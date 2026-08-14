-- INVENTIQ · Fase 8.7 · Inventario gastronómico, preparaciones y mermas
-- Ejecutar después de las fases 8.1 a 8.6.
-- Migración no destructiva: no elimina ventas, comandas, recetas, productos ni datos de otros negocios.

create extension if not exists pgcrypto;

-- 1. Diferenciar los lotes de panadería y las preparaciones internas del restaurante.
alter table public.production_batches
  add column if not exists production_context text not null default 'bakery';

update public.production_batches batch
set production_context = coalesce(recipe.recipe_context, 'bakery')
from public.production_recipes recipe
where recipe.id = batch.recipe_id
  and batch.production_context = 'bakery'
  and coalesce(recipe.recipe_context, 'bakery') <> 'bakery';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'production_batches_context_check'
      and conrelid = 'public.production_batches'::regclass
  ) then
    alter table public.production_batches
      add constraint production_batches_context_check
      check (production_context in ('bakery', 'restaurant'));
  end if;
end
$$;

create index if not exists production_batches_user_context_date_idx
  on public.production_batches (user_id, production_context, production_date desc, created_at desc);

-- 2. Ampliar el historial compartido de inventario con movimientos gastronómicos.
do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.inventory_movements'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%movement_type%'
  loop
    execute format('alter table public.inventory_movements drop constraint %I', v_constraint.conname);
  end loop;

  alter table public.inventory_movements
    add constraint inventory_movements_movement_type_check
    check (
      movement_type in (
        'initial',
        'purchase',
        'sale',
        'sale_return',
        'adjustment_in',
        'adjustment_out',
        'production_input',
        'production_output',
        'waste',
        'restaurant_consumption',
        'restaurant_preparation_input',
        'restaurant_preparation_output',
        'restaurant_return'
      )
    );
end
$$;

-- 3. Estado resumido de consumo en la cuenta del restaurante.
alter table public.restaurant_orders
  add column if not exists inventory_consumption_status text not null default 'pending',
  add column if not exists inventory_consumed_at timestamptz,
  add column if not exists inventory_cost_total numeric(14,4) not null default 0,
  add column if not exists inventory_shortage_count integer not null default 0,
  add column if not exists inventory_issue_count integer not null default 0,
  add column if not exists inventory_consumption_notes text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'restaurant_orders_inventory_status_valid'
      and conrelid = 'public.restaurant_orders'::regclass
  ) then
    alter table public.restaurant_orders
      add constraint restaurant_orders_inventory_status_valid
      check (inventory_consumption_status in ('pending', 'complete', 'partial', 'error', 'legacy', 'reversed'));
  end if;
end
$$;

-- No se altera el inventario de cuentas cerradas antes de esta fase.
update public.restaurant_orders
set inventory_consumption_status = 'legacy',
    inventory_consumption_notes = 'Cuenta cerrada antes de activar el inventario gastronómico.'
where status = 'cerrada'
  and inventory_consumption_status = 'pending'
  and inventory_consumed_at is null;

-- 4. Consumo teórico/aplicado por ingrediente al cerrar una cuenta.
create table if not exists public.restaurant_inventory_consumptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.restaurant_orders(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete set null,
  order_item_id uuid not null references public.restaurant_order_items(id) on delete cascade,
  menu_product_id uuid references public.products(id) on delete set null,
  menu_product_name text not null,
  ingredient_product_id uuid references public.products(id) on delete set null,
  ingredient_name text not null,
  source_kind text not null check (source_kind in ('ingredient', 'preparation', 'packaging')),
  quantity_sold numeric(14,4) not null check (quantity_sold > 0),
  recipe_quantity numeric(14,4) not null check (recipe_quantity > 0),
  recipe_unit text not null,
  required_quantity numeric(14,4) not null check (required_quantity > 0),
  stock_quantity numeric(14,4) not null check (stock_quantity > 0),
  applied_quantity numeric(14,4) not null default 0 check (applied_quantity >= 0),
  shortage_quantity numeric(14,4) not null default 0 check (shortage_quantity >= 0),
  stock_unit text not null,
  unit_cost numeric(14,6) not null default 0 check (unit_cost >= 0),
  theoretical_cost numeric(14,4) not null default 0 check (theoretical_cost >= 0),
  applied_cost numeric(14,4) not null default 0 check (applied_cost >= 0),
  stock_before numeric(14,4) not null,
  stock_after numeric(14,4) not null check (stock_after >= 0),
  order_type text not null,
  consumed_at timestamptz not null default now(),
  reversed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  unique (user_id, order_item_id, ingredient_product_id)
);

