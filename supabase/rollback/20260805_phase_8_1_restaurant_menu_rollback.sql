-- Rollback conservador de Fase 8.1.
-- No elimina columnas ni revierte clasificaciones porque podrían contener información creada por el usuario.

drop index if exists public.products_restaurant_operational_type_idx;
drop index if exists public.products_product_metadata_gin_idx;
