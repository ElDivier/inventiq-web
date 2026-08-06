-- Verificación Fase 8.3 · debe devolver las columnas y funciones creadas.
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'production_recipes'
  and column_name in ('recipe_context', 'labor_cost', 'overhead_cost', 'target_food_cost_percent')
order by column_name;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'save_restaurant_recipe',
    'set_restaurant_recipe_active',
    'delete_restaurant_recipe'
  )
order by routine_name;
