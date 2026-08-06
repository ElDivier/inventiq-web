-- INVENTIQ · Fase 7.5 · Pedidos especiales para panadería
-- Ejecutar una sola vez en Supabase > SQL Editor.
-- Migración no destructiva: no modifica productos, ventas, clientes ni datos existentes.

create extension if not exists pgcrypto;

create table if not exists public.bakery_custom_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  order_code text not null,
  customer_name text not null check (char_length(trim(customer_name)) between 2 and 180),
  customer_phone text not null check (char_length(trim(customer_phone)) between 5 and 40),
  customer_email text,
  fulfillment_type text not null default 'pickup' check (fulfillment_type in ('pickup', 'delivery')),
  delivery_date date not null,
  delivery_time time,
  delivery_address text,
  status text not null default 'quote' check (status in ('quote', 'confirmed', 'in_production', 'ready', 'delivered', 'cancelled')),
  occasion text,
  flavor text,
  filling text,
  size_label text,
  servings integer check (servings is null or servings >= 0),
  theme text,
  inscription text,
  notes text,
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  delivery_fee numeric(14,2) not null default 0 check (delivery_fee >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  confirmed_at timestamptz,
  production_started_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, order_code),
  check (discount <= subtotal),
  check (paid_amount <= total)
);

create table if not exists public.bakery_custom_order_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.bakery_custom_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  item_name text not null check (char_length(trim(item_name)) between 2 and 220),
  quantity numeric(14,4) not null check (quantity > 0),
  unit text not null default 'unidad',
  unit_price numeric(14,4) not null default 0 check (unit_price >= 0),
  line_total numeric(14,2) not null default 0 check (line_total >= 0),
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.bakery_custom_order_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.bakery_custom_orders(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('Efectivo', 'Transferencia', 'Tarjeta', 'Otro')),
  paid_at timestamptz not null default now(),
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists bakery_custom_orders_user_delivery_idx
  on public.bakery_custom_orders (user_id, delivery_date, delivery_time);

create index if not exists bakery_custom_orders_user_status_idx
  on public.bakery_custom_orders (user_id, status, delivery_date);

create index if not exists bakery_custom_orders_client_idx
  on public.bakery_custom_orders (client_id, delivery_date desc)
  where client_id is not null;

create index if not exists bakery_custom_order_items_order_idx
  on public.bakery_custom_order_items (order_id, sort_order);

create index if not exists bakery_custom_order_items_product_idx
  on public.bakery_custom_order_items (product_id)
  where product_id is not null;

create index if not exists bakery_custom_order_payments_order_idx
  on public.bakery_custom_order_payments (order_id, paid_at desc);

comment on table public.bakery_custom_orders is
'Pedidos especiales de panadería con cliente, fecha de entrega, personalización, estado y control de saldo.';

comment on table public.bakery_custom_order_items is
'Productos registrados o conceptos personalizados que forman parte de un pedido especial.';

comment on table public.bakery_custom_order_payments is
'Historial inmutable de anticipos y abonos registrados para pedidos especiales.';

create or replace function public.inventiq_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists bakery_custom_orders_touch_updated_at on public.bakery_custom_orders;
create trigger bakery_custom_orders_touch_updated_at
before update on public.bakery_custom_orders
for each row execute function public.inventiq_touch_updated_at();

alter table public.bakery_custom_orders enable row level security;
alter table public.bakery_custom_order_items enable row level security;
alter table public.bakery_custom_order_payments enable row level security;

-- Pedidos
drop policy if exists "bakery_custom_orders_owner_select" on public.bakery_custom_orders;
create policy "bakery_custom_orders_owner_select"
on public.bakery_custom_orders
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "bakery_custom_orders_owner_insert" on public.bakery_custom_orders;
create policy "bakery_custom_orders_owner_insert"
on public.bakery_custom_orders
for insert to authenticated
with check (
  auth.uid() = user_id
  and created_by = auth.uid()
  and updated_by = auth.uid()
  and (
    client_id is null
    or exists (
      select 1 from public.clients client
      where client.id = client_id and client.user_id = auth.uid()
    )
  )
);

drop policy if exists "bakery_custom_orders_owner_update" on public.bakery_custom_orders;
create policy "bakery_custom_orders_owner_update"
on public.bakery_custom_orders
for update to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and updated_by = auth.uid()
  and (
    client_id is null
    or exists (
      select 1 from public.clients client
      where client.id = client_id and client.user_id = auth.uid()
    )
  )
);