create index if not exists restaurant_inventory_consumptions_user_date_idx
  on public.restaurant_inventory_consumptions (user_id, consumed_at desc);
create index if not exists restaurant_inventory_consumptions_order_idx
  on public.restaurant_inventory_consumptions (order_id);
create index if not exists restaurant_inventory_consumptions_ingredient_idx
  on public.restaurant_inventory_consumptions (ingredient_product_id, consumed_at desc);
create index if not exists restaurant_inventory_consumptions_shortage_idx
  on public.restaurant_inventory_consumptions (user_id, shortage_quantity, consumed_at desc)
  where shortage_quantity > 0;

create table if not exists public.restaurant_inventory_issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.restaurant_orders(id) on delete cascade,
  order_item_id uuid references public.restaurant_order_items(id) on delete cascade,
  menu_product_id uuid references public.products(id) on delete set null,
  menu_product_name text not null,
  issue_type text not null check (issue_type in ('missing_recipe', 'missing_component', 'incompatible_unit', 'invalid_yield', 'processing_error')),
  details text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_notes text
);

create index if not exists restaurant_inventory_issues_user_date_idx
  on public.restaurant_inventory_issues (user_id, created_at desc);
create index if not exists restaurant_inventory_issues_open_idx
  on public.restaurant_inventory_issues (user_id, resolved_at, created_at desc)
  where resolved_at is null;

-- 5. Mermas y conteos físicos específicos del restaurante.
create table if not exists public.restaurant_stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  production_batch_id uuid references public.production_batches(id) on delete set null,
  adjustment_kind text not null check (adjustment_kind in ('waste', 'physical_count')),
  reason_code text not null,
  reason_label text not null,
  product_name text not null,
  product_type text not null,
  quantity_reported numeric(14,4) not null check (quantity_reported >= 0),
  quantity_delta numeric(14,4) not null check (quantity_delta <> 0),
  stock_before numeric(14,4) not null,
  stock_after numeric(14,4) not null check (stock_after >= 0),
  unit text not null,
  unit_cost numeric(14,6) not null default 0 check (unit_cost >= 0),
  cost_impact numeric(14,4) not null default 0 check (cost_impact >= 0),
  event_date date not null default current_date,
  batch_code text,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists restaurant_stock_adjustments_user_date_idx
  on public.restaurant_stock_adjustments (user_id, event_date desc, created_at desc);
create index if not exists restaurant_stock_adjustments_product_idx
  on public.restaurant_stock_adjustments (product_id, created_at desc);
create index if not exists restaurant_stock_adjustments_kind_idx
  on public.restaurant_stock_adjustments (user_id, adjustment_kind, event_date desc);

-- 6. RLS.
alter table public.restaurant_inventory_consumptions enable row level security;
alter table public.restaurant_inventory_issues enable row level security;
alter table public.restaurant_stock_adjustments enable row level security;

drop policy if exists "restaurant_inventory_consumptions_owner_select" on public.restaurant_inventory_consumptions;
create policy "restaurant_inventory_consumptions_owner_select"
on public.restaurant_inventory_consumptions for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "restaurant_inventory_issues_owner_select" on public.restaurant_inventory_issues;
create policy "restaurant_inventory_issues_owner_select"
on public.restaurant_inventory_issues for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "restaurant_stock_adjustments_owner_select" on public.restaurant_stock_adjustments;
create policy "restaurant_stock_adjustments_owner_select"
on public.restaurant_stock_adjustments for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "restaurant_stock_adjustments_owner_insert" on public.restaurant_stock_adjustments;
create policy "restaurant_stock_adjustments_owner_insert"
on public.restaurant_stock_adjustments for insert to authenticated
with check (auth.uid() = user_id and created_by = auth.uid());

grant select on public.restaurant_inventory_consumptions to authenticated;
grant select on public.restaurant_inventory_issues to authenticated;
grant select, insert on public.restaurant_stock_adjustments to authenticated;

-- 7. Registrar producción de una preparación interna.
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

-- 8. Aplicar el consumo de recetas al cerrar una cuenta.
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

  if auth.uid() is not null and auth.uid() <> v_order.user_id then
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
    where order_id = v_order.id and user_id = v_order.user_id and status <> 'cancelado'
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

create or replace function public.restaurant_inventory_after_order_closed()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.status = 'cerrada' and old.status is distinct from new.status then
    begin
      perform public.restaurant_apply_order_inventory(new.id);
    exception when others then
      update public.restaurant_orders
      set inventory_consumption_status = 'error',
          inventory_issue_count = greatest(inventory_issue_count, 1),
          inventory_consumption_notes = left(sqlerrm, 500)
      where id = new.id;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists restaurant_orders_apply_inventory_on_close on public.restaurant_orders;
