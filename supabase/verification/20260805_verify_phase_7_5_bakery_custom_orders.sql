-- INVENTIQ · Verificación Fase 7.5 · Pedidos especiales
-- Este archivo solo consulta metadatos. No modifica información.

select
  table_name,
  case when table_name is not null then 'OK' else 'FALTA' end as estado
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'bakery_custom_orders',
    'bakery_custom_order_items',
    'bakery_custom_order_payments'
  )
order by table_name;

select
  routine_name,
  data_type as retorno
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'save_bakery_custom_order',
    'register_bakery_custom_order_payment',
    'update_bakery_custom_order_status'
  )
order by routine_name;

select
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'bakery_custom_orders',
    'bakery_custom_order_items',
    'bakery_custom_order_payments'
  )
order by tablename, policyname;

select
  relname as tabla,
  relrowsecurity as rls_activo
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in (
    'bakery_custom_orders',
    'bakery_custom_order_items',
    'bakery_custom_order_payments'
  )
order by relname;

select
  (select count(*) from public.bakery_custom_orders) as pedidos,
  (select count(*) from public.bakery_custom_order_items) as lineas,
  (select count(*) from public.bakery_custom_order_payments) as pagos;
