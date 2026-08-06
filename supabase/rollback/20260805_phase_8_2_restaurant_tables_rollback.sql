-- INVENTIQ · Rollback Fase 8.2
-- Ejecutar únicamente si deseas retirar completamente Mesas y salón.

revoke select, insert, update, delete on public.restaurant_tables from authenticated;
revoke select, insert, update, delete on public.restaurant_areas from authenticated;

revoke execute on function public.restaurant_seed_default_floor() from authenticated;
revoke execute on function public.restaurant_open_table(uuid, integer, text, text) from authenticated;
revoke execute on function public.restaurant_update_table_service(uuid, text, integer, text, text, text, timestamptz) from authenticated;
revoke execute on function public.restaurant_release_table(uuid, text) from authenticated;
revoke execute on function public.restaurant_transfer_table(uuid, uuid) from authenticated;
revoke execute on function public.restaurant_join_tables(uuid, uuid) from authenticated;
revoke execute on function public.restaurant_unjoin_table(uuid) from authenticated;

drop function if exists public.restaurant_unjoin_table(uuid);
drop function if exists public.restaurant_join_tables(uuid, uuid);
drop function if exists public.restaurant_transfer_table(uuid, uuid);
drop function if exists public.restaurant_release_table(uuid, text);
drop function if exists public.restaurant_update_table_service(uuid, text, integer, text, text, text, timestamptz);
drop function if exists public.restaurant_open_table(uuid, integer, text, text);
drop function if exists public.restaurant_seed_default_floor();

drop table if exists public.restaurant_tables cascade;
drop table if exists public.restaurant_areas cascade;
