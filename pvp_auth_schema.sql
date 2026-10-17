create table if not exists public.pvp_auth_accounts (
  username text primary key,
  password_salt text not null,
  password_hash text not null,
  active_device_id text,
  active_session_hash text,
  created_at timestamptz not null default now(),
  constraint pvp_auth_accounts_username_lower check (username = lower(username))
);

alter table public.pvp_auth_accounts enable row level security;
revoke all on public.pvp_auth_accounts from anon, authenticated;
grant select, insert, update on public.pvp_auth_accounts to service_role;

insert into public.pvp_auth_accounts (username, password_salt, password_hash)
values
  ('a', 'ba26831d9bce2b8746187f316563077c', 'b1119cd9ebfb47b2110dd523f3a46eab3a63ffbe936007d584267964b6d3f9028b7cacb461f613ee7bef77b96d0759935177819270380b5e5b8bb53d063f1367'),
  ('b', 'c484aa35ed0278e0f4510925b4341ab0', '3c97daf2ca296cff23838f73c170cb9bb6fe175b99eb671aa5cfb2c30c7347af3aee594ac65522fbd050fdeb0eded96c3a11682f3f04dca3fc873e4bacf99d82')
on conflict (username) do nothing;
