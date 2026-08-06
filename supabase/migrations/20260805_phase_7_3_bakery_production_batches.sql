-- INVENTIQ · Fase 7.3 · Producción por lotes para panadería
-- Ejecutar una sola vez en Supabase > SQL Editor después de las fases 7.1 y 7.2.
-- Migración no destructiva: no elimina productos, ventas, recetas ni inventario existente.

create table if not exists public.production_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.production_recipes(id) on delete restrict,
  output_product_id uuid not null references public.products(id) on delete restrict,
  batch_code text not null,
  production_date date not null default current_date,
  produced_quantity numeric(14,4) not null check (produced_quantity > 0),
  produced_unit text not null,
  output_stock_quantity numeric(14,4) not null check (output_stock_quantity > 0),
  output_stock_unit text not null,
  recipe_multiplier numeric(14,6) not null check (recipe_multiplier > 0),
  ingredient_cost numeric(14,4) not null default 0 check (ingredient_cost >= 0),
  additional_cost numeric(14,4) not null default 0 check (additional_cost >= 0),
  total_cost numeric(14,4) not null default 0 check (total_cost >= 0),
  unit_cost numeric(14,6) not null default 0 check (unit_cost >= 0),
  output_product_name text not null,
  recipe_name text not null,
  status text not null default 'completed' check (status in ('completed', 'cancelled')),
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (user_id, batch_code)
);

create table if not exists public.production_batch_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null references public.production_batches(id) on delete cascade,
  ingredient_product_id uuid not null references public.products(id) on delete restrict,
  ingredient_name text not null,
  recipe_quantity numeric(14,4) not null check (recipe_quantity > 0),
  waste_percent numeric(6,3) not null default 0 check (waste_percent >= 0 and waste_percent <= 100),
  required_quantity numeric(14,4) not null check (required_quantity > 0),
  recipe_unit text not null,
  stock_quantity numeric(14,4) not null check (stock_quantity > 0),
  stock_unit text not null,
  unit_cost numeric(14,6) not null default 0 check (unit_cost >= 0),
  total_cost numeric(14,4) not null default 0 check (total_cost >= 0),
  stock_before numeric(14,4) not null,
  stock_after numeric(14,4) not null,
  created_at timestamptz not null default now()
);

create index if not exists production_batches_user_date_idx
  on public.production_batches (user_id, production_date desc, created_at desc);

create index if not exists production_batches_recipe_idx
  on public.production_batches (recipe_id);

create index if not exists production_batches_output_product_idx
  on public.production_batches (output_product_id);

create index if not exists production_batch_items_batch_idx
  on public.production_batch_items (batch_id);

create index if not exists production_batch_items_ingredient_idx
  on public.production_batch_items (ingredient_product_id);

comment on table public.production_batches is
'Lotes de producción terminados. Cada registro consolida producto elaborado, rendimiento, costos y entrada de inventario.';

comment on table public.production_batch_items is
'Detalle histórico de materias primas e insumos consumidos por cada lote de producción.';

alter table public.production_batches enable row level security;
alter table public.production_batch_items enable row level security;

drop policy if exists "production_batches_owner_select" on public.production_batches;
create policy "production_batches_owner_select"
on public.production_batches
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "production_batches_owner_insert" on public.production_batches;
create policy "production_batches_owner_insert"
on public.production_batches
for insert to authenticated
with check (
  auth.uid() = user_id
  and created_by = auth.uid()
  and exists (
    select 1 from public.production_recipes recipe
    where recipe.id = production_batches.recipe_id and recipe.user_id = auth.uid()
  )
  and exists (
    select 1 from public.products product
    where product.id = production_batches.output_product_id and product.user_id = auth.uid()
  )
);

drop policy if exists "production_batches_owner_update" on public.production_batches;
create policy "production_batches_owner_update"
on public.production_batches
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "production_batch_items_owner_select" on public.production_batch_items;
create policy "production_batch_items_owner_select"
on public.production_batch_items
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "production_batch_items_owner_insert" on public.production_batch_items;
create policy "production_batch_items_owner_insert"
on public.production_batch_items
for insert to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.production_batches batch
    where batch.id = production_batch_items.batch_id and batch.user_id = auth.uid()
  )
  and exists (
    select 1 from public.products product
    where product.id = production_batch_items.ingredient_product_id and product.user_id = auth.uid()
  )
);

-- Normalización de unidades equivalente a la utilizada por la interfaz.
create or replace function public.inventiq_normalize_unit(p_unit text)
returns text
language plpgsql
immutable
security invoker
set search_path = public
as $$
declare
  v_text text := lower(trim(coalesce(p_unit, '')));
  v_compact text;
