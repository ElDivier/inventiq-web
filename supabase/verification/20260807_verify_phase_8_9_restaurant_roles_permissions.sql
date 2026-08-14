-- INVENTIQ · Verificación Fase 8.9
select to_regclass('public.restaurant_staff_profiles') as restaurant_staff_profiles,
       to_regclass('public.restaurant_audit_log') as restaurant_audit_log;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'restaurant_create_staff_profile',
    'restaurant_update_staff_profile',
    'restaurant_verify_staff_pin',
    'restaurant_log_audit'
  )
order by routine_name;

select policyname, tablename, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('restaurant_staff_profiles', 'restaurant_audit_log')
order by tablename, policyname;
