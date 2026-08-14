-- INVENTIQ · Fase 8.5 · Pantalla de cocina (KDS) para restaurantes
-- Migración no destructiva. Añade tiempos objetivo, prioridad y funciones seguras
-- para mover cada ítem por el flujo: enviado -> preparación -> listo -> servido.

alter table public.restaurant_order_items
  add column if not exists preparation_minutes integer not null default 15,
  add column if not exists is_priority boolean not null default false,
  add column if not exists priority_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'restaurant_order_items_preparation_minutes_valid'
  ) then
    alter table public.restaurant_order_items
      add constraint restaurant_order_items_preparation_minutes_valid
      check (preparation_minutes between 1 and 240);
  end if;
end $$;

create index if not exists restaurant_order_items_kitchen_board_idx
  on public.restaurant_order_items (user_id, kitchen_station, status, sent_at, created_at)
  where status in ('enviado', 'preparacion', 'listo');

comment on column public.restaurant_order_items.preparation_minutes is
'Tiempo objetivo de preparación mostrado en la pantalla de cocina.';
comment on column public.restaurant_order_items.is_priority is
'Indica que el ítem requiere atención prioritaria en cocina.';

-- Copia el tiempo configurado en el menú al crear una línea de comanda.
create or replace function public.restaurant_apply_kitchen_item_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_minutes integer;
begin
  if new.product_id is not null then
    select greatest(
      1,
      least(
        240,
        coalesce(nullif((p.product_metadata->>'preparationMinutes')::integer, 0), 15)
      )
    )
    into v_minutes
    from public.products p
    where p.id = new.product_id;
  end if;

  new.preparation_minutes := coalesce(v_minutes, nullif(new.preparation_minutes, 0), 15);
  return new;
exception when invalid_text_representation then
  new.preparation_minutes := coalesce(nullif(new.preparation_minutes, 0), 15);
  return new;
end;
$$;

drop trigger if exists restaurant_order_items_kitchen_defaults on public.restaurant_order_items;
create trigger restaurant_order_items_kitchen_defaults
before insert or update of product_id on public.restaurant_order_items
for each row execute function public.restaurant_apply_kitchen_item_defaults();

-- Actualiza comandas existentes con el tiempo configurado actualmente en Productos.
update public.restaurant_order_items roi
set preparation_minutes = greatest(
  1,
  least(
    240,
    case
      when coalesce(p.product_metadata->>'preparationMinutes', '') ~ '^[0-9]+$'
        then coalesce(nullif((p.product_metadata->>'preparationMinutes')::integer, 0), 15)
      else 15
    end
  )
)
from public.products p
where roi.product_id = p.id;

create or replace function public.restaurant_sync_kitchen_order(p_order_id uuid)
returns public.restaurant_orders
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.restaurant_orders;
  v_dispatched integer := 0;
  v_preparing integer := 0;
  v_ready integer := 0;
  v_served integer := 0;
  v_next_status text;
begin
  if v_user_id is null then raise exception 'No existe una sesión activa.'; end if;

  select * into v_order
  from public.restaurant_orders
  where id = p_order_id and user_id = v_user_id
  for update;

  if not found then raise exception 'Pedido no encontrado.'; end if;

  select
    count(*) filter (where status in ('enviado','preparacion','listo','servido')),
    count(*) filter (where status = 'preparacion'),
    count(*) filter (where status = 'listo'),
    count(*) filter (where status = 'servido')
  into v_dispatched, v_preparing, v_ready, v_served
  from public.restaurant_order_items
  where order_id = p_order_id
    and user_id = v_user_id
    and status <> 'cancelado';

  -- Cuenta solicitada, cerrada o cancelada mantienen su estado comercial.
  if v_order.status in ('cuenta','cerrada','cancelada') then
    return v_order;
  end if;

  v_next_status := case
    when v_dispatched = 0 then 'borrador'
    when v_served = v_dispatched then 'servida'
    when (v_ready + v_served) = v_dispatched then 'lista'
    when v_preparing > 0 then 'preparacion'
    else 'enviada'
  end;

  update public.restaurant_orders
  set status = v_next_status
  where id = p_order_id
  returning * into v_order;

  if v_order.table_id is not null then
    update public.restaurant_tables
    set status = case
      when v_next_status in ('enviada','preparacion','lista') then 'preparacion'
      when v_next_status = 'servida' then 'servida'
      else status
    end,
    current_total = v_order.total
    where id = v_order.table_id and user_id = v_user_id and status <> 'cobrar';
  end if;

  return v_order;
