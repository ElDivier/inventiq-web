-- INVENTIQ · Fase 8.9 · Roles operativos, permisos y estabilización final de Restaurante
-- Ejecutar después de la corrección 8.8.1.
-- Esta migración NO modifica datos de otros tipos de negocio.

create extension if not exists pgcrypto;

create table if not exists public.restaurant_staff_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  role text not null default 'mesero',
  permissions jsonb not null default '[]'::jsonb,
  pin_hash text not null,
  is_active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_staff_profiles_role_check
    check (role in ('administrador', 'supervisor', 'cajero', 'mesero', 'cocina')),
  constraint restaurant_staff_profiles_permissions_array
    check (jsonb_typeof(permissions) = 'array')
);

create index if not exists restaurant_staff_profiles_user_idx
  on public.restaurant_staff_profiles (user_id, is_active, name);

create table if not exists public.restaurant_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  staff_profile_id uuid references public.restaurant_staff_profiles(id) on delete set null,
  operator_name text not null,
  operator_role text not null,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists restaurant_audit_log_user_created_idx
  on public.restaurant_audit_log (user_id, created_at desc);
create index if not exists restaurant_audit_log_entity_idx
  on public.restaurant_audit_log (user_id, entity_type, entity_id);

alter table public.restaurant_staff_profiles enable row level security;
alter table public.restaurant_audit_log enable row level security;

grant select, insert, update, delete on table public.restaurant_staff_profiles to authenticated;
grant select, insert on table public.restaurant_audit_log to authenticated;


drop policy if exists "restaurant_staff_owner_all" on public.restaurant_staff_profiles;
create policy "restaurant_staff_owner_all"
on public.restaurant_staff_profiles
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "restaurant_audit_owner_select" on public.restaurant_audit_log;
create policy "restaurant_audit_owner_select"
on public.restaurant_audit_log
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "restaurant_audit_owner_insert" on public.restaurant_audit_log;
create policy "restaurant_audit_owner_insert"
on public.restaurant_audit_log
for insert
to authenticated
with check (auth.uid() = user_id);

create or replace function public.restaurant_staff_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists restaurant_staff_touch_updated_at on public.restaurant_staff_profiles;
create trigger restaurant_staff_touch_updated_at
before update on public.restaurant_staff_profiles
for each row execute function public.restaurant_staff_touch_updated_at();

create or replace function public.restaurant_validate_staff_pin(p_pin text)
returns void
language plpgsql
immutable
as $$
begin
  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'El PIN debe contener entre 4 y 6 números.';
  end if;
end;
$$;

