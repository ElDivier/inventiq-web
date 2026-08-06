-- INVENTIQ · Fase 7.6 · Integración final de panadería
-- Ejecutar una sola vez en Supabase > SQL Editor.
-- Integra pedidos especiales con ventas, inventario, caja y reportes sin duplicar cobros.

create extension if not exists pgcrypto;

-- 1. Trazabilidad entre pedidos especiales y ventas.
alter table public.bakery_custom_orders
  add column if not exists sale_id uuid references public.sales(id) on delete set null,
  add column if not exists sale_registered_at timestamptz;

alter table public.sales
  add column if not exists source_type text not null default 'pos',
  add column if not exists source_id uuid,
  add column if not exists cash_already_recorded boolean not null default false;

create index if not exists bakery_custom_orders_sale_idx
  on public.bakery_custom_orders (sale_id)
  where sale_id is not null;

create unique index if not exists sales_active_bakery_order_source_uidx
  on public.sales (user_id, source_id)
  where source_type = 'bakery_order' and source_id is not null and status <> 'Anulada';

create index if not exists sales_source_idx
  on public.sales (user_id, source_type, created_at desc);

comment on column public.sales.source_type is
'Origen de la venta: pos para venta directa, bakery_order para pedido especial y bakery_order_cancelled para una integración anulada.';

comment on column public.sales.cash_already_recorded is
'Indica que el efectivo ya fue registrado en otro historial de cobros, evitando duplicarlo en caja.';