begin
  if v_text = '' then return ''; end if;
  v_compact := replace(regexp_replace(v_text, '\s+', '', 'g'), ',', '.');

  if v_text like '%miligramo%' or v_compact = 'mg' or v_compact ~ '^[0-9]+(\.[0-9]+)?mg$' then return 'mg'; end if;
  if v_text like '%mililitro%' or v_compact = 'ml' or v_compact ~ '^[0-9]+(\.[0-9]+)?ml$' then return 'ml'; end if;
  if v_text like '%kilogramo%' or v_compact = 'kg' or v_compact ~ '^[0-9]+(\.[0-9]+)?kg$' then return 'kg'; end if;
  if v_text like '%libra%' or v_compact in ('lb', 'lbs') then return 'lb'; end if;
  if v_text like '%onza%' or v_compact = 'oz' then return 'oz'; end if;
  if v_text like '%gramo%' or v_compact in ('g', 'gr') or v_compact ~ '^[0-9]+(\.[0-9]+)?g(r)?$' then return 'g'; end if;
  if v_text like '%litro%' or v_compact = 'l' or v_compact ~ '^[0-9]+(\.[0-9]+)?l$' then return 'l'; end if;
  if v_text like '%docena%' or v_compact = 'doc' then return 'docena'; end if;
  if v_text like '%unidad%' or v_text like '%unid%' or v_compact in ('u', 'und') or v_text like '%pieza%' or v_compact like '%pz%' then return 'unidad'; end if;
  if v_text like '%paquete%' then return 'paquete'; end if;
  if v_text like '%funda%' then return 'funda'; end if;
  if v_text like '%caja%' then return 'caja'; end if;

  return v_text;
end;
$$;

create or replace function public.inventiq_unit_family(p_unit text)
returns text
language sql
immutable
security invoker
set search_path = public
as $$
  select case
    when public.inventiq_normalize_unit(p_unit) in ('ml', 'l') then 'volume'
    when public.inventiq_normalize_unit(p_unit) in ('mg', 'g', 'kg', 'lb', 'oz') then 'mass'
    when public.inventiq_normalize_unit(p_unit) in ('unidad', 'docena') then 'unit'
    else 'custom'
  end;
$$;

create or replace function public.inventiq_unit_factor(p_unit text)
returns numeric
language sql
immutable
security invoker
set search_path = public
as $$
  select case public.inventiq_normalize_unit(p_unit)
    when 'ml' then 1
    when 'l' then 1000
    when 'mg' then 1
    when 'g' then 1000
    when 'kg' then 1000000
    when 'lb' then 453592.37
    when 'oz' then 28349.523125
    when 'unidad' then 1
    when 'docena' then 12
    else 1
  end;
$$;

create or replace function public.inventiq_convert_quantity(
  p_quantity numeric,
  p_from_unit text,
  p_to_unit text
)
returns numeric
language plpgsql
immutable
security invoker
set search_path = public
as $$
declare
  v_from text := public.inventiq_normalize_unit(p_from_unit);
  v_to text := public.inventiq_normalize_unit(p_to_unit);
  v_from_family text;
  v_to_family text;
begin
  if p_quantity is null then return null; end if;
  if v_from = '' or v_to = '' then return p_quantity; end if;
  if v_from = v_to then return p_quantity; end if;

  v_from_family := public.inventiq_unit_family(v_from);
  v_to_family := public.inventiq_unit_family(v_to);

  if v_from_family = 'custom' or v_to_family = 'custom' or v_from_family <> v_to_family then
    return null;
  end if;

  return (p_quantity * public.inventiq_unit_factor(v_from)) / public.inventiq_unit_factor(v_to);
end;
$$;

