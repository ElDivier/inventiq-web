-- Rollback técnico de la Fase 8.5. No elimina comandas ni pedidos.
drop function if exists public.restaurant_kitchen_toggle_priority(uuid);
drop function if exists public.restaurant_kitchen_set_station_status(uuid,text,text);
drop function if exists public.restaurant_kitchen_set_item_status(uuid,text);
drop function if exists public.restaurant_sync_kitchen_order(uuid);
drop trigger if exists restaurant_order_items_kitchen_defaults on public.restaurant_order_items;
drop function if exists public.restaurant_apply_kitchen_item_defaults();
drop index if exists public.restaurant_order_items_kitchen_board_idx;
alter table public.restaurant_order_items
  drop column if exists priority_at,
  drop column if exists is_priority,
  drop column if exists preparation_minutes;