-- Detalle de productos
drop policy if exists "bakery_custom_order_items_owner_select" on public.bakery_custom_order_items;
create policy "bakery_custom_order_items_owner_select"
on public.bakery_custom_order_items
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "bakery_custom_order_items_owner_insert" on public.bakery_custom_order_items;
create policy "bakery_custom_order_items_owner_insert"
on public.bakery_custom_order_items
for insert to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.bakery_custom_orders orders
    where orders.id = order_id and orders.user_id = auth.uid()
  )
  and (
    product_id is null
    or exists (
      select 1 from public.products product
      where product.id = product_id and product.user_id = auth.uid()
    )
  )
);

drop policy if exists "bakery_custom_order_items_owner_delete" on public.bakery_custom_order_items;
create policy "bakery_custom_order_items_owner_delete"
on public.bakery_custom_order_items
for delete to authenticated
using (auth.uid() = user_id);

-- Pagos
drop policy if exists "bakery_custom_order_payments_owner_select" on public.bakery_custom_order_payments;
create policy "bakery_custom_order_payments_owner_select"
on public.bakery_custom_order_payments
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "bakery_custom_order_payments_owner_insert" on public.bakery_custom_order_payments;
create policy "bakery_custom_order_payments_owner_insert"
on public.bakery_custom_order_payments
for insert to authenticated
with check (
  auth.uid() = user_id
  and created_by = auth.uid()
  and exists (
    select 1 from public.bakery_custom_orders orders
    where orders.id = order_id and orders.user_id = auth.uid()
  )
);

-- No se habilita update/delete para pagos; se conserva la trazabilidad.

revoke insert, update, delete on public.bakery_custom_orders from authenticated;
revoke insert, update, delete on public.bakery_custom_order_items from authenticated;
revoke insert, update, delete on public.bakery_custom_order_payments from authenticated;
grant select on public.bakery_custom_orders to authenticated;
grant select on public.bakery_custom_order_items to authenticated;
grant select on public.bakery_custom_order_payments to authenticated;

