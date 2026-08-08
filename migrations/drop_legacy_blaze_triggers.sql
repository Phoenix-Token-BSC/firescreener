-- Fixes signup failing with:
--   42P01 relation "user_blaze_stats" does not exist
-- on INSERT into auth_users (and the same on developer_accounts).
--
-- Background: consolidate_blaze_into_user_tables.sql moved all blaze state onto
-- the user row (total_blazes_claimed, blaze_streak_day, blaze_claimed_days,
-- blaze_bonus_claimed_days, blaze_last_claim_at) and retired user_blaze_stats
-- and blaze_daily_claims. Two AFTER INSERT triggers were left behind that still
-- provision rows in those retired tables, so every new signup aborts. They were
-- created directly in the SQL editor and were never tracked in this repo.
--
-- No replacement is needed. The column defaults on auth_users and
-- developer_accounts (0 / 1 / 0 / 0 / null) already are the fresh state that
-- src/lib/blazeUser.ts and the claim routes expect — see the comment in
-- src/app/api/blaze/history/route.ts: "New users need no initialization".
--
-- Dropped for the record:
--
--   create_user_blaze_stats()   AFTER INSERT ON auth_users
--     INSERT INTO user_blaze_stats (user_id, current_streak_day, total_blaze_earned)
--     VALUES (NEW.id, 1, 0);
--     FOR i IN 1..7 LOOP
--       INSERT INTO blaze_daily_claims (user_id, day_number, amount, is_claimed, claimed_at)
--       VALUES (NEW.id, i, 10, FALSE, NULL);
--     END LOOP;
--
--   initialize_developer_blaze()  AFTER INSERT ON developer_accounts, SECURITY DEFINER
--     INSERT INTO public.user_blaze_stats (user_id, total_blaze_earned, current_streak_day, is_active_today)
--     VALUES (new.id, 0, 1, false) ON CONFLICT (user_id) DO NOTHING;
--     INSERT INTO public.blaze_daily_claims (user_id, day_number, amount, is_claimed, claimed_at)
--     SELECT new.id, day_num, 10, false, NULL FROM generate_series(1, 7) AS day_num
--     ON CONFLICT (user_id, day_number) DO NOTHING;
--
-- Both touch only the retired tables, so dropping them removes no live
-- behaviour. The BEFORE UPDATE timestamp triggers on both tables
-- (update_auth_users_timestamp, developer_accounts_updated_at) are unrelated
-- and must stay.
--
-- Run this in the Supabase SQL editor.

begin;

drop trigger if exists trigger_create_blaze_stats on public.auth_users;
drop trigger if exists initialize_developer_blaze_trigger on public.developer_accounts;

drop function if exists public.create_user_blaze_stats();
drop function if exists public.initialize_developer_blaze();

commit;

-- Verify: should return only the two BEFORE UPDATE timestamp triggers.

select c.relname as table_name,
       t.tgname  as trigger_name,
       p.proname as function_name
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc  p on p.oid = t.tgfoid
where not t.tgisinternal
  and c.relname in ('auth_users', 'developer_accounts')
order by c.relname, t.tgname;
