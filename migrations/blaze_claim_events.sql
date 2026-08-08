-- Append-only ledger of blaze point credits (daily and bonus claims), written
-- by the claim routes after each successful balance update. Balances stay on
-- the user row; this table exists so every credit is explainable after the
-- fact (support disputes, reconciliation, earning-over-time analytics).
-- Redemptions are already logged in reward_claims.
-- Run this in the Supabase SQL editor.

create table if not exists public.blaze_claim_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('daily', 'bonus')),
  day_number integer not null check (day_number between 1 and 7),
  amount integer not null,
  claimed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_blaze_claim_events_user
  on public.blaze_claim_events (user_id, claimed_at desc);

-- No policies: only the service role key (used by the API routes) can access it.
alter table public.blaze_claim_events enable row level security;