-- 2. Finalizar un pedido listo, descontar producto terminado y registrarlo como venta.
create or replace function public.finalize_bakery_custom_order_sale(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.bakery_custom_orders%rowtype;
  v_item record;
  v_product public.products%rowtype;
  v_sale_id uuid := gen_random_uuid();
  v_sale_code text;
  v_item_count integer := 0;
  v_linked_product_count integer := 0;
  v_single_product_id uuid;
  v_product_summary text;
  v_total_quantity numeric := 0;
  v_stock_quantity numeric;
  v_stock_unit text;
  v_stock_before numeric;
  v_stock_after numeric;
  v_line_cost numeric;
  v_total_cost numeric := 0;
  v_line_price numeric;
  v_profit numeric;
  v_payment_method text := 'Otro';
  v_payment_method_count integer := 0;
  v_cash_amount numeric := 0;
  v_card_amount numeric := 0;
  v_transfer_amount numeric := 0;
  v_payment_total numeric := 0;
  v_discount_percent numeric := 0;
begin
  if v_user_id is null then
    raise exception 'No existe una sesión autenticada.';
  end if;

  select * into v_order
  from public.bakery_custom_orders
  where id = p_order_id and user_id = v_user_id
  for update;

  if v_order.id is null then
    raise exception 'El pedido no existe o no pertenece al negocio actual.';
  end if;

  if v_order.sale_id is not null then
    return jsonb_build_object(
      'order_id', v_order.id,
      'order_code', v_order.order_code,
      'sale_id', v_order.sale_id,
      'already_registered', true
    );
  end if;

  if v_order.status not in ('ready', 'delivered') then
    raise exception 'El pedido debe estar listo para poder entregarlo y registrarlo como venta.';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'Un pedido cancelado no puede registrarse como venta.';
  end if;

  if round(coalesce(v_order.paid_amount, 0), 2) + 0.01 < round(coalesce(v_order.total, 0), 2) then
    raise exception 'El pedido mantiene un saldo pendiente de %. Registra el cobro antes de entregarlo.',
      round(coalesce(v_order.total, 0) - coalesce(v_order.paid_amount, 0), 2);
  end if;

  select count(*), count(product_id), max(product_id)
    into v_item_count, v_linked_product_count, v_single_product_id
  from public.bakery_custom_order_items
  where order_id = v_order.id and user_id = v_user_id;

  if v_item_count = 0 then
    raise exception 'El pedido no tiene productos registrados.';
  end if;

  select
    count(distinct payment_method),
    coalesce(sum(amount), 0),
    coalesce(sum(case when lower(payment_method) = 'efectivo' then amount else 0 end), 0),
    coalesce(sum(case when lower(payment_method) = 'tarjeta' then amount else 0 end), 0),
    coalesce(sum(case when lower(payment_method) = 'transferencia' then amount else 0 end), 0)
  into
    v_payment_method_count,
    v_payment_total,
    v_cash_amount,
    v_card_amount,
    v_transfer_amount
  from public.bakery_custom_order_payments
  where order_id = v_order.id and user_id = v_user_id;

  if v_payment_method_count = 1 then
    select max(payment_method) into v_payment_method
    from public.bakery_custom_order_payments
    where order_id = v_order.id and user_id = v_user_id;
  elsif v_payment_method_count > 1 then
    v_payment_method := 'Mixto';
  elsif coalesce(v_order.total, 0) = 0 then
    v_payment_method := 'Efectivo';
  end if;

  if v_payment_method not in ('Efectivo', 'Transferencia', 'Tarjeta', 'Crédito', 'Mixto') then
    v_payment_method := 'Mixto';
  end if;

  -- Primera pasada: validar existencias y calcular costo estimado sin aplicar cambios parciales.
  for v_item in
    select *
    from public.bakery_custom_order_items
    where order_id = v_order.id and user_id = v_user_id
    order by sort_order, created_at
  loop
    v_total_quantity := v_total_quantity + coalesce(v_item.quantity, 0);

    if v_item.product_id is null then
      continue;
    end if;

    select * into v_product
    from public.products
    where id = v_item.product_id and user_id = v_user_id
    for update;

    if v_product.id is null then
      raise exception 'El producto % ya no existe o no pertenece al negocio actual.', v_item.item_name;
    end if;

    if coalesce(v_product.product_type, 'sale_product') = 'service' then
      continue;
    end if;

    v_stock_unit := coalesce(nullif(trim(v_product.stock_unit), ''), nullif(trim(v_product.size), ''), 'unidad');
    v_stock_quantity := public.inventiq_convert_quantity(v_item.quantity, v_item.unit, v_stock_unit);

    if v_stock_quantity <= 0 then
      raise exception 'La cantidad de % no puede convertirse a la unidad de inventario.', v_item.item_name;
    end if;

    if coalesce(v_product.stock, 0) + 0.000001 < v_stock_quantity then
      raise exception 'Stock insuficiente para %. Disponible: % %. Requerido: % %.',
        v_item.item_name,
        round(coalesce(v_product.stock, 0), 4),
        v_stock_unit,
        round(v_stock_quantity, 4),
        v_stock_unit;
    end if;

    v_total_cost := v_total_cost + (v_stock_quantity * greatest(coalesce(v_product.cost, 0), 0));
  end loop;

  v_total_cost := round(v_total_cost, 4);
  v_profit := round(coalesce(v_order.total, 0) - v_total_cost, 2);
  v_discount_percent := case
    when coalesce(v_order.subtotal, 0) > 0
      then round((coalesce(v_order.discount, 0) / v_order.subtotal) * 100, 4)
    else 0
  end;

  v_sale_code := 'V-' || v_order.order_code;
  if exists (
    select 1 from public.sales
    where user_id = v_user_id and code = v_sale_code
  ) then
    v_sale_code := v_sale_code || '-' || substr(replace(v_sale_id::text, '-', ''), 1, 6);
  end if;

  if v_item_count = 1 then
    select item_name into v_product_summary
    from public.bakery_custom_order_items
    where order_id = v_order.id and user_id = v_user_id
    limit 1;
  else
    v_product_summary := 'Pedido especial · ' || v_item_count || ' productos';
  end if;

  insert into public.sales (
    id,
    user_id,
    product_id,
    code,
    product,
    customer,
    payment_method,
    invoice_enabled,
    invoice_name,
    invoice_identification,
    invoice_address,
    invoice_email,
    quantity,
    subtotal,
    discount_percent,
    discount,
    total,
    profit,
    status,
    cash_amount,
    card_amount,
    transfer_amount,
    source_type,
    source_id,
    cash_already_recorded
  ) values (
    v_sale_id,
    v_user_id,
    case when v_item_count = 1 and v_linked_product_count = 1 then v_single_product_id else null end,
    v_sale_code,
    v_product_summary,
    v_order.customer_name,
    v_payment_method,
    false,
    '',
    '',
    coalesce(v_order.delivery_address, ''),
    coalesce(v_order.customer_email, ''),
    v_total_quantity,
    coalesce(v_order.subtotal, 0),
    v_discount_percent,
    coalesce(v_order.discount, 0),
    coalesce(v_order.total, 0),
    v_profit,
    'Completada',
    round(v_cash_amount, 2),
    round(v_card_amount, 2),
    round(v_transfer_amount, 2),
    'bakery_order',
    v_order.id,
    true
  );

  -- Segunda pasada: registrar detalle y aplicar salidas de producto terminado.
  for v_item in
    select *
    from public.bakery_custom_order_items
    where order_id = v_order.id and user_id = v_user_id
    order by sort_order, created_at
  loop
    v_stock_quantity := v_item.quantity;
    v_line_cost := 0;
    v_line_price := coalesce(v_item.unit_price, 0);

    if v_item.product_id is not null then
      select * into v_product
      from public.products
      where id = v_item.product_id and user_id = v_user_id
      for update;

      if coalesce(v_product.product_type, 'sale_product') <> 'service' then
        v_stock_unit := coalesce(nullif(trim(v_product.stock_unit), ''), nullif(trim(v_product.size), ''), 'unidad');
        v_stock_quantity := public.inventiq_convert_quantity(v_item.quantity, v_item.unit, v_stock_unit);
        v_stock_before := coalesce(v_product.stock, 0);
        v_stock_after := v_stock_before - v_stock_quantity;
        v_line_cost := round(v_stock_quantity * greatest(coalesce(v_product.cost, 0), 0), 4);
        v_line_price := case
          when v_stock_quantity > 0 then round(coalesce(v_item.line_total, 0) / v_stock_quantity, 6)
          else coalesce(v_item.unit_price, 0)
        end;

        update public.products
        set
          stock = v_stock_after,
          status = case when v_stock_after <= 0.000001 then 'Inactivo' else 'Activo' end
        where id = v_product.id and user_id = v_user_id;

        insert into public.inventory_movements (
          user_id,
          product_id,
          product_name,
          movement_type,
          quantity,
          stock_before,
          stock_after,
          unit,
          reference_type,
          reference_id,
          notes,
          created_by
        ) values (
          v_user_id,
          v_product.id,
          v_product.name,
          'sale',
          -v_stock_quantity,
          v_stock_before,
          v_stock_after,
          v_stock_unit,
          'bakery_order',
          v_order.id,
          'Entrega del pedido especial ' || v_order.order_code,
          v_user_id
        );
      end if;
    end if;

    insert into public.sale_items (
      user_id,
      sale_id,
      product_id,
      product,
      quantity,
      price,
      cost,
      subtotal,
      profit
    ) values (
      v_user_id,
      v_sale_id,
      v_item.product_id,
      v_item.item_name,
      v_stock_quantity,
      v_line_price,
      case when v_stock_quantity > 0 then round(v_line_cost / v_stock_quantity, 6) else 0 end,
      coalesce(v_item.line_total, 0),
      round(coalesce(v_item.line_total, 0) - v_line_cost, 2)
    );
  end loop;

  update public.bakery_custom_orders
  set
    status = 'delivered',
    delivered_at = coalesce(delivered_at, now()),
    sale_id = v_sale_id,
    sale_registered_at = now(),
    updated_by = v_user_id
  where id = v_order.id and user_id = v_user_id;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_code', v_order.order_code,
    'sale_id', v_sale_id,
    'sale_code', v_sale_code,
    'total', v_order.total,
    'estimated_cost', v_total_cost,
    'estimated_profit', v_profit,
    'already_registered', false
  );
