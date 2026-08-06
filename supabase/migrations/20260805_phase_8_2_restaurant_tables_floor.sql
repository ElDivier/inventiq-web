-- INVENTIQ · Fase 8.2 · Mesas y salón para restaurantes
-- Migración no destructiva. Crea áreas, mesas, estados y funciones operativas.

create table if not exists public.restaurant_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_areas_name_not_empty check (char_length(trim(name)) > 0)
);

create table if not exists public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  area_id uuid not null references public.restaurant_areas(id) on delete restrict,
  name text not null,
  capacity integer not null default 4,
  shape text not null default 'square',
  status text not null default 'libre',
  sort_order integer not null default 0,
  waiter_name text not null default '',
  guest_count integer not null default 0,
  opened_at timestamptz,
  bill_requested_at timestamptz,
  reservation_name text not null default '',
  reserved_for timestamptz,
  notes text not null default '',
  joined_to uuid references public.restaurant_tables(id) on delete set null,
  current_total numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_tables_name_not_empty check (char_length(trim(name)) > 0),
  constraint restaurant_tables_capacity_valid check (capacity between 1 and 50),
  constraint restaurant_tables_guest_count_valid check (guest_count between 0 and 100),
  constraint restaurant_tables_shape_valid check (shape in ('square', 'round', 'rectangle', 'bar')),
  constraint restaurant_tables_status_valid check (status in ('libre', 'ocupada', 'preparacion', 'servida', 'cobrar', 'limpieza', 'reservada')),
  constraint restaurant_tables_total_valid check (current_total >= 0),
  constraint restaurant_tables_no_self_join check (joined_to is null or joined_to <> id)
);

create unique index if not exists restaurant_areas_active_name_uidx
  on public.restaurant_areas (user_id, lower(trim(name)))
  where is_active = true;

create unique index if not exists restaurant_tables_active_name_uidx
  on public.restaurant_tables (user_id, area_id, lower(trim(name)))
  where is_active = true;

create index if not exists restaurant_areas_user_sort_idx
  on public.restaurant_areas (user_id, is_active, sort_order, created_at);

create index if not exists restaurant_tables_user_area_sort_idx
  on public.restaurant_tables (user_id, area_id, is_active, sort_order, created_at);

create index if not exists restaurant_tables_user_status_idx
  on public.restaurant_tables (user_id, status, is_active);

create index if not exists restaurant_tables_joined_to_idx
  on public.restaurant_tables (joined_to)
  where joined_to is not null;

comment on table public.restaurant_areas is
'Áreas operativas de un restaurante, por ejemplo salón principal, terraza o barra.';

comment on table public.restaurant_tables is
'Mesas del restaurante con capacidad, forma, estado de servicio, responsable, reserva y relación visual entre mesas unidas.';

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

drop trigger if exists restaurant_areas_touch_updated_at on public.restaurant_areas;
create trigger restaurant_areas_touch_updated_at
before update on public.restaurant_areas
for each row execute function public.inventiq_touch_updated_at();

drop trigger if exists restaurant_tables_touch_updated_at on public.restaurant_tables;
create trigger restaurant_tables_touch_updated_at
before update on public.restaurant_tables
for each row execute function public.inventiq_touch_updated_at();

alter table public.restaurant_areas enable row level security;
alter table public.restaurant_tables enable row level security;

grant select, insert, update, delete on public.restaurant_areas to authenticated;
grant select, insert, update, delete on public.restaurant_tables to authenticated;

drop policy if exists "restaurant_areas_owner_select" on public.restaurant_areas;
create policy "restaurant_areas_owner_select"
on public.restaurant_areas
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "restaurant_areas_owner_insert" on public.restaurant_areas;
create policy "restaurant_areas_owner_insert"
on public.restaurant_areas
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "restaurant_areas_owner_update" on public.restaurant_areas;
create policy "restaurant_areas_owner_update"
on public.restaurant_areas
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "restaurant_areas_owner_delete" on public.restaurant_areas;
create policy "restaurant_areas_owner_delete"
on public.restaurant_areas
for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists "restaurant_tables_owner_select" on public.restaurant_tables;
create policy "restaurant_tables_owner_select"
on public.restaurant_tables
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "restaurant_tables_owner_insert" on public.restaurant_tables;
create policy "restaurant_tables_owner_insert"
on public.restaurant_tables
for insert to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.restaurant_areas area
    where area.id = area_id
      and area.user_id = auth.uid()
  )
);