create trigger restaurant_orders_apply_inventory_on_close
after update of status on public.restaurant_orders
for each row execute function public.restaurant_inventory_after_order_closed();

-- 9. Registrar mermas y conteos del restaurante.
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
  v_user_id uuid := auth.uid();
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

-- 10. Anular una venta originada en una cuenta y restaurar el consumo aplicado.
create or replace function public.cancel_restaurant_order_sale(p_sale_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_sale public.sales%rowtype;
  v_order public.restaurant_orders%rowtype;
  v_row record;
  v_product public.products%rowtype;
  v_stock_before numeric;
  v_stock_after numeric;
  v_restored integer := 0;
begin
  if v_user_id is null then raise exception 'No existe una sesión activa.'; end if;

  select * into v_sale
  from public.sales
  where id = p_sale_id and user_id = v_user_id
  for update;
  if not found then raise exception 'Venta no encontrada.'; end if;
  if v_sale.source_type <> 'restaurant_order' then raise exception 'La venta no pertenece a una cuenta de restaurante.'; end if;
  if v_sale.status = 'Anulada' then return jsonb_build_object('already_cancelled', true, 'sale_code', v_sale.code); end if;

  select * into v_order
  from public.restaurant_orders
  where id = v_sale.source_id and user_id = v_user_id
  for update;
  if not found then raise exception 'No se encontró la cuenta de origen.'; end if;

  for v_row in
    select * from public.restaurant_inventory_consumptions
    where order_id = v_order.id and user_id = v_user_id
      and reversed_at is null and applied_quantity > 0
    order by consumed_at, id
  loop
    select * into v_product
    from public.products
    where id = v_row.ingredient_product_id and user_id = v_user_id
    for update;
    if found then
      v_stock_before := greatest(coalesce(v_product.stock, 0), 0);
      v_stock_after := v_stock_before + v_row.applied_quantity;
      update public.products set stock = v_stock_after, status = 'Activo'
      where id = v_product.id and user_id = v_user_id;

      insert into public.inventory_movements (
        user_id, product_id, product_name, movement_type, quantity, stock_before,
        stock_after, unit, reference_type, reference_id, notes, created_by
      ) values (
        v_user_id, v_product.id, v_product.name, 'restaurant_return',
        v_row.applied_quantity, v_stock_before, v_stock_after, v_row.stock_unit,
        'restaurant_order_cancel', v_order.id, 'Anulación de ' || v_sale.code, v_user_id
      );
      v_restored := v_restored + 1;
    end if;

    update public.restaurant_inventory_consumptions
    set reversed_at = now()
    where id = v_row.id and user_id = v_user_id;
  end loop;

  update public.sales set status = 'Anulada' where id = v_sale.id and user_id = v_user_id;
  update public.restaurant_orders
  set status = 'cancelada',
      inventory_consumption_status = 'reversed',
      inventory_consumption_notes = 'Consumo restaurado por anulación de la venta.'
  where id = v_order.id and user_id = v_user_id;

  return jsonb_build_object(
    'sale_id', v_sale.id,
    'sale_code', v_sale.code,
    'order_id', v_order.id,
    'restored_products', v_restored
  );
end;
$$;

revoke all on function public.register_restaurant_preparation_batch(uuid, numeric, date, text, text) from public;
revoke all on function public.restaurant_apply_order_inventory(uuid) from public;
revoke all on function public.register_restaurant_stock_adjustment(uuid, text, numeric, date, text, text, text, uuid) from public;
revoke all on function public.cancel_restaurant_order_sale(uuid) from public;

grant execute on function public.register_restaurant_preparation_batch(uuid, numeric, date, text, text) to authenticated;
grant execute on function public.restaurant_apply_order_inventory(uuid) to authenticated;
grant execute on function public.register_restaurant_stock_adjustment(uuid, text, numeric, date, text, text, text, uuid) to authenticated;
grant execute on function public.cancel_restaurant_order_sale(uuid) to authenticated;

comment on table public.restaurant_inventory_consumptions is
'Consumo teórico y aplicado de ingredientes, preparaciones y empaques al cerrar una cuenta del restaurante.';
comment on table public.restaurant_inventory_issues is
'Observaciones que impidieron aplicar correctamente una parte del consumo de inventario gastronómico.';
comment on table public.restaurant_stock_adjustments is
'Historial inmutable de mermas y conteos físicos del restaurante.';
