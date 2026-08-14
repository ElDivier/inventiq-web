-- INVENTIQ · Fase 8.6 · Cobro y división de cuentas para restaurantes
-- Migración no destructiva. Añade descuentos/cargos, cobros parciales,
-- división por partes/asientos/productos y cierre transaccional de la cuenta.

create extension if not exists pgcrypto;

alter table public.restaurant_orders
  add column if not exists discount_amount numeric(14,2) not null default 0,
  add column if not exists service_charge numeric(14,2) not null default 0,
  add column if not exists paid_total numeric(14,2) not null default 0,
  add column if not exists balance_due numeric(14,2) not null default 0,
  add column if not exists payment_status text not null default 'pendiente';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'restaurant_orders_discount_valid') then
    alter table public.restaurant_orders
      add constraint restaurant_orders_discount_valid check (discount_amount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'restaurant_orders_service_charge_valid') then
    alter table public.restaurant_orders
      add constraint restaurant_orders_service_charge_valid check (service_charge >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'restaurant_orders_paid_total_valid') then
    alter table public.restaurant_orders
      add constraint restaurant_orders_paid_total_valid check (paid_total >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'restaurant_orders_balance_due_valid') then
    alter table public.restaurant_orders
      add constraint restaurant_orders_balance_due_valid check (balance_due >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'restaurant_orders_payment_status_valid') then
    alter table public.restaurant_orders
      add constraint restaurant_orders_payment_status_valid
      check (payment_status in ('pendiente','parcial','pagada'));
  end if;
end $$;

create table if not exists public.restaurant_order_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.restaurant_orders(id) on delete cascade,
  payment_code text not null,
  amount numeric(14,2) not null,
  payment_method text not null default 'Efectivo',
  cash_amount numeric(14,2) not null default 0,
  card_amount numeric(14,2) not null default 0,
  transfer_amount numeric(14,2) not null default 0,
  split_mode text not null default 'completa',
  split_label text not null default '',
  allocation jsonb not null default '{}'::jsonb,
  notes text not null default '',
  status text not null default 'active',
  paid_at timestamptz not null default now(),
  voided_at timestamptz,
  void_reason text not null default '',
  sale_id uuid references public.sales(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_order_payments_amount_valid check (amount > 0),
  constraint restaurant_order_payments_components_valid check (
    cash_amount >= 0 and card_amount >= 0 and transfer_amount >= 0
  ),
  constraint restaurant_order_payments_method_valid check (
    payment_method in ('Efectivo','Tarjeta','Transferencia','Mixto')
  ),
  constraint restaurant_order_payments_split_valid check (
    split_mode in ('completa','partes','asientos','productos','monto')
  ),
  constraint restaurant_order_payments_status_valid check (status in ('active','voided'))
);

create unique index if not exists restaurant_order_payments_code_uidx
  on public.restaurant_order_payments (user_id, payment_code);
create index if not exists restaurant_order_payments_order_idx
  on public.restaurant_order_payments (order_id, status, paid_at desc);
create index if not exists restaurant_order_payments_cash_idx
  on public.restaurant_order_payments (user_id, paid_at desc)
  where status = 'active';
create unique index if not exists sales_active_restaurant_order_source_uidx
  on public.sales (user_id, source_id)
  where source_type = 'restaurant_order' and source_id is not null and status <> 'Anulada';

comment on table public.restaurant_order_payments is
'Cobros parciales o totales de cuentas de restaurante, con división y desglose por método de pago.';
comment on column public.restaurant_order_payments.allocation is
'Instantánea JSON de los asientos o productos incluidos en el cobro.';

alter table public.restaurant_order_payments enable row level security;
revoke insert, update, delete on public.restaurant_order_payments from authenticated;
grant select on public.restaurant_order_payments to authenticated;

drop policy if exists "restaurant_order_payments_owner_all" on public.restaurant_order_payments;
create policy "restaurant_order_payments_owner_all"
on public.restaurant_order_payments
for all to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.restaurant_orders ro
    where ro.id = order_id and ro.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.restaurant_orders ro
    where ro.id = order_id and ro.user_id = auth.uid()
  )
);

