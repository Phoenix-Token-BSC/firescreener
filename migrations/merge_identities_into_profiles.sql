-- Merge auth_users + developer_accounts into ONE identity: Supabase Auth + `profiles`.
--
-- RUN IN THE SUPABASE SQL EDITOR. BACK UP FIRST — this writes to auth.users.
--
-- Works either way:
--   * Whole file at once (preferred): the BEGIN/COMMIT wrapper makes it atomic, so any
--     failure rolls everything back and the database is untouched.
--   * Section by section: also fine. Each step is guarded and idempotent, and the
--     scratch table in step 2 is a real table precisely so it survives between runs.
--     You lose atomicity, so a failure leaves earlier steps applied — re-running from
--     the top is safe and picks up where it stopped.
--
-- Nothing here is destructive to accounts. The only DELETEs are scoped to the duplicate
-- developer-side rows (step 7); every person keeps an account.
--
-- ── Why this shape ────────────────────────────────────────────────────────────
--
-- Before: two unrelated login systems.
--   auth_users           own bcrypt password_hash
--   developer_accounts   backed by Supabase auth.users
--   A handful of people had an account in BOTH, with different UUIDs and diverging
--   blaze state.
--
-- After: one row per person in auth.users, one profile row, and `is_developer` as a
-- capability rather than a separate account.
--
-- Two facts make this safe:
--   * auth_users.password_hash is bcrypt ($2b$10$…), the same format Supabase Auth
--     stores in auth.users.encrypted_password — passwords carry over, nobody resets.
--   * auth.users.id accepts a supplied UUID, so existing IDs are preserved and no
--     foreign key value needs rewriting except for the duplicated accounts.
--
-- auth_users is never written to. developer_accounts loses only the duplicate rows.
-- Both survive as the rollback path.
--
-- Decisions applied, as agreed:
--   * blaze balances for duplicates are SUMMED; streak/claimed-day fields take the max.
--   * duplicates keep their REGULAR-USER password; the developer credential is retired.
--
-- ── Ordering matters ──────────────────────────────────────────────────────────
--
-- tokens.developer_id has a foreign key to developer_accounts(id). That table is being
-- retired, so the constraint has to be moved to profiles(id) BEFORE any developer_id
-- value is repointed at a user-side UUID — and profiles has to be populated first, or
-- the new constraint has nothing to point at. Hence: import → populate → move FK →
-- repoint → delete. Getting this order wrong is what produced
--   ERROR 23503 … violates foreign key constraint "tokens_developer_id_fkey"

-- Run this FIRST, on its own, and keep the number. Step 9 checks it is unchanged.
--
--   SELECT (SELECT COALESCE(sum(total_blazes_claimed),0) FROM auth_users)
--        + (SELECT COALESCE(sum(total_blazes_claimed),0) FROM developer_accounts)
--        AS total_blaze_before;

BEGIN;

-- ── 0. Preconditions ──────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'auth_users') THEN
    RAISE EXCEPTION 'auth_users not found — nothing to migrate';
  END IF;
  IF EXISTS (SELECT 1 FROM auth_users
             WHERE password_hash IS NOT NULL AND password_hash NOT LIKE '$2%') THEN
    RAISE EXCEPTION 'auth_users contains non-bcrypt password hashes; they cannot be imported as-is';
  END IF;
END $$;

-- ── 1. The profiles table ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id                       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username                 text NOT NULL,
  email                    text NOT NULL,
  is_developer             boolean NOT NULL DEFAULT false,
  is_active                boolean NOT NULL DEFAULT true,
  display_name             text,
  avatar_url               text,
  total_blazes_claimed     integer NOT NULL DEFAULT 0,
  blaze_streak_day         integer NOT NULL DEFAULT 1,
  blaze_claimed_days       integer NOT NULL DEFAULT 0,
  blaze_bonus_claimed_days integer NOT NULL DEFAULT 0,
  blaze_last_claim_at      timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Login lowercases whatever the user types, so usernames must be unique
