-- INVENTIQ · Reversión Fase 7.3
-- ADVERTENCIA: elimina el historial de lotes creado en esta fase.
-- No restaura automáticamente el stock consumido o producido por lotes ya registrados.

revoke all on function public.register_production_batch(uuid, numeric, date, text, text) from authenticated;
drop function if exists public.register_production_batch(uuid, numeric, date, text, text);
drop function if exists public.inventiq_convert_quantity(numeric, text, text);
drop function if exists public.inventiq_unit_factor(text);
drop function if exists public.inventiq_unit_family(text);
drop function if exists public.inventiq_normalize_unit(text);

drop table if exists public.production_batch_items;
drop table if exists public.production_batches;
