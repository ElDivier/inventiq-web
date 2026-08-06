-- Rollback técnico Fase 8.3.
-- ATENCIÓN: elimina recetas gastronómicas antes de retirar las columnas.
delete from public.production_recipes
where recipe_context = 'restaurant';

drop function if exists public.delete_restaurant_recipe(uuid);
drop function if exists public.set_restaurant_recipe_active(uuid, boolean);
drop function if exists public.save_restaurant_recipe(uuid, uuid, text, numeric, text, text, boolean, numeric, numeric, numeric, jsonb);

alter table public.production_recipes
  drop constraint if exists production_recipes_context_check,
  drop constraint if exists production_recipes_labor_cost_check,
  drop constraint if exists production_recipes_overhead_cost_check,
  drop constraint if exists production_recipes_target_food_cost_check;

alter table public.production_recipes
  drop column if exists recipe_context,
  drop column if exists labor_cost,
  drop column if exists overhead_cost,
  drop column if exists target_food_cost_percent;
