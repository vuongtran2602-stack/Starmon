-- Starmon persistence schema for project jymjumdypgunipgjkjak.
-- The project's public.accounts table is reserved for Supabase Auth profiles.
-- Game accounts use a separate table so they do not conflict with its auth.users FK.
create table if not exists public.starmon_accounts (
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
  arena text not null default 'Sunken Sands',
  status text not null default 'WAITING',
  players jsonb not null default '[]'::jsonb,
  match_state jsonb,
  created_at bigint not null default 0,
  updated_at bigint not null default 0
);

alter table public.pvp_rooms alter column arena set default 'Sunken Sands';
create index if not exists pvp_rooms_status_idx on public.pvp_rooms (status);

alter table public.starmon_accounts enable row level security;
revoke all on public.starmon_accounts from anon, authenticated;
grant all on public.starmon_accounts to service_role;

alter table public.pvp_rooms enable row level security;
grant select, insert, update, delete on public.pvp_rooms to anon, authenticated;
grant all on public.pvp_rooms to service_role;
drop policy if exists "Public access to PvP rooms" on public.pvp_rooms;
create policy "Public access to PvP rooms" on public.pvp_rooms
  for all to anon, authenticated using (true) with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pvp_rooms'
  ) then
    execute 'alter publication supabase_realtime add table public.pvp_rooms';
  end if;
end $$;

notify pgrst, 'reload schema';