create or replace function public.save_bakery_custom_order(
  p_order_id uuid,
  p_client_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_fulfillment_type text,
  p_delivery_date date,
  p_delivery_time time,
  p_delivery_address text,
  p_status text,
  p_occasion text,
  p_flavor text,
  p_filling text,
  p_size_label text,
  p_servings integer,
  p_theme text,
  p_inscription text,
  p_notes text,
  p_discount numeric,
  p_delivery_fee numeric,
  p_items jsonb,
  p_initial_payment numeric,
  p_payment_method text,
  p_payment_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.bakery_custom_orders%rowtype;
  v_order_id uuid;
  v_order_code text;
  v_item jsonb;
  v_product_id uuid;
  v_item_name text;
  v_quantity numeric;
  v_unit text;
  v_unit_price numeric;
  v_line_total numeric;
  v_subtotal numeric := 0;
  v_discount numeric := greatest(coalesce(p_discount, 0), 0);
  v_delivery_fee numeric := greatest(coalesce(p_delivery_fee, 0), 0);
  v_total numeric;
  v_paid_amount numeric := 0;
  v_initial_payment numeric := greatest(coalesce(p_initial_payment, 0), 0);
  v_status text := lower(trim(coalesce(p_status, 'quote')));
  v_fulfillment text := lower(trim(coalesce(p_fulfillment_type, 'pickup')));
  v_attempt integer := 0;
  v_sort integer := 0;
begin
  if v_user_id is null then
    raise exception 'No existe una sesión autenticada.';
  end if;

  if nullif(trim(coalesce(p_customer_name, '')), '') is null then
    raise exception 'Ingresa el nombre del cliente.';
  end if;

  if nullif(trim(coalesce(p_customer_phone, '')), '') is null then
    raise exception 'Ingresa un teléfono de contacto.';
  end if;

  if p_delivery_date is null then
    raise exception 'Selecciona la fecha de entrega.';
  end if;

  if v_fulfillment not in ('pickup', 'delivery') then
    raise exception 'La modalidad de entrega no es válida.';
  end if;

  if v_fulfillment = 'delivery' and nullif(trim(coalesce(p_delivery_address, '')), '') is null then
    raise exception 'Ingresa la dirección de entrega.';
  end if;

  if v_status not in ('quote', 'confirmed', 'in_production', 'ready', 'delivered', 'cancelled') then
    raise exception 'El estado del pedido no es válido.';
  end if;

  if p_client_id is not null and not exists (
    select 1 from public.clients client
    where client.id = p_client_id and client.user_id = v_user_id
  ) then
    raise exception 'El cliente seleccionado no pertenece al negocio actual.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega al menos un producto al pedido.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_product_id := nullif(trim(coalesce(v_item->>'product_id', '')), '')::uuid;
    exception when invalid_text_representation then
      raise exception 'Uno de los productos seleccionados no es válido.';
    end;

    v_item_name := trim(coalesce(v_item->>'item_name', ''));
    v_quantity := coalesce(nullif(v_item->>'quantity', '')::numeric, 0);
    v_unit_price := greatest(coalesce(nullif(v_item->>'unit_price', '')::numeric, 0), 0);

    if char_length(v_item_name) < 2 then
      raise exception 'Todos los productos deben tener una descripción.';
    end if;

    if v_quantity <= 0 then
      raise exception 'La cantidad de % debe ser mayor a cero.', v_item_name;
    end if;

    if v_product_id is not null and not exists (
      select 1 from public.products product
      where product.id = v_product_id and product.user_id = v_user_id
    ) then
      raise exception 'El producto % no pertenece al negocio actual.', v_item_name;
    end if;

    v_line_total := round(v_quantity * v_unit_price, 2);
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  v_subtotal := round(v_subtotal, 2);
  v_discount := round(v_discount, 2);
  v_delivery_fee := round(v_delivery_fee, 2);

  if v_discount > v_subtotal then
    raise exception 'El descuento no puede superar el subtotal.';
  end if;

  v_total := round(v_subtotal - v_discount + v_delivery_fee, 2);

  if p_order_id is null then
    if v_status not in ('quote', 'confirmed') then
      raise exception 'Un pedido nuevo debe iniciar como cotización o confirmado.';
    end if;

    if v_initial_payment > v_total then
      raise exception 'El anticipo no puede superar el total del pedido.';
    end if;

    if v_initial_payment > 0 and v_status = 'quote' then
      v_status := 'confirmed';
    end if;

    loop
      v_attempt := v_attempt + 1;
      v_order_code := 'PED-' || to_char(p_delivery_date, 'YYYYMMDD') || '-' || lpad((floor(random() * 10000))::integer::text, 4, '0');
      exit when not exists (
        select 1 from public.bakery_custom_orders
        where user_id = v_user_id and order_code = v_order_code
      );
      if v_attempt >= 30 then
        raise exception 'No se pudo generar el código del pedido. Intenta nuevamente.';
      end if;
    end loop;

    v_order_id := gen_random_uuid();
    v_paid_amount := round(v_initial_payment, 2);

    insert into public.bakery_custom_orders (
      id, user_id, client_id, order_code, customer_name, customer_phone, customer_email,
      fulfillment_type, delivery_date, delivery_time, delivery_address, status,
      occasion, flavor, filling, size_label, servings, theme, inscription, notes,
      subtotal, discount, delivery_fee, total, paid_amount,
      confirmed_at, created_by, updated_by
    ) values (
      v_order_id, v_user_id, p_client_id, v_order_code, trim(p_customer_name), trim(p_customer_phone),
      nullif(trim(coalesce(p_customer_email, '')), ''), v_fulfillment, p_delivery_date, p_delivery_time,
      case when v_fulfillment = 'delivery' then nullif(trim(coalesce(p_delivery_address, '')), '') else null end,
      v_status, nullif(trim(coalesce(p_occasion, '')), ''), nullif(trim(coalesce(p_flavor, '')), ''),
      nullif(trim(coalesce(p_filling, '')), ''), nullif(trim(coalesce(p_size_label, '')), ''),
      p_servings, nullif(trim(coalesce(p_theme, '')), ''), nullif(trim(coalesce(p_inscription, '')), ''),
      nullif(trim(coalesce(p_notes, '')), ''), v_subtotal, v_discount, v_delivery_fee, v_total,
      v_paid_amount, case when v_status <> 'quote' then now() else null end, v_user_id, v_user_id
    );
  else
    select * into v_order
    from public.bakery_custom_orders
    where id = p_order_id and user_id = v_user_id
    for update;

    if v_order.id is null then
      raise exception 'El pedido no existe o no pertenece al negocio actual.';
    end if;

    if v_order.status in ('delivered', 'cancelled') then
      raise exception 'Los pedidos entregados o cancelados no pueden modificarse.';
    end if;

    if v_total < v_order.paid_amount then
      raise exception 'El total actualizado no puede ser menor al valor ya abonado (%).', v_order.paid_amount;
    end if;

    v_order_id := v_order.id;
    v_order_code := v_order.order_code;
    v_paid_amount := v_order.paid_amount;
    v_status := v_order.status;

    update public.bakery_custom_orders
    set
      client_id = p_client_id,
      customer_name = trim(p_customer_name),
      customer_phone = trim(p_customer_phone),
      customer_email = nullif(trim(coalesce(p_customer_email, '')), ''),
      fulfillment_type = v_fulfillment,
      delivery_date = p_delivery_date,
      delivery_time = p_delivery_time,
      delivery_address = case when v_fulfillment = 'delivery' then nullif(trim(coalesce(p_delivery_address, '')), '') else null end,
      occasion = nullif(trim(coalesce(p_occasion, '')), ''),
      flavor = nullif(trim(coalesce(p_flavor, '')), ''),
      filling = nullif(trim(coalesce(p_filling, '')), ''),
      size_label = nullif(trim(coalesce(p_size_label, '')), ''),
      servings = p_servings,
      theme = nullif(trim(coalesce(p_theme, '')), ''),
      inscription = nullif(trim(coalesce(p_inscription, '')), ''),
      notes = nullif(trim(coalesce(p_notes, '')), ''),
      subtotal = v_subtotal,
      discount = v_discount,
      delivery_fee = v_delivery_fee,
      total = v_total,
      updated_by = v_user_id
    where id = v_order_id and user_id = v_user_id;

    delete from public.bakery_custom_order_items
    where order_id = v_order_id and user_id = v_user_id;
  end if;

  v_sort := 0;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(trim(coalesce(v_item->>'product_id', '')), '')::uuid;
    v_item_name := trim(v_item->>'item_name');
    v_quantity := (v_item->>'quantity')::numeric;
    v_unit := coalesce(nullif(trim(v_item->>'unit'), ''), 'unidad');
    v_unit_price := greatest(coalesce(nullif(v_item->>'unit_price', '')::numeric, 0), 0);
    v_line_total := round(v_quantity * v_unit_price, 2);

    insert into public.bakery_custom_order_items (
      user_id, order_id, product_id, item_name, quantity, unit, unit_price, line_total, notes, sort_order
    ) values (
      v_user_id, v_order_id, v_product_id, v_item_name, v_quantity, v_unit, v_unit_price, v_line_total,
      nullif(trim(coalesce(v_item->>'notes', '')), ''), v_sort
    );

    v_sort := v_sort + 1;
  end loop;

  if p_order_id is null and v_initial_payment > 0 then
    if coalesce(p_payment_method, '') not in ('Efectivo', 'Transferencia', 'Tarjeta', 'Otro') then
      raise exception 'El método de pago del anticipo no es válido.';
    end if;

    insert into public.bakery_custom_order_payments (
      user_id, order_id, amount, payment_method, paid_at, notes, created_by
    ) values (
      v_user_id, v_order_id, round(v_initial_payment, 2), p_payment_method, now(),
      nullif(trim(coalesce(p_payment_notes, '')), ''), v_user_id
    );
  end if;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_code', v_order_code,
    'status', v_status,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'delivery_fee', v_delivery_fee,
    'total', v_total,
    'paid_amount', v_paid_amount,
    'balance', round(v_total - v_paid_amount, 2)
  );
