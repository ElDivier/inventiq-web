-- INVENTIQ · Verificación Fase 9.5 · Cafetería
-- Debe devolver filas/valores sin errores después de ejecutar la migración.

select 'cafeteria_orders' as table_name,
       has_table_privilege('authenticated', 'public.cafeteria_orders', 'SELECT') as can_select,
       has_table_privilege('authenticated', 'public.cafeteria_orders', 'INSERT') as can_insert_direct,
       has_table_privilege('authenticated', 'public.cafeteria_orders', 'UPDATE') as can_update_direct;

select 'cafeteria_order_items' as table_name,
       has_table_privilege('authenticated', 'public.cafeteria_order_items', 'SELECT') as can_select,
       has_table_privilege('authenticated', 'public.cafeteria_order_items', 'INSERT') as can_insert_direct,
       has_table_privilege('authenticated', 'public.cafeteria_order_items', 'UPDATE') as can_update_direct;

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'cafeteria_orders',
    'cafeteria_order_items',
    'cafeteria_inventory_consumptions',
    'cafeteria_inventory_issues',
    'cafeteria_stock_adjustments'
  )
order by tablename, policyname;

select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'cafeteria_create_order_from_sale',
    'cafeteria_set_order_status',
    'cafeteria_set_order_item_status',
    'cafeteria_set_order_priority',
    'cafeteria_call_order'
  )
order by proname;