-- case-insensitively or two accounts can never both be reachable by name.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uniq ON profiles (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_uniq    ON profiles (lower(email));
CREATE INDEX        IF NOT EXISTS profiles_is_developer_idx    ON profiles (is_developer) WHERE is_developer;

-- ── 2. Snapshot the duplicated accounts ───────────────────────────────────────
-- Same email in both tables = one person with two accounts. The user-side UUID wins.
-- The developer-side blaze state is captured here because its row is deleted in step 7
-- but the balance is still needed in step 5.

-- A REAL table, not a TEMP one. A temp table with ON COMMIT DROP disappears the moment
-- its statement commits, so it is gone by the next section if this file is run a piece
-- at a time — which produced:
--   ERROR 42P01: relation "dupes" does not exist
-- This survives either way, and step 11 drops it once the migration is done.
DROP TABLE IF EXISTS _merge_dupes;

CREATE TABLE _merge_dupes AS
SELECT a.id AS keep_id, d.id AS retire_id, lower(a.email) AS email,
       COALESCE(d.total_blazes_claimed, 0)     AS d_total,
       COALESCE(d.blaze_streak_day, 1)         AS d_streak,
       COALESCE(d.blaze_claimed_days, 0)       AS d_days,
       COALESCE(d.blaze_bonus_claimed_days, 0) AS d_bonus,
       d.blaze_last_claim_at                   AS d_last
FROM auth_users a
JOIN developer_accounts d ON lower(d.email) = lower(a.email);

-- Not reachable through the API: new tables get no grants to anon/authenticated.
REVOKE ALL ON _merge_dupes FROM PUBLIC;

-- ── 3. Import auth_users into Supabase Auth ───────────────────────────────────
-- IDs are preserved, so no foreign key VALUE needs to change for these accounts.

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

-- Password sign-in needs a matching identity row, not just the users row.
-- auth.identities.provider_id only exists on newer Supabase, and naming a missing
-- column would abort everything — so the column list is built to match this project.
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

-- ── 4. Populate profiles from auth_users ──────────────────────────────────────
--
-- Both transformations happen HERE, in the read, so auth_users stays byte-for-byte
-- unchanged and remains a genuine rollback path:
--
--   * blaze is summed with the retiring developer row's snapshot (_merge_dupes.d_*);
--   * colliding usernames are suffixed. Only an all-lowercase username is reachable at
--     login, so that spelling keeps the name and other casings are suffixed.

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
LEFT JOIN _merge_dupes x ON x.keep_id = a.id
WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = a.id)
ON CONFLICT (id) DO NOTHING;

-- ── 5. Populate profiles from developer-only accounts ─────────────────────────
-- The duplicates are excluded: their person already has a profile from step 4.

INSERT INTO profiles (
  id, username, email, is_developer, is_active, display_name, avatar_url,
  total_blazes_claimed, blaze_streak_day, blaze_claimed_days,
  blaze_bonus_claimed_days, blaze_last_claim_at, created_at, updated_at
)
SELECT
  d.id, d.username, lower(d.email), true, true, d.display_name, d.avatar_url,
  COALESCE(d.total_blazes_claimed, 0),
  COALESCE(d.blaze_streak_day, 1),
  COALESCE(d.blaze_claimed_days, 0),
  COALESCE(d.blaze_bonus_claimed_days, 0),
  d.blaze_last_claim_at,
  d.created_at,
  COALESCE(d.updated_at, d.created_at)
FROM developer_accounts d
WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = d.id)
  AND NOT EXISTS (SELECT 1 FROM _merge_dupes x WHERE x.retire_id = d.id)
ON CONFLICT (id) DO NOTHING;

