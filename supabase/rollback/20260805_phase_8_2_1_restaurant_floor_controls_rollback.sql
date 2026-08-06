-- Rollback de la Fase 8.2.1
-- No elimina áreas ni mesas; únicamente retira la función agregada en esta corrección.
drop function if exists public.restaurant_clear_floor();