drop trigger if exists restaurant_order_payments_touch_updated_at on public.restaurant_order_payments;
create trigger restaurant_order_payments_touch_updated_at
before update on public.restaurant_order_payments
for each row execute function public.inventiq_touch_updated_at();

create or replace function public.restaurant_refresh_checkout_totals(p_order_id uuid)
returns public.restaurant_orders
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.restaurant_orders;
  v_subtotal numeric(14,2) := 0;
  v_paid numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_balance numeric(14,2) := 0;
begin
  if v_user_id is null then raise exception 'No existe una sesión activa.'; end if;

  select * into v_order
  from public.restaurant_orders
  where id = p_order_id and user_id = v_user_id
  for update;
  if not found then raise exception 'Pedido no encontrado.'; end if;

  select coalesce(sum(quantity * unit_price), 0)
    into v_subtotal
  from public.restaurant_order_items
  where order_id = p_order_id and user_id = v_user_id and status <> 'cancelado';

  select coalesce(sum(amount), 0)
    into v_paid
  from public.restaurant_order_payments
  where order_id = p_order_id and user_id = v_user_id and status = 'active';

  if coalesce(v_order.discount_amount, 0) > v_subtotal then
    v_order.discount_amount := v_subtotal;
  end if;

  v_total := greatest(round(v_subtotal - coalesce(v_order.discount_amount, 0) + coalesce(v_order.service_charge, 0), 2), 0);
  v_paid := round(v_paid, 2);
  v_balance := greatest(round(v_total - v_paid, 2), 0);

  update public.restaurant_orders
  set subtotal = round(v_subtotal, 2),
      total = v_total,
      discount_amount = least(coalesce(discount_amount, 0), round(v_subtotal, 2)),
      paid_total = v_paid,
      balance_due = v_balance,
      payment_status = case
        when v_total <= 0.01 or v_balance <= 0.01 then 'pagada'
        when v_paid > 0 then 'parcial'
        else 'pendiente'
      end
  where id = p_order_id and user_id = v_user_id
  returning * into v_order;

  if v_order.table_id is not null then
    update public.restaurant_tables
    set current_total = v_order.balance_due
    where id = v_order.table_id and user_id = v_user_id;
  end if;

  return v_order;
end;
$$;

-- Sustituye el recálculo anterior para respetar descuentos, cargos y cobros parciales.
create or replace function public.restaurant_recalculate_order(p_order_id uuid)
returns public.restaurant_orders
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return public.restaurant_refresh_checkout_totals(p_order_id);
end;
$$;

create or replace function public.restaurant_update_order_charges(
  p_order_id uuid,
  p_discount_amount numeric default 0,
  p_service_charge numeric default 0
)
returns public.restaurant_orders
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.restaurant_orders;
  v_payments integer := 0;
begin
  if v_user_id is null then raise exception 'No existe una sesión activa.'; end if;
  if coalesce(p_discount_amount, 0) < 0 or coalesce(p_service_charge, 0) < 0 then
    raise exception 'El descuento y el cargo de servicio no pueden ser negativos.';
  end if;

  select * into v_order
  from public.restaurant_orders
  where id = p_order_id and user_id = v_user_id
  for update;
  if not found then raise exception 'Pedido no encontrado.'; end if;
  if v_order.status in ('cerrada','cancelada') then raise exception 'La cuenta ya no puede modificarse.'; end if;

  select count(*) into v_payments
  from public.restaurant_order_payments
  where order_id = p_order_id and user_id = v_user_id and status = 'active';
  if v_payments > 0 then raise exception 'No se pueden cambiar descuentos o cargos después de registrar un cobro.'; end if;

  update public.restaurant_orders
  set discount_amount = round(coalesce(p_discount_amount, 0), 2),
      service_charge = round(coalesce(p_service_charge, 0), 2)
  where id = p_order_id and user_id = v_user_id;

  return public.restaurant_refresh_checkout_totals(p_order_id);