drop policy if exists "restaurant_tables_owner_update" on public.restaurant_tables;
create policy "restaurant_tables_owner_update"
on public.restaurant_tables
for update to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.restaurant_areas area
    where area.id = area_id
      and area.user_id = auth.uid()
  )
);

drop policy if exists "restaurant_tables_owner_delete" on public.restaurant_tables;
create policy "restaurant_tables_owner_delete"
on public.restaurant_tables
for delete to authenticated
using (auth.uid() = user_id);

create or replace function public.restaurant_seed_default_floor()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_area_id uuid;
  v_existing_count integer;
  v_index integer;
begin
  if v_user_id is null then
    raise exception 'No existe una sesión activa.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_user_id
      and business_type = 'restaurante'
  ) then
    raise exception 'La estructura de mesas solo está disponible para cuentas Restaurante.';
  end if;

  select count(*) into v_existing_count
  from public.restaurant_areas
  where user_id = v_user_id and is_active = true;

  if v_existing_count > 0 then
    return jsonb_build_object('created', false, 'message', 'El restaurante ya tiene áreas configuradas.');
  end if;

  insert into public.restaurant_areas (user_id, name, sort_order)
  values (v_user_id, 'Salón principal', 1)
  returning id into v_area_id;

  for v_index in 1..12 loop
    insert into public.restaurant_tables (
      user_id,
      area_id,
      name,
      capacity,
      shape,
      sort_order
    ) values (
      v_user_id,
      v_area_id,
      'Mesa ' || v_index,
      case when v_index in (5, 6, 11, 12) then 6 else 4 end,
      case when v_index in (3, 8) then 'round' else 'square' end,
      v_index
    );
  end loop;

  return jsonb_build_object('created', true, 'area_id', v_area_id, 'tables', 12);
end;
$$;

create or replace function public.restaurant_open_table(
  p_table_id uuid,
  p_guest_count integer default 1,
  p_waiter_name text default '',
  p_notes text default ''
)
returns public.restaurant_tables
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_table public.restaurant_tables;
begin
  if v_user_id is null then
    raise exception 'No existe una sesión activa.';
  end if;

  select * into v_table
  from public.restaurant_tables
  where id = p_table_id
    and user_id = v_user_id
    and is_active = true
  for update;

  if not found then
    raise exception 'Mesa no encontrada.';
  end if;

  if v_table.status not in ('libre', 'reservada') then
    raise exception 'La mesa ya se encuentra en servicio.';
  end if;

  update public.restaurant_tables
  set status = 'ocupada',
      guest_count = greatest(1, coalesce(p_guest_count, 1)),
      waiter_name = trim(coalesce(p_waiter_name, '')),
      notes = trim(coalesce(p_notes, '')),
      opened_at = now(),
      bill_requested_at = null,
      reservation_name = '',
      reserved_for = null,
      current_total = 0
  where id = p_table_id
  returning * into v_table;

  return v_table;
end;
$$;

create or replace function public.restaurant_update_table_service(
  p_table_id uuid,
  p_status text,
  p_guest_count integer default 0,
  p_waiter_name text default '',
  p_notes text default '',
  p_reservation_name text default '',
  p_reserved_for timestamptz default null
)
returns public.restaurant_tables
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_table public.restaurant_tables;
  v_status text := lower(trim(coalesce(p_status, '')));
