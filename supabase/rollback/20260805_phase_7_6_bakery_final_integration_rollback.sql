-- Rollback técnico de la Fase 7.6.
-- Úsalo solamente si todavía no registraste ventas desde pedidos especiales.

drop function if exists public.cancel_bakery_custom_order_sale(uuid);
drop function if exists public.finalize_bakery_custom_order_sale(uuid);
drop index if exists public.sales_active_bakery_order_source_uidx;
drop index if exists public.sales_source_idx;
drop index if exists public.bakery_custom_orders_sale_idx;

alter table public.bakery_custom_orders
  drop column if exists sale_registered_at,
  drop column if exists sale_id;

alter table public.sales
  drop column if exists cash_already_recorded,
  drop column if exists source_id,
  drop column if exists source_type;