end;
$$;

create or replace function public.register_bakery_custom_order_payment(
  p_order_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_paid_at timestamptz,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.bakery_custom_orders%rowtype;
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_balance numeric;
  v_payment_id uuid := gen_random_uuid();
begin
  if v_user_id is null then
    raise exception 'No existe una sesión autenticada.';
  end if;

  if v_amount <= 0 then
    raise exception 'El valor del abono debe ser mayor a cero.';
  end if;

  if coalesce(p_payment_method, '') not in ('Efectivo', 'Transferencia', 'Tarjeta', 'Otro') then
    raise exception 'El método de pago no es válido.';
  end if;

  select * into v_order
  from public.bakery_custom_orders
  where id = p_order_id and user_id = v_user_id
  for update;

  if v_order.id is null then
    raise exception 'El pedido no existe o no pertenece al negocio actual.';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'No se pueden registrar abonos en un pedido cancelado.';
  end if;

  v_balance := round(v_order.total - v_order.paid_amount, 2);

  if v_balance <= 0 then
    raise exception 'El pedido ya está pagado por completo.';
  end if;

  if v_amount > v_balance then
    raise exception 'El abono (%) supera el saldo pendiente (%).', v_amount, v_balance;
  end if;

  insert into public.bakery_custom_order_payments (
    id, user_id, order_id, amount, payment_method, paid_at, notes, created_by
  ) values (
    v_payment_id, v_user_id, v_order.id, v_amount, p_payment_method,
    coalesce(p_paid_at, now()), nullif(trim(coalesce(p_notes, '')), ''), v_user_id
  );

  update public.bakery_custom_orders
  set
    paid_amount = round(paid_amount + v_amount, 2),
    status = case when status = 'quote' then 'confirmed' else status end,
    confirmed_at = case when status = 'quote' and confirmed_at is null then now() else confirmed_at end,
    updated_by = v_user_id
  where id = v_order.id and user_id = v_user_id;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'order_id', v_order.id,
    'order_code', v_order.order_code,
    'amount', v_amount,
    'paid_amount', round(v_order.paid_amount + v_amount, 2),
    'balance', round(v_balance - v_amount, 2)
  );
