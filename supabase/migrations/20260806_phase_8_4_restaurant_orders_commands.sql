-- INVENTIQ · Fase 8.4 · Pedidos y comandas para restaurantes
-- Migración no destructiva. Crea cuentas abiertas, rondas de comanda y trazabilidad por ítem.

create table if not exists public.restaurant_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  table_id uuid references public.restaurant_tables(id) on delete set null,
  area_id uuid references public.restaurant_areas(id) on delete set null,
  order_code text not null,
  order_type text not null default 'local',
  order_reference text not null default '',
  status text not null default 'borrador',
  waiter_name text not null default '',
  guest_count integer not null default 1,
  customer_name text not null default '',
  notes text not null default '',
  subtotal numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  opened_at timestamptz not null default now(),
  sent_at timestamptz,
  bill_requested_at timestamptz,
  closed_at timestamptz,
  sale_id uuid references public.sales(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_orders_type_valid check (order_type in ('local', 'takeaway', 'delivery')),
  constraint restaurant_orders_status_valid check (status in ('borrador', 'enviada', 'preparacion', 'lista', 'servida', 'cuenta', 'cerrada', 'cancelada')),
  constraint restaurant_orders_guests_valid check (guest_count between 1 and 100),
  constraint restaurant_orders_amounts_valid check (subtotal >= 0 and total >= 0)
);

create table if not exists public.restaurant_order_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.restaurant_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  category text not null default '',
  kitchen_station text not null default 'cocina',
  course text not null default 'principal',
  seat_number integer,
  quantity numeric(12,3) not null default 1,
  unit_price numeric(14,2) not null default 0,
  modifiers jsonb not null default '[]'::jsonb,
  notes text not null default '',
  status text not null default 'pendiente',
  sent_at timestamptz,
  started_at timestamptz,
  ready_at timestamptz,
  served_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_order_items_name_not_empty check (char_length(trim(product_name)) > 0),
  constraint restaurant_order_items_quantity_valid check (quantity > 0),
  constraint restaurant_order_items_price_valid check (unit_price >= 0),
  constraint restaurant_order_items_course_valid check (course in ('entrada', 'principal', 'postre', 'bebida', 'sin_curso')),
  constraint restaurant_order_items_status_valid check (status in ('pendiente', 'enviado', 'preparacion', 'listo', 'servido', 'cancelado')),
  constraint restaurant_order_items_seat_valid check (seat_number is null or seat_number between 1 and 100)
);

create unique index if not exists restaurant_orders_code_uidx
  on public.restaurant_orders (user_id, order_code);

create unique index if not exists restaurant_orders_active_table_uidx
  on public.restaurant_orders (user_id, table_id)
  where table_id is not null and status not in ('cerrada', 'cancelada');

create index if not exists restaurant_orders_user_status_idx
  on public.restaurant_orders (user_id, status, opened_at desc);

create index if not exists restaurant_order_items_order_status_idx
  on public.restaurant_order_items (order_id, status, sort_order, created_at);

comment on table public.restaurant_orders is
'Cuentas abiertas y pedidos gastronómicos vinculados a mesa, para llevar o delivery.';

comment on table public.restaurant_order_items is
'Ítems de comanda con curso, asiento, estación, modificadores, observaciones y estado de cocina.';

-- Reutiliza la función de timestamps instalada en fases anteriores.
drop trigger if exists restaurant_orders_touch_updated_at on public.restaurant_orders;
create trigger restaurant_orders_touch_updated_at
before update on public.restaurant_orders
for each row execute function public.inventiq_touch_updated_at();

drop trigger if exists restaurant_order_items_touch_updated_at on public.restaurant_order_items;
create trigger restaurant_order_items_touch_updated_at
before update on public.restaurant_order_items
for each row execute function public.inventiq_touch_updated_at();

alter table public.restaurant_orders enable row level security;
alter table public.restaurant_order_items enable row level security;

grant select, insert, update, delete on public.restaurant_orders to authenticated;
grant select, insert, update, delete on public.restaurant_order_items to authenticated;

drop policy if exists "restaurant_orders_owner_all" on public.restaurant_orders;
create policy "restaurant_orders_owner_all"
on public.restaurant_orders
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "restaurant_order_items_owner_all" on public.restaurant_order_items;
create policy "restaurant_order_items_owner_all"
on public.restaurant_order_items
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

