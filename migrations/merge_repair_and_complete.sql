-- REPAIR + COMPLETE the identity merge.
--
-- Run this INSTEAD of merge_identities_into_profiles.sql. That file assumed a clean
-- start; this one is written against the database's ACTUAL measured state after the
-- partial run, and finishes the job.
--
-- ── Measured state this script assumes ────────────────────────────────────────
--
--   auth_users          431   untouched
--   developer_accounts   81   (the 9 duplicate rows were already deleted)
--   auth.users           81   the import of auth_users NEVER ran
--   profiles             81   developer-only rows, is_developer = true
--   emails in both tables  0   the duplicates are already resolved
--   FKs -> developer_accounts  already dropped
--   tokens.developer_id  4 rows already repointed to user-side UUIDs
--
-- If those numbers do not match, STOP — step 0 checks them and aborts.
--
-- ── Two problems being repaired ───────────────────────────────────────────────
--
-- 1. _merge_dupes is contaminated. It holds 9 genuine duplicate pairs plus 422 bogus
--    self-pairs where keep_id = retire_id. Feeding that into the profiles insert would
--    flag ~431 ordinary users as developers. Only the 9 real pairs are kept.
--
-- 2. A trigger on auth.users inserts into developer_accounts. That is what produced the
--    422 self-pairs, and it will fire again on the 431-row import below, recreating the
--    mess. It is dropped first — developer_accounts is being retired anyway, and
--    /api/dev/verify now grants the developer capability explicitly instead.

BEGIN;

-- ── 0. Refuse to run against an unexpected state ──────────────────────────────

DO $$
DECLARE n_au int; n_da int; n_pr int; n_dupe_emails int;
BEGIN
  SELECT count(*) INTO n_au FROM auth_users;
  SELECT count(*) INTO n_da FROM developer_accounts;
  SELECT count(*) INTO n_pr FROM profiles;
  SELECT count(*) INTO n_dupe_emails
    FROM auth_users a JOIN developer_accounts d ON lower(d.email) = lower(a.email);

  IF n_pr <> n_da THEN
    RAISE EXCEPTION 'expected profiles (%) to equal developer_accounts (%) — state is not what this repair assumes', n_pr, n_da;
  END IF;
  IF n_dupe_emails <> 0 THEN
    RAISE EXCEPTION '% duplicate emails still present — the duplicate merge did not complete', n_dupe_emails;
  END IF;
  RAISE NOTICE 'state OK: % auth_users to import, % existing developer profiles', n_au, n_pr;
END $$;

-- ── 1. Drop the trigger that mirrors auth.users into developer_accounts ───────
-- Reported by name so there is a record of what was removed.

DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT tg.tgname, p.proname
    FROM pg_trigger tg
    JOIN pg_class c ON c.oid = tg.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = tg.tgfoid
    WHERE n.nspname = 'auth' AND c.relname = 'users' AND NOT tg.tgisinternal
  LOOP
    RAISE NOTICE 'dropping trigger auth.users.% (function %)', t.tgname, t.proname;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users', t.tgname);
  END LOOP;
END $$;

-- ── 2. Rebuild the duplicate snapshot from the 9 REAL pairs only ──────────────
-- keep_id = retire_id is a row that matched itself, not a duplicate.

CREATE TABLE IF NOT EXISTS _merge_dupes_clean AS
SELECT * FROM _merge_dupes WHERE keep_id <> retire_id;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM _merge_dupes_clean;
  IF n = 0 THEN
    RAISE EXCEPTION 'no genuine duplicate pairs recovered — the blaze snapshot for merged accounts would be lost';
  END IF;
  RAISE NOTICE 'recovered % genuine duplicate pairs', n;
END $$;

-- ── 3. Import auth_users into Supabase Auth ───────────────────────────────────
-- The duplicate developer rows are already gone, so no email collides.

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  a.id, 'authenticated', 'authenticated',
  lower(a.email),
  a.password_hash,
  CASE WHEN a.is_email_verified THEN COALESCE(a.email_verified_at, a.created_at) END,
  a.created_at,
  COALESCE(a.updated_at, a.created_at),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('username', a.username),
  '', '', '', ''
FROM auth_users a
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = a.id)
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(a.email));

-- Password sign-in needs a matching identity row.
DO $$
DECLARE has_provider_id boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'provider_id'
  ) INTO has_provider_id;

  EXECUTE format($f$
    INSERT INTO auth.identities (id, user_id, identity_data, provider, %s last_sign_in_at, created_at, updated_at)
    SELECT gen_random_uuid(), a.id,
           jsonb_build_object('sub', a.id::text, 'email', lower(a.email),
                              'email_verified', COALESCE(a.is_email_verified, false)),
           'email', %s a.last_login, a.created_at, COALESCE(a.updated_at, a.created_at)
    FROM auth_users a
    WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = a.id)
      AND NOT EXISTS (SELECT 1 FROM auth.identities i
                      WHERE i.user_id = a.id AND i.provider = 'email')
  $f$,
    CASE WHEN has_provider_id THEN 'provider_id,' ELSE '' END,
    CASE WHEN has_provider_id THEN 'a.id::text,'  ELSE '' END
  );
