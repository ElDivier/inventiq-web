-- INVENTIQ · Fase 8.3 · Recetas gastronómicas y costo real por plato
-- Ejecutar después de las fases 8.1 y 8.2.
-- Migración no destructiva: no elimina productos, ventas, mesas ni recetas de panadería.

alter table public.production_recipes
  add column if not exists recipe_context text not null default 'bakery',
  add column if not exists labor_cost numeric(14,4) not null default 0,
  add column if not exists overhead_cost numeric(14,4) not null default 0,
  add column if not exists target_food_cost_percent numeric(6,2) not null default 30;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'production_recipes_context_check'
      and conrelid = 'public.production_recipes'::regclass
  ) then
    alter table public.production_recipes
      add constraint production_recipes_context_check
      check (recipe_context in ('bakery', 'restaurant'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'production_recipes_labor_cost_check'
      and conrelid = 'public.production_recipes'::regclass
  ) then
    alter table public.production_recipes
      add constraint production_recipes_labor_cost_check
      check (labor_cost >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'production_recipes_overhead_cost_check'
      and conrelid = 'public.production_recipes'::regclass
  ) then
    alter table public.production_recipes
      add constraint production_recipes_overhead_cost_check
      check (overhead_cost >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'production_recipes_target_food_cost_check'
      and conrelid = 'public.production_recipes'::regclass
  ) then
    alter table public.production_recipes
      add constraint production_recipes_target_food_cost_check
      check (target_food_cost_percent > 0 and target_food_cost_percent <= 100);
  end if;
end
$$;

create index if not exists production_recipes_user_context_idx
  on public.production_recipes (user_id, recipe_context, is_active);

comment on column public.production_recipes.recipe_context is
'Contexto funcional de la receta: bakery para panadería o restaurant para restaurante.';
comment on column public.production_recipes.labor_cost is
'Costo estimado de mano de obra por rendimiento/lote de la receta.';
comment on column public.production_recipes.overhead_cost is
'Costo estimado por gas, energía y otros costos indirectos del rendimiento/lote.';
comment on column public.production_recipes.target_food_cost_percent is
'Porcentaje objetivo del costo gastronómico sobre el precio de venta.';

create or replace function public.save_restaurant_recipe(
  p_recipe_id uuid,
  p_output_product_id uuid,
  p_name text,
  p_yield_quantity numeric,
  p_yield_unit text,
  p_notes text,
  p_is_active boolean,
  p_labor_cost numeric,
  p_overhead_cost numeric,
  p_target_food_cost_percent numeric,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_recipe_id uuid;
  v_item jsonb;
  v_ingredient_id uuid;
  v_quantity numeric;
  v_unit text;
  v_waste_percent numeric;
  v_output_category text;
  v_output_type text;
  v_input_category text;
  v_input_type text;
  v_has_cycle boolean := false;
begin
  if v_user_id is null then
    raise exception 'No existe una sesión autenticada.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_user_id and business_type = 'restaurante'
  ) then
    raise exception 'Esta función está disponible únicamente para cuentas tipo Restaurante.';
  end if;

  select lower(trim(coalesce(category, ''))), coalesce(product_type, 'sale_product')
  into v_output_category, v_output_type
  from public.products
  where id = p_output_product_id and user_id = v_user_id;

  if v_output_category is null then
    raise exception 'El plato o preparación no pertenece al negocio actual.';
  end if;

  if (
    v_output_category like 'insumos -%'
    or v_output_category like 'empaques -%'
    or v_output_category like 'empaque -%'
  ) then
    raise exception 'Un insumo o empaque no puede ser el resultado de una receta gastronómica.';
  end if;

  if not (
    v_output_type in ('sale_product', 'intermediate')
    or v_output_category like 'menú -%'
    or v_output_category like 'menu -%'
    or v_output_category like 'preparaciones -%'
    or v_output_category like 'preparación -%'
  ) then
    raise exception 'La receta debe producir un plato del menú o una preparación interna.';
  end if;

  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Ingresa un nombre válido para la receta.';
  end if;

  if coalesce(p_yield_quantity, 0) <= 0 then
    raise exception 'El rendimiento debe ser mayor a cero.';
  end if;

  if char_length(trim(coalesce(p_yield_unit, ''))) = 0 then
    raise exception 'Selecciona la unidad del rendimiento.';
  end if;

  if coalesce(p_labor_cost, 0) < 0 or coalesce(p_overhead_cost, 0) < 0 then
    raise exception 'Los costos operativos no pueden ser negativos.';
  end if;

  if coalesce(p_target_food_cost_percent, 0) <= 0 or p_target_food_cost_percent > 100 then
    raise exception 'El costo gastronómico objetivo debe estar entre 1 y 100 por ciento.';
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'La receta debe tener al menos un ingrediente o preparación.';
  end if;

  if p_recipe_id is null then
    if exists (
      select 1 from public.production_recipes
      where user_id = v_user_id and output_product_id = p_output_product_id
    ) then
      raise exception 'Este plato o preparación ya tiene una receta registrada.';
    end if;

    insert into public.production_recipes (
      user_id,
      output_product_id,
      name,
      yield_quantity,
      yield_unit,
      version,
      is_active,
      notes,
      additional_cost,
      labor_cost,
      overhead_cost,
      target_food_cost_percent,
      recipe_context
    ) values (
      v_user_id,
      p_output_product_id,
      trim(p_name),
      p_yield_quantity,
      trim(p_yield_unit),
      1,
      coalesce(p_is_active, true),
      nullif(trim(coalesce(p_notes, '')), ''),
      0,
      coalesce(p_labor_cost, 0),
      coalesce(p_overhead_cost, 0),
      coalesce(p_target_food_cost_percent, 30),
      'restaurant'
    ) returning id into v_recipe_id;
  else
    update public.production_recipes
    set
      name = trim(p_name),
      yield_quantity = p_yield_quantity,
      yield_unit = trim(p_yield_unit),
      is_active = coalesce(p_is_active, true),
      notes = nullif(trim(coalesce(p_notes, '')), ''),
      labor_cost = coalesce(p_labor_cost, 0),
      overhead_cost = coalesce(p_overhead_cost, 0),
      target_food_cost_percent = coalesce(p_target_food_cost_percent, 30),
      recipe_context = 'restaurant'
    where id = p_recipe_id
      and user_id = v_user_id
      and output_product_id = p_output_product_id
      and recipe_context = 'restaurant'
    returning id into v_recipe_id;

    if v_recipe_id is null then
      raise exception 'No se encontró la receta o no tienes permisos para editarla.';
    end if;

    delete from public.production_recipe_items
    where recipe_id = v_recipe_id and user_id = v_user_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_ingredient_id := nullif(v_item->>'ingredient_product_id', '')::uuid;
    v_quantity := nullif(v_item->>'quantity', '')::numeric;
    v_unit := trim(coalesce(v_item->>'unit', ''));
    v_waste_percent := coalesce(nullif(v_item->>'waste_percent', '')::numeric, 0);

    if v_ingredient_id is null then
      raise exception 'Uno de los componentes no es válido.';
    end if;

    if v_ingredient_id = p_output_product_id then
      raise exception 'El resultado de la receta no puede utilizarse como ingrediente de sí mismo.';
    end if;

    select lower(trim(coalesce(category, ''))), coalesce(product_type, 'sale_product')
    into v_input_category, v_input_type
    from public.products
    where id = v_ingredient_id and user_id = v_user_id;

    if v_input_category is null then
      raise exception 'Uno de los componentes no pertenece al negocio actual.';
    end if;

    if (
      v_input_type = 'sale_product'
      or v_input_category like 'menú -%'
      or v_input_category like 'menu -%'
    ) and not (
      v_input_type = 'intermediate'
      or v_input_category like 'preparaciones -%'
      or v_input_category like 'preparación -%'
    ) then
      raise exception 'Un plato del menú no puede utilizarse como ingrediente. Usa insumos, empaques o preparaciones internas.';
    end if;

    if not (
      v_input_type in ('raw_material', 'packaging', 'intermediate')
      or v_input_category like 'insumos -%'
      or v_input_category like 'empaques -%'
      or v_input_category like 'empaque -%'
      or v_input_category like 'preparaciones -%'
      or v_input_category like 'preparación -%'
    ) then
      raise exception 'Uno de los componentes no está clasificado como insumo, empaque o preparación interna.';
    end if;

    if coalesce(v_quantity, 0) <= 0 then
      raise exception 'Todas las cantidades deben ser mayores a cero.';
    end if;

    if char_length(v_unit) = 0 then
      raise exception 'Todos los componentes deben tener una unidad.';
    end if;

    if v_waste_percent < 0 or v_waste_percent > 100 then
      raise exception 'La merma prevista debe estar entre 0 y 100 por ciento.';
    end if;

    insert into public.production_recipe_items (
      user_id,
      recipe_id,
      ingredient_product_id,
      quantity,
      unit,
      waste_percent,
      notes
    ) values (
      v_user_id,
      v_recipe_id,
      v_ingredient_id,
      v_quantity,
      v_unit,
      v_waste_percent,
      nullif(trim(coalesce(v_item->>'notes', '')), '')
    );
  end loop;

  with recursive dependencies(product_id, path, is_cycle) as (
    select
      item.ingredient_product_id,
      array[p_output_product_id, item.ingredient_product_id]::uuid[],
      item.ingredient_product_id = p_output_product_id
    from public.production_recipe_items item
    where item.recipe_id = v_recipe_id

    union all

    select
      child.ingredient_product_id,
      dependencies.path || child.ingredient_product_id,
      child.ingredient_product_id = any(dependencies.path)
    from dependencies
    join public.production_recipes nested_recipe
      on nested_recipe.user_id = v_user_id
     and nested_recipe.output_product_id = dependencies.product_id
     and nested_recipe.recipe_context = 'restaurant'
    join public.production_recipe_items child
      on child.recipe_id = nested_recipe.id
    where not dependencies.is_cycle
      and cardinality(dependencies.path) < 30
  )
  select exists(select 1 from dependencies where is_cycle)
  into v_has_cycle;

  if v_has_cycle then
    raise exception 'La receta crea una dependencia circular entre preparaciones.';
  end if;

  update public.products
  set production_enabled = coalesce(p_is_active, true)
  where id = p_output_product_id and user_id = v_user_id;

  return v_recipe_id;
end;
$$;

revoke all on function public.save_restaurant_recipe(
  uuid, uuid, text, numeric, text, text, boolean, numeric, numeric, numeric, jsonb
) from public;
grant execute on function public.save_restaurant_recipe(
  uuid, uuid, text, numeric, text, text, boolean, numeric, numeric, numeric, jsonb
) to authenticated;

create or replace function public.set_restaurant_recipe_active(
  p_recipe_id uuid,
  p_is_active boolean
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_output_product_id uuid;
begin
  update public.production_recipes
  set is_active = coalesce(p_is_active, false)
  where id = p_recipe_id
    and user_id = v_user_id
    and recipe_context = 'restaurant'
  returning output_product_id into v_output_product_id;

  if v_output_product_id is null then
    raise exception 'No se encontró la receta gastronómica.';
  end if;

  update public.products
  set production_enabled = coalesce(p_is_active, false)
  where id = v_output_product_id and user_id = v_user_id;

  return true;
end;
$$;

revoke all on function public.set_restaurant_recipe_active(uuid, boolean) from public;
grant execute on function public.set_restaurant_recipe_active(uuid, boolean) to authenticated;

create or replace function public.delete_restaurant_recipe(p_recipe_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_output_product_id uuid;
begin
  select output_product_id into v_output_product_id
  from public.production_recipes
  where id = p_recipe_id
    and user_id = v_user_id
    and recipe_context = 'restaurant';

  if v_output_product_id is null then
    raise exception 'No se encontró la receta gastronómica.';
  end if;

  delete from public.production_recipes
  where id = p_recipe_id
    and user_id = v_user_id
    and recipe_context = 'restaurant';

  update public.products
  set production_enabled = false
  where id = v_output_product_id and user_id = v_user_id;

  return true;
end;
$$;

revoke all on function public.delete_restaurant_recipe(uuid) from public;
grant execute on function public.delete_restaurant_recipe(uuid) to authenticated;