end;
$$;

-- 3. Anular una venta proveniente de un pedido y devolver su stock sin borrar el historial.
create or replace function public.cancel_bakery_custom_order_sale(p_sale_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_sale public.sales%rowtype;
  v_order public.bakery_custom_orders%rowtype;
  v_item record;
  v_product public.products%rowtype;
  v_stock_before numeric;
  v_stock_after numeric;
  v_stock_unit text;
begin
  if v_user_id is null then
    raise exception 'No existe una sesión autenticada.';
  end if;

  select * into v_sale
  from public.sales
  where id = p_sale_id and user_id = v_user_id
  for update;

  if v_sale.id is null then
    raise exception 'La venta no existe o no pertenece al negocio actual.';
  end if;

  if v_sale.source_type <> 'bakery_order' or v_sale.source_id is null then
    raise exception 'La venta seleccionada no proviene de un pedido especial.';
  end if;

  if v_sale.status = 'Anulada' then
    return jsonb_build_object('sale_id', v_sale.id, 'already_cancelled', true);
  end if;

  select * into v_order
  from public.bakery_custom_orders
  where id = v_sale.source_id and user_id = v_user_id
  for update;

  for v_item in
    select * from public.sale_items
    where sale_id = v_sale.id and user_id = v_user_id
  loop
    if v_item.product_id is null then
      continue;
    end if;

    select * into v_product
    from public.products
    where id = v_item.product_id and user_id = v_user_id
    for update;

    if v_product.id is null or coalesce(v_product.product_type, 'sale_product') = 'service' then
      continue;
    end if;

    v_stock_unit := coalesce(nullif(trim(v_product.stock_unit), ''), nullif(trim(v_product.size), ''), 'unidad');
    v_stock_before := coalesce(v_product.stock, 0);
    v_stock_after := v_stock_before + coalesce(v_item.quantity, 0);

    update public.products
    set stock = v_stock_after, status = 'Activo'
    where id = v_product.id and user_id = v_user_id;

    insert into public.inventory_movements (
      user_id,
      product_id,
      product_name,
      movement_type,
      quantity,
      stock_before,
      stock_after,
      unit,
      reference_type,
      reference_id,
      notes,
      created_by
    ) values (
      v_user_id,
      v_product.id,
      v_product.name,
      'sale_return',
      coalesce(v_item.quantity, 0),
      v_stock_before,
      v_stock_after,
      v_stock_unit,
      'bakery_order_sale_cancel',
      v_sale.id,
      'Anulación de la venta ' || v_sale.code || ' vinculada a un pedido especial.',
      v_user_id
    );
  end loop;

  update public.sales
  set
    status = 'Anulada',
    source_type = 'bakery_order_cancelled'
  where id = v_sale.id and user_id = v_user_id;

  if v_order.id is not null then
    update public.bakery_custom_orders
    set
      status = 'ready',
      delivered_at = null,
      sale_id = null,
      sale_registered_at = null,
      updated_by = v_user_id
    where id = v_order.id and user_id = v_user_id;
  end if;

  return jsonb_build_object(
    'sale_id', v_sale.id,
    'sale_code', v_sale.code,
    'order_id', v_order.id,
    'order_code', v_order.order_code,
    'already_cancelled', false
  );
end;
$$;

revoke all on function public.finalize_bakery_custom_order_sale(uuid) from public;
revoke all on function public.cancel_bakery_custom_order_sale(uuid) from public;
grant execute on function public.finalize_bakery_custom_order_sale(uuid) to authenticated;
grant execute on function public.cancel_bakery_custom_order_sale(uuid) to authenticated;
