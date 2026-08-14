-- INVENTIQ · Corrección 8.9.2 · Acceso de empleados separado del administrador
-- Implementa:
-- 1) Código + contraseña del negocio.
-- 2) Selección de integrante.
-- 3) PIN individual.
-- 4) Sesión Supabase separada para empleados (no usa la cuenta del propietario).
-- 5) Compatibilidad de las funciones de restaurante con sesiones de empleado.
--
-- Requiere la Fase 8.9 y recomienda haber ejecutado la Corrección 8.9.1.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.restaurant_employee_access (
  owner_user_id uuid primary key,
  access_code text not null unique,
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_employee_access_code_check
    check (access_code ~ '^[a-z0-9][a-z0-9_-]{3,39}$')
);

create table if not exists public.restaurant_staff_auth_users (
  staff_profile_id uuid primary key references public.restaurant_staff_profiles(id) on delete cascade,
  owner_user_id uuid not null,
  auth_user_id uuid not null unique,
  auth_email text not null unique,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists restaurant_staff_auth_users_owner_idx
  on public.restaurant_staff_auth_users (owner_user_id, is_active);

alter table public.restaurant_employee_access enable row level security;
alter table public.restaurant_staff_auth_users enable row level security;

revoke all on table public.restaurant_employee_access from anon, authenticated;
revoke all on table public.restaurant_staff_auth_users from anon, authenticated;
grant select, insert, update, delete on table public.restaurant_employee_access to service_role;
grant select, insert, update, delete on table public.restaurant_staff_auth_users to service_role;

create or replace function public.restaurant_employee_access_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists restaurant_employee_access_touch_updated_at on public.restaurant_employee_access;
create trigger restaurant_employee_access_touch_updated_at
before update on public.restaurant_employee_access
for each row execute function public.restaurant_employee_access_touch_updated_at();

drop trigger if exists restaurant_staff_auth_users_touch_updated_at on public.restaurant_staff_auth_users;
create trigger restaurant_staff_auth_users_touch_updated_at
before update on public.restaurant_staff_auth_users
for each row execute function public.restaurant_employee_access_touch_updated_at();

-- Si el administrador cambia el PIN de un integrante o lo desactiva, cualquier
-- sesión operativa ya emitida para ese perfil deja de tener acceso de inmediato.
create or replace function public.restaurant_revoke_staff_auth_on_security_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.pin_hash is distinct from new.pin_hash
     or (old.is_active = true and new.is_active = false) then
    update public.restaurant_staff_auth_users
    set is_active = false,
        updated_at = now()
    where staff_profile_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists restaurant_staff_revoke_auth_on_security_change on public.restaurant_staff_profiles;
create trigger restaurant_staff_revoke_auth_on_security_change
after update of pin_hash, is_active on public.restaurant_staff_profiles
for each row execute function public.restaurant_revoke_staff_auth_on_security_change();


-- Identifica al propietario real de los datos.
-- Para una sesión normal devuelve auth.uid().
-- Para una sesión de empleado devuelve el owner_user_id vinculado al perfil.
create or replace function public.restaurant_effective_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (
      select sau.owner_user_id
      from public.restaurant_staff_auth_users sau
      join public.restaurant_staff_profiles sp
        on sp.id = sau.staff_profile_id
       and sp.user_id = sau.owner_user_id
       and sp.is_active = true
      join public.restaurant_employee_access ea
        on ea.owner_user_id = sau.owner_user_id
       and ea.is_active = true
      where sau.auth_user_id = auth.uid()
        and sau.is_active = true
      limit 1
    ),
    auth.uid()
  );
$$;

create or replace function public.restaurant_is_employee_session()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.restaurant_staff_auth_users sau
    join public.restaurant_staff_profiles sp
      on sp.id = sau.staff_profile_id
     and sp.user_id = sau.owner_user_id
     and sp.is_active = true
    join public.restaurant_employee_access ea
      on ea.owner_user_id = sau.owner_user_id
     and ea.is_active = true
    where sau.auth_user_id = auth.uid()
      and sau.is_active = true
  );
$$;

create or replace function public.restaurant_employee_has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when not public.restaurant_is_employee_session() then true
    else exists (
      select 1
      from public.restaurant_staff_auth_users sau
      join public.restaurant_staff_profiles sp
        on sp.id = sau.staff_profile_id
       and sp.user_id = sau.owner_user_id
       and sp.is_active = true
      join public.restaurant_employee_access ea
        on ea.owner_user_id = sau.owner_user_id
       and ea.is_active = true
      where sau.auth_user_id = auth.uid()
        and sau.is_active = true
        and sp.permissions ? p_permission
    )
  end;
$$;

create or replace function public.restaurant_require_permission(p_permission text)
returns void
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if public.restaurant_is_employee_session()
     and not public.restaurant_employee_has_permission(p_permission) then
    raise exception 'Tu perfil no tiene permiso para realizar esta acción.';
  end if;
end;
$$;

grant execute on function public.restaurant_effective_user_id() to authenticated;
grant execute on function public.restaurant_is_employee_session() to authenticated;
grant execute on function public.restaurant_employee_has_permission(text) to authenticated;
grant execute on function public.restaurant_require_permission(text) to authenticated;


-- Configuración que realiza el propietario desde Equipo y permisos.
create or replace function public.restaurant_get_employee_access_settings()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_access public.restaurant_employee_access%rowtype;
begin
  if v_user_id is null then
    raise exception 'No existe una sesión activa.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_user_id
      and business_type in ('restaurante', 'cafeteria')
  ) then
    raise exception 'El acceso de empleados está disponible para negocios gastronómicos.';
  end if;

  select * into v_access
  from public.restaurant_employee_access
  where owner_user_id = v_user_id;

  if not found then
    return jsonb_build_object(
      'accessCode', '',
      'isActive', false,
      'passwordConfigured', false
    );
  end if;

  return jsonb_build_object(
    'accessCode', v_access.access_code,
    'isActive', v_access.is_active,
    'passwordConfigured', (v_access.password_hash is not null and v_access.password_hash <> '')
  );
end;
$$;

create or replace function public.restaurant_set_employee_access(
  p_access_code text,
  p_password text default '',
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text := lower(trim(coalesce(p_access_code, '')));
  v_existing public.restaurant_employee_access%rowtype;
  v_revoke_sessions boolean := false;
begin
  if v_user_id is null then
    raise exception 'No existe una sesión activa.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_user_id
      and business_type in ('restaurante', 'cafeteria')
  ) then
    raise exception 'El acceso de empleados está disponible para negocios gastronómicos.';
  end if;

  if v_code !~ '^[a-z0-9][a-z0-9_-]{3,39}$' then
    raise exception 'El código debe tener entre 4 y 40 caracteres y usar solo letras, números, guion o guion bajo.';
  end if;

  select * into v_existing
  from public.restaurant_employee_access
  where owner_user_id = v_user_id
  for update;

  if not found and length(coalesce(p_password, '')) < 8 then
    raise exception 'La contraseña de acceso del equipo debe tener al menos 8 caracteres.';
  end if;

  if coalesce(p_password, '') <> '' and length(p_password) < 8 then
    raise exception 'La nueva contraseña de acceso debe tener al menos 8 caracteres.';
  end if;

  if found then
    v_revoke_sessions := v_existing.access_code is distinct from v_code
      or coalesce(p_password, '') <> ''
      or coalesce(p_is_active, true) = false;
  end if;

  begin
    if not found then
      insert into public.restaurant_employee_access (
        owner_user_id, access_code, password_hash, is_active
      ) values (
        v_user_id,
        v_code,
        extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
        coalesce(p_is_active, true)
      );
    else
      update public.restaurant_employee_access
      set access_code = v_code,
          password_hash = case
            when coalesce(p_password, '') <> ''
              then extensions.crypt(p_password, extensions.gen_salt('bf', 10))
            else password_hash
          end,
          is_active = coalesce(p_is_active, true)
      where owner_user_id = v_user_id;
    end if;
  exception
    when unique_violation then
      raise exception 'Ese código ya está siendo utilizado por otro negocio. Elige uno diferente.';
  end;

  if v_revoke_sessions then
    update public.restaurant_staff_auth_users
    set is_active = false,
        updated_at = now()
    where owner_user_id = v_user_id;
  end if;

  return jsonb_build_object(
    'accessCode', v_code,
    'isActive', coalesce(p_is_active, true),
    'passwordConfigured', true
  );
