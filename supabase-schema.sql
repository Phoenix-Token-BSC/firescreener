-- Run this in the Supabase SQL editor (Dashboard → SQL editor → New query)
-- If you ran the previous schema, drop the old table first:
--   drop table if exists price_alerts;

create table if not exists price_alerts (
  id               uuid        primary key default gen_random_uuid(),
  device_id        text        not null,          -- stable localStorage UUID (always available)
  push_token       text,                          -- OneSignal subscription ID (nullable, set async)
  chain            text        not null,          -- 'bsc' | 'eth' | 'sol' | 'rwa'
  contract_address text        not null,          -- lowercased
  token_symbol     text        not null,
  type             text        not null check (type in ('price_above', 'price_below')),
  threshold        numeric     not null,
  triggered        boolean     not null default false,
  created_at       timestamptz not null default now()
);

-- Speed up the cron worker's "get all non-triggered with push_token" query
create index if not exists price_alerts_triggered_idx
  on price_alerts (triggered)
  where triggered = false;

-- Speed up per-device + per-token lookups from the client
create index if not exists price_alerts_device_token_idx
  on price_alerts (device_id, chain, contract_address);

alter table price_alerts disable row level security;
