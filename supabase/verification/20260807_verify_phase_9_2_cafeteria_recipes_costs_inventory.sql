-- INVENTIQ · Verificación Fase 9.2
select recipe_context, count(*)
from public.production_recipes
group by recipe_context
order by recipe_context;

select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='production_recipe_items'
  and column_name in ('component_key','scale_with_size')
order by column_name;

select table_name
from information_schema.tables
where table_schema='public'
  and table_name in ('cafeteria_recipe_variant_rules','cafeteria_inventory_consumptions','cafeteria_inventory_issues')
order by table_name;

select routine_name
from information_schema.routines
where routine_schema='public'
  and routine_name in ('cafeteria_get_recipe_controlled_products','save_cafeteria_recipe','delete_cafeteria_recipe','cafeteria_apply_order_item_inventory','cafeteria_set_order_item_status','cafeteria_set_order_status')
order by routine_name;
