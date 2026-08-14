-- Rollback técnico Fase 8.6. Ejecutar solo si se desea retirar esta fase.
-- Antes de usarlo, asegúrate de no tener cuentas con pagos parciales activos.

drop trigger if exists restaurant_order_items_lock_after_payment on public.restaurant_order_items;
drop trigger if exists restaurant_orders_lock_transfer_after_payment on public.restaurant_orders;
drop function if exists public.restaurant_prevent_item_changes_after_payment();
drop function if exists public.restaurant_prevent_transfer_after_payment();
drop function if exists public.restaurant_void_payment(uuid,text);
drop function if exists public.restaurant_register_payment(uuid,numeric,text,numeric,numeric,numeric,text,text,jsonb,text);
drop function if exists public.restaurant_update_order_charges(uuid,numeric,numeric);
drop function if exists public.restaurant_refresh_checkout_totals(uuid);
drop index if exists public.sales_active_restaurant_order_source_uidx;
drop table if exists public.restaurant_order_payments;

alter table public.restaurant_orders
  drop column if exists discount_amount,
  drop column if exists service_charge,
  drop column if exists paid_total,
  drop column if exists balance_due,
  drop column if exists payment_status;

-- Restaura el recálculo de cuentas usado antes de la Fase 8.6.
create or replace function public.restaurant_recalculate_order(p_order_id uuid)
returns public.restaurant_orders
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.restaurant_orders;
  v_total numeric(14,2);
begin
  if v_user_id is null then raise exception 'No existe una sesión activa.'; end if;

  select * into v_order from public.restaurant_orders
  where id = p_order_id and user_id = v_user_id
  for update;
  if not found then raise exception 'Pedido no encontrado.'; end if;

  select coalesce(sum(quantity * unit_price), 0)
  into v_total
  from public.restaurant_order_items
  where order_id = p_order_id and status <> 'cancelado';

  update public.restaurant_orders
  set subtotal = round(v_total, 2), total = round(v_total, 2)
  where id = p_order_id
  returning * into v_order;

  if v_order.table_id is not null then
    update public.restaurant_tables
    set current_total = v_order.total
    where id = v_order.table_id and user_id = v_user_id;
  end if;

  return v_order;
end;
$$;

grant execute on function public.restaurant_recalculate_order(uuid) to authenticated;