end;
$$;

create or replace function public.restaurant_kitchen_set_item_status(
  p_item_id uuid,
  p_status text
)
returns public.restaurant_order_items
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.restaurant_order_items;
  v_target text := lower(trim(coalesce(p_status, '')));
begin
  if v_user_id is null then raise exception 'No existe una sesión activa.'; end if;
  if v_target not in ('preparacion','listo','servido') then
    raise exception 'Estado de cocina no válido.';
  end if;

  select * into v_item
  from public.restaurant_order_items
  where id = p_item_id and user_id = v_user_id
  for update;

  if not found then raise exception 'Ítem de comanda no encontrado.'; end if;
  if v_item.status in ('pendiente','cancelado') then
    raise exception 'El producto todavía no fue enviado a cocina o está cancelado.';
  end if;

  if v_target = 'preparacion' and v_item.status <> 'enviado' then
    raise exception 'Solo un producto enviado puede iniciarse.';
  elsif v_target = 'listo' and v_item.status not in ('enviado','preparacion') then
    raise exception 'El producto ya no puede marcarse como listo.';
  elsif v_target = 'servido' and v_item.status <> 'listo' then
    raise exception 'Solo un producto listo puede marcarse como entregado.';
  end if;

  update public.restaurant_order_items
  set status = v_target,
      started_at = case when v_target = 'preparacion' then coalesce(started_at, now()) else started_at end,
      ready_at = case when v_target = 'listo' then coalesce(ready_at, now()) else ready_at end,
      served_at = case when v_target = 'servido' then coalesce(served_at, now()) else served_at end
  where id = p_item_id
  returning * into v_item;

  perform public.restaurant_sync_kitchen_order(v_item.order_id);
  return v_item;
end;
$$;

create or replace function public.restaurant_kitchen_set_station_status(
  p_order_id uuid,
  p_station text,
  p_status text
)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_station text := lower(trim(coalesce(p_station, '')));
  v_target text := lower(trim(coalesce(p_status, '')));
  v_count integer := 0;
begin
  if v_user_id is null then raise exception 'No existe una sesión activa.'; end if;
  if not exists (
    select 1 from public.restaurant_orders
    where id = p_order_id and user_id = v_user_id and status not in ('cerrada','cancelada')
  ) then raise exception 'Pedido no encontrado o inactivo.'; end if;

  if v_target = 'preparacion' then
    update public.restaurant_order_items
    set status = 'preparacion', started_at = coalesce(started_at, now())
    where order_id = p_order_id and user_id = v_user_id
      and status = 'enviado'
      and (v_station in ('', 'todas') or kitchen_station = v_station);
  elsif v_target = 'listo' then
    update public.restaurant_order_items
    set status = 'listo',
        started_at = coalesce(started_at, sent_at, now()),
        ready_at = coalesce(ready_at, now())
    where order_id = p_order_id and user_id = v_user_id
      and status in ('enviado','preparacion')
      and (v_station in ('', 'todas') or kitchen_station = v_station);
  elsif v_target = 'servido' then
    update public.restaurant_order_items
    set status = 'servido', served_at = coalesce(served_at, now())
    where order_id = p_order_id and user_id = v_user_id
      and status = 'listo'
      and (v_station in ('', 'todas') or kitchen_station = v_station);
  else
    raise exception 'Estado de cocina no válido.';
  end if;

  get diagnostics v_count = row_count;
  if v_count = 0 then raise exception 'No existen productos que puedan cambiar a ese estado.'; end if;

  perform public.restaurant_sync_kitchen_order(p_order_id);
  return v_count;
end;
$$;

create or replace function public.restaurant_kitchen_toggle_priority(p_item_id uuid)
returns public.restaurant_order_items
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.restaurant_order_items;
begin
  if v_user_id is null then raise exception 'No existe una sesión activa.'; end if;

  update public.restaurant_order_items
  set is_priority = not is_priority,
      priority_at = case when not is_priority then now() else null end
  where id = p_item_id and user_id = v_user_id
    and status in ('enviado','preparacion','listo')
  returning * into v_item;

  if not found then raise exception 'El producto ya no está activo en cocina.'; end if;
  return v_item;
end;
$$;

grant execute on function public.restaurant_sync_kitchen_order(uuid) to authenticated;
grant execute on function public.restaurant_kitchen_set_item_status(uuid,text) to authenticated;
grant execute on function public.restaurant_kitchen_set_station_status(uuid,text,text) to authenticated;
grant execute on function public.restaurant_kitchen_toggle_priority(uuid) to authenticated;