end;
$$;

create or replace function public.restaurant_prevent_item_changes_after_payment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_order_id uuid;
  v_has_payment boolean := false;
  v_only_kitchen_progress boolean := false;
begin
  v_order_id := case when tg_op = 'DELETE' then old.order_id else new.order_id end;

  select exists (
    select 1 from public.restaurant_order_payments
    where order_id = v_order_id and status = 'active'
  ) into v_has_payment;

  if not v_has_payment then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  -- Después de un abono se permite únicamente avanzar la preparación/entrega
  -- o cambiar la prioridad. No se permite alterar productos, cantidades, precios,
  -- asientos, observaciones ni cancelar ítems porque cambiarían la cuenta cobrada.
  if tg_op = 'UPDATE' then
    v_only_kitchen_progress :=
      new.user_id is not distinct from old.user_id
      and new.order_id is not distinct from old.order_id
      and new.product_id is not distinct from old.product_id
      and new.product_name is not distinct from old.product_name
      and new.category is not distinct from old.category
      and new.kitchen_station is not distinct from old.kitchen_station
      and new.course is not distinct from old.course
      and new.seat_number is not distinct from old.seat_number
      and new.quantity is not distinct from old.quantity
      and new.unit_price is not distinct from old.unit_price
      and new.modifiers is not distinct from old.modifiers
      and new.notes is not distinct from old.notes
      and new.cancellation_reason is not distinct from old.cancellation_reason
      and new.sort_order is not distinct from old.sort_order
      and new.status <> 'cancelado';

    if v_only_kitchen_progress then
      return new;
    end if;
  end if;

  raise exception 'La cuenta ya tiene cobros registrados. Anula los cobros parciales antes de modificar productos o cantidades.';
end;
$$;

drop trigger if exists restaurant_order_items_lock_after_payment on public.restaurant_order_items;
create trigger restaurant_order_items_lock_after_payment
before insert or update or delete on public.restaurant_order_items
for each row execute function public.restaurant_prevent_item_changes_after_payment();

create or replace function public.restaurant_prevent_transfer_after_payment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.table_id is distinct from old.table_id or new.order_type is distinct from old.order_type)
     and exists (
       select 1 from public.restaurant_order_payments
       where order_id = old.id and status = 'active'
     ) then
    raise exception 'No se puede transferir una cuenta que ya tiene cobros registrados.';
  end if;
  return new;
end;
$$;

drop trigger if exists restaurant_orders_lock_transfer_after_payment on public.restaurant_orders;
create trigger restaurant_orders_lock_transfer_after_payment
before update of table_id, order_type on public.restaurant_orders
for each row execute function public.restaurant_prevent_transfer_after_payment();