create or replace function public.register_production_batch(
  p_recipe_id uuid,
  p_produced_quantity numeric,
  p_production_date date,
  p_notes text,
  p_batch_code text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_recipe public.production_recipes%rowtype;
  v_output public.products%rowtype;
  v_item record;
  v_ingredient public.products%rowtype;
  v_batch_id uuid := gen_random_uuid();
  v_batch_code text;
  v_multiplier numeric;
  v_output_stock_unit text;
  v_output_stock_quantity numeric;
  v_scaled_recipe_quantity numeric;
  v_required_recipe_quantity numeric;
  v_stock_unit text;
  v_stock_quantity numeric;
  v_stock_before numeric;
  v_stock_after numeric;
  v_line_cost numeric;
  v_ingredient_cost numeric := 0;
  v_additional_cost numeric := 0;
  v_total_cost numeric := 0;
  v_unit_cost numeric := 0;
  v_existing_output_stock numeric;
  v_existing_output_cost numeric;
  v_new_output_stock numeric;
  v_new_output_cost numeric;
  v_attempt integer := 0;
begin
  if v_user_id is null then
    raise exception 'No existe una sesión autenticada.';
  end if;

  if p_recipe_id is null then
    raise exception 'Selecciona una receta de producción.';
  end if;

  if coalesce(p_produced_quantity, 0) <= 0 then
    raise exception 'La cantidad elaborada debe ser mayor a cero.';
  end if;

  select * into v_recipe
  from public.production_recipes
  where id = p_recipe_id
    and user_id = v_user_id
  for update;

  if v_recipe.id is null then
    raise exception 'La receta no existe o no pertenece al negocio actual.';
  end if;

  if not v_recipe.is_active then
    raise exception 'La receta está inactiva. Actívala antes de registrar producción.';
  end if;

  select * into v_output
  from public.products
  where id = v_recipe.output_product_id
    and user_id = v_user_id
  for update;

  if v_output.id is null then
    raise exception 'El producto terminado de la receta no existe.';
  end if;

  if not exists (
    select 1 from public.production_recipe_items item
    where item.recipe_id = v_recipe.id and item.user_id = v_user_id
  ) then
    raise exception 'La receta no tiene ingredientes registrados.';
  end if;

  v_multiplier := p_produced_quantity / v_recipe.yield_quantity;
  v_output_stock_unit := coalesce(nullif(trim(v_output.stock_unit), ''), nullif(trim(v_output.size), ''), v_recipe.yield_unit);
  v_output_stock_quantity := public.inventiq_convert_quantity(
    p_produced_quantity,
    v_recipe.yield_unit,
    v_output_stock_unit
  );

  if v_output_stock_quantity is null or v_output_stock_quantity <= 0 then
    raise exception 'La unidad de rendimiento (%) no es compatible con la unidad de stock del producto terminado (%).', v_recipe.yield_unit, v_output_stock_unit;
  end if;

  if nullif(trim(coalesce(p_batch_code, '')), '') is not null then
    v_batch_code := upper(trim(p_batch_code));
    if exists (
      select 1 from public.production_batches
      where user_id = v_user_id and batch_code = v_batch_code
    ) then
      raise exception 'Ya existe un lote con el código %.', v_batch_code;
    end if;
  else
    loop
      v_attempt := v_attempt + 1;
      v_batch_code := 'PROD-' || to_char(coalesce(p_production_date, current_date), 'YYYYMMDD') || '-' || lpad((floor(random() * 10000))::integer::text, 4, '0');
      exit when not exists (
        select 1 from public.production_batches
        where user_id = v_user_id and batch_code = v_batch_code
      );
      if v_attempt >= 20 then
        raise exception 'No se pudo generar el código del lote. Intenta nuevamente.';
      end if;
    end loop;
  end if;

  insert into public.production_batches (
    id,
    user_id,
    recipe_id,
    output_product_id,
    batch_code,
    production_date,
    produced_quantity,
    produced_unit,
    output_stock_quantity,
    output_stock_unit,
    recipe_multiplier,
    ingredient_cost,
    additional_cost,
    total_cost,
    unit_cost,
    output_product_name,
    recipe_name,
    status,
    notes,
    created_by
  ) values (
    v_batch_id,
    v_user_id,
    v_recipe.id,
    v_output.id,
    v_batch_code,
    coalesce(p_production_date, current_date),
    p_produced_quantity,
    v_recipe.yield_unit,
    v_output_stock_quantity,
    v_output_stock_unit,
    v_multiplier,
    0,
    0,
    0,
    0,
    v_output.name,
    v_recipe.name,
    'completed',
    nullif(trim(coalesce(p_notes, '')), ''),
    v_user_id
  );

  for v_item in
    select *
    from public.production_recipe_items
    where recipe_id = v_recipe.id
      and user_id = v_user_id
    order by created_at, id
  loop
    select * into v_ingredient
    from public.products
    where id = v_item.ingredient_product_id
      and user_id = v_user_id
    for update;

    if v_ingredient.id is null then
      raise exception 'Uno de los ingredientes de la receta ya no existe.';
    end if;

    v_scaled_recipe_quantity := v_item.quantity * v_multiplier;
    v_required_recipe_quantity := v_scaled_recipe_quantity * (1 + (v_item.waste_percent / 100));
    v_stock_unit := coalesce(nullif(trim(v_ingredient.stock_unit), ''), nullif(trim(v_ingredient.size), ''), v_item.unit);
    v_stock_quantity := public.inventiq_convert_quantity(
      v_required_recipe_quantity,
      v_item.unit,
      v_stock_unit
    );

    if v_stock_quantity is null or v_stock_quantity <= 0 then
      raise exception 'La unidad de la receta (%) no es compatible con la unidad de stock (%) de %.', v_item.unit, v_stock_unit, v_ingredient.name;
    end if;

    v_stock_before := coalesce(v_ingredient.stock, 0);
    if v_stock_before + 0.0000001 < v_stock_quantity then
      raise exception 'Stock insuficiente de %. Disponible: % %. Requerido: % %.',
        v_ingredient.name,
        round(v_stock_before, 4),
        v_stock_unit,
        round(v_stock_quantity, 4),
        v_stock_unit;
    end if;

    v_stock_after := greatest(0, v_stock_before - v_stock_quantity);
    v_line_cost := v_stock_quantity * coalesce(v_ingredient.cost, 0);
    v_ingredient_cost := v_ingredient_cost + v_line_cost;

    update public.products
    set
      stock = v_stock_after,
      status = case when v_stock_after <= 0 then 'Inactivo' else 'Activo' end
    where id = v_ingredient.id and user_id = v_user_id;

    insert into public.production_batch_items (
      user_id,
      batch_id,
      ingredient_product_id,
      ingredient_name,
      recipe_quantity,
      waste_percent,
      required_quantity,
      recipe_unit,
      stock_quantity,
      stock_unit,
      unit_cost,
      total_cost,
      stock_before,
      stock_after
    ) values (
      v_user_id,
      v_batch_id,
      v_ingredient.id,
      v_ingredient.name,
      v_scaled_recipe_quantity,
      v_item.waste_percent,
      v_required_recipe_quantity,
      v_item.unit,
      v_stock_quantity,
      v_stock_unit,
      coalesce(v_ingredient.cost, 0),
      v_line_cost,
      v_stock_before,
      v_stock_after
    );

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
      v_ingredient.id,
      v_ingredient.name,
      'production_input',
      -v_stock_quantity,
      v_stock_before,
      v_stock_after,
      v_stock_unit,
      'production_batch',
      v_batch_id,
      'Consumo para lote ' || v_batch_code,
      v_user_id
    );
  end loop;

  v_additional_cost := coalesce(v_recipe.additional_cost, 0) * v_multiplier;
  v_total_cost := v_ingredient_cost + v_additional_cost;
  v_unit_cost := case when v_output_stock_quantity > 0 then v_total_cost / v_output_stock_quantity else 0 end;

  v_existing_output_stock := coalesce(v_output.stock, 0);
  v_existing_output_cost := coalesce(v_output.cost, 0);
  v_new_output_stock := v_existing_output_stock + v_output_stock_quantity;
  v_new_output_cost := case
    when v_new_output_stock > 0 then
      ((v_existing_output_stock * v_existing_output_cost) + (v_output_stock_quantity * v_unit_cost)) / v_new_output_stock
    else v_unit_cost
  end;

  update public.products
  set
    stock = v_new_output_stock,
    cost = v_new_output_cost,
    status = 'Activo',
    production_enabled = true,
    product_type = case when product_type = 'sale_product' then 'finished_product' else product_type end,
    stock_unit = coalesce(nullif(stock_unit, ''), v_output_stock_unit)
  where id = v_output.id and user_id = v_user_id;

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
    v_output.id,
    v_output.name,
    'production_output',
    v_output_stock_quantity,
    v_existing_output_stock,
    v_new_output_stock,
    v_output_stock_unit,
    'production_batch',
    v_batch_id,
    'Ingreso de producto terminado del lote ' || v_batch_code,
    v_user_id
  );

  update public.production_batches
  set
    ingredient_cost = v_ingredient_cost,
    additional_cost = v_additional_cost,
    total_cost = v_total_cost,
    unit_cost = v_unit_cost
  where id = v_batch_id and user_id = v_user_id;

  return jsonb_build_object(
    'batch_id', v_batch_id,
    'batch_code', v_batch_code,
    'output_product_id', v_output.id,
    'output_product_name', v_output.name,
    'produced_quantity', p_produced_quantity,
    'produced_unit', v_recipe.yield_unit,
    'output_stock_quantity', v_output_stock_quantity,
    'output_stock_unit', v_output_stock_unit,
    'ingredient_cost', round(v_ingredient_cost, 4),
    'additional_cost', round(v_additional_cost, 4),
    'total_cost', round(v_total_cost, 4),
    'unit_cost', round(v_unit_cost, 6),
    'new_stock', v_new_output_stock
  );
end;
$$;

revoke all on function public.inventiq_normalize_unit(text) from public;
revoke all on function public.inventiq_unit_family(text) from public;
revoke all on function public.inventiq_unit_factor(text) from public;
revoke all on function public.inventiq_convert_quantity(numeric, text, text) from public;
revoke all on function public.register_production_batch(uuid, numeric, date, text, text) from public;

grant execute on function public.inventiq_normalize_unit(text) to authenticated;
grant execute on function public.inventiq_unit_family(text) to authenticated;
grant execute on function public.inventiq_unit_factor(text) to authenticated;
grant execute on function public.inventiq_convert_quantity(numeric, text, text) to authenticated;
grant execute on function public.register_production_batch(uuid, numeric, date, text, text) to authenticated;

grant select, insert, update on public.production_batches to authenticated;
grant select, insert on public.production_batch_items to authenticated;
