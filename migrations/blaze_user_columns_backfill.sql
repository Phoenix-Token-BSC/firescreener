-- Blaze state on the user row: adds the columns the claim/bonus-claim/history/
-- redeem routes read (see src/lib/blazeUser.ts), then backfills balances from
-- the old user_blaze_stats table so existing users keep their points.
-- Run this in the Supabase SQL editor.
--
-- The backfill is additive (old balance + anything earned since the new code
-- deployed) and guarded by user_blaze_stats.blaze_backfilled_at, so re-running
-- this file is safe: already-backfilled rows are skipped.
 
-- 1. Columns

alter table public.auth_users
  add column if not exists total_blazes_claimed integer not null default 0,
  add column if not exists blaze_streak_day integer not null default 1,
  add column if not exists blaze_claimed_days integer not null default 0,
  add column if not exists blaze_bonus_claimed_days integer not null default 0,
  add column if not exists blaze_last_claim_at timestamptz;

alter table public.developer_accounts
  add column if not exists total_blazes_claimed integer not null default 0,
  add column if not exists blaze_streak_day integer not null default 1,
  add column if not exists blaze_claimed_days integer not null default 0,
  add column if not exists blaze_bonus_claimed_days integer not null default 0,
  add column if not exists blaze_last_claim_at timestamptz;

-- 2. Backfill marker on the old table

alter table public.user_blaze_stats
  add column if not exists blaze_backfilled_at timestamptz;

-- 3. Backfill balances
-- Each statement marks the old rows as backfilled and credits the matching
-- user table in one go, so a row can never be credited twice.

with pending as (
  update public.user_blaze_stats s
  set blaze_backfilled_at = now()
  where s.blaze_backfilled_at is null
    and exists (select 1 from public.auth_users u where u.id = s.user_id)
  returning s.user_id, s.total_blaze_earned
)
update public.auth_users u
set total_blazes_claimed = u.total_blazes_claimed + p.total_blaze_earned
from pending p
where u.id = p.user_id
  and p.total_blaze_earned > 0;

with pending as (
  update public.user_blaze_stats s
  set blaze_backfilled_at = now()
  where s.blaze_backfilled_at is null
    and exists (select 1 from public.developer_accounts d where d.id = s.user_id)
  returning s.user_id, s.total_blaze_earned
)
update public.developer_accounts d
set total_blazes_claimed = d.total_blazes_claimed + p.total_blaze_earned
from pending p
where d.id = p.user_id
  and p.total_blaze_earned > 0;
