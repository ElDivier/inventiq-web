-- Verificación Fase 8.6 · Cobro y división de cuentas
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'restaurant_order_payments';

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'restaurant_orders'
  and column_name in ('discount_amount','service_charge','paid_total','balance_due','payment_status')
order by column_name;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'restaurant_refresh_checkout_totals',
    'restaurant_update_order_charges',
    'restaurant_register_payment',
    'restaurant_void_payment'
  )
order by routine_name;

select indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'restaurant_order_payments_code_uidx',
    'restaurant_order_payments_order_idx',
    'restaurant_order_payments_cash_idx',
    'sales_active_restaurant_order_source_uidx'
  )
order by indexname;

select trigger_name, event_object_table
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'restaurant_order_items_lock_after_payment',
    'restaurant_orders_lock_transfer_after_payment'
  )
order by trigger_name;