begin
  if v_user_id is null then
    raise exception 'No existe una sesión activa.';
  end if;

  if v_status not in ('libre', 'ocupada', 'preparacion', 'servida', 'cobrar', 'limpieza', 'reservada') then
    raise exception 'Estado de mesa no válido.';
  end if;

  select * into v_table
  from public.restaurant_tables
  where id = p_table_id
    and user_id = v_user_id
    and is_active = true
  for update;

  if not found then
    raise exception 'Mesa no encontrada.';
  end if;

  if v_status = 'reservada' and (trim(coalesce(p_reservation_name, '')) = '' or p_reserved_for is null) then
    raise exception 'La reserva requiere nombre y fecha.';
  end if;

  update public.restaurant_tables
  set status = v_status,
      guest_count = case
        when v_status in ('libre', 'limpieza') then 0
        else greatest(0, coalesce(p_guest_count, guest_count))
      end,
      waiter_name = case
        when v_status in ('libre', 'limpieza', 'reservada') then ''
        else trim(coalesce(p_waiter_name, waiter_name))
      end,
      notes = trim(coalesce(p_notes, notes)),
      opened_at = case
        when v_status in ('ocupada', 'preparacion', 'servida', 'cobrar') then coalesce(opened_at, now())
        when v_status in ('libre', 'limpieza', 'reservada') then null
        else opened_at
      end,
      bill_requested_at = case
        when v_status = 'cobrar' then coalesce(bill_requested_at, now())
        else null
      end,
      reservation_name = case when v_status = 'reservada' then trim(coalesce(p_reservation_name, '')) else '' end,
      reserved_for = case when v_status = 'reservada' then p_reserved_for else null end
  where id = p_table_id
  returning * into v_table;

  return v_table;
end;
$$;

create or replace function public.restaurant_release_table(
  p_table_id uuid,
  p_next_status text default 'libre'
)
returns public.restaurant_tables
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text := lower(trim(coalesce(p_next_status, 'libre')));
  v_table public.restaurant_tables;
begin
  if v_user_id is null then
    raise exception 'No existe una sesión activa.';
  end if;

  if v_status not in ('libre', 'limpieza') then
    raise exception 'La liberación solo puede dejar la mesa libre o pendiente de limpieza.';
  end if;

  select * into v_table
  from public.restaurant_tables
  where id = p_table_id
    and user_id = v_user_id
    and is_active = true
  for update;

  if not found then
    raise exception 'Mesa no encontrada.';
  end if;

  update public.restaurant_tables
  set status = v_status,
      waiter_name = '',
      guest_count = 0,
      opened_at = null,
      bill_requested_at = null,
      reservation_name = '',
      reserved_for = null,
      notes = '',
      joined_to = null,
      current_total = 0
  where id = p_table_id
  returning * into v_table;

  update public.restaurant_tables
  set status = v_status,
      waiter_name = '',
      guest_count = 0,
      opened_at = null,
      bill_requested_at = null,
      reservation_name = '',
      reserved_for = null,
      notes = '',
      joined_to = null,
      current_total = 0
  where joined_to = p_table_id
    and user_id = v_user_id;

  return v_table;
end;
$$;