-- ── 6. Move foreign keys off developer_accounts ───────────────────────────────
--
-- Every profile now exists, so constraints can point at profiles instead. Any FK still
-- referencing developer_accounts is dropped (and reported), because that table is being
-- retired. This is the step whose absence caused the 23503 error.

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname, rel.relname AS tbl
    FROM pg_constraint con
    JOIN pg_class rel  ON rel.oid = con.conrelid
    JOIN pg_class fref ON fref.oid = con.confrelid
    WHERE con.contype = 'f' AND fref.relname = 'developer_accounts'
  LOOP
    RAISE NOTICE 'dropping FK %.% -> developer_accounts', c.tbl, c.conname;
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', c.tbl, c.conname);
  END LOOP;
END $$;

-- ── 7. Repoint and retire the duplicates ──────────────────────────────────────
-- Now safe: the old constraint is gone and every keep_id has a profile.

UPDATE tokens t SET developer_id = x.keep_id FROM _merge_dupes x WHERE t.developer_id = x.retire_id;
UPDATE tokens t SET submitted_by = x.keep_id FROM _merge_dupes x WHERE t.submitted_by = x.retire_id;
UPDATE blaze_claim_events e SET user_id = x.keep_id FROM _merge_dupes x WHERE e.user_id = x.retire_id;

-- Retire the DUPLICATE DEVELOPER-SIDE ROW ONLY — scoped to retire_id, never keep_id.
-- Nobody loses an account: the surviving user-side account has already absorbed the
-- developer capability and the blaze balance.
DELETE FROM developer_accounts d USING _merge_dupes x WHERE d.id = x.retire_id;
DELETE FROM auth.users u        USING _merge_dupes x WHERE u.id = x.retire_id;

-- ── 8. Re-establish the ownership constraint against profiles ─────────────────

ALTER TABLE tokens
  ADD CONSTRAINT tokens_developer_id_fkey
  FOREIGN KEY (developer_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- ── 9. Row Level Security ─────────────────────────────────────────────────────
-- Profiles are readable (usernames appear publicly), but a person may only edit their
-- own, and nobody may grant themselves is_developer from the client.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_all  ON profiles;
DROP POLICY IF EXISTS profiles_update_self ON profiles;

CREATE POLICY profiles_select_all ON profiles FOR SELECT USING (true);
CREATE POLICY profiles_update_self ON profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
-- No INSERT/DELETE policy: those go through the service role only.

-- ── 10. Verify before committing ──────────────────────────────────────────────
-- Invariants, not fixed numbers: this is a live site and the counts move.

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
    RAISE EXCEPTION 'profiles=% but expected % (auth_users + developer_accounts)', n_profiles, n_expected;
  END IF;
  IF n_orphan_u > 0 OR n_orphan_d > 0 THEN
    RAISE EXCEPTION '% legacy users and % legacy developers have no profile', n_orphan_u, n_orphan_d;
  END IF;
  IF n_no_ident > 0 THEN
    RAISE EXCEPTION '% profiles have no email identity — they could not sign in', n_no_ident;
  END IF;
  IF n_bad_owner > 0 THEN
    RAISE EXCEPTION '% tokens point at a developer_id with no profile', n_bad_owner;
  END IF;

  RAISE NOTICE 'OK: % profiles (% developers), no orphans, all token owners valid.',
    n_profiles, n_devs;
END $$;

-- Must equal total_blaze_before from the top of this file.
SELECT sum(total_blazes_claimed) AS total_blaze_after FROM profiles;

-- ── 11. Clean up the scratch table ────────────────────────────────────────────
-- Only after every step above has used it. Keep it until then: if you are running this
-- section by section and something fails, this table is what lets you resume.

DROP TABLE IF EXISTS _merge_dupes;

COMMIT;

-- ── 12. Afterwards ────────────────────────────────────────────────────────────
-- auth_users and developer_accounts are untouched apart from the deleted duplicate
-- developer rows, and nothing reads them once the app is deployed. They are the
-- rollback path — drop them only once you are satisfied:
--
--   ALTER TABLE auth_users         RENAME TO auth_users_legacy;
--   ALTER TABLE developer_accounts RENAME TO developer_accounts_legacy;
