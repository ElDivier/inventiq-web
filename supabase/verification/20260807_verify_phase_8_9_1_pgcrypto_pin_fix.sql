-- Verificación opcional de la corrección 8.9.1
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.proconfig as function_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'restaurant_create_staff_profile',
    'restaurant_update_staff_profile',
    'restaurant_verify_staff_pin'
  )
order by p.proname;

-- Debe existir gen_salt en alguno de los esquemas incluidos en el search_path.
select
  n.nspname as schema_name,
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname in ('gen_salt', 'crypt')
order by n.nspname, p.proname;
