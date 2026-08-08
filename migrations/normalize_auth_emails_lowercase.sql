-- Normalize every stored email to lowercase, and stop mixed-case duplicates
-- from being created again.
--
-- Why: login matches email with a case-sensitive `=`:
--
--   src/app/api/auth/login/route.ts:30
--     .or(`email.eq.${login},username.eq.${login}`)
--
-- so `John@Gmail.com` and `john@gmail.com` are different accounts as far as
-- both login and the signup duplicate-check are concerned.
--
-- IMPORTANT — this migration is only half the fix. Lowercasing the column
-- while login still compares the raw user input flips the failure around:
-- users who signed up with capitals and type capitals will start failing.
-- Ship the route change (lowercase the email side of the comparison) in the
-- SAME deploy as this migration. See the note at the bottom.
--
-- RUN THIS IN THE SUPABASE SQL EDITOR, step by step. Steps 1-2 are read-only
-- audits; do not run step 4 until step 2 returns zero rows.

-- ── 1. Audit: is the column already citext, and who is affected? ───────────────

select table_name, column_name, data_type, udt_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('auth_users', 'developer_accounts', 'email_verification')
  and column_name = 'email';
-- If udt_name is already `citext`, comparisons are case-insensitive and there
-- is no login bug to fix — stop here.

select id, username, email, created_at, last_login
from public.auth_users
where email <> lower(email)
order by created_at;

-- ── 2. Collisions — MUST return zero rows before step 4 ───────────────────────
--
-- Two accounts that differ only by case cannot both survive lowercasing.

select lower(email) as normalized,
       count(*)     as accounts,
       array_agg(id      order by created_at) as ids,
       array_agg(email   order by created_at) as emails,
       array_agg(username order by created_at) as usernames,
       array_agg(created_at order by created_at) as created,
       array_agg(last_login order by created_at) as last_logins
from public.auth_users
group by lower(email)
having count(*) > 1;

-- ── 3. Resolve collisions by hand (only if step 2 returned rows) ──────────────
--
-- Decide per pair which account is real — usually the one with a non-null
-- last_login, or with blaze/reward state worth keeping. Check before deleting:
--
--   select id, email, blaze_streak, blaze_claimed_days, total_rewards
--   from public.auth_users where id in ('<id-a>', '<id-b>');
--
--   select user_id, count(*) from public.sessions
--   where user_id in ('<id-a>', '<id-b>') group by user_id;
--
-- Then either park the loser rather than dropping it (reversible, preferred):
--
--   update public.auth_users
--   set email = lower(email) || '.dup-' || left(id::text, 8),
--       is_active = false
--   where id = '<losing-id>';
--
-- ...or delete it, after clearing dependent rows:
--
--   delete from public.sessions            where user_id = '<losing-id>';
--   delete from public.email_verification  where user_id = '<losing-id>';
--   delete from public.auth_users          where id      = '<losing-id>';

-- ── 4. Normalize ──────────────────────────────────────────────────────────────
--
-- Wrapped in a transaction so a unique-violation from an unresolved collision
-- rolls the whole thing back instead of leaving the table half-converted.
--
-- The Supabase SQL editor already opens a transaction around each run, so the
-- explicit begin/commit below logs "there is already a transaction in progress"
-- and "there is no transaction in progress". Both are warnings, not errors, and
-- the all-or-nothing behaviour still holds. Run steps 4 and 5 as separate runs.

begin;

update public.auth_users
set email = lower(email)
where email <> lower(email);

-- email_verification stores the address the code was mailed to; keep it in
-- step so re-send / audit lookups by email still line up.
update public.email_verification
set email = lower(email)
where email <> lower(email);

-- developer_accounts is read by src/app/api/auth/user-type/route.ts:68 with the
-- same case-sensitive `=`. Supabase Auth lowercases its own auth.users.email,
-- so this row copy is the only one that can drift.
update public.developer_accounts
set email = lower(email)
where email <> lower(email);

commit;

-- ── 5. Prevent recurrence ─────────────────────────────────────────────────────
--
-- A plain `unique(email)` does not stop `John@x.com` + `john@x.com`. A unique
-- index on the expression does.
--
-- NOT built CONCURRENTLY: the Supabase SQL editor wraps every run in an
-- implicit transaction, and `CREATE INDEX CONCURRENTLY` errors inside one
-- (25001). A plain build takes an ACCESS EXCLUSIVE lock on the table, which at
-- this row count is milliseconds — logins and signups block for that instant
-- and then proceed. Acceptable here.
--
-- If auth_users ever grows to where that lock matters, build it concurrently
-- from a direct psql session instead (Supabase → Project Settings → Database →
-- connection string), where there is no wrapping transaction:
--
--   psql "$DATABASE_URL" -c "create unique index concurrently auth_users_email_lower_key on public.auth_users (lower(email));"

create unique index if not exists auth_users_email_lower_key
  on public.auth_users (lower(email));

create unique index if not exists developer_accounts_email_lower_key
  on public.developer_accounts (lower(email));

-- Belt and braces: normalize on write, so a route that forgets to lowercase
-- cannot reintroduce the problem. Note the repo already carries a trigger it
-- did not track (see drop_legacy_blaze_triggers.sql and
-- fix_solana_address_casing.sql) — inspect what exists before adding:
--
--   select t.tgname, p.proname, pg_get_functiondef(p.oid)
--   from pg_trigger t
--   join pg_class c on c.oid = t.tgrelid
--   join pg_proc  p on p.oid = t.tgfoid
--   where c.relname in ('auth_users', 'developer_accounts')
--     and not t.tgisinternal;

create or replace function public.lowercase_email()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(new.email);
  return new;
end;
$$;

drop trigger if exists auth_users_lowercase_email on public.auth_users;
create trigger auth_users_lowercase_email
  before insert or update of email on public.auth_users
  for each row execute function public.lowercase_email();

drop trigger if exists developer_accounts_lowercase_email on public.developer_accounts;
create trigger developer_accounts_lowercase_email
  before insert or update of email on public.developer_accounts
  for each row execute function public.lowercase_email();

-- ── 6. Verify — every query below should return zero rows ─────────────────────

select id, email from public.auth_users          where email <> lower(email);
select id, email from public.developer_accounts  where email <> lower(email);
select id, email from public.email_verification  where email <> lower(email);

-- ── 7. Required application change (NOT optional) ─────────────────────────────
--
-- src/app/api/auth/login/route.ts — lowercase the email side of the match.
-- `login` may be a username, and usernames are stored case-preserved, so the
-- input cannot simply be lowercased wholesale:
--
--   const identifier = String(login).trim();
--   const emailCandidate = identifier.toLowerCase();
--   .or(`email.eq.${emailCandidate},username.eq.${identifier}`)
--
-- src/app/api/auth/signup/route.ts:63  — .eq('email', email.trim().toLowerCase())
--   and insert the lowercased value at line 111.
-- src/app/api/auth/user-type/route.ts:68,86 — same, .eq('email', email.toLowerCase()).
--
-- Separately: `login` is interpolated straight into the PostgREST `.or()`
-- filter. A value containing `,` `.` or `)` rewrites the filter expression.
-- Worth fixing while this file is open, but it is a distinct bug from the
-- casing one.