END $$;

-- ── 4. Undo anything the trigger created before it was dropped ────────────────
-- Belt and braces: if a mirrored row slipped in, remove it so developer_accounts still
-- means "genuine developer" for the checks below.

DELETE FROM developer_accounts d
WHERE EXISTS (SELECT 1 FROM auth_users a WHERE a.id = d.id);

-- ── 5. Populate profiles for the imported users ───────────────────────────────
-- is_developer comes ONLY from the 9 recovered pairs. Blaze is summed with the
-- developer-side snapshot. Colliding usernames are suffixed.

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY lower(username)
           ORDER BY (username = lower(username)) DESC, created_at ASC
         ) AS rn
  FROM auth_users
)
INSERT INTO profiles (
  id, username, email, is_developer, is_active,
  total_blazes_claimed, blaze_streak_day, blaze_claimed_days,
  blaze_bonus_claimed_days, blaze_last_claim_at, created_at, updated_at
)
SELECT
  a.id,
  CASE WHEN r.rn > 1 THEN a.username || r.rn::text ELSE a.username END,
  lower(a.email),
  (x.keep_id IS NOT NULL),
  COALESCE(a.is_active, true),
  COALESCE(a.total_blazes_claimed, 0)     + COALESCE(x.d_total, 0),
  GREATEST(COALESCE(a.blaze_streak_day, 1),         COALESCE(x.d_streak, 1)),
  GREATEST(COALESCE(a.blaze_claimed_days, 0),       COALESCE(x.d_days, 0)),
  GREATEST(COALESCE(a.blaze_bonus_claimed_days, 0), COALESCE(x.d_bonus, 0)),
  GREATEST(a.blaze_last_claim_at, x.d_last),
  a.created_at,
  COALESCE(a.updated_at, a.created_at)
FROM auth_users a
JOIN ranked r ON r.id = a.id
LEFT JOIN _merge_dupes_clean x ON x.keep_id = a.id
WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = a.id)
ON CONFLICT (id) DO NOTHING;

-- ── 6. Restore token ownership against profiles ───────────────────────────────

ALTER TABLE tokens DROP CONSTRAINT IF EXISTS tokens_developer_id_fkey;
ALTER TABLE tokens
  ADD CONSTRAINT tokens_developer_id_fkey
  FOREIGN KEY (developer_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- ── 7. Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_all  ON profiles;
DROP POLICY IF EXISTS profiles_update_self ON profiles;

CREATE POLICY profiles_select_all ON profiles FOR SELECT USING (true);
CREATE POLICY profiles_update_self ON profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ── 8. Verify ─────────────────────────────────────────────────────────────────

DO $$
DECLARE
  n_profiles int; n_devs int; n_expected int;
  n_orphan_u int; n_orphan_d int; n_no_ident int; n_bad_owner int;
BEGIN
  SELECT count(*) INTO n_profiles FROM profiles;
  SELECT count(*) INTO n_devs     FROM profiles WHERE is_developer;
  SELECT (SELECT count(*) FROM auth_users) + (SELECT count(*) FROM developer_accounts)
    INTO n_expected;

  SELECT count(*) INTO n_orphan_u FROM auth_users a
    WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = a.id);
  SELECT count(*) INTO n_orphan_d FROM developer_accounts d
    WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = d.id);
  SELECT count(*) INTO n_no_ident FROM profiles p
    WHERE NOT EXISTS (SELECT 1 FROM auth.identities i
                      WHERE i.user_id = p.id AND i.provider = 'email');
  SELECT count(*) INTO n_bad_owner FROM tokens t
    WHERE t.developer_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = t.developer_id);

  IF n_profiles <> n_expected THEN
    RAISE EXCEPTION 'profiles=% but expected %', n_profiles, n_expected;
  END IF;
  IF n_orphan_u > 0 OR n_orphan_d > 0 THEN
    RAISE EXCEPTION '% users and % developers have no profile', n_orphan_u, n_orphan_d;
  END IF;
  IF n_no_ident > 0 THEN
    RAISE EXCEPTION '% profiles cannot sign in (no email identity)', n_no_ident;
  END IF;
  IF n_bad_owner > 0 THEN
    RAISE EXCEPTION '% tokens point at a developer_id with no profile', n_bad_owner;
  END IF;
  -- The developer count must be the 81 existing + the 9 merged, not 400-odd.
  IF n_devs > (SELECT count(*) FROM developer_accounts) + (SELECT count(*) FROM _merge_dupes_clean) THEN
    RAISE EXCEPTION 'developer count % is implausibly high — is_developer was set too broadly', n_devs;
  END IF;

  RAISE NOTICE 'OK: % profiles, % developers, all token owners valid.', n_profiles, n_devs;
END $$;

-- Must equal the pre-migration total (54650 when measured).
SELECT sum(total_blazes_claimed) AS total_blaze_after FROM profiles;

-- ── 9. Clean up scratch tables ────────────────────────────────────────────────

DROP TABLE IF EXISTS _merge_dupes;
DROP TABLE IF EXISTS _merge_dupes_clean;

COMMIT;