end;
$$;

revoke all on function public.restaurant_get_employee_access_settings() from public;
revoke all on function public.restaurant_set_employee_access(text,text,boolean) from public;
grant execute on function public.restaurant_get_employee_access_settings() to authenticated;
grant execute on function public.restaurant_set_employee_access(text,text,boolean) to authenticated;


-- Se usa únicamente desde la Edge Function para validar el negocio sin iniciar
-- la sesión del propietario.
create or replace function public.restaurant_employee_lookup(
  p_access_code text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_access public.restaurant_employee_access%rowtype;
  v_profile public.profiles%rowtype;
  v_profiles jsonb;
begin
  select * into v_access
  from public.restaurant_employee_access
  where access_code = lower(trim(coalesce(p_access_code, '')))
    and is_active = true;

  if not found
     or extensions.crypt(coalesce(p_password, ''), v_access.password_hash) <> v_access.password_hash then
    raise exception 'Código o contraseña de acceso incorrectos.';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_access.owner_user_id
    and business_type in ('restaurante', 'cafeteria');

  if not found
     or coalesce(v_profile.is_suspended, false)
     or lower(coalesce(v_profile.subscription_status, 'activo')) in ('suspendido', 'vencido')
     or (v_profile.subscription_end is not null and v_profile.subscription_end::date < current_date) then
    raise exception 'El acceso de este negocio no está disponible.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', sp.id,
        'name', sp.name,
        'role', sp.role
      )
      order by sp.name
    ),
    '[]'::jsonb
  )
  into v_profiles
  from public.restaurant_staff_profiles sp
  where sp.user_id = v_access.owner_user_id
    and sp.is_active = true;

  return jsonb_build_object(
    'ownerId', v_access.owner_user_id,
    'storeName', v_profile.store_name,
    'businessType', v_profile.business_type,
    'businessTypeLabel', case when v_profile.business_type = 'cafeteria' then 'Cafetería' else 'Restaurante' end,
    'profiles', v_profiles
  );
end;
$$;

create or replace function public.restaurant_employee_verify_profile(
  p_access_code text,
  p_password text,
  p_profile_id uuid,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_lookup jsonb;
  v_owner_id uuid;
  v_staff public.restaurant_staff_profiles%rowtype;
begin
  v_lookup := public.restaurant_employee_lookup(p_access_code, p_password);
  v_owner_id := (v_lookup->>'ownerId')::uuid;

  select * into v_staff
  from public.restaurant_staff_profiles
  where id = p_profile_id
    and user_id = v_owner_id
    and is_active = true;

  if not found then
    raise exception 'El perfil seleccionado ya no está disponible.';
  end if;

  if extensions.crypt(coalesce(p_pin, ''), v_staff.pin_hash) <> v_staff.pin_hash then
    raise exception 'PIN incorrecto.';
  end if;

  update public.restaurant_staff_profiles
  set last_used_at = now()
  where id = v_staff.id;

  return jsonb_build_object(
    'ownerId', v_owner_id,
    'storeName', v_lookup->>'storeName',
    'businessType', v_lookup->>'businessType',
    'profile', jsonb_build_object(
      'id', v_staff.id,
      'name', v_staff.name,
      'role', v_staff.role,
      'permissions', v_staff.permissions
    )
  );
end;
$$;

revoke all on function public.restaurant_employee_lookup(text,text) from public;
revoke all on function public.restaurant_employee_verify_profile(text,text,uuid,text) from public;
grant execute on function public.restaurant_employee_lookup(text,text) to service_role;
grant execute on function public.restaurant_employee_verify_profile(text,text,uuid,text) to service_role;


-- Contexto de la sesión de empleado ya autenticada.
create or replace function public.restaurant_employee_session_context()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_map public.restaurant_staff_auth_users%rowtype;
  v_staff public.restaurant_staff_profiles%rowtype;
  v_profile public.profiles%rowtype;
begin
  if v_auth_user_id is null then
    raise exception 'No existe una sesión activa.';
  end if;

  select * into v_map
  from public.restaurant_staff_auth_users
  where auth_user_id = v_auth_user_id
    and is_active = true;

  if not found then
    raise exception 'La sesión no corresponde a un empleado de INVENTIQ.';
  end if;

  select * into v_staff
  from public.restaurant_staff_profiles
  where id = v_map.staff_profile_id
    and user_id = v_map.owner_user_id
    and is_active = true;

  if not found then
    raise exception 'El perfil del empleado está inactivo.';
  end if;

  if not exists (
    select 1 from public.restaurant_employee_access
    where owner_user_id = v_map.owner_user_id
      and is_active = true
  ) then
    raise exception 'El acceso del equipo está desactivado.';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_map.owner_user_id;

  if not found
     or coalesce(v_profile.is_suspended, false)
     or lower(coalesce(v_profile.subscription_status, 'activo')) in ('suspendido', 'vencido')
     or (v_profile.subscription_end is not null and v_profile.subscription_end::date < current_date) then
    raise exception 'La cuenta del negocio no está disponible.';
  end if;

  return jsonb_build_object(
    'ownerId', v_profile.id,
    'ownerName', v_profile.owner_name,
    'storeName', v_profile.store_name,
    'city', v_profile.city,
    'businessId', v_profile.business_id,
    'address', v_profile.address,
    'phone', v_profile.phone,
    'commercialEmail', v_profile.commercial_email,
    'receiptFooter', v_profile.receipt_footer,
    'logoUrl', v_profile.logo_url,
    'businessType', v_profile.business_type,
    'plan', v_profile.plan,
    'subscriptionStatus', v_profile.subscription_status,
    'subscriptionStart', v_profile.subscription_start,
    'subscriptionEnd', v_profile.subscription_end,
    'isSuspended', coalesce(v_profile.is_suspended, false),
    'maxProducts', v_profile.max_products,
    'splitPaymentEnabled', coalesce(v_profile.split_payment_enabled, false),
    'customerAccountsEnabled', coalesce(v_profile.customer_accounts_enabled, false),
    'operator', jsonb_build_object(
      'id', v_staff.id,
      'name', v_staff.name,
      'role', v_staff.role,
      'permissions', v_staff.permissions
    )
  );
end;
$$;

revoke all on function public.restaurant_employee_session_context() from public;
grant execute on function public.restaurant_employee_session_context() to authenticated;


-- Políticas adicionales para sesiones de empleados.
-- Las políticas originales del propietario permanecen intactas.


drop policy if exists "restaurant_employee_products_select" on public.products;
create policy "restaurant_employee_products_select" on public.products
for select to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and (
    public.restaurant_employee_has_permission('sales.manage')
    or public.restaurant_employee_has_permission('orders.manage')
    or public.restaurant_employee_has_permission('orders.view')
    or public.restaurant_employee_has_permission('kitchen.manage')
    or public.restaurant_employee_has_permission('menu.manage')
    or public.restaurant_employee_has_permission('inventory.manage')
    or public.restaurant_employee_has_permission('purchases.manage')
    or public.restaurant_employee_has_permission('reports.view')
    or public.restaurant_employee_has_permission('costs.view')
  )
);

drop policy if exists "restaurant_employee_products_insert" on public.products;
create policy "restaurant_employee_products_insert" on public.products
for insert to authenticated
with check (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and public.restaurant_employee_has_permission('menu.manage')
);

