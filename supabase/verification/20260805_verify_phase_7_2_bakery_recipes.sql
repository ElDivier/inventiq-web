-- Verificación de la Fase 7.2
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'production_recipes'
  and column_name in ('additional_cost', 'additional_cost_notes')
order by column_name;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'save_production_recipe',
    'set_production_recipe_active',
    'delete_production_recipe'
  )
order by routine_name;