create or replace function public.restaurant_register_payment(
  p_order_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_cash_amount numeric default 0,
  p_card_amount numeric default 0,
  p_transfer_amount numeric default 0,
  p_split_mode text default 'completa',
  p_split_label text default '',
  p_allocation jsonb default '{}'::jsonb,
  p_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.restaurant_orders;
  v_payment_id uuid := gen_random_uuid();
  v_payment_code text;
  v_amount numeric(14,2) := round(coalesce(p_amount, 0), 2);
  v_method text := initcap(lower(trim(coalesce(p_payment_method, 'Efectivo'))));
  v_cash numeric(14,2) := round(coalesce(p_cash_amount, 0), 2);
  v_card numeric(14,2) := round(coalesce(p_card_amount, 0), 2);
  v_transfer numeric(14,2) := round(coalesce(p_transfer_amount, 0), 2);
  v_component_total numeric(14,2);
  v_sale_id uuid;
  v_sale_code text;
  v_item record;
  v_item_count integer := 0;
  v_total_quantity numeric := 0;
  v_total_cost numeric := 0;
  v_line_cost numeric := 0;
  v_product_summary text;
  v_customer text;
  v_reference text;
  v_payment_method_final text;
  v_cash_total numeric := 0;
  v_card_total numeric := 0;
  v_transfer_total numeric := 0;
  v_method_count integer := 0;
  v_discount_percent numeric := 0;
  v_closed boolean := false;
begin
  if v_user_id is null then raise exception 'No existe una sesión activa.'; end if;

  select * into v_order
  from public.restaurant_orders
  where id = p_order_id and user_id = v_user_id
  for update;
  if not found then raise exception 'Pedido no encontrado.'; end if;
  if v_order.status in ('cerrada','cancelada') then raise exception 'La cuenta ya está cerrada o cancelada.'; end if;
  if v_order.status not in ('lista','servida','cuenta') then
    raise exception 'La cuenta debe estar lista, servida o solicitada antes de registrar el cobro.';
  end if;

  v_order := public.restaurant_refresh_checkout_totals(p_order_id);

  if v_amount <= 0 then raise exception 'El monto debe ser mayor a cero.'; end if;
  if v_amount > v_order.balance_due + 0.01 then
    raise exception 'El monto supera el saldo pendiente de %.', v_order.balance_due;
  end if;

  if v_method not in ('Efectivo','Tarjeta','Transferencia','Mixto') then
    raise exception 'Método de pago no válido.';
  end if;
  if lower(trim(coalesce(p_split_mode, ''))) not in ('completa','partes','asientos','productos','monto') then
    raise exception 'Forma de división no válida.';
  end if;

  if v_method = 'Efectivo' then
    v_cash := v_amount; v_card := 0; v_transfer := 0;
  elsif v_method = 'Tarjeta' then
    v_cash := 0; v_card := v_amount; v_transfer := 0;
  elsif v_method = 'Transferencia' then
    v_cash := 0; v_card := 0; v_transfer := v_amount;
  else
    v_component_total := round(v_cash + v_card + v_transfer, 2);
    if abs(v_component_total - v_amount) > 0.01 then
      raise exception 'El desglose del pago mixto debe sumar exactamente %.', v_amount;
    end if;
  end if;

  v_payment_code := 'COB-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(v_payment_id::text, '-', ''), 1, 6));

  insert into public.restaurant_order_payments (
    id, user_id, order_id, payment_code, amount, payment_method,
    cash_amount, card_amount, transfer_amount, split_mode, split_label,
    allocation, notes
  ) values (
    v_payment_id, v_user_id, p_order_id, v_payment_code, v_amount, v_method,
    v_cash, v_card, v_transfer, lower(trim(p_split_mode)),
    trim(coalesce(p_split_label, '')), coalesce(p_allocation, '{}'::jsonb),
    trim(coalesce(p_notes, ''))
  );

  v_order := public.restaurant_refresh_checkout_totals(p_order_id);

  if v_order.balance_due <= 0.01 then
    if exists (
      select 1 from public.restaurant_order_items
      where order_id = p_order_id and user_id = v_user_id
        and status not in ('servido','cancelado')
    ) then
      raise exception 'Para cerrar la cuenta, todos los productos deben estar entregados. Puedes registrar un abono menor al saldo mientras termina el servicio.';
    end if;
    if exists (
      select 1 from public.sales
      where user_id = v_user_id and source_type = 'restaurant_order'
        and source_id = p_order_id and status <> 'Anulada'
    ) then
      select id into v_sale_id from public.sales
      where user_id = v_user_id and source_type = 'restaurant_order'
        and source_id = p_order_id and status <> 'Anulada'
      limit 1;
    else
      select
        count(*),
        coalesce(sum(roi.quantity), 0),
        coalesce(sum(roi.quantity * greatest(coalesce(p.cost, 0), 0)), 0)
      into v_item_count, v_total_quantity, v_total_cost
      from public.restaurant_order_items roi
      left join public.products p on p.id = roi.product_id and p.user_id = v_user_id
      where roi.order_id = p_order_id and roi.user_id = v_user_id and roi.status <> 'cancelado';

      if v_item_count = 0 then raise exception 'La cuenta no tiene productos cobrables.'; end if;

      select
        count(distinct payment_method),
        coalesce(sum(cash_amount), 0),
        coalesce(sum(card_amount), 0),
        coalesce(sum(transfer_amount), 0)
      into v_method_count, v_cash_total, v_card_total, v_transfer_total
      from public.restaurant_order_payments
      where order_id = p_order_id and user_id = v_user_id and status = 'active';

      if v_method_count = 1 then
        select max(payment_method) into v_payment_method_final
        from public.restaurant_order_payments
        where order_id = p_order_id and user_id = v_user_id and status = 'active';
      else
        v_payment_method_final := 'Mixto';
      end if;

      select coalesce(rt.name, '') into v_reference
      from public.restaurant_tables rt
      where rt.id = v_order.table_id and rt.user_id = v_user_id;

      v_customer := case
        when trim(coalesce(v_order.customer_name, '')) <> '' then trim(v_order.customer_name)
        when trim(coalesce(v_order.order_reference, '')) <> '' then trim(v_order.order_reference)
        when trim(coalesce(v_reference, '')) <> '' then v_reference
        when v_order.order_type = 'takeaway' then 'Para llevar'
        when v_order.order_type = 'delivery' then 'Delivery'
        else 'Consumidor final'
      end;

      v_product_summary := case
        when v_item_count = 1 then (
          select product_name from public.restaurant_order_items
          where order_id = p_order_id and user_id = v_user_id and status <> 'cancelado'
          limit 1
        )
        else 'Cuenta restaurante · ' || v_item_count || ' productos'
      end;

      v_sale_id := gen_random_uuid();
      v_sale_code := 'V-' || v_order.order_code;
      if exists (select 1 from public.sales where user_id = v_user_id and code = v_sale_code) then
        v_sale_code := v_sale_code || '-' || substr(replace(v_sale_id::text, '-', ''), 1, 6);
      end if;

      v_discount_percent := case
        when (v_order.subtotal + v_order.service_charge) > 0
          then round((v_order.discount_amount / (v_order.subtotal + v_order.service_charge)) * 100, 4)
        else 0
      end;

      insert into public.sales (
        id, user_id, product_id, code, product, customer, payment_method,
        invoice_enabled, invoice_name, invoice_identification, invoice_address,
        invoice_email, quantity, subtotal, discount_percent, discount, total,
        profit, status, cash_amount, card_amount, transfer_amount,
        source_type, source_id, cash_already_recorded
      ) values (
        v_sale_id, v_user_id, null, v_sale_code, v_product_summary, v_customer,
        coalesce(v_payment_method_final, 'Mixto'), false, '', '', '', '',
        v_total_quantity, round(v_order.subtotal + v_order.service_charge, 2),
        v_discount_percent, v_order.discount_amount, v_order.total,
        round(v_order.total - v_total_cost, 2), 'Completada',
        round(v_cash_total, 2), round(v_card_total, 2), round(v_transfer_total, 2),
        'restaurant_order', v_order.id, true
      );

      for v_item in
        select roi.*, greatest(coalesce(p.cost, 0), 0) as current_cost
        from public.restaurant_order_items roi
        left join public.products p on p.id = roi.product_id and p.user_id = v_user_id
        where roi.order_id = p_order_id and roi.user_id = v_user_id and roi.status <> 'cancelado'
        order by roi.sort_order, roi.created_at
      loop
        v_line_cost := round(v_item.quantity * v_item.current_cost, 4);
        insert into public.sale_items (
          user_id, sale_id, product_id, product, quantity, price, cost, subtotal, profit
        ) values (
          v_user_id, v_sale_id, v_item.product_id, v_item.product_name,
          v_item.quantity, v_item.unit_price, v_item.current_cost,
          round(v_item.quantity * v_item.unit_price, 2),
          round((v_item.quantity * v_item.unit_price) - v_line_cost, 2)
        );
      end loop;

      if v_order.service_charge > 0 then
        insert into public.sale_items (
          user_id, sale_id, product_id, product, quantity, price, cost, subtotal, profit
        ) values (
          v_user_id, v_sale_id, null, 'Cargo de servicio', 1,
          v_order.service_charge, 0, v_order.service_charge, v_order.service_charge
        );
      end if;
    end if;

    update public.restaurant_order_payments
    set sale_id = v_sale_id
    where order_id = p_order_id and user_id = v_user_id and status = 'active';

    update public.restaurant_orders
    set status = 'cerrada', payment_status = 'pagada', paid_total = total,
        balance_due = 0, sale_id = v_sale_id, closed_at = coalesce(closed_at, now())
    where id = p_order_id and user_id = v_user_id
    returning * into v_order;

    if v_order.table_id is not null then
      update public.restaurant_tables
      set status = 'limpieza', current_total = 0, bill_requested_at = null,
          waiter_name = '', guest_count = 0, opened_at = null, joined_to = null
      where id = v_order.table_id and user_id = v_user_id;
    end if;

    v_closed := true;
  end if;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'payment_code', v_payment_code,
    'order_id', p_order_id,
    'paid_total', v_order.paid_total,
    'balance_due', v_order.balance_due,
    'closed', v_closed,
    'sale_id', v_sale_id
  );
