-- Verificación Fase 8.7 · Inventario gastronómico
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'restaurant_inventory_consumptions',
    'restaurant_inventory_issues',
    'restaurant_stock_adjustments'
  )
order by table_name;

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'restaurant_orders'
  and column_name like 'inventory_%'
order by ordinal_position;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'register_restaurant_preparation_batch',
    'restaurant_apply_order_inventory',
    'register_restaurant_stock_adjustment',
    'cancel_restaurant_order_sale'
  )
order by routine_name;

select trigger_name, event_manipulation
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'restaurant_orders'
  and trigger_name = 'restaurant_orders_apply_inventory_on_close';
