-- INVENTIQ · Reversión opcional Fase 7.5
-- ATENCIÓN: elimina pedidos especiales, sus productos y pagos.
-- Úsalo únicamente para desinstalar por completo esta fase en un entorno de prueba.

revoke all on function public.save_bakery_custom_order(
  uuid, uuid, text, text, text, text, date, time, text, text, text, text, text, text, integer, text, text, text, numeric, numeric, jsonb, numeric, text, text
) from authenticated;
revoke all on function public.register_bakery_custom_order_payment(uuid, numeric, text, timestamptz, text) from authenticated;
revoke all on function public.update_bakery_custom_order_status(uuid, text) from authenticated;

drop function if exists public.save_bakery_custom_order(
  uuid, uuid, text, text, text, text, date, time, text, text, text, text, text, text, integer, text, text, text, numeric, numeric, jsonb, numeric, text, text
);
drop function if exists public.register_bakery_custom_order_payment(uuid, numeric, text, timestamptz, text);
drop function if exists public.update_bakery_custom_order_status(uuid, text);

drop trigger if exists bakery_custom_orders_touch_updated_at on public.bakery_custom_orders;

drop table if exists public.bakery_custom_order_payments cascade;
drop table if exists public.bakery_custom_order_items cascade;
drop table if exists public.bakery_custom_orders cascade;
