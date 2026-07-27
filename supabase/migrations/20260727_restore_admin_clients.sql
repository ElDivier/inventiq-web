-- INVENTIQ · Restaurar administración de clientes
-- Ejecutar una sola vez en Supabase > SQL Editor.
-- No crea clientes ficticios ni modifica la información existente de KUEHNS u otros negocios.

-- Campos administrativos utilizados por el panel.
alter table public.profiles
  add column if not exists commercial_email text,
  add column if not exists plan text not null default 'anual',
  add column if not exists subscription_status text not null default 'activo',
  add column if not exists subscription_start date,
  add column if not exists subscription_end date,
  add column if not exists monthly_price numeric(12,2) not null default 30.00,
  add column if not exists annual_price numeric(12,2) not null default 300.00,
  add column if not exists max_products integer not null default 2000,
  add column if not exists is_suspended boolean not null default false,
  add column if not exists admin_notes text;

alter table public.profiles enable row level security;

-- Políticas adicionales exclusivas para el administrador.
-- Las políticas propias de cada cliente se conservan sin cambios.
drop policy if exists "inventiq_admin_select_all_profiles" on public.profiles;
create policy "inventiq_admin_select_all_profiles"
on public.profiles
for select
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'inventiqweb@gmail.com'
);

drop policy if exists "inventiq_admin_update_all_profiles" on public.profiles;
create policy "inventiq_admin_update_all_profiles"
on public.profiles
for update
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'inventiqweb@gmail.com'
)
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'inventiqweb@gmail.com'
);

drop policy if exists "inventiq_admin_insert_profiles" on public.profiles;
create policy "inventiq_admin_insert_profiles"
on public.profiles
for insert
to authenticated
with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'inventiqweb@gmail.com'
);

grant select, insert, update on public.profiles to authenticated;

-- Lectura administrativa para calcular la cantidad de productos de cada negocio.
alter table public.products enable row level security;

drop policy if exists "inventiq_admin_select_all_products" on public.products;
create policy "inventiq_admin_select_all_products"
on public.products
for select
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'inventiqweb@gmail.com'
);

grant select on public.products to authenticated;

-- Índices de apoyo para el listado y conteo por cliente.
create index if not exists profiles_store_name_idx on public.profiles (store_name);
create index if not exists products_user_id_idx on public.products (user_id);
