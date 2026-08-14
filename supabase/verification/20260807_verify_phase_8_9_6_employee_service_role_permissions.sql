-- Verificación opcional · Corrección 8.9.6
select
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('profiles', 'restaurant_audit_log')
  and grantee = 'service_role'
order by table_name, privilege_type;
