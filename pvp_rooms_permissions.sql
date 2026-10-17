-- Required for Cloud Run to create, look up, update, and remove shared PvP rooms.
-- Run in the Supabase SQL Editor for project jymjumdypgunipgjkjak.
grant select, insert, update, delete on table public.pvp_rooms to service_role;
notify pgrst, 'reload schema';
