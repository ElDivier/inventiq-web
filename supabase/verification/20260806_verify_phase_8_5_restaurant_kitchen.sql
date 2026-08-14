-- Verificación de la Fase 8.5 · Pantalla de cocina
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'restaurant_order_items'
  and column_name in ('preparation_minutes','is_priority','priority_at')
order by column_name;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'restaurant_sync_kitchen_order',
    'restaurant_kitchen_set_item_status',
    'restaurant_kitchen_set_station_status',
    'restaurant_kitchen_toggle_priority'
  )
order by routine_name;

select status, kitchen_station, count(*) as items
from public.restaurant_order_items
where status in ('enviado','preparacion','listo')
group by status, kitchen_station
order by kitchen_station, status;