drop policy if exists "restaurant_employee_products_update" on public.products;
create policy "restaurant_employee_products_update" on public.products
for update to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and (
    public.restaurant_employee_has_permission('menu.manage')
    or public.restaurant_employee_has_permission('purchases.manage')
    or public.restaurant_employee_has_permission('inventory.adjust')
  )
)
with check (user_id = public.restaurant_effective_user_id());

drop policy if exists "restaurant_employee_products_delete" on public.products;
create policy "restaurant_employee_products_delete" on public.products
for delete to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and public.restaurant_employee_has_permission('menu.manage')
);

drop policy if exists "restaurant_employee_clients_select" on public.clients;
create policy "restaurant_employee_clients_select" on public.clients
for select to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and (
    public.restaurant_employee_has_permission('clients.view')
    or public.restaurant_employee_has_permission('clients.manage')
    or public.restaurant_employee_has_permission('sales.manage')
    or public.restaurant_employee_has_permission('checkout.manage')
  )
);

drop policy if exists "restaurant_employee_clients_insert" on public.clients;
create policy "restaurant_employee_clients_insert" on public.clients
for insert to authenticated
with check (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and public.restaurant_employee_has_permission('clients.manage')
);

drop policy if exists "restaurant_employee_clients_update" on public.clients;
create policy "restaurant_employee_clients_update" on public.clients
for update to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and public.restaurant_employee_has_permission('clients.manage')
)
with check (user_id = public.restaurant_effective_user_id());

drop policy if exists "restaurant_employee_clients_delete" on public.clients;
create policy "restaurant_employee_clients_delete" on public.clients
for delete to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and public.restaurant_employee_has_permission('clients.manage')
);

drop policy if exists "restaurant_employee_sales_select" on public.sales;
create policy "restaurant_employee_sales_select" on public.sales
for select to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and (
    public.restaurant_employee_has_permission('sales.manage')
    or public.restaurant_employee_has_permission('checkout.manage')
    or public.restaurant_employee_has_permission('cash.view')
    or public.restaurant_employee_has_permission('reports.view')
  )
);

drop policy if exists "restaurant_employee_sales_insert" on public.sales;
create policy "restaurant_employee_sales_insert" on public.sales
for insert to authenticated
with check (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and (
    public.restaurant_employee_has_permission('sales.manage')
    or public.restaurant_employee_has_permission('checkout.manage')
  )
);

drop policy if exists "restaurant_employee_sales_update" on public.sales;
create policy "restaurant_employee_sales_update" on public.sales
for update to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and public.restaurant_employee_has_permission('cancellations.manage')
)
with check (user_id = public.restaurant_effective_user_id());

drop policy if exists "restaurant_employee_sale_items_select" on public.sale_items;
create policy "restaurant_employee_sale_items_select" on public.sale_items
for select to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and (
    public.restaurant_employee_has_permission('sales.manage')
    or public.restaurant_employee_has_permission('checkout.manage')
    or public.restaurant_employee_has_permission('cash.view')
    or public.restaurant_employee_has_permission('reports.view')
  )
);

drop policy if exists "restaurant_employee_sale_items_insert" on public.sale_items;
create policy "restaurant_employee_sale_items_insert" on public.sale_items
for insert to authenticated
with check (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and (
    public.restaurant_employee_has_permission('sales.manage')
    or public.restaurant_employee_has_permission('checkout.manage')
  )
);

drop policy if exists "restaurant_employee_food_modifiers_select" on public.food_modifiers;
create policy "restaurant_employee_food_modifiers_select" on public.food_modifiers
for select to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and (
    public.restaurant_employee_has_permission('sales.manage')
    or public.restaurant_employee_has_permission('orders.manage')
    or public.restaurant_employee_has_permission('menu.manage')
  )
);

drop policy if exists "restaurant_employee_food_modifiers_write" on public.food_modifiers;
create policy "restaurant_employee_food_modifiers_write" on public.food_modifiers
for all to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and public.restaurant_employee_has_permission('menu.manage')
)
with check (
  user_id = public.restaurant_effective_user_id()
  and public.restaurant_employee_has_permission('menu.manage')
);

drop policy if exists "restaurant_employee_areas_select" on public.restaurant_areas;
create policy "restaurant_employee_areas_select" on public.restaurant_areas
for select to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and (
    public.restaurant_employee_has_permission('tables.manage')
    or public.restaurant_employee_has_permission('orders.manage')
    or public.restaurant_employee_has_permission('orders.view')
    or public.restaurant_employee_has_permission('kitchen.manage')
    or public.restaurant_employee_has_permission('checkout.manage')
  )
);

drop policy if exists "restaurant_employee_areas_write" on public.restaurant_areas;
create policy "restaurant_employee_areas_write" on public.restaurant_areas
for all to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and public.restaurant_employee_has_permission('tables.manage')
)
with check (
  user_id = public.restaurant_effective_user_id()
  and public.restaurant_employee_has_permission('tables.manage')
);

drop policy if exists "restaurant_employee_tables_select" on public.restaurant_tables;
create policy "restaurant_employee_tables_select" on public.restaurant_tables
for select to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and (
    public.restaurant_employee_has_permission('tables.manage')
    or public.restaurant_employee_has_permission('orders.manage')
    or public.restaurant_employee_has_permission('orders.view')
    or public.restaurant_employee_has_permission('kitchen.manage')
    or public.restaurant_employee_has_permission('checkout.manage')
  )
);

drop policy if exists "restaurant_employee_tables_write" on public.restaurant_tables;
create policy "restaurant_employee_tables_write" on public.restaurant_tables
for all to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and public.restaurant_employee_has_permission('tables.manage')
)
with check (
  user_id = public.restaurant_effective_user_id()
  and public.restaurant_employee_has_permission('tables.manage')
);

drop policy if exists "restaurant_employee_orders_select" on public.restaurant_orders;
create policy "restaurant_employee_orders_select" on public.restaurant_orders
for select to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and (
    public.restaurant_employee_has_permission('orders.manage')
    or public.restaurant_employee_has_permission('orders.view')
    or public.restaurant_employee_has_permission('tables.manage')
    or public.restaurant_employee_has_permission('kitchen.manage')
    or public.restaurant_employee_has_permission('checkout.manage')
    or public.restaurant_employee_has_permission('cash.view')
  )
);

drop policy if exists "restaurant_employee_orders_write" on public.restaurant_orders;
create policy "restaurant_employee_orders_write" on public.restaurant_orders
for all to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and (
    public.restaurant_employee_has_permission('orders.manage')
    or public.restaurant_employee_has_permission('kitchen.manage')
    or public.restaurant_employee_has_permission('checkout.manage')
  )
)
with check (user_id = public.restaurant_effective_user_id());

drop policy if exists "restaurant_employee_order_items_select" on public.restaurant_order_items;
create policy "restaurant_employee_order_items_select" on public.restaurant_order_items
for select to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and (
    public.restaurant_employee_has_permission('orders.manage')
    or public.restaurant_employee_has_permission('orders.view')
    or public.restaurant_employee_has_permission('kitchen.manage')
    or public.restaurant_employee_has_permission('checkout.manage')
  )
);

drop policy if exists "restaurant_employee_order_items_write" on public.restaurant_order_items;
create policy "restaurant_employee_order_items_write" on public.restaurant_order_items
for all to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and (
    public.restaurant_employee_has_permission('orders.manage')
    or public.restaurant_employee_has_permission('kitchen.manage')
  )
)
with check (user_id = public.restaurant_effective_user_id());

drop policy if exists "restaurant_employee_order_payments_select" on public.restaurant_order_payments;
create policy "restaurant_employee_order_payments_select" on public.restaurant_order_payments
for select to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and (
    public.restaurant_employee_has_permission('checkout.manage')
    or public.restaurant_employee_has_permission('cash.view')
  )
);

drop policy if exists "restaurant_employee_inventory_consumptions_select" on public.restaurant_inventory_consumptions;
create policy "restaurant_employee_inventory_consumptions_select" on public.restaurant_inventory_consumptions
for select to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and (
    public.restaurant_employee_has_permission('inventory.manage')
    or public.restaurant_employee_has_permission('reports.view')
    or public.restaurant_employee_has_permission('costs.view')
  )
);

