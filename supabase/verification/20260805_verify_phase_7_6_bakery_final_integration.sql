-- Verificación de la Fase 7.6
select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bakery_custom_orders' and column_name = 'sale_id'
  ) as orders_have_sale_id,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sales' and column_name = 'source_type'
  ) as sales_have_source_type,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sales' and column_name = 'cash_already_recorded'
  ) as sales_prevent_double_cash,
  to_regprocedure('public.finalize_bakery_custom_order_sale(uuid)') is not null as finalize_function_ready,
  to_regprocedure('public.cancel_bakery_custom_order_sale(uuid)') is not null as cancel_function_ready;
