-- INVENTIQ · Corrección 8.8.1 · Anulaciones reales + reportes gastronómicos
-- Ejecutar después de las fases 8.7 y 8.8.
-- No elimina datos. Corrige la lógica para que una anulación comercial NO restaure
-- automáticamente ingredientes/preparaciones que pudieron haber sido consumidos.

-- 1. Al cerrar una cuenta, un producto cancelado DESPUÉS de iniciar preparación
--    sí consume inventario. Un producto cancelado antes de iniciar preparación no.
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

-- 2. Al anular una venta ya cerrada, conservar el consumo gastronómico real.
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
  v_consumption_count integer := 0;
begin
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

revoke all on function public.restaurant_apply_order_inventory(uuid) from public;
revoke all on function public.cancel_restaurant_order_sale(uuid) from public;
grant execute on function public.restaurant_apply_order_inventory(uuid) to authenticated;
grant execute on function public.cancel_restaurant_order_sale(uuid) to authenticated;

comment on function public.cancel_restaurant_order_sale(uuid) is
  'Anula una venta de restaurante sin restaurar automáticamente ingredientes o preparaciones ya consumidos.';
