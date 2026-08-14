-- INVENTIQ · Fase 9.1 · Base operativa para Cafeterías
-- No destructiva. Agrega cola de barra, numeración de pedidos, metadatos de menú y rol Barista.

-- 1) Metadatos por defecto del menú de cafetería.
update public.products as product
set product_metadata = jsonb_build_object(
  'menuStatus', 'available',
  'station', 'barra',
  'preparationMinutes', 0,
  'orderChannels', jsonb_build_array('local', 'takeaway', 'delivery'),
  'temperatures', '[]'::jsonb,
  'sizes', '[]'::jsonb,
  'milkOptions', '[]'::jsonb,
  'syrupOptions', '[]'::jsonb,
  'extraShotEnabled', false,
  'extraShotPrice', 0,
  'preparationNotes', ''
) || coalesce(product.product_metadata, '{}'::jsonb)
from public.profiles as profile
where profile.id = product.user_id
  and profile.business_type = 'cafeteria'
  and not (lower(trim(product.category)) like 'insumos -%');

-- 2) Cola operativa de cafetería.
create table if not exists public.cafeteria_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete set null,
  order_date date not null default current_date,
  order_number integer not null,
  order_code text not null,
  order_type text not null default 'local',
  order_reference text not null default '',
  customer_name text not null default '',
  status text not null default 'recibido',
  notes text not null default '',
  total numeric(14,2) not null default 0,
  received_at timestamptz not null default now(),
  started_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cafeteria_orders_type_check check (order_type in ('local','takeaway','delivery')),
  constraint cafeteria_orders_status_check check (status in ('recibido','preparacion','listo','entregado','cancelado')),
  constraint cafeteria_orders_number_check check (order_number > 0),
  constraint cafeteria_orders_total_check check (total >= 0)
);

create table if not exists public.cafeteria_order_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.cafeteria_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  station text not null default 'barra',
  quantity numeric(12,3) not null default 1,
  unit_price numeric(14,2) not null default 0,
  variant_summary text not null default '',
  modifiers jsonb not null default '[]'::jsonb,
  notes text not null default '',
  status text not null default 'recibido',
  started_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cafeteria_order_items_status_check check (status in ('recibido','preparacion','listo','entregado','cancelado')),
  constraint cafeteria_order_items_quantity_check check (quantity > 0),
  constraint cafeteria_order_items_price_check check (unit_price >= 0)
);

create unique index if not exists cafeteria_orders_daily_number_uidx
  on public.cafeteria_orders(user_id, order_date, order_number);
create unique index if not exists cafeteria_orders_sale_uidx
  on public.cafeteria_orders(sale_id) where sale_id is not null;
create index if not exists cafeteria_orders_user_status_idx
  on public.cafeteria_orders(user_id, status, created_at desc);
create index if not exists cafeteria_order_items_order_idx
  on public.cafeteria_order_items(order_id, status, created_at);

-- Timestamps.
drop trigger if exists cafeteria_orders_touch_updated_at on public.cafeteria_orders;
create trigger cafeteria_orders_touch_updated_at
before update on public.cafeteria_orders
for each row execute function public.inventiq_touch_updated_at();

drop trigger if exists cafeteria_order_items_touch_updated_at on public.cafeteria_order_items;
create trigger cafeteria_order_items_touch_updated_at
before update on public.cafeteria_order_items
for each row execute function public.inventiq_touch_updated_at();

-- 3) RLS compatible con administrador y sesiones de empleados.
alter table public.cafeteria_orders enable row level security;
alter table public.cafeteria_order_items enable row level security;

grant select, insert, update on public.cafeteria_orders to authenticated;
grant select, insert, update on public.cafeteria_order_items to authenticated;

drop policy if exists "cafeteria_orders_owner_access" on public.cafeteria_orders;
create policy "cafeteria_orders_owner_access"
on public.cafeteria_orders for all to authenticated
using (user_id = public.restaurant_effective_user_id())
with check (user_id = public.restaurant_effective_user_id());

