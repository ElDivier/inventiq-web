-- INVENTIQ · Verificación rápida de la Fase 7.1

select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'products'
  and column_name in (
    'product_type',
    'stock_unit',
    'production_enabled',
    'tracks_lots',
    'tracks_expiration',
    'product_metadata'
  )
order by column_name;

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'production_recipes',
    'production_recipe_items',
    'inventory_movements'
  )
order by table_name;

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'production_recipes',
    'production_recipe_items',
    'inventory_movements'
  )
order by tablename, policyname;