end;
$$;

create or replace function public.update_bakery_custom_order_status(
  p_order_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.bakery_custom_orders%rowtype;
  v_status text := lower(trim(coalesce(p_status, '')));
begin
  if v_user_id is null then
    raise exception 'No existe una sesión autenticada.';
  end if;

  if v_status not in ('quote', 'confirmed', 'in_production', 'ready', 'delivered', 'cancelled') then
    raise exception 'El estado indicado no es válido.';
  end if;

  select * into v_order
  from public.bakery_custom_orders
  where id = p_order_id and user_id = v_user_id
  for update;

  if v_order.id is null then
    raise exception 'El pedido no existe o no pertenece al negocio actual.';
  end if;

  if v_order.status in ('delivered', 'cancelled') and v_order.status <> v_status then
    raise exception 'Los pedidos entregados o cancelados no pueden reactivarse desde esta pantalla.';
  end if;

  update public.bakery_custom_orders
  set
    status = v_status,
    confirmed_at = case when v_status = 'confirmed' and confirmed_at is null then now() else confirmed_at end,
    production_started_at = case when v_status = 'in_production' and production_started_at is null then now() else production_started_at end,
    ready_at = case when v_status = 'ready' and ready_at is null then now() else ready_at end,
    delivered_at = case when v_status = 'delivered' then now() else delivered_at end,
    cancelled_at = case when v_status = 'cancelled' then now() else cancelled_at end,
    updated_by = v_user_id
  where id = v_order.id and user_id = v_user_id;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_code', v_order.order_code,
    'previous_status', v_order.status,
    'status', v_status,
    'balance', round(v_order.total - v_order.paid_amount, 2)
  );
end;
$$;

revoke all on function public.save_bakery_custom_order(
  uuid, uuid, text, text, text, text, date, time, text, text, text, text, text, text, integer, text, text, text, numeric, numeric, jsonb, numeric, text, text
) from public;

grant execute on function public.save_bakery_custom_order(
  uuid, uuid, text, text, text, text, date, time, text, text, text, text, text, text, integer, text, text, text, numeric, numeric, jsonb, numeric, text, text
) to authenticated;

revoke all on function public.register_bakery_custom_order_payment(uuid, numeric, text, timestamptz, text) from public;
grant execute on function public.register_bakery_custom_order_payment(uuid, numeric, text, timestamptz, text) to authenticated;

revoke all on function public.update_bakery_custom_order_status(uuid, text) from public;
grant execute on function public.update_bakery_custom_order_status(uuid, text) to authenticated;

-- Habilita actualizaciones en tiempo real sin fallar si las tablas ya forman parte de la publicación.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bakery_custom_orders'
    ) then
      alter publication supabase_realtime add table public.bakery_custom_orders;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bakery_custom_order_payments'
    ) then
      alter publication supabase_realtime add table public.bakery_custom_order_payments;
    end if;
  end if;
end $$;
