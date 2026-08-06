-- INVENTIQ · Verificación Fase 7.3
-- Debe devolver registros para las tablas y funciones indicadas.

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('production_batches', 'production_batch_items')
order by table_name;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'inventiq_normalize_unit',
    'inventiq_unit_family',
    'inventiq_unit_factor',
    'inventiq_convert_quantity',
    'register_production_batch'
  )
order by routine_name;

select
  public.inventiq_convert_quantity(1000, 'g', 'kg') as gramos_a_kg,
  public.inventiq_convert_quantity(2, 'docena', 'unidad') as docenas_a_unidades;
