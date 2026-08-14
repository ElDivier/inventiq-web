-- Rollback opcional de la Fase 8.4. Ejecutar solo si se desea retirar completamente el módulo.
drop function if exists public.restaurant_transfer_order(uuid,uuid);
drop function if exists public.restaurant_cancel_order_item(uuid,text);
drop function if exists public.restaurant_request_bill(uuid);
drop function if exists public.restaurant_send_order(uuid);
drop function if exists public.restaurant_save_order(uuid,uuid,uuid,text,text,text,integer,text,text,jsonb);
drop function if exists public.restaurant_recalculate_order(uuid);
drop table if exists public.restaurant_order_items;
drop table if exists public.restaurant_orders;
