-- Verificación Fase 8.4
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('restaurant_orders', 'restaurant_order_items')
order by table_name;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'restaurant_save_order', 'restaurant_send_order', 'restaurant_request_bill',
    'restaurant_cancel_order_item', 'restaurant_transfer_order'
  )
order by routine_name;
