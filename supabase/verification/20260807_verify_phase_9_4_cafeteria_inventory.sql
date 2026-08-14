-- Verificación opcional · Fase 9.4 Cafeterías
select to_regclass('public.cafeteria_stock_adjustments') as cafeteria_stock_adjustments;

select proname
from pg_proc
where proname in (
  'register_cafeteria_preparation_batch',
  'register_cafeteria_stock_adjustment',
  'resolve_cafeteria_inventory_issue'
)
order by proname;

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid='public.production_batches'::regclass
  and conname='production_batches_context_check';

select schemaname, tablename
from pg_publication_tables
where pubname='supabase_realtime'
  and tablename in ('cafeteria_inventory_consumptions','cafeteria_inventory_issues','cafeteria_stock_adjustments','production_batches')
order by tablename;