end;
$$;

create or replace function public.restaurant_void_payment(
  p_payment_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_payment public.restaurant_order_payments;
  v_order public.restaurant_orders;
begin
  if v_user_id is null then raise exception 'No existe una sesión activa.'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Escribe un motivo para anular el cobro.';
  end if;

  select * into v_payment
  from public.restaurant_order_payments
  where id = p_payment_id and user_id = v_user_id
  for update;
  if not found then raise exception 'Cobro no encontrado.'; end if;
  if v_payment.status = 'voided' then
    return jsonb_build_object('payment_id', v_payment.id, 'already_voided', true);
  end if;
  if v_payment.sale_id is not null then
    raise exception 'La cuenta ya fue cerrada. La anulación de la venta se gestionará desde Ventas.';
  end if;

  select * into v_order
  from public.restaurant_orders
  where id = v_payment.order_id and user_id = v_user_id
  for update;
  if not found or v_order.status in ('cerrada','cancelada') then
    raise exception 'La cuenta ya no permite anular cobros parciales.';
  end if;

  update public.restaurant_order_payments
  set status = 'voided', voided_at = now(), void_reason = trim(p_reason)
  where id = v_payment.id and user_id = v_user_id;

  v_order := public.restaurant_refresh_checkout_totals(v_payment.order_id);

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'order_id', v_payment.order_id,
    'paid_total', v_order.paid_total,
    'balance_due', v_order.balance_due,
    'already_voided', false
  );
end;
$$;

-- Inicializa saldos de cuentas existentes.
update public.restaurant_orders
set balance_due = greatest(round(total - paid_total, 2), 0),
    payment_status = case
      when total <= 0.01 or greatest(round(total - paid_total, 2), 0) <= 0.01 then 'pagada'
      when paid_total > 0 then 'parcial'
      else 'pendiente'
    end;

revoke execute on function public.restaurant_refresh_checkout_totals(uuid) from public;
revoke execute on function public.restaurant_update_order_charges(uuid,numeric,numeric) from public;
revoke execute on function public.restaurant_register_payment(uuid,numeric,text,numeric,numeric,numeric,text,text,jsonb,text) from public;
revoke execute on function public.restaurant_void_payment(uuid,text) from public;

grant execute on function public.restaurant_refresh_checkout_totals(uuid) to authenticated;
grant execute on function public.restaurant_update_order_charges(uuid,numeric,numeric) to authenticated;
grant execute on function public.restaurant_register_payment(uuid,numeric,text,numeric,numeric,numeric,text,text,jsonb,text) to authenticated;
grant execute on function public.restaurant_void_payment(uuid,text) to authenticated;