drop policy if exists "restaurant_employee_inventory_issues_select" on public.restaurant_inventory_issues;
create policy "restaurant_employee_inventory_issues_select" on public.restaurant_inventory_issues
for select to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and (
    public.restaurant_employee_has_permission('inventory.manage')
    or public.restaurant_employee_has_permission('reports.view')
    or public.restaurant_employee_has_permission('costs.view')
  )
);

drop policy if exists "restaurant_employee_stock_adjustments_select" on public.restaurant_stock_adjustments;
create policy "restaurant_employee_stock_adjustments_select" on public.restaurant_stock_adjustments
for select to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and (
    public.restaurant_employee_has_permission('inventory.manage')
    or public.restaurant_employee_has_permission('reports.view')
    or public.restaurant_employee_has_permission('costs.view')
  )
);

drop policy if exists "restaurant_employee_stock_adjustments_insert" on public.restaurant_stock_adjustments;
create policy "restaurant_employee_stock_adjustments_insert" on public.restaurant_stock_adjustments
for insert to authenticated
with check (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and public.restaurant_employee_has_permission('inventory.adjust')
);

drop policy if exists "restaurant_employee_recipes_select" on public.production_recipes;
create policy "restaurant_employee_recipes_select" on public.production_recipes
for select to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and (
    public.restaurant_employee_has_permission('orders.manage')
    or public.restaurant_employee_has_permission('kitchen.manage')
    or public.restaurant_employee_has_permission('recipes.manage')
    or public.restaurant_employee_has_permission('inventory.manage')
    or public.restaurant_employee_has_permission('reports.view')
    or public.restaurant_employee_has_permission('costs.view')
  )
);

drop policy if exists "restaurant_employee_recipe_items_select" on public.production_recipe_items;
create policy "restaurant_employee_recipe_items_select" on public.production_recipe_items
for select to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and (
    public.restaurant_employee_has_permission('orders.manage')
    or public.restaurant_employee_has_permission('kitchen.manage')
    or public.restaurant_employee_has_permission('recipes.manage')
    or public.restaurant_employee_has_permission('inventory.manage')
    or public.restaurant_employee_has_permission('reports.view')
    or public.restaurant_employee_has_permission('costs.view')
  )
);

drop policy if exists "restaurant_employee_recipes_write" on public.production_recipes;
create policy "restaurant_employee_recipes_write" on public.production_recipes
for all to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and public.restaurant_employee_has_permission('recipes.manage')
)
with check (
  user_id = public.restaurant_effective_user_id()
  and public.restaurant_employee_has_permission('recipes.manage')
);

drop policy if exists "restaurant_employee_recipe_items_write" on public.production_recipe_items;
create policy "restaurant_employee_recipe_items_write" on public.production_recipe_items
for all to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and public.restaurant_employee_has_permission('recipes.manage')
)
with check (
  user_id = public.restaurant_effective_user_id()
  and public.restaurant_employee_has_permission('recipes.manage')
);

drop policy if exists "restaurant_employee_providers_select" on public.providers;
create policy "restaurant_employee_providers_select" on public.providers
for select to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and public.restaurant_employee_has_permission('providers.manage')
);

drop policy if exists "restaurant_employee_providers_write" on public.providers;
create policy "restaurant_employee_providers_write" on public.providers
for all to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and public.restaurant_employee_has_permission('providers.manage')
)
with check (user_id = public.restaurant_effective_user_id());

drop policy if exists "restaurant_employee_purchases_select" on public.purchases;
create policy "restaurant_employee_purchases_select" on public.purchases
for select to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and public.restaurant_employee_has_permission('purchases.manage')
);

drop policy if exists "restaurant_employee_purchases_write" on public.purchases;
create policy "restaurant_employee_purchases_write" on public.purchases
for all to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and public.restaurant_employee_has_permission('purchases.manage')
)
with check (user_id = public.restaurant_effective_user_id());

drop policy if exists "restaurant_employee_purchase_items_select" on public.purchase_items;
create policy "restaurant_employee_purchase_items_select" on public.purchase_items
for select to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and public.restaurant_employee_has_permission('purchases.manage')
);

drop policy if exists "restaurant_employee_purchase_items_write" on public.purchase_items;
create policy "restaurant_employee_purchase_items_write" on public.purchase_items
for all to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and public.restaurant_employee_has_permission('purchases.manage')
)
with check (user_id = public.restaurant_effective_user_id());

drop policy if exists "restaurant_employee_inventory_movements_select" on public.inventory_movements;
create policy "restaurant_employee_inventory_movements_select" on public.inventory_movements
for select to authenticated
using (
  public.restaurant_is_employee_session()
  and user_id = public.restaurant_effective_user_id()
  and (
    public.restaurant_employee_has_permission('inventory.manage')
    or public.restaurant_employee_has_permission('reports.view')
    or public.restaurant_employee_has_permission('costs.view')
  )
);

-- Caja gastronómica (si las tablas existen en la instalación base).
do $policy$
begin
  if to_regclass('public.cash_sessions') is not null then
    execute 'drop policy if exists "restaurant_employee_cash_sessions_all" on public.cash_sessions';
    execute $sql$create policy "restaurant_employee_cash_sessions_all" on public.cash_sessions for all to authenticated
      using (public.restaurant_is_employee_session() and user_id = public.restaurant_effective_user_id() and public.restaurant_employee_has_permission('cash.view'))
      with check (user_id = public.restaurant_effective_user_id() and public.restaurant_employee_has_permission('cash.view'))$sql$;
  end if;

  if to_regclass('public.cash_expenses') is not null then
    execute 'drop policy if exists "restaurant_employee_cash_expenses_all" on public.cash_expenses';
    execute $sql$create policy "restaurant_employee_cash_expenses_all" on public.cash_expenses for all to authenticated
      using (public.restaurant_is_employee_session() and user_id = public.restaurant_effective_user_id() and public.restaurant_employee_has_permission('cash.view'))
      with check (user_id = public.restaurant_effective_user_id() and public.restaurant_employee_has_permission('cash.view'))$sql$;
  end if;
end
$policy$;


-- Funciones de restaurante adaptadas a owner_user_id efectivo.

create or replace function public.restaurant_clear_floor()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.restaurant_effective_user_id();
  v_busy_tables integer := 0;
  v_table_count integer := 0;
  v_area_count integer := 0;
begin
  perform public.restaurant_require_permission('tables.manage');
  if v_user_id is null then
    raise exception 'No existe una sesión activa.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_user_id
      and business_type = 'restaurante'
  ) then
    raise exception 'El plano de mesas solo está disponible para cuentas Restaurante.';
  end if;

  select count(*)
  into v_busy_tables
  from public.restaurant_tables
  where user_id = v_user_id
    and is_active = true
    and status <> 'libre';

  if v_busy_tables > 0 then
    raise exception 'Primero marca todas las mesas como libres antes de eliminar el plano.';
  end if;

  select count(*)
  into v_table_count
  from public.restaurant_tables
  where user_id = v_user_id
    and is_active = true;

  select count(*)
  into v_area_count
  from public.restaurant_areas
  where user_id = v_user_id
    and is_active = true;

  update public.restaurant_tables
  set is_active = false,
      joined_to = null
  where user_id = v_user_id
    and is_active = true;

  update public.restaurant_areas
  set is_active = false
  where user_id = v_user_id
    and is_active = true;

  return jsonb_build_object(
    'cleared', true,
    'areas', v_area_count,
    'tables', v_table_count
  );
end;
$$;

create or replace function public.restaurant_seed_default_floor()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.restaurant_effective_user_id();
  v_area_id uuid;
  v_existing_count integer;
  v_index integer;
begin
  perform public.restaurant_require_permission('tables.manage');
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
  v_user_id uuid := public.restaurant_effective_user_id();
  v_table public.restaurant_tables;
