-- INVENTIQ · Verificación Corrección 8.8.1

-- La tabla de consumos utiliza consumed_at; no posee created_at.
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'restaurant_inventory_consumptions'
order by ordinal_position;

-- Confirmar que las funciones corregidas existen.
select proname, pg_get_function_identity_arguments(oid) as arguments
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('restaurant_apply_order_inventory', 'cancel_restaurant_order_sale')
order by proname;

-- Revisar las últimas cuentas y su estado de consumo.
select order_code, status, inventory_consumption_status, inventory_consumed_at,
       inventory_cost_total, inventory_consumption_notes
from public.restaurant_orders
where user_id = auth.uid()
order by opened_at desc
limit 20;
