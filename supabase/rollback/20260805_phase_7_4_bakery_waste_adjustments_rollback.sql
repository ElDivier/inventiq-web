-- INVENTIQ · Rollback estructural Fase 7.4
-- ADVERTENCIA: elimina el historial de mermas y ajustes creado en esta fase.
-- No revierte automáticamente los cambios de stock que ya se hayan aplicado.

revoke all on function public.register_bakery_stock_adjustment(
  uuid, text, numeric, date, text, text, text, uuid
) from authenticated;

drop function if exists public.register_bakery_stock_adjustment(
  uuid, text, numeric, date, text, text, text, uuid
);

drop table if exists public.bakery_stock_adjustments;
