-- Rollback técnico de la Fase 8.7.
-- Advertencia: elimina únicamente estructuras creadas por esta fase; no restaura stocks ya modificados.
drop trigger if exists restaurant_orders_apply_inventory_on_close on public.restaurant_orders;
drop function if exists public.restaurant_inventory_after_order_closed();
drop function if exists public.cancel_restaurant_order_sale(uuid);
drop function if exists public.register_restaurant_stock_adjustment(uuid, text, numeric, date, text, text, text, uuid);
drop function if exists public.restaurant_apply_order_inventory(uuid);
drop function if exists public.register_restaurant_preparation_batch(uuid, numeric, date, text, text);
drop table if exists public.restaurant_stock_adjustments;
drop table if exists public.restaurant_inventory_issues;
drop table if exists public.restaurant_inventory_consumptions;
alter table public.restaurant_orders
  drop column if exists inventory_consumption_notes,
  drop column if exists inventory_issue_count,
  drop column if exists inventory_shortage_count,
  drop column if exists inventory_cost_total,
  drop column if exists inventory_consumed_at,
  drop column if exists inventory_consumption_status;
alter table public.production_batches drop column if exists production_context;
