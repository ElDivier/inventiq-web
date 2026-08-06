-- INVENTIQ · Fase 7.1 · Base técnica para panadería
-- Ejecutar una sola vez en Supabase > SQL Editor.
-- Migración no destructiva: no elimina ni reescribe productos, ventas, clientes o inventario existentes.

create extension if not exists pgcrypto;

-- 1. Metadatos de producto para producción y clasificación operativa.
alter table public.products
  add column if not exists product_type text not null default 'sale_product',
  add column if not exists stock_unit text,
  add column if not exists production_enabled boolean not null default false,
  add column if not exists tracks_lots boolean not null default false,
  add column if not exists tracks_expiration boolean not null default false,
  add column if not exists product_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_product_type_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_product_type_check
      check (
        product_type in (
          'sale_product',
          'raw_material',
          'packaging',
          'intermediate',
          'finished_product',
          'service'
        )
      );
  end if;
end
$$;

create index if not exists products_user_product_type_idx
  on public.products (user_id, product_type);

create index if not exists products_user_production_enabled_idx
  on public.products (user_id, production_enabled)
  where production_enabled = true;

comment on column public.products.product_type is
'Clasificación operativa: sale_product, raw_material, packaging, intermediate, finished_product o service.';

comment on column public.products.stock_unit is
'Unidad base en la que se controla el stock: unidad, kg, g, litro, ml, caja, paquete, entre otras.';

-- 2. Recetas de producción con rendimiento por lote.
create table if not exists public.production_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  output_product_id uuid not null references public.products(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 160),
  yield_quantity numeric(14,3) not null default 1 check (yield_quantity > 0),
  yield_unit text not null default 'unidad',
  version integer not null default 1 check (version > 0),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, output_product_id, version)
);

create table if not exists public.production_recipe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.production_recipes(id) on delete cascade,
  ingredient_product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(14,4) not null check (quantity > 0),
  unit text not null,
  waste_percent numeric(6,3) not null default 0
    check (waste_percent >= 0 and waste_percent <= 100),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipe_id, ingredient_product_id)
);

create index if not exists production_recipes_user_idx
  on public.production_recipes (user_id, is_active);

create index if not exists production_recipes_output_product_idx
  on public.production_recipes (output_product_id);

create index if not exists production_recipe_items_recipe_idx
  on public.production_recipe_items (recipe_id);

create index if not exists production_recipe_items_ingredient_idx
  on public.production_recipe_items (ingredient_product_id);

-- 3. Historial base de movimientos de inventario.
-- Se crea desde esta fase para que producción, mermas y ajustes compartan el mismo registro en fases posteriores.
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  movement_type text not null check (
    movement_type in (
      'initial',
      'purchase',
      'sale',
      'sale_return',
      'adjustment_in',
      'adjustment_out',
      'production_input',
      'production_output',
      'waste'
    )
  ),
  quantity numeric(14,4) not null check (quantity <> 0),
  stock_before numeric(14,4),
  stock_after numeric(14,4),
  unit text,
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_user_created_idx
  on public.inventory_movements (user_id, created_at desc);

create index if not exists inventory_movements_product_created_idx
  on public.inventory_movements (product_id, created_at desc);

create index if not exists inventory_movements_reference_idx
  on public.inventory_movements (reference_type, reference_id);

-- 4. Fecha de actualización automática para tablas editables.
create or replace function public.set_inventiq_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists production_recipes_set_updated_at on public.production_recipes;
create trigger production_recipes_set_updated_at
before update on public.production_recipes
for each row execute function public.set_inventiq_updated_at();

drop trigger if exists production_recipe_items_set_updated_at on public.production_recipe_items;
create trigger production_recipe_items_set_updated_at
before update on public.production_recipe_items
for each row execute function public.set_inventiq_updated_at();

-- 5. Seguridad por negocio/usuario.
alter table public.production_recipes enable row level security;
alter table public.production_recipe_items enable row level security;
alter table public.inventory_movements enable row level security;

drop policy if exists "production_recipes_owner_select" on public.production_recipes;
create policy "production_recipes_owner_select"
on public.production_recipes
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "production_recipes_owner_insert" on public.production_recipes;
create policy "production_recipes_owner_insert"
on public.production_recipes
for insert to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.products product
    where product.id = output_product_id
      and product.user_id = auth.uid()
  )
);

drop policy if exists "production_recipes_owner_update" on public.production_recipes;
create policy "production_recipes_owner_update"
on public.production_recipes
for update to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.products product
    where product.id = output_product_id
      and product.user_id = auth.uid()
  )
);

drop policy if exists "production_recipes_owner_delete" on public.production_recipes;
create policy "production_recipes_owner_delete"
on public.production_recipes
for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists "production_recipe_items_owner_select" on public.production_recipe_items;
create policy "production_recipe_items_owner_select"
on public.production_recipe_items
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "production_recipe_items_owner_insert" on public.production_recipe_items;
create policy "production_recipe_items_owner_insert"
on public.production_recipe_items
for insert to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.production_recipes recipe
    where recipe.id = recipe_id
      and recipe.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.products ingredient
    where ingredient.id = ingredient_product_id
      and ingredient.user_id = auth.uid()
  )
);

drop policy if exists "production_recipe_items_owner_update" on public.production_recipe_items;
create policy "production_recipe_items_owner_update"
on public.production_recipe_items
for update to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.production_recipes recipe
    where recipe.id = recipe_id
      and recipe.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.products ingredient
    where ingredient.id = ingredient_product_id
      and ingredient.user_id = auth.uid()
  )
);

drop policy if exists "production_recipe_items_owner_delete" on public.production_recipe_items;
create policy "production_recipe_items_owner_delete"
on public.production_recipe_items
for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists "inventory_movements_owner_select" on public.inventory_movements;
create policy "inventory_movements_owner_select"
on public.inventory_movements
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "inventory_movements_owner_insert" on public.inventory_movements;
create policy "inventory_movements_owner_insert"
on public.inventory_movements
for insert to authenticated
with check (
  auth.uid() = user_id
  and created_by = auth.uid()
  and (
    product_id is null
    or exists (
      select 1
      from public.products product
      where product.id = product_id
        and product.user_id = auth.uid()
    )
  )
);

-- El historial de movimientos es de solo lectura después de su creación.
grant select, insert, update, delete on public.production_recipes to authenticated;
grant select, insert, update, delete on public.production_recipe_items to authenticated;
grant select, insert on public.inventory_movements to authenticated;

comment on table public.production_recipes is
'Cabecera de recetas o fórmulas de producción con rendimiento por lote.';

comment on table public.production_recipe_items is
'Materias primas, productos intermedios y empaques requeridos por cada receta de producción.';

comment on table public.inventory_movements is
'Historial inmutable de entradas y salidas de inventario para compras, ventas, producción, ajustes y mermas.';
