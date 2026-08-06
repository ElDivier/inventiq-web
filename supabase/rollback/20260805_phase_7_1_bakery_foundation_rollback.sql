-- INVENTIQ · Reversión opcional de la Fase 7.1
-- USAR SOLO si se decidió abandonar por completo la base técnica de producción.
-- No ejecutar después de comenzar a registrar recetas, movimientos o producción real.

drop table if exists public.inventory_movements cascade;
drop table if exists public.production_recipe_items cascade;
drop table if exists public.production_recipes cascade;

alter table public.products
  drop column if exists product_metadata,
  drop column if exists tracks_expiration,
  drop column if exists tracks_lots,
  drop column if exists production_enabled,
  drop column if exists stock_unit,
  drop column if exists product_type;
