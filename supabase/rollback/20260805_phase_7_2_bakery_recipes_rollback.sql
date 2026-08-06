-- Reversión técnica de funciones de la Fase 7.2.
-- No elimina recetas ni ingredientes existentes.
drop function if exists public.delete_production_recipe(uuid);
drop function if exists public.set_production_recipe_active(uuid, boolean);
drop function if exists public.save_production_recipe(
  uuid, uuid, text, numeric, text, text, boolean, numeric, text, jsonb
);

-- Las columnas additional_cost y additional_cost_notes se conservan para evitar pérdida de datos.
