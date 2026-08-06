-- INVENTIQ · Verificación Fase 8.2

select
  to_regclass('public.restaurant_areas') as restaurant_areas,
  to_regclass('public.restaurant_tables') as restaurant_tables;

select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('restaurant_areas', 'restaurant_tables')
order by table_name, ordinal_position;

select
  proname as function_name
from pg_proc
join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
where pg_namespace.nspname = 'public'
  and proname in (
    'restaurant_seed_default_floor',
    'restaurant_open_table',
    'restaurant_update_table_service',
    'restaurant_release_table',
    'restaurant_transfer_table',
    'restaurant_join_tables',
    'restaurant_unjoin_table'
  )
order by proname;

select
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('restaurant_areas', 'restaurant_tables')
order by tablename, policyname;

select
  schemaname,
  tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('restaurant_areas', 'restaurant_tables')
order by tablename;