create or replace function public.restaurant_create_staff_profile(
  p_name text,
  p_role text,
  p_pin text,
  p_permissions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.restaurant_staff_profiles%rowtype;
begin
  if v_user_id is null then
    raise exception 'No existe una sesión activa.';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Ingresa el nombre del integrante.';
  end if;

  if p_role not in ('administrador', 'supervisor', 'cajero', 'mesero', 'cocina') then
    raise exception 'Rol no válido.';
  end if;

  perform public.restaurant_validate_staff_pin(p_pin);

  if p_permissions is null or jsonb_typeof(p_permissions) <> 'array' then
    raise exception 'La configuración de permisos no es válida.';
  end if;

  insert into public.restaurant_staff_profiles (
    user_id, name, role, permissions, pin_hash
  ) values (
    v_user_id,
    trim(p_name),
    p_role,
    p_permissions,
    crypt(p_pin, gen_salt('bf', 10))
  )
  returning * into v_profile;

  insert into public.restaurant_audit_log (
    user_id, operator_name, operator_role, action, entity_type, entity_id, details
  ) values (
    v_user_id, 'Administrador', 'administrador', 'staff.created', 'staff_profile', v_profile.id::text,
    jsonb_build_object('name', v_profile.name, 'role', v_profile.role)
  );

  return jsonb_build_object(
    'id', v_profile.id,
    'name', v_profile.name,
    'role', v_profile.role,
    'permissions', v_profile.permissions,
    'is_active', v_profile.is_active
  );
end;
$$;

create or replace function public.restaurant_update_staff_profile(
  p_profile_id uuid,
  p_name text,
  p_role text,
  p_permissions jsonb,
  p_is_active boolean,
  p_pin text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.restaurant_staff_profiles%rowtype;
begin
  if v_user_id is null then
    raise exception 'No existe una sesión activa.';
  end if;

  select * into v_profile
  from public.restaurant_staff_profiles
  where id = p_profile_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Integrante no encontrado.';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Ingresa el nombre del integrante.';
  end if;

  if p_role not in ('administrador', 'supervisor', 'cajero', 'mesero', 'cocina') then
    raise exception 'Rol no válido.';
  end if;

  if p_permissions is null or jsonb_typeof(p_permissions) <> 'array' then
    raise exception 'La configuración de permisos no es válida.';
  end if;

  if p_pin is not null and trim(p_pin) <> '' then
    perform public.restaurant_validate_staff_pin(trim(p_pin));
  end if;

  update public.restaurant_staff_profiles
  set name = trim(p_name),
      role = p_role,
      permissions = p_permissions,
      is_active = coalesce(p_is_active, true),
      pin_hash = case
        when p_pin is not null and trim(p_pin) <> '' then crypt(trim(p_pin), gen_salt('bf', 10))
        else pin_hash
      end
  where id = p_profile_id and user_id = v_user_id
  returning * into v_profile;

  insert into public.restaurant_audit_log (
    user_id, operator_name, operator_role, action, entity_type, entity_id, details
  ) values (
    v_user_id, 'Administrador', 'administrador', 'staff.updated', 'staff_profile', v_profile.id::text,
    jsonb_build_object('name', v_profile.name, 'role', v_profile.role, 'is_active', v_profile.is_active)
  );

  return jsonb_build_object(
    'id', v_profile.id,
    'name', v_profile.name,
    'role', v_profile.role,
    'permissions', v_profile.permissions,
    'is_active', v_profile.is_active
  );
end;
$$;

create or replace function public.restaurant_verify_staff_pin(
  p_profile_id uuid,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.restaurant_staff_profiles%rowtype;
begin
  if v_user_id is null then
    raise exception 'No existe una sesión activa.';
  end if;

  select * into v_profile
  from public.restaurant_staff_profiles
  where id = p_profile_id
    and user_id = v_user_id
    and is_active = true;

  if not found then
    raise exception 'El operador no está disponible.';
  end if;

  if crypt(coalesce(p_pin, ''), v_profile.pin_hash) <> v_profile.pin_hash then
    raise exception 'PIN incorrecto.';
  end if;

  update public.restaurant_staff_profiles
  set last_used_at = now()
  where id = v_profile.id;

  insert into public.restaurant_audit_log (
    user_id, staff_profile_id, operator_name, operator_role, action, entity_type, entity_id
  ) values (
    v_user_id, v_profile.id, v_profile.name, v_profile.role,
    'operator.activated', 'staff_profile', v_profile.id::text
  );

  return jsonb_build_object(
    'id', v_profile.id,
    'name', v_profile.name,
    'role', v_profile.role,
    'permissions', v_profile.permissions
  );
end;
$$;

create or replace function public.restaurant_log_audit(
  p_staff_profile_id uuid,
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_staff public.restaurant_staff_profiles%rowtype;
  v_id uuid;
  v_operator_name text := 'Administrador';
  v_operator_role text := 'administrador';
begin
  if v_user_id is null then
    raise exception 'No existe una sesión activa.';
  end if;

  if nullif(trim(p_action), '') is null then
    raise exception 'La acción de auditoría es obligatoria.';
  end if;

  if p_staff_profile_id is not null then
    select * into v_staff
    from public.restaurant_staff_profiles
    where id = p_staff_profile_id and user_id = v_user_id;

    if found then
      v_operator_name := v_staff.name;
      v_operator_role := v_staff.role;
    end if;
  end if;

  insert into public.restaurant_audit_log (
    user_id, staff_profile_id, operator_name, operator_role,
    action, entity_type, entity_id, details
  ) values (
    v_user_id,
    case when v_staff.id is not null then v_staff.id else null end,
    v_operator_name,
    v_operator_role,
    trim(p_action),
    p_entity_type,
    p_entity_id,
    coalesce(p_details, '{}'::jsonb)
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.restaurant_create_staff_profile(text, text, text, jsonb) from public;
revoke all on function public.restaurant_update_staff_profile(uuid, text, text, jsonb, boolean, text) from public;
revoke all on function public.restaurant_verify_staff_pin(uuid, text) from public;
revoke all on function public.restaurant_log_audit(uuid, text, text, text, jsonb) from public;

grant execute on function public.restaurant_create_staff_profile(text, text, text, jsonb) to authenticated;
grant execute on function public.restaurant_update_staff_profile(uuid, text, text, jsonb, boolean, text) to authenticated;
grant execute on function public.restaurant_verify_staff_pin(uuid, text) to authenticated;
grant execute on function public.restaurant_log_audit(uuid, text, text, text, jsonb) to authenticated;

comment on table public.restaurant_staff_profiles is
  'Perfiles operativos por PIN para Restaurante. Mantienen todos los datos dentro de la cuenta propietaria.';
comment on table public.restaurant_audit_log is
  'Bitácora de acciones sensibles y cambios de operador del módulo Restaurante.';
