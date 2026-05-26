-- Run this in the Supabase SQL editor (Dashboard → SQL editor → New query)

create table if not exists price_alerts (
  id               uuid        primary key default gen_random_uuid(),
  subscription_id  text        not null,          -- OneSignal subscription ID
  chain            text        not null,          -- 'bsc' | 'eth' | 'sol' | 'rwa'
  contract_address text        not null,          -- lowercased
  token_symbol     text        not null,
  type             text        not null check (type in ('price_above', 'price_below')),
  threshold        numeric     not null,
  triggered        boolean     not null default false,
  created_at       timestamptz not null default now()
);

-- Speed up the cron worker's "get all non-triggered" query
create index if not exists price_alerts_triggered_idx
  on price_alerts (triggered)
  where triggered = false;

-- Speed up per-device + per-token lookups from the client
create index if not exists price_alerts_subscription_token_idx
  on price_alerts (subscription_id, chain, contract_address);

-- Disable RLS — rows are keyed by subscription_id (anonymous device token),
-- and writes go through the service-role key (server only).
alter table price_alerts disable row level security;