create or replace function public.restaurant_save_order(
  p_order_id uuid default null,
  p_table_id uuid default null,
  p_area_id uuid default null,
  p_order_type text default 'local',
  p_order_reference text default '',
  p_waiter_name text default '',
  p_guest_count integer default 1,
  p_customer_name text default '',
  p_notes text default '',
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id uuid := p_order_id;
  v_order_type text := lower(trim(coalesce(p_order_type, 'local')));
  v_order_code text;
  v_item jsonb;
  v_product_id uuid;
  v_table public.restaurant_tables;
  v_sort integer := 0;
begin
  if v_user_id is null then raise exception 'No existe una sesión activa.'; end if;

  if not exists (select 1 from public.profiles where id = v_user_id and business_type = 'restaurante') then
    raise exception 'Los pedidos y comandas solo están disponibles para cuentas Restaurante.';
  end if;

  if v_order_type not in ('local', 'takeaway', 'delivery') then
    raise exception 'Tipo de pedido no válido.';
  end if;

  if v_order_type = 'local' then
    if p_table_id is null then raise exception 'Selecciona una mesa para el consumo en local.'; end if;
    select * into v_table from public.restaurant_tables
    where id = p_table_id and user_id = v_user_id and is_active = true
    for update;
    if not found then raise exception 'Mesa no encontrada.'; end if;
    if v_table.status = 'limpieza' then raise exception 'La mesa está pendiente de limpieza.'; end if;
  end if;

  if v_order_id is null and p_table_id is not null then
    select id into v_order_id from public.restaurant_orders
    where user_id = v_user_id and table_id = p_table_id
      and status not in ('cerrada', 'cancelada')
    order by opened_at desc limit 1;
  end if;

  if v_order_id is null then
    v_order_code := 'CMD-' || to_char(now(), 'YYMMDD') || '-' || lpad((
      select (count(*) + 1)::text from public.restaurant_orders where user_id = v_user_id
    ), 4, '0');

    insert into public.restaurant_orders (
      user_id, table_id, area_id, order_code, order_type, order_reference,
      waiter_name, guest_count, customer_name, notes
    ) values (
      v_user_id, p_table_id, p_area_id, v_order_code, v_order_type,
      trim(coalesce(p_order_reference, '')), trim(coalesce(p_waiter_name, '')),
      greatest(1, coalesce(p_guest_count, 1)), trim(coalesce(p_customer_name, '')),
      trim(coalesce(p_notes, ''))
    ) returning id into v_order_id;
  else
    if not exists (
      select 1 from public.restaurant_orders
      where id = v_order_id and user_id = v_user_id and status not in ('cerrada', 'cancelada')
    ) then raise exception 'El pedido ya no está activo.'; end if;

    update public.restaurant_orders
    set table_id = p_table_id,
        area_id = p_area_id,
        order_type = v_order_type,
        order_reference = trim(coalesce(p_order_reference, '')),
        waiter_name = trim(coalesce(p_waiter_name, '')),
        guest_count = greatest(1, coalesce(p_guest_count, 1)),
        customer_name = trim(coalesce(p_customer_name, '')),
        notes = trim(coalesce(p_notes, ''))
    where id = v_order_id and user_id = v_user_id;
  end if;

  -- Solo reemplaza la ronda que todavía no fue enviada a cocina.
  delete from public.restaurant_order_items
  where order_id = v_order_id and user_id = v_user_id and status = 'pendiente';

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    begin
      v_product_id := nullif(v_item->>'productId', '')::uuid;
    exception when invalid_text_representation then
      v_product_id := null;
    end;

    insert into public.restaurant_order_items (
      user_id, order_id, product_id, product_name, category, kitchen_station,
      course, seat_number, quantity, unit_price, modifiers, notes, status, sort_order
    ) values (
      v_user_id,
      v_order_id,
      v_product_id,
      trim(coalesce(v_item->>'product', v_item->>'productName', 'Producto')),
      trim(coalesce(v_item->>'category', '')),
      trim(coalesce(v_item->>'kitchenStation', 'cocina')),
      case when coalesce(v_item->>'course', 'principal') in ('entrada','principal','postre','bebida','sin_curso')
        then coalesce(v_item->>'course', 'principal') else 'principal' end,
      nullif(v_item->>'seatNumber', '')::integer,
      greatest(0.001, coalesce((v_item->>'quantity')::numeric, 1)),
      greatest(0, coalesce((v_item->>'price')::numeric, (v_item->>'unitPrice')::numeric, 0)),
      coalesce(v_item->'modifiers', '[]'::jsonb),
      trim(coalesce(v_item->>'notes', '')),
      'pendiente',
      v_sort
    );
    v_sort := v_sort + 1;
  end loop;

  perform public.restaurant_recalculate_order(v_order_id);

  if p_table_id is not null then
    update public.restaurant_tables
    set status = case when status in ('libre','reservada') then 'ocupada' else status end,
        guest_count = greatest(1, coalesce(p_guest_count, guest_count, 1)),
        waiter_name = trim(coalesce(p_waiter_name, waiter_name, '')),
        opened_at = coalesce(opened_at, now()),
        reservation_name = '', reserved_for = null
    where id = p_table_id and user_id = v_user_id;
  end if;

  return v_order_id;
end;
$$;

create or replace function public.restaurant_send_order(p_order_id uuid)
returns public.restaurant_orders
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.restaurant_orders;
  v_pending integer;
begin
  if v_user_id is null then raise exception 'No existe una sesión activa.'; end if;

  select * into v_order from public.restaurant_orders
  where id = p_order_id and user_id = v_user_id and status not in ('cerrada','cancelada')
  for update;
  if not found then raise exception 'Pedido no encontrado.'; end if;

  select count(*) into v_pending from public.restaurant_order_items
  where order_id = p_order_id and user_id = v_user_id and status = 'pendiente';
  if v_pending = 0 then raise exception 'No hay productos nuevos para enviar a cocina.'; end if;

  update public.restaurant_order_items
  set status = 'enviado', sent_at = now()
  where order_id = p_order_id and user_id = v_user_id and status = 'pendiente';

  update public.restaurant_orders
  set status = 'enviada', sent_at = coalesce(sent_at, now())
  where id = p_order_id returning * into v_order;

  if v_order.table_id is not null then
    update public.restaurant_tables
    set status = 'preparacion', current_total = v_order.total
    where id = v_order.table_id and user_id = v_user_id;
  end if;

  return v_order;
end;
$$;

create or replace function public.restaurant_request_bill(p_order_id uuid)
returns public.restaurant_orders
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.restaurant_orders;
begin
  select * into v_order from public.restaurant_orders
  where id = p_order_id and user_id = v_user_id and status not in ('cerrada','cancelada')
  for update;
  if not found then raise exception 'Pedido no encontrado.'; end if;

  update public.restaurant_orders set status = 'cuenta', bill_requested_at = now()
  where id = p_order_id returning * into v_order;

  if v_order.table_id is not null then
    update public.restaurant_tables set status = 'cobrar', bill_requested_at = now(), current_total = v_order.total
    where id = v_order.table_id and user_id = v_user_id;
  end if;
  return v_order;
end;
$$;

create or replace function public.restaurant_cancel_order_item(p_item_id uuid, p_reason text)
returns public.restaurant_orders
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_order public.restaurant_orders;
begin
  if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Indica el motivo de cancelación.'; end if;

  update public.restaurant_order_items
  set status = 'cancelado', cancellation_reason = trim(p_reason), cancelled_at = now()
  where id = p_item_id and user_id = v_user_id and status <> 'cancelado'
  returning order_id into v_order_id;
  if v_order_id is null then raise exception 'Ítem no encontrado o ya cancelado.'; end if;

  select * into v_order from public.restaurant_recalculate_order(v_order_id);
  return v_order;
end;
$$;

create or replace function public.restaurant_transfer_order(p_order_id uuid, p_target_table_id uuid)
returns public.restaurant_orders
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.restaurant_orders;
  v_source_table uuid;
  v_target public.restaurant_tables;
begin
  select * into v_order from public.restaurant_orders
  where id = p_order_id and user_id = v_user_id and status not in ('cerrada','cancelada')
  for update;
  if not found then raise exception 'Pedido no encontrado.'; end if;

  select * into v_target from public.restaurant_tables
  where id = p_target_table_id and user_id = v_user_id and is_active = true
  for update;
  if not found then raise exception 'Mesa de destino no encontrada.'; end if;
  if v_target.status <> 'libre' then raise exception 'La mesa de destino debe estar libre.'; end if;

  v_source_table := v_order.table_id;
  update public.restaurant_orders
  set table_id = v_target.id, area_id = v_target.area_id, order_type = 'local', order_reference = v_target.name
  where id = p_order_id returning * into v_order;

  update public.restaurant_tables
  set status = case when v_order.status = 'cuenta' then 'cobrar' when v_order.status in ('enviada','preparacion') then 'preparacion' else 'ocupada' end,
      guest_count = v_order.guest_count, waiter_name = v_order.waiter_name,
      opened_at = v_order.opened_at, current_total = v_order.total
  where id = v_target.id and user_id = v_user_id;

  if v_source_table is not null and v_source_table <> v_target.id then
    update public.restaurant_tables
    set status = 'limpieza', guest_count = 0, waiter_name = '', current_total = 0,
        bill_requested_at = null, notes = ''
    where id = v_source_table and user_id = v_user_id;
  end if;

  return v_order;
end;
$$;

grant execute on function public.restaurant_recalculate_order(uuid) to authenticated;
grant execute on function public.restaurant_save_order(uuid,uuid,uuid,text,text,text,integer,text,text,jsonb) to authenticated;
grant execute on function public.restaurant_send_order(uuid) to authenticated;
grant execute on function public.restaurant_request_bill(uuid) to authenticated;
grant execute on function public.restaurant_cancel_order_item(uuid,text) to authenticated;
grant execute on function public.restaurant_transfer_order(uuid,uuid) to authenticated;

-- Realtime para salón, comandas y futura pantalla de cocina.
do $$
begin
  begin alter publication supabase_realtime add table public.restaurant_orders; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.restaurant_order_items; exception when duplicate_object then null; end;
end $$;
