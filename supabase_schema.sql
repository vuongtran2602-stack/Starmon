-- Schema expected by the Starmon server-side Supabase adapter.
-- Run this in the Supabase SQL editor only if these tables do not already exist.
create table if not exists public.accounts (
  username text primary key,
  account_id text unique,
  pin text not null default '',
  google_id text not null default '',
  email text not null default '',
  created_at timestamptz not null default now(),
  last_played_at timestamptz not null default now(),
  player jsonb not null default '{}'::jsonb,
  starmons jsonb not null default '[]'::jsonb,
  quests jsonb not null default '[]'::jsonb
);

create table if not exists public.pvp_rooms (
  room_code text primary key,
  code text,
  host_id text not null,
  host_name text not null,
  host_level integer not null default 1,
  guest_name text not null default '',
  guest_level integer not null default 1,
  arena text not null default 'Celestial Sanctuary',
  status text not null default 'WAITING',
  players jsonb not null default '[]'::jsonb,
  match_state jsonb,
  created_at bigint not null default 0,
  updated_at bigint not null default 0
);

create index if not exists pvp_rooms_status_idx on public.pvp_rooms (status);
