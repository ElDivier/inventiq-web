-- INVENTIQ · Verificación Corrección 8.9.2 · Portal de empleados

select
  to_regclass('public.restaurant_employee_access') as employee_access_table,
  to_regclass('public.restaurant_staff_auth_users') as staff_auth_users_table;

select
  to_regprocedure('public.restaurant_get_employee_access_settings()') as get_settings,
  to_regprocedure('public.restaurant_set_employee_access(text,text,boolean)') as set_settings,
  to_regprocedure('public.restaurant_employee_lookup(text,text)') as employee_lookup,
  to_regprocedure('public.restaurant_employee_verify_profile(text,text,uuid,text)') as verify_profile,
  to_regprocedure('public.restaurant_employee_session_context()') as employee_context,
  to_regprocedure('public.restaurant_effective_user_id()') as effective_user,
  to_regprocedure('public.restaurant_employee_has_permission(text)') as permission_check;

select policyname, tablename, cmd
from pg_policies
where schemaname = 'public'
  and policyname like 'restaurant_employee_%'
order by tablename, policyname;

-- Ejecutar como propietario autenticado para comprobar la configuración actual.
select public.restaurant_get_employee_access_settings();
