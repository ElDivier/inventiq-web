-- Verificación Corrección 8.9.7

-- Debe devolver las tablas que existan de la lista y estén publicadas en Realtime.
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in (
    'restaurant_areas',
    'restaurant_tables',
    'restaurant_orders',
    'restaurant_order_items',
    'restaurant_order_payments',
    'restaurant_inventory_consumptions',
    'restaurant_inventory_issues',
    'restaurant_stock_adjustments',
    'production_batches'
  )
order by tablename;

-- Debe mostrar SELECT=YES e INSERT/UPDATE/DELETE=NO para authenticated
-- en restaurant_orders y restaurant_order_items.
select
  table_name,
  privilege_type
from information_schema.role_table_grants
where grantee = 'authenticated'
  and table_schema = 'public'
  and table_name in ('restaurant_orders', 'restaurant_order_items')
order by table_name, privilege_type;