drop policy if exists "cafeteria_order_items_owner_access" on public.cafeteria_order_items;
create policy "cafeteria_order_items_owner_access"
on public.cafeteria_order_items for all to authenticated
using (user_id = public.restaurant_effective_user_id())
with check (user_id = public.restaurant_effective_user_id());

-- 4) Crea un ticket de barra a partir de una venta ya registrada.
create or replace function public.cafeteria_create_order_from_sale(
  p_sale_id uuid,
  p_order_type text,
  p_order_reference text,
  p_customer_name text,
  p_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.restaurant_effective_user_id();
  v_sale public.sales%rowtype;
  v_order_id uuid;
  v_number integer;
  v_code text;
  v_item jsonb;
  v_product public.products%rowtype;
  v_metadata jsonb;
  v_station text;
begin
  if auth.uid() is null or v_user_id is null then raise exception 'No existe una sesión activa.'; end if;
  perform public.restaurant_require_permission('sales.manage');

  if not exists (select 1 from public.profiles where id = v_user_id and business_type = 'cafeteria') then
    raise exception 'La cola de barra solo está disponible para cuentas Cafetería.';
  end if;

  select * into v_sale from public.sales where id = p_sale_id and user_id = v_user_id;
  if not found then raise exception 'Venta no encontrada.'; end if;

  select id, order_number, order_code into v_order_id, v_number, v_code
  from public.cafeteria_orders where sale_id = p_sale_id limit 1;
  if found then
    return jsonb_build_object('id', v_order_id, 'number', v_number, 'code', v_code);
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user_id::text || current_date::text));
  select coalesce(max(order_number), 0) + 1 into v_number
  from public.cafeteria_orders where user_id = v_user_id and order_date = current_date;
  v_code := 'CAF-' || to_char(current_date, 'YYMMDD') || '-' || lpad(v_number::text, 3, '0');

  insert into public.cafeteria_orders (
    user_id, sale_id, order_date, order_number, order_code, order_type,
    order_reference, customer_name, notes, total
  ) values (
    v_user_id, p_sale_id, current_date, v_number, v_code,
    case when lower(coalesce(p_order_type,'')) in ('local','takeaway','delivery') then lower(p_order_type) else 'local' end,
    trim(coalesce(p_order_reference,'')), trim(coalesce(p_customer_name,'')), trim(coalesce(p_notes,'')), coalesce(v_sale.total,0)
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    select * into v_product from public.products
    where id = nullif(v_item->>'productId','')::uuid and user_id = v_user_id;

    v_metadata := coalesce(v_product.product_metadata, '{}'::jsonb);
    v_station := coalesce(nullif(v_item->>'station',''), nullif(v_metadata->>'station',''), 'barra');

    insert into public.cafeteria_order_items (
      user_id, order_id, product_id, product_name, station, quantity, unit_price,
      variant_summary, modifiers, notes
    ) values (
      v_user_id,
      v_order_id,
      case when v_product.id is null then null else v_product.id end,
      coalesce(nullif(v_item->>'baseProduct',''), nullif(v_item->>'product',''), coalesce(v_product.name,'Producto')),
      v_station,
      greatest(0.001, coalesce((v_item->>'quantity')::numeric, 1)),
      greatest(0, coalesce((v_item->>'price')::numeric, 0)),
      coalesce(v_item->>'variantSummary',''),
      case when jsonb_typeof(v_item->'modifiers') = 'array' then v_item->'modifiers' else '[]'::jsonb end,
      coalesce(v_item->>'notes','')
    );
  end loop;

  return jsonb_build_object('id', v_order_id, 'number', v_number, 'code', v_code);
end;
$$;

-- 5) Estados de barra por pedido o por ítem.
create or replace function public.cafeteria_set_order_status(p_order_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.restaurant_effective_user_id();
  v_status text := lower(trim(coalesce(p_status,'')));
  v_order public.cafeteria_orders%rowtype;
begin
  if auth.uid() is null then raise exception 'No existe una sesión activa.'; end if;
  if public.restaurant_is_employee_session()
     and not (public.restaurant_employee_has_permission('cafe.queue.manage') or public.restaurant_employee_has_permission('sales.manage')) then
    raise exception 'Tu perfil no tiene permiso para gestionar la barra.';
  end if;
  if v_status not in ('recibido','preparacion','listo','entregado','cancelado') then raise exception 'Estado no válido.'; end if;

  update public.cafeteria_orders
  set status = v_status,
      started_at = case when v_status = 'preparacion' then coalesce(started_at, now()) else started_at end,
      ready_at = case when v_status = 'listo' then coalesce(ready_at, now()) else ready_at end,
      delivered_at = case when v_status = 'entregado' then coalesce(delivered_at, now()) else delivered_at end
  where id = p_order_id and user_id = v_user_id
  returning * into v_order;
  if not found then raise exception 'Pedido no encontrado.'; end if;

  update public.cafeteria_order_items
  set status = v_status,
      started_at = case when v_status = 'preparacion' then coalesce(started_at, now()) else started_at end,
      ready_at = case when v_status = 'listo' then coalesce(ready_at, now()) else ready_at end,
      delivered_at = case when v_status = 'entregado' then coalesce(delivered_at, now()) else delivered_at end
  where order_id = p_order_id and user_id = v_user_id and status <> 'cancelado';

  return jsonb_build_object('id', v_order.id, 'status', v_status);
end;
$$;

create or replace function public.cafeteria_set_order_item_status(p_item_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.restaurant_effective_user_id();
  v_status text := lower(trim(coalesce(p_status,'')));
  v_item public.cafeteria_order_items%rowtype;
  v_order_status text;
begin
  if auth.uid() is null then raise exception 'No existe una sesión activa.'; end if;
  if public.restaurant_is_employee_session()
     and not (public.restaurant_employee_has_permission('cafe.queue.manage') or public.restaurant_employee_has_permission('sales.manage')) then
    raise exception 'Tu perfil no tiene permiso para gestionar la barra.';
  end if;
  if v_status not in ('recibido','preparacion','listo','entregado','cancelado') then raise exception 'Estado no válido.'; end if;

  update public.cafeteria_order_items
  set status = v_status,
      started_at = case when v_status = 'preparacion' then coalesce(started_at, now()) else started_at end,
      ready_at = case when v_status = 'listo' then coalesce(ready_at, now()) else ready_at end,
      delivered_at = case when v_status = 'entregado' then coalesce(delivered_at, now()) else delivered_at end
  where id = p_item_id and user_id = v_user_id
  returning * into v_item;
  if not found then raise exception 'Producto del pedido no encontrado.'; end if;

  select case
    when bool_and(status in ('entregado','cancelado')) then 'entregado'
    when bool_and(status in ('listo','entregado','cancelado')) then 'listo'
    when bool_or(status = 'preparacion') then 'preparacion'
    else 'recibido'
  end into v_order_status
  from public.cafeteria_order_items
  where order_id = v_item.order_id;

  update public.cafeteria_orders
  set status = coalesce(v_order_status, status),
      started_at = case when v_order_status = 'preparacion' then coalesce(started_at, now()) else started_at end,
      ready_at = case when v_order_status = 'listo' then coalesce(ready_at, now()) else ready_at end,
      delivered_at = case when v_order_status = 'entregado' then coalesce(delivered_at, now()) else delivered_at end
  where id = v_item.order_id and user_id = v_user_id;

  return jsonb_build_object('id', v_item.id, 'orderId', v_item.order_id, 'status', v_status, 'orderStatus', v_order_status);
end;
$$;

revoke all on function public.cafeteria_create_order_from_sale(uuid,text,text,text,text,jsonb) from public;
revoke all on function public.cafeteria_set_order_status(uuid,text) from public;
revoke all on function public.cafeteria_set_order_item_status(uuid,text) from public;
grant execute on function public.cafeteria_create_order_from_sale(uuid,text,text,text,text,jsonb) to authenticated;
grant execute on function public.cafeteria_set_order_status(uuid,text) to authenticated;
grant execute on function public.cafeteria_set_order_item_status(uuid,text) to authenticated;

-- 6) Rol Barista para Cafeterías.
alter table public.restaurant_staff_profiles
  drop constraint if exists restaurant_staff_profiles_role_check;
alter table public.restaurant_staff_profiles
  add constraint restaurant_staff_profiles_role_check
  check (role in ('administrador','supervisor','cajero','mesero','cocina','barista'));

create or replace function public.restaurant_create_staff_profile(
  p_name text, p_role text, p_pin text, p_permissions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid := public.restaurant_effective_user_id();
  v_profile public.restaurant_staff_profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'No existe una sesión activa.'; end if;
  perform public.restaurant_require_permission('team.manage');
  if nullif(trim(p_name),'') is null then raise exception 'Ingresa el nombre del integrante.'; end if;
  if p_role not in ('administrador','supervisor','cajero','mesero','cocina','barista') then raise exception 'Rol no válido.'; end if;
  perform public.restaurant_validate_staff_pin(p_pin);
  if p_permissions is null or jsonb_typeof(p_permissions) <> 'array' then raise exception 'La configuración de permisos no es válida.'; end if;

  insert into public.restaurant_staff_profiles(user_id,name,role,permissions,pin_hash)
  values(v_user_id, trim(p_name), p_role, p_permissions, crypt(p_pin, gen_salt('bf',10)))
  returning * into v_profile;

  return jsonb_build_object('id',v_profile.id,'name',v_profile.name,'role',v_profile.role,'permissions',v_profile.permissions,'is_active',v_profile.is_active);
end;
$$;

create or replace function public.restaurant_update_staff_profile(
  p_profile_id uuid, p_name text, p_role text, p_permissions jsonb, p_is_active boolean, p_pin text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid := public.restaurant_effective_user_id();
  v_profile public.restaurant_staff_profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'No existe una sesión activa.'; end if;
  perform public.restaurant_require_permission('team.manage');
  select * into v_profile from public.restaurant_staff_profiles where id=p_profile_id and user_id=v_user_id for update;
  if not found then raise exception 'Integrante no encontrado.'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'Ingresa el nombre del integrante.'; end if;
  if p_role not in ('administrador','supervisor','cajero','mesero','cocina','barista') then raise exception 'Rol no válido.'; end if;
  if p_permissions is null or jsonb_typeof(p_permissions) <> 'array' then raise exception 'La configuración de permisos no es válida.'; end if;
  if p_pin is not null and trim(p_pin) <> '' then perform public.restaurant_validate_staff_pin(trim(p_pin)); end if;

  update public.restaurant_staff_profiles
  set name=trim(p_name), role=p_role, permissions=p_permissions, is_active=coalesce(p_is_active,true),
      pin_hash=case when p_pin is not null and trim(p_pin)<>'' then crypt(trim(p_pin),gen_salt('bf',10)) else pin_hash end
  where id=p_profile_id and user_id=v_user_id returning * into v_profile;

  return jsonb_build_object('id',v_profile.id,'name',v_profile.name,'role',v_profile.role,'permissions',v_profile.permissions,'is_active',v_profile.is_active);
end;
$$;

-- 7) Realtime para trabajo simultáneo Caja ↔ Barra.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='cafeteria_orders'
  ) then alter publication supabase_realtime add table public.cafeteria_orders; end if;
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='cafeteria_order_items'
  ) then alter publication supabase_realtime add table public.cafeteria_order_items; end if;
end $$;

comment on table public.cafeteria_orders is 'Cola operativa de pedidos de cafetería generada desde Caja rápida.';
comment on table public.cafeteria_order_items is 'Productos por pedido con estación, variante y estado de preparación.';