create or replace function public.restaurant_transfer_table(
  p_source_table_id uuid,
  p_target_table_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.restaurant_tables;
  v_target public.restaurant_tables;
begin
  if v_user_id is null then
    raise exception 'No existe una sesión activa.';
  end if;

  if p_source_table_id = p_target_table_id then
    raise exception 'Selecciona una mesa diferente.';
  end if;

  select * into v_source
  from public.restaurant_tables
  where id = p_source_table_id and user_id = v_user_id and is_active = true
  for update;

  select * into v_target
  from public.restaurant_tables
  where id = p_target_table_id and user_id = v_user_id and is_active = true
  for update;

  if v_source.id is null or v_target.id is null then
    raise exception 'No se encontró una de las mesas.';
  end if;

  if v_source.status in ('libre', 'limpieza', 'reservada') then
    raise exception 'La mesa de origen no tiene una ocupación activa.';
  end if;

  if v_target.status <> 'libre' or v_target.joined_to is not null then
    raise exception 'La mesa de destino debe estar libre.';
  end if;

  update public.restaurant_tables
  set status = v_source.status,
      waiter_name = v_source.waiter_name,
      guest_count = v_source.guest_count,
      opened_at = v_source.opened_at,
      bill_requested_at = v_source.bill_requested_at,
      notes = v_source.notes,
      current_total = v_source.current_total
  where id = v_target.id;

  update public.restaurant_tables
  set joined_to = v_target.id
  where joined_to = v_source.id
    and user_id = v_user_id;

  update public.restaurant_tables
  set status = 'libre',
      waiter_name = '',
      guest_count = 0,
      opened_at = null,
      bill_requested_at = null,
      notes = '',
      current_total = 0,
      joined_to = null
  where id = v_source.id;

  return jsonb_build_object('source_table_id', v_source.id, 'target_table_id', v_target.id);
end;
$$;

create or replace function public.restaurant_join_tables(
  p_primary_table_id uuid,
  p_secondary_table_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_primary public.restaurant_tables;
  v_secondary public.restaurant_tables;
begin
  if v_user_id is null then
    raise exception 'No existe una sesión activa.';
  end if;

  if p_primary_table_id = p_secondary_table_id then
    raise exception 'Selecciona una mesa diferente.';
  end if;

  select * into v_primary
  from public.restaurant_tables
  where id = p_primary_table_id and user_id = v_user_id and is_active = true
  for update;

  select * into v_secondary
  from public.restaurant_tables
  where id = p_secondary_table_id and user_id = v_user_id and is_active = true
  for update;

  if v_primary.id is null or v_secondary.id is null then
    raise exception 'No se encontró una de las mesas.';
  end if;

  if v_primary.status in ('libre', 'limpieza', 'reservada') then
    raise exception 'Abre primero la mesa principal.';
  end if;

  if v_secondary.status <> 'libre' or v_secondary.joined_to is not null then
    raise exception 'La mesa que deseas unir debe estar libre.';
  end if;

  update public.restaurant_tables
  set status = v_primary.status,
      waiter_name = v_primary.waiter_name,
      guest_count = 0,
      opened_at = v_primary.opened_at,
      notes = 'Unida a ' || v_primary.name,
      joined_to = v_primary.id,
      current_total = 0
  where id = v_secondary.id;

  return jsonb_build_object('primary_table_id', v_primary.id, 'secondary_table_id', v_secondary.id);
end;
$$;

create or replace function public.restaurant_unjoin_table(p_table_id uuid)
returns public.restaurant_tables
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_table public.restaurant_tables;
begin
  if v_user_id is null then
    raise exception 'No existe una sesión activa.';
  end if;

  select * into v_table
  from public.restaurant_tables
  where id = p_table_id
    and user_id = v_user_id
    and is_active = true
  for update;

  if not found then
    raise exception 'Mesa no encontrada.';
  end if;

  if v_table.joined_to is null then
    raise exception 'La mesa no está unida a otra.';
  end if;

  update public.restaurant_tables
  set status = 'libre',
      waiter_name = '',
      guest_count = 0,
      opened_at = null,
      bill_requested_at = null,
      notes = '',
      joined_to = null,
      current_total = 0
  where id = p_table_id
  returning * into v_table;

  return v_table;
end;
$$;

grant execute on function public.restaurant_seed_default_floor() to authenticated;
grant execute on function public.restaurant_open_table(uuid, integer, text, text) to authenticated;
grant execute on function public.restaurant_update_table_service(uuid, text, integer, text, text, text, timestamptz) to authenticated;
grant execute on function public.restaurant_release_table(uuid, text) to authenticated;
grant execute on function public.restaurant_transfer_table(uuid, uuid) to authenticated;
grant execute on function public.restaurant_join_tables(uuid, uuid) to authenticated;
grant execute on function public.restaurant_unjoin_table(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'restaurant_areas'
    ) then
      alter publication supabase_realtime add table public.restaurant_areas;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'restaurant_tables'
    ) then
      alter publication supabase_realtime add table public.restaurant_tables;
    end if;
  end if;
end;
$$;
