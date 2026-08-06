-- INVENTIQ · Fase 7.2 · Recetas, rendimiento y costos para panadería
-- Ejecutar una sola vez en Supabase > SQL Editor después de la Fase 7.1.
-- Migración no destructiva: no elimina productos, ventas, clientes ni inventario existente.

alter table public.production_recipes
  add column if not exists additional_cost numeric(14,4) not null default 0,
  add column if not exists additional_cost_notes text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'production_recipes_additional_cost_check'
      and conrelid = 'public.production_recipes'::regclass
  ) then
    alter table public.production_recipes
      add constraint production_recipes_additional_cost_check
      check (additional_cost >= 0);
  end if;
end
$$;

comment on column public.production_recipes.additional_cost is
'Costo adicional estimado por lote: mano de obra, energía u otros costos no controlados como inventario.';

comment on column public.production_recipes.additional_cost_notes is
'Descripción breve del costo adicional incluido en la receta.';

create or replace function public.save_production_recipe(
  p_recipe_id uuid,
  p_output_product_id uuid,
  p_name text,
  p_yield_quantity numeric,
  p_yield_unit text,
  p_notes text,
  p_is_active boolean,
  p_additional_cost numeric,
  p_additional_cost_notes text,
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
begin
  if v_user_id is null then
    raise exception 'No existe una sesión autenticada.';
  end if;

  if p_output_product_id is null then
    raise exception 'Selecciona el producto terminado de la receta.';
  end if;

  if not exists (
    select 1
    from public.products
    where id = p_output_product_id
      and user_id = v_user_id
  ) then
    raise exception 'El producto terminado no pertenece al negocio actual.';
  end if;

  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Ingresa un nombre válido para la receta.';
  end if;

  if coalesce(p_yield_quantity, 0) <= 0 then
    raise exception 'El rendimiento debe ser mayor a cero.';
  end if;

  if char_length(trim(coalesce(p_yield_unit, ''))) = 0 then
    raise exception 'Selecciona la unidad de rendimiento.';
  end if;

  if coalesce(p_additional_cost, 0) < 0 then
    raise exception 'El costo adicional no puede ser negativo.';
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'La receta debe tener al menos un ingrediente.';
  end if;

  if p_recipe_id is null then
    if exists (
      select 1
      from public.production_recipes
      where user_id = v_user_id
        and output_product_id = p_output_product_id
        and version = 1
    ) then
      raise exception 'Este producto ya tiene una receta registrada.';
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
      additional_cost_notes
    ) values (
      v_user_id,
      p_output_product_id,
      trim(p_name),
      p_yield_quantity,
      trim(p_yield_unit),
      1,
      coalesce(p_is_active, true),
      nullif(trim(coalesce(p_notes, '')), ''),
      coalesce(p_additional_cost, 0),
      nullif(trim(coalesce(p_additional_cost_notes, '')), '')
    )
    returning id into v_recipe_id;
  else
    update public.production_recipes
    set
      name = trim(p_name),
      yield_quantity = p_yield_quantity,
      yield_unit = trim(p_yield_unit),
      is_active = coalesce(p_is_active, true),
      notes = nullif(trim(coalesce(p_notes, '')), ''),
      additional_cost = coalesce(p_additional_cost, 0),
      additional_cost_notes = nullif(trim(coalesce(p_additional_cost_notes, '')), '')
    where id = p_recipe_id
      and user_id = v_user_id
      and output_product_id = p_output_product_id
    returning id into v_recipe_id;

    if v_recipe_id is null then
      raise exception 'No se encontró la receta o no tienes permisos para editarla.';
    end if;

    delete from public.production_recipe_items
    where recipe_id = v_recipe_id
      and user_id = v_user_id;
  end if;

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop
    v_ingredient_id := nullif(v_item->>'ingredient_product_id', '')::uuid;
    v_quantity := nullif(v_item->>'quantity', '')::numeric;
    v_unit := trim(coalesce(v_item->>'unit', ''));
    v_waste_percent := coalesce(nullif(v_item->>'waste_percent', '')::numeric, 0);

    if v_ingredient_id is null then
      raise exception 'Uno de los ingredientes no es válido.';
    end if;

    if v_ingredient_id = p_output_product_id then
      raise exception 'El producto terminado no puede utilizarse como ingrediente de sí mismo.';
    end if;

    if not exists (
      select 1
      from public.products
      where id = v_ingredient_id
        and user_id = v_user_id
    ) then
      raise exception 'Uno de los ingredientes no pertenece al negocio actual.';
    end if;

    if coalesce(v_quantity, 0) <= 0 then
      raise exception 'Todas las cantidades de ingredientes deben ser mayores a cero.';
    end if;

    if char_length(v_unit) = 0 then
      raise exception 'Todos los ingredientes deben tener una unidad.';
    end if;

    if v_waste_percent < 0 or v_waste_percent > 100 then
      raise exception 'El porcentaje de merma debe estar entre 0 y 100.';
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

  update public.products
  set
    production_enabled = coalesce(p_is_active, true),
    product_type = case
      when product_type in ('sale_product', 'finished_product') then 'finished_product'
      else product_type
    end,
    stock_unit = coalesce(nullif(stock_unit, ''), nullif(trim(p_yield_unit), ''))
  where id = p_output_product_id
    and user_id = v_user_id;

  return v_recipe_id;
end;
$$;

revoke all on function public.save_production_recipe(
  uuid, uuid, text, numeric, text, text, boolean, numeric, text, jsonb
) from public;

grant execute on function public.save_production_recipe(
  uuid, uuid, text, numeric, text, text, boolean, numeric, text, jsonb
) to authenticated;

create or replace function public.set_production_recipe_active(
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
  returning output_product_id into v_output_product_id;

  if v_output_product_id is null then
    raise exception 'No se encontró la receta.';
  end if;

  update public.products
  set production_enabled = exists (
    select 1
    from public.production_recipes
    where user_id = v_user_id
      and output_product_id = v_output_product_id
      and is_active = true
  )
  where id = v_output_product_id
    and user_id = v_user_id;

  return true;
end;
$$;

revoke all on function public.set_production_recipe_active(uuid, boolean) from public;
grant execute on function public.set_production_recipe_active(uuid, boolean) to authenticated;

create or replace function public.delete_production_recipe(
  p_recipe_id uuid
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
  select output_product_id
  into v_output_product_id
  from public.production_recipes
  where id = p_recipe_id
    and user_id = v_user_id;

  if v_output_product_id is null then
    raise exception 'No se encontró la receta.';
  end if;

  delete from public.production_recipes
  where id = p_recipe_id
    and user_id = v_user_id;

  update public.products
  set production_enabled = exists (
    select 1
    from public.production_recipes
    where user_id = v_user_id
      and output_product_id = v_output_product_id
      and is_active = true
  )
  where id = v_output_product_id
    and user_id = v_user_id;

  return true;
end;
$$;

revoke all on function public.delete_production_recipe(uuid) from public;
grant execute on function public.delete_production_recipe(uuid) to authenticated;
