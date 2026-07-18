-- Bonus claims: two extra rewards per 7-day cycle, unlocked when the user
-- claims day 3 and day 7 of the daily streak.
-- Run this in the Supabase SQL editor.
-- Note: user_id is uuid to match blaze_daily_claims.user_id — change the type
-- here if your user ids are stored as text.

create table if not exists public.blaze_bonus_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  day_number integer not null check (day_number in (3, 7)),
  amount integer not null,
  is_claimed boolean not null default false,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day_number)
);

create index if not exists idx_blaze_bonus_claims_user
  on public.blaze_bonus_claims (user_id);

-- No policies: only the service role key (used by the API routes) can access it.
alter table public.blaze_bonus_claims enable row level security;