begin
  perform public.restaurant_require_permission('tables.manage');
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
  v_user_id uuid := public.restaurant_effective_user_id();
  v_table public.restaurant_tables;
  v_status text := lower(trim(coalesce(p_status, '')));
begin
  perform public.restaurant_require_permission('tables.manage');
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
  v_user_id uuid := public.restaurant_effective_user_id();
  v_status text := lower(trim(coalesce(p_next_status, 'libre')));
  v_table public.restaurant_tables;
begin
  perform public.restaurant_require_permission('tables.manage');
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
  v_user_id uuid := public.restaurant_effective_user_id();
  v_source public.restaurant_tables;
  v_target public.restaurant_tables;
begin
  perform public.restaurant_require_permission('tables.manage');
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
  v_user_id uuid := public.restaurant_effective_user_id();
  v_primary public.restaurant_tables;
  v_secondary public.restaurant_tables;
begin
  perform public.restaurant_require_permission('tables.manage');
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
  v_user_id uuid := public.restaurant_effective_user_id();
  v_table public.restaurant_tables;
begin
  perform public.restaurant_require_permission('tables.manage');
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
  v_user_id uuid := public.restaurant_effective_user_id();
  v_order_id uuid := p_order_id;
  v_order_type text := lower(trim(coalesce(p_order_type, 'local')));
  v_order_code text;
  v_item jsonb;
  v_product_id uuid;
  v_table public.restaurant_tables;
  v_sort integer := 0;
begin
  perform public.restaurant_require_permission('orders.manage');
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
  v_user_id uuid := public.restaurant_effective_user_id();
  v_order public.restaurant_orders;
  v_pending integer;
begin
  perform public.restaurant_require_permission('orders.manage');
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
  v_user_id uuid := public.restaurant_effective_user_id();
  v_order public.restaurant_orders;
begin
  perform public.restaurant_require_permission('orders.manage');
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
  v_user_id uuid := public.restaurant_effective_user_id();
  v_order_id uuid;
  v_order public.restaurant_orders;
begin
  perform public.restaurant_require_permission('cancellations.manage');
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
  v_user_id uuid := public.restaurant_effective_user_id();
  v_order public.restaurant_orders;
  v_source_table uuid;
  v_target public.restaurant_tables;
begin
  perform public.restaurant_require_permission('orders.manage');
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

create or replace function public.restaurant_sync_kitchen_order(p_order_id uuid)
returns public.restaurant_orders
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.restaurant_effective_user_id();
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
  v_user_id uuid := public.restaurant_effective_user_id();
  v_item public.restaurant_order_items;
  v_target text := lower(trim(coalesce(p_status, '')));
begin
  perform public.restaurant_require_permission('kitchen.manage');
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
  v_user_id uuid := public.restaurant_effective_user_id();
  v_station text := lower(trim(coalesce(p_station, '')));
  v_target text := lower(trim(coalesce(p_status, '')));
  v_count integer := 0;
begin
  perform public.restaurant_require_permission('kitchen.manage');
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
  v_user_id uuid := public.restaurant_effective_user_id();
  v_item public.restaurant_order_items;
begin
  perform public.restaurant_require_permission('kitchen.manage');
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

create or replace function public.restaurant_refresh_checkout_totals(p_order_id uuid)
returns public.restaurant_orders
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.restaurant_effective_user_id();
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
  v_user_id uuid := public.restaurant_effective_user_id();
  v_order public.restaurant_orders;
  v_payments integer := 0;
begin
  perform public.restaurant_require_permission('discounts.apply');
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
  v_user_id uuid := public.restaurant_effective_user_id();
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
  perform public.restaurant_require_permission('checkout.manage');
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
  v_user_id uuid := public.restaurant_effective_user_id();
  v_payment public.restaurant_order_payments;
  v_order public.restaurant_orders;
begin
  perform public.restaurant_require_permission('payments.void');
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

