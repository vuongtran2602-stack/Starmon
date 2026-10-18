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

-- CREATE TABLE IF NOT EXISTS does not add columns to an existing table. Older
-- deployments already have pvp_rooms, so add the runtime snapshot explicitly
-- before installing the ownership RPC below.
alter table public.pvp_rooms
  add column if not exists match_state jsonb;

alter table public.pvp_rooms alter column arena set default 'Sunken Sands';
create index if not exists pvp_rooms_status_idx on public.pvp_rooms (status);

-- Atomically persist match snapshots and lease a single authoritative runtime
-- per room. The row lock prevents two Cloud Run instances from both owning it.
create or replace function public.persist_pvp_runtime_state(
  p_room_code text,
  p_instance_id text,
  p_candidate_state jsonb,
  p_now_ms bigint,
  p_lease_ms bigint
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_state jsonb;
  next_state jsonb;
  current_owner text;
  current_seen bigint;
  current_revision bigint;
begin
  select match_state into current_state
  from public.pvp_rooms
  where room_code = p_room_code
  for update;

  if not found then
    return null;
  end if;

  current_owner := current_state->>'runtimeOwnerId';
  current_seen := coalesce((current_state->>'runtimeOwnerLastSeenAt')::bigint, 0);
  current_revision := coalesce((current_state->>'runtimeRevision')::bigint, 0);

  -- A delayed persistence call from the same owner must never roll a room back.
  if current_owner = p_instance_id
     and coalesce((p_candidate_state->>'runtimeRevision')::bigint, 0) < current_revision then
    return current_state;
  end if;

  if current_state is null then
    next_state := p_candidate_state || jsonb_build_object(
      'runtimeOwnerId', p_instance_id,
      'runtimeOwnerLastSeenAt', p_now_ms,
      'runtimeRevision', greatest(1, coalesce((p_candidate_state->>'runtimeRevision')::bigint, 1))
    );
    update public.pvp_rooms
    set match_state = next_state, updated_at = p_now_ms
    where room_code = p_room_code;
    return next_state;
  end if;

  if current_owner = p_instance_id then
    next_state := p_candidate_state || jsonb_build_object(
      'runtimeOwnerId', p_instance_id,
      'runtimeOwnerLastSeenAt', p_now_ms,
      'runtimeRevision', greatest(current_revision, coalesce((p_candidate_state->>'runtimeRevision')::bigint, current_revision))
    );
    update public.pvp_rooms
    set match_state = next_state, updated_at = p_now_ms
    where room_code = p_room_code;
    return next_state;
  end if;

  if current_seen < p_now_ms - p_lease_ms then
    -- Promote the replica using the latest state stored in the row, not its
    -- possibly stale local copy.
    next_state := current_state || jsonb_build_object(
      'runtimeOwnerId', p_instance_id,
      'runtimeOwnerLastSeenAt', p_now_ms,
      'runtimeRevision', current_revision + 1
    );
    update public.pvp_rooms
    set match_state = next_state, updated_at = p_now_ms
    where room_code = p_room_code;
    return next_state;
  end if;

  return current_state;
end;
$$;

revoke all on function public.persist_pvp_runtime_state(text, text, jsonb, bigint, bigint) from public, anon, authenticated;
grant execute on function public.persist_pvp_runtime_state(text, text, jsonb, bigint, bigint) to service_role;

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
