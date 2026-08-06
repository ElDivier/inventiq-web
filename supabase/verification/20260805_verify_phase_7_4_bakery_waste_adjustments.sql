-- INVENTIQ · Verificación Fase 7.4

select
  to_regclass('public.bakery_stock_adjustments') as adjustments_table,
  to_regprocedure('public.register_bakery_stock_adjustment(uuid,text,numeric,date,text,text,text,uuid)') as register_function;

select
  schemaname,
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'bakery_stock_adjustments'
order by policyname;

select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'bakery_stock_adjustments'
order by ordinal_position;