create or replace function public.register_restaurant_preparation_batch(
  p_recipe_id uuid,
  p_produced_quantity numeric,
  p_production_date date,
  p_notes text,
  p_batch_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.restaurant_effective_user_id();
  v_recipe public.production_recipes%rowtype;
  v_output public.products%rowtype;
  v_item record;
  v_ingredient public.products%rowtype;
  v_batch_id uuid := gen_random_uuid();
  v_batch_code text;
  v_multiplier numeric;
  v_output_stock_unit text;
  v_output_stock_quantity numeric;
  v_required_recipe_quantity numeric;
  v_stock_unit text;
  v_stock_quantity numeric;
  v_stock_before numeric;
  v_stock_after numeric;
  v_line_cost numeric;
  v_ingredient_cost numeric := 0;
  v_total_cost numeric := 0;
  v_unit_cost numeric := 0;
  v_existing_output_stock numeric;
  v_existing_output_cost numeric;
  v_new_output_stock numeric;
  v_new_output_cost numeric;
  v_attempt integer := 0;
begin
  perform public.restaurant_require_permission('inventory.adjust');
  if v_user_id is null then raise exception 'No existe una sesión autenticada.'; end if;
  if not exists (select 1 from public.profiles where id = v_user_id and business_type = 'restaurante') then
    raise exception 'Esta función está disponible únicamente para cuentas tipo Restaurante.';
  end if;
  if coalesce(p_produced_quantity, 0) <= 0 then raise exception 'La cantidad elaborada debe ser mayor a cero.'; end if;

  select * into v_recipe
  from public.production_recipes
  where id = p_recipe_id and user_id = v_user_id and recipe_context = 'restaurant'
  for update;
  if not found then raise exception 'La receta no existe o no pertenece al restaurante.'; end if;
  if not v_recipe.is_active then raise exception 'La receta está inactiva.'; end if;

  select * into v_output
  from public.products
  where id = v_recipe.output_product_id and user_id = v_user_id
  for update;
  if not found then raise exception 'La preparación de salida ya no existe.'; end if;
  if coalesce(v_output.product_type, '') <> 'intermediate'
     and lower(trim(coalesce(v_output.category, ''))) not like 'preparaciones -%'
     and lower(trim(coalesce(v_output.category, ''))) not like 'preparación -%' then
    raise exception 'Solo se puede registrar producción de preparaciones internas.';
  end if;

  if not exists (select 1 from public.production_recipe_items where recipe_id = v_recipe.id and user_id = v_user_id) then
    raise exception 'La preparación no tiene componentes registrados.';
  end if;

  v_multiplier := p_produced_quantity / v_recipe.yield_quantity;
  v_output_stock_unit := coalesce(nullif(trim(v_output.stock_unit), ''), nullif(trim(v_output.size), ''), v_recipe.yield_unit);
  v_output_stock_quantity := public.inventiq_convert_quantity(p_produced_quantity, v_recipe.yield_unit, v_output_stock_unit);
  if v_output_stock_quantity is null or v_output_stock_quantity <= 0 then
    raise exception 'La unidad de rendimiento (%) no es compatible con la unidad de stock (%).', v_recipe.yield_unit, v_output_stock_unit;
  end if;

  if nullif(trim(coalesce(p_batch_code, '')), '') is not null then
    v_batch_code := upper(trim(p_batch_code));
    if exists (select 1 from public.production_batches where user_id = v_user_id and batch_code = v_batch_code) then
      raise exception 'Ya existe un lote con el código %.', v_batch_code;
    end if;
  else
    loop
      v_attempt := v_attempt + 1;
      v_batch_code := 'PREP-' || to_char(coalesce(p_production_date, current_date), 'YYYYMMDD') || '-' || lpad((floor(random() * 10000))::integer::text, 4, '0');
      exit when not exists (select 1 from public.production_batches where user_id = v_user_id and batch_code = v_batch_code);
      if v_attempt >= 20 then raise exception 'No se pudo generar el código del lote.'; end if;
    end loop;
  end if;

  insert into public.production_batches (
    id, user_id, recipe_id, output_product_id, batch_code, production_date,
    produced_quantity, produced_unit, output_stock_quantity, output_stock_unit,
    recipe_multiplier, ingredient_cost, additional_cost, total_cost, unit_cost,
    output_product_name, recipe_name, status, notes, created_by, production_context
  ) values (
    v_batch_id, v_user_id, v_recipe.id, v_output.id, v_batch_code, coalesce(p_production_date, current_date),
    p_produced_quantity, v_recipe.yield_unit, v_output_stock_quantity, v_output_stock_unit,
    v_multiplier, 0, 0, 0, 0, v_output.name, v_recipe.name, 'completed',
    nullif(trim(coalesce(p_notes, '')), ''), v_user_id, 'restaurant'
  );

  for v_item in
    select * from public.production_recipe_items
    where recipe_id = v_recipe.id and user_id = v_user_id
    order by created_at, id
  loop
    select * into v_ingredient
    from public.products
    where id = v_item.ingredient_product_id and user_id = v_user_id
    for update;
    if not found then raise exception 'Uno de los componentes de la receta ya no existe.'; end if;

    v_required_recipe_quantity := (v_item.quantity * v_multiplier) * (1 + (v_item.waste_percent / 100));
    v_stock_unit := coalesce(nullif(trim(v_ingredient.stock_unit), ''), nullif(trim(v_ingredient.size), ''), v_item.unit);
    v_stock_quantity := public.inventiq_convert_quantity(v_required_recipe_quantity, v_item.unit, v_stock_unit);
    if v_stock_quantity is null or v_stock_quantity <= 0 then
      raise exception 'La unidad de % no es compatible con su unidad de stock.', v_ingredient.name;
    end if;

    v_stock_before := coalesce(v_ingredient.stock, 0);
    if v_stock_before + 0.0000001 < v_stock_quantity then
      raise exception 'Stock insuficiente de %. Disponible: % %. Requerido: % %.',
        v_ingredient.name, round(v_stock_before, 4), v_stock_unit, round(v_stock_quantity, 4), v_stock_unit;
    end if;

    v_stock_after := greatest(v_stock_before - v_stock_quantity, 0);
    v_line_cost := v_stock_quantity * greatest(coalesce(v_ingredient.cost, 0), 0);
    v_ingredient_cost := v_ingredient_cost + v_line_cost;

    update public.products
    set stock = v_stock_after,
        status = case when v_stock_after <= 0 then 'Inactivo' else 'Activo' end
    where id = v_ingredient.id and user_id = v_user_id;

    insert into public.production_batch_items (
      user_id, batch_id, ingredient_product_id, ingredient_name, recipe_quantity,
      waste_percent, required_quantity, recipe_unit, stock_quantity, stock_unit,
      unit_cost, total_cost, stock_before, stock_after
    ) values (
      v_user_id, v_batch_id, v_ingredient.id, v_ingredient.name,
      v_item.quantity * v_multiplier, v_item.waste_percent, v_required_recipe_quantity,
      v_item.unit, v_stock_quantity, v_stock_unit, greatest(coalesce(v_ingredient.cost, 0), 0),
      v_line_cost, v_stock_before, v_stock_after
    );

    insert into public.inventory_movements (
      user_id, product_id, product_name, movement_type, quantity, stock_before,
      stock_after, unit, reference_type, reference_id, notes, created_by
    ) values (
      v_user_id, v_ingredient.id, v_ingredient.name, 'restaurant_preparation_input',
      -v_stock_quantity, v_stock_before, v_stock_after, v_stock_unit,
      'restaurant_preparation_batch', v_batch_id, 'Consumo para ' || v_output.name || ' · ' || v_batch_code, v_user_id
    );
  end loop;

  v_total_cost := v_ingredient_cost
    + greatest(coalesce(v_recipe.additional_cost, 0), 0) * v_multiplier
    + greatest(coalesce(v_recipe.labor_cost, 0), 0) * v_multiplier
    + greatest(coalesce(v_recipe.overhead_cost, 0), 0) * v_multiplier;
  v_unit_cost := case when v_output_stock_quantity > 0 then v_total_cost / v_output_stock_quantity else 0 end;

  v_existing_output_stock := coalesce(v_output.stock, 0);
  v_existing_output_cost := greatest(coalesce(v_output.cost, 0), 0);
  v_new_output_stock := v_existing_output_stock + v_output_stock_quantity;
  v_new_output_cost := case
    when v_new_output_stock > 0 then
      ((v_existing_output_stock * v_existing_output_cost) + v_total_cost) / v_new_output_stock
    else v_unit_cost
  end;

  update public.products
  set stock = v_new_output_stock,
      cost = v_new_output_cost,
      status = 'Activo'
  where id = v_output.id and user_id = v_user_id;

  insert into public.inventory_movements (
    user_id, product_id, product_name, movement_type, quantity, stock_before,
    stock_after, unit, reference_type, reference_id, notes, created_by
  ) values (
    v_user_id, v_output.id, v_output.name, 'restaurant_preparation_output',
    v_output_stock_quantity, v_existing_output_stock, v_new_output_stock,
    v_output_stock_unit, 'restaurant_preparation_batch', v_batch_id,
    'Preparación interna · ' || v_batch_code, v_user_id
  );

  update public.production_batches
  set ingredient_cost = round(v_ingredient_cost, 4),
      additional_cost = round(v_total_cost - v_ingredient_cost, 4),
      total_cost = round(v_total_cost, 4),
      unit_cost = round(v_unit_cost, 6)
  where id = v_batch_id and user_id = v_user_id;

  return jsonb_build_object(
    'batch_id', v_batch_id,
    'batch_code', v_batch_code,
    'output_product_id', v_output.id,
    'output_product_name', v_output.name,
    'produced_quantity', p_produced_quantity,
    'output_stock_quantity', v_output_stock_quantity,
    'output_stock_unit', v_output_stock_unit,
    'total_cost', round(v_total_cost, 4),
    'unit_cost', round(v_unit_cost, 6)
  );
end;
$$;

create or replace function public.restaurant_apply_order_inventory(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_order public.restaurant_orders%rowtype;
  v_item record;
  v_recipe public.production_recipes%rowtype;
  v_component record;
  v_ingredient public.products%rowtype;
  v_stock_unit text;
  v_required_recipe_quantity numeric;
  v_stock_quantity numeric;
  v_stock_before numeric;
  v_stock_after numeric;
  v_applied numeric;
  v_shortage numeric;
  v_unit_cost numeric;
  v_theoretical_cost numeric;
  v_applied_cost numeric;
  v_source_kind text;
  v_total_cost numeric := 0;
  v_shortages integer := 0;
  v_issues integer := 0;
  v_consumption_count integer := 0;
  v_skip_packaging boolean;
  v_issue_details text;
begin
  select * into v_order
  from public.restaurant_orders
  where id = p_order_id
  for update;
  if not found then raise exception 'La cuenta del restaurante no existe.'; end if;

  if public.restaurant_effective_user_id() is not null and public.restaurant_effective_user_id() <> v_order.user_id then
    raise exception 'La cuenta no pertenece al negocio actual.';
  end if;
  if v_order.status <> 'cerrada' then
    return jsonb_build_object('processed', false, 'reason', 'order_not_closed');
  end if;
  if v_order.inventory_consumed_at is not null
     or v_order.inventory_consumption_status in ('complete', 'partial', 'legacy') then
    return jsonb_build_object('processed', false, 'reason', 'already_processed');
  end if;

  v_skip_packaging := v_order.order_type = 'local';

  for v_item in
    select * from public.restaurant_order_items
    where order_id = v_order.id
      and user_id = v_order.user_id
      and (
        status <> 'cancelado'
        or started_at is not null
        or ready_at is not null
        or served_at is not null
      )
    order by sort_order, created_at
  loop
    select * into v_recipe
    from public.production_recipes
    where user_id = v_order.user_id
      and output_product_id = v_item.product_id
      and recipe_context = 'restaurant'
      and is_active = true
    order by version desc, updated_at desc
    limit 1;

    if not found then
      insert into public.restaurant_inventory_issues (
        user_id, order_id, order_item_id, menu_product_id, menu_product_name,
        issue_type, details
      ) values (
        v_order.user_id, v_order.id, v_item.id, v_item.product_id, v_item.product_name,
        'missing_recipe', 'El producto no tiene una receta gastronómica activa.'
      );
      v_issues := v_issues + 1;
      continue;
    end if;

    if coalesce(v_recipe.yield_quantity, 0) <= 0 then
      insert into public.restaurant_inventory_issues (
        user_id, order_id, order_item_id, menu_product_id, menu_product_name,
        issue_type, details
      ) values (
        v_order.user_id, v_order.id, v_item.id, v_item.product_id, v_item.product_name,
        'invalid_yield', 'La receta tiene un rendimiento inválido.'
      );
      v_issues := v_issues + 1;
      continue;
    end if;

    for v_component in
      select pri.*
      from public.production_recipe_items pri
      where pri.recipe_id = v_recipe.id and pri.user_id = v_order.user_id
      order by pri.created_at, pri.id
    loop
      select * into v_ingredient
      from public.products
      where id = v_component.ingredient_product_id and user_id = v_order.user_id
      for update;

      if not found then
        insert into public.restaurant_inventory_issues (
          user_id, order_id, order_item_id, menu_product_id, menu_product_name,
          issue_type, details
        ) values (
          v_order.user_id, v_order.id, v_item.id, v_item.product_id, v_item.product_name,
          'missing_component', 'Uno de los componentes de la receta ya no existe.'
        );
        v_issues := v_issues + 1;
        continue;
      end if;

      v_source_kind := case
        when coalesce(v_ingredient.product_type, '') = 'packaging'
          or lower(trim(coalesce(v_ingredient.category, ''))) like 'empaque%'
          then 'packaging'
        when coalesce(v_ingredient.product_type, '') = 'intermediate'
          or lower(trim(coalesce(v_ingredient.category, ''))) like 'preparaciones -%'
          or lower(trim(coalesce(v_ingredient.category, ''))) like 'preparación -%'
          then 'preparation'
        else 'ingredient'
      end;

      if v_skip_packaging and v_source_kind = 'packaging' then
        continue;
      end if;

      v_required_recipe_quantity := (v_component.quantity * v_item.quantity / v_recipe.yield_quantity)
        * (1 + (v_component.waste_percent / 100));
      v_stock_unit := coalesce(nullif(trim(v_ingredient.stock_unit), ''), nullif(trim(v_ingredient.size), ''), v_component.unit);
      v_stock_quantity := public.inventiq_convert_quantity(v_required_recipe_quantity, v_component.unit, v_stock_unit);

      if v_stock_quantity is null or v_stock_quantity <= 0 then
        v_issue_details := 'La unidad ' || coalesce(v_component.unit, 'sin unidad') || ' no es compatible con ' || coalesce(v_stock_unit, 'la unidad de stock') || ' de ' || v_ingredient.name || '.';
        insert into public.restaurant_inventory_issues (
          user_id, order_id, order_item_id, menu_product_id, menu_product_name,
          issue_type, details
        ) values (
          v_order.user_id, v_order.id, v_item.id, v_item.product_id, v_item.product_name,
          'incompatible_unit', v_issue_details
        );
        v_issues := v_issues + 1;
        continue;
      end if;

      v_stock_before := greatest(coalesce(v_ingredient.stock, 0), 0);
      v_applied := least(v_stock_before, v_stock_quantity);
      v_shortage := greatest(v_stock_quantity - v_stock_before, 0);
      v_stock_after := greatest(v_stock_before - v_stock_quantity, 0);
      v_unit_cost := greatest(coalesce(v_ingredient.cost, 0), 0);
      v_theoretical_cost := v_stock_quantity * v_unit_cost;
      v_applied_cost := v_applied * v_unit_cost;

      update public.products
      set stock = v_stock_after,
          status = case when v_stock_after <= 0 then 'Inactivo' else 'Activo' end
      where id = v_ingredient.id and user_id = v_order.user_id;

      insert into public.restaurant_inventory_consumptions (
        user_id, order_id, sale_id, order_item_id, menu_product_id, menu_product_name,
        ingredient_product_id, ingredient_name, source_kind, quantity_sold,
        recipe_quantity, recipe_unit, required_quantity, stock_quantity,
        applied_quantity, shortage_quantity, stock_unit, unit_cost,
        theoretical_cost, applied_cost, stock_before, stock_after, order_type, created_by
      ) values (
        v_order.user_id, v_order.id, v_order.sale_id, v_item.id, v_item.product_id, v_item.product_name,
        v_ingredient.id, v_ingredient.name, v_source_kind, v_item.quantity,
        v_component.quantity, v_component.unit, v_required_recipe_quantity, v_stock_quantity,
        v_applied, v_shortage, v_stock_unit, v_unit_cost,
        v_theoretical_cost, v_applied_cost, v_stock_before, v_stock_after, v_order.order_type, v_order.user_id
      ) on conflict (user_id, order_item_id, ingredient_product_id) do nothing;

      if v_applied > 0 then
        insert into public.inventory_movements (
          user_id, product_id, product_name, movement_type, quantity, stock_before,
          stock_after, unit, reference_type, reference_id, notes, created_by
        ) values (
          v_order.user_id, v_ingredient.id, v_ingredient.name, 'restaurant_consumption',
          -v_applied, v_stock_before, v_stock_after, v_stock_unit,
          'restaurant_order', v_order.id,
          v_item.product_name || ' · ' || v_order.order_code,
          v_order.user_id
        );
      end if;

      v_total_cost := v_total_cost + v_theoretical_cost;
      v_consumption_count := v_consumption_count + 1;
      if v_shortage > 0 then v_shortages := v_shortages + 1; end if;
    end loop;
  end loop;

  update public.restaurant_orders
  set inventory_consumed_at = now(),
      inventory_cost_total = round(v_total_cost, 4),
      inventory_shortage_count = v_shortages,
      inventory_issue_count = v_issues,
      inventory_consumption_status = case
        when v_issues > 0 or v_shortages > 0 then 'partial'
        else 'complete'
      end,
      inventory_consumption_notes = case
        when v_consumption_count = 0 and v_issues = 0 then 'La cuenta no contenía componentes inventariables.'
        when v_issues > 0 or v_shortages > 0 then 'Revisa faltantes o recetas incompletas en Control gastronómico.'
        else 'Consumo aplicado correctamente según las recetas activas.'
      end
  where id = v_order.id;

  return jsonb_build_object(
    'processed', true,
    'order_id', v_order.id,
    'consumption_count', v_consumption_count,
    'inventory_cost_total', round(v_total_cost, 4),
    'shortage_count', v_shortages,
    'issue_count', v_issues
  );
end;
$$;

create or replace function public.register_restaurant_stock_adjustment(
  p_product_id uuid,
  p_adjustment_kind text,
  p_quantity numeric,
  p_event_date date,
  p_reason_code text,
  p_reason_label text,
  p_notes text default null,
  p_batch_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.restaurant_effective_user_id();
  v_product public.products%rowtype;
  v_batch public.production_batches%rowtype;
  v_adjustment_id uuid := gen_random_uuid();
  v_kind text := lower(trim(coalesce(p_adjustment_kind, '')));
  v_stock_before numeric;
  v_stock_after numeric;
  v_quantity_delta numeric;
  v_quantity_reported numeric := coalesce(p_quantity, 0);
  v_unit text;
  v_unit_cost numeric;
  v_cost_impact numeric;
  v_movement_type text;
  v_batch_code text;
begin
  perform public.restaurant_require_permission('inventory.adjust');
  if v_user_id is null then raise exception 'No existe una sesión autenticada.'; end if;
  if not exists (select 1 from public.profiles where id = v_user_id and business_type = 'restaurante') then
    raise exception 'Esta función está disponible únicamente para cuentas tipo Restaurante.';
  end if;
  if v_kind not in ('waste', 'physical_count') then raise exception 'El tipo de registro no es válido.'; end if;
  if nullif(trim(coalesce(p_reason_code, '')), '') is null then raise exception 'Selecciona un motivo.'; end if;

  select * into v_product
  from public.products
  where id = p_product_id and user_id = v_user_id
  for update;
  if not found then raise exception 'El producto o insumo no existe.'; end if;
  if coalesce(v_product.product_type, '') = 'service' then raise exception 'Los servicios no manejan existencias.'; end if;

  v_stock_before := greatest(coalesce(v_product.stock, 0), 0);
  v_unit := coalesce(nullif(trim(v_product.stock_unit), ''), nullif(trim(v_product.size), ''), 'unidad');
  v_unit_cost := greatest(coalesce(v_product.cost, 0), 0);

  if v_kind = 'waste' then
    if v_quantity_reported <= 0 then raise exception 'La cantidad de la merma debe ser mayor a cero.'; end if;
    if v_quantity_reported > v_stock_before + 0.0000001 then raise exception 'La merma supera el stock disponible.'; end if;
    v_quantity_delta := -v_quantity_reported;
    v_stock_after := v_stock_before + v_quantity_delta;
    v_movement_type := 'waste';
  else
    if p_quantity is null or v_quantity_reported < 0 then raise exception 'El conteo no puede ser negativo.'; end if;
    v_stock_after := v_quantity_reported;
    v_quantity_delta := v_stock_after - v_stock_before;
    if abs(v_quantity_delta) < 0.000001 then raise exception 'El conteo coincide con el stock actual.'; end if;
    v_movement_type := case when v_quantity_delta > 0 then 'adjustment_in' else 'adjustment_out' end;
  end if;

  if p_batch_id is not null then
    select * into v_batch from public.production_batches
    where id = p_batch_id and user_id = v_user_id and production_context = 'restaurant';
    if not found then raise exception 'El lote de preparación no existe.'; end if;
    v_batch_code := v_batch.batch_code;
  end if;

  v_cost_impact := abs(v_quantity_delta) * v_unit_cost;

  update public.products
  set stock = v_stock_after,
      status = case when v_stock_after <= 0 then 'Inactivo' else 'Activo' end
  where id = v_product.id and user_id = v_user_id;

  insert into public.restaurant_stock_adjustments (
    id, user_id, product_id, production_batch_id, adjustment_kind,
    reason_code, reason_label, product_name, product_type, quantity_reported,
    quantity_delta, stock_before, stock_after, unit, unit_cost, cost_impact,
    event_date, batch_code, notes, created_by
  ) values (
    v_adjustment_id, v_user_id, v_product.id, p_batch_id, v_kind,
    trim(p_reason_code), trim(p_reason_label), v_product.name,
    coalesce(v_product.product_type, 'sale_product'), v_quantity_reported,
    v_quantity_delta, v_stock_before, v_stock_after, v_unit, v_unit_cost,
    v_cost_impact, coalesce(p_event_date, current_date), v_batch_code,
    nullif(trim(coalesce(p_notes, '')), ''), v_user_id
  );

  insert into public.inventory_movements (
    user_id, product_id, product_name, movement_type, quantity, stock_before,
    stock_after, unit, reference_type, reference_id, notes, created_by
  ) values (
    v_user_id, v_product.id, v_product.name, v_movement_type, v_quantity_delta,
    v_stock_before, v_stock_after, v_unit, 'restaurant_stock_adjustment',
    v_adjustment_id, trim(p_reason_label), v_user_id
  );

  return jsonb_build_object(
    'adjustment_id', v_adjustment_id,
    'product_name', v_product.name,
    'quantity_delta', v_quantity_delta,
    'stock_before', v_stock_before,
    'stock_after', v_stock_after,
    'unit', v_unit,
    'cost_impact', round(v_cost_impact, 4)
  );
end;
$$;

create or replace function public.cancel_restaurant_order_sale(p_sale_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.restaurant_effective_user_id();
  v_sale public.sales%rowtype;
  v_order public.restaurant_orders%rowtype;
  v_consumption_count integer := 0;
begin
  perform public.restaurant_require_permission('cancellations.manage');
  if v_user_id is null then
    raise exception 'No existe una sesión activa.';
  end if;

  select * into v_sale
  from public.sales
  where id = p_sale_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Venta no encontrada.';
  end if;

  if v_sale.source_type <> 'restaurant_order' then
    raise exception 'La venta no pertenece a una cuenta de restaurante.';
  end if;

  if v_sale.status = 'Anulada' then
    return jsonb_build_object(
      'already_cancelled', true,
      'sale_code', v_sale.code,
      'inventory_preserved', true
    );
  end if;

  select * into v_order
  from public.restaurant_orders
  where id = v_sale.source_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'No se encontró la cuenta de origen.';
  end if;

  select count(*)::integer into v_consumption_count
  from public.restaurant_inventory_consumptions
  where order_id = v_order.id
    and user_id = v_user_id
    and applied_quantity > 0
    and reversed_at is null;

  -- Una anulación comercial no equivale a una devolución física de insumos.
  -- Si el plato ya fue preparado/servido, sus ingredientes permanecen consumidos.
  -- Cualquier devolución física debe registrarse de forma explícita mediante un
  -- ajuste de inventario, nunca automáticamente por anular la venta.
  update public.sales
  set status = 'Anulada'
  where id = v_sale.id and user_id = v_user_id;

  update public.restaurant_orders
  set status = 'cancelada',
      inventory_consumption_notes = case
        when v_consumption_count > 0 then
          'Venta anulada. El consumo gastronómico se conserva porque la anulación comercial no implica devolución física de ingredientes o preparaciones.'
        else
          coalesce(inventory_consumption_notes, 'Venta anulada sin consumos gastronómicos aplicados.')
      end
  where id = v_order.id and user_id = v_user_id;

  return jsonb_build_object(
    'sale_id', v_sale.id,
    'sale_code', v_sale.code,
    'order_id', v_order.id,
    'inventory_preserved', true,
    'consumption_records', v_consumption_count,
    'restored_products', 0
  );
end;
$$;


-- Auditoría compatible con sesiones separadas de empleado.
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
  v_user_id uuid := public.restaurant_effective_user_id();
  v_staff public.restaurant_staff_profiles%rowtype;
  v_id uuid;
  v_operator_name text := 'Administrador';
  v_operator_role text := 'administrador';
  v_bound_staff_id uuid;
begin
  if v_user_id is null then
    raise exception 'No existe una sesión activa.';
  end if;

  if nullif(trim(p_action), '') is null then
    raise exception 'La acción de auditoría es obligatoria.';
  end if;

  if public.restaurant_is_employee_session() then
    select sau.staff_profile_id into v_bound_staff_id
    from public.restaurant_staff_auth_users sau
    where sau.auth_user_id = auth.uid()
      and sau.owner_user_id = v_user_id
      and sau.is_active = true
    limit 1;

    if v_bound_staff_id is null then
      raise exception 'La sesión del empleado no está vinculada a un perfil.';
    end if;

    select * into v_staff
    from public.restaurant_staff_profiles
    where id = v_bound_staff_id
      and user_id = v_user_id
      and is_active = true;
  elsif p_staff_profile_id is not null then
    select * into v_staff
    from public.restaurant_staff_profiles
    where id = p_staff_profile_id
      and user_id = v_user_id;
  end if;

  if found and v_staff.id is not null then
    v_operator_name := v_staff.name;
    v_operator_role := v_staff.role;
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
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.restaurant_log_audit(uuid,text,text,text,jsonb) from public;
grant execute on function public.restaurant_log_audit(uuid,text,text,text,jsonb) to authenticated;

comment on table public.restaurant_employee_access is
  'Credencial compartida del negocio para abrir el portal de empleados; nunca reemplaza la contraseña del propietario.';
comment on table public.restaurant_staff_auth_users is
  'Vincula cada perfil operativo con una identidad Auth separada usada por el portal de empleados.';
