-- INVENTIQ · Fase 9.4 · Inventario, mermas y reposición para Cafeterías
-- Ejecutar después de 20260807_phase_9_3_cafeteria_barra_entrega.sql
-- No destructiva. Añade control físico de stock, preparaciones internas, mermas y alertas de reposición.

create extension if not exists pgcrypto;

-- 1) Preparaciones de cafetería también pueden registrarse como lotes reales.
alter table public.production_batches
  drop constraint if exists production_batches_context_check;
alter table public.production_batches
  add constraint production_batches_context_check
  check (production_context in ('bakery', 'restaurant', 'cafeteria'));

-- 2) Historial de mermas y conteos físicos propio de Cafetería.
create table if not exists public.cafeteria_stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  production_batch_id uuid references public.production_batches(id) on delete set null,
  adjustment_kind text not null,
  reason_code text not null,
  reason_label text not null,
  product_name text not null,
  product_type text not null default 'stock_item',
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
  created_at timestamptz not null default now(),
  constraint cafeteria_stock_adjustments_kind_check
    check (adjustment_kind in ('waste','physical_count'))
);

create index if not exists cafeteria_stock_adjustments_user_date_idx
  on public.cafeteria_stock_adjustments(user_id, event_date desc, created_at desc);
create index if not exists cafeteria_stock_adjustments_product_idx
  on public.cafeteria_stock_adjustments(product_id, created_at desc);
create index if not exists cafeteria_stock_adjustments_kind_idx
  on public.cafeteria_stock_adjustments(user_id, adjustment_kind, event_date desc);

alter table public.cafeteria_stock_adjustments enable row level security;
grant select on public.cafeteria_stock_adjustments to authenticated;
revoke insert, update, delete on public.cafeteria_stock_adjustments from authenticated;

drop policy if exists "cafeteria_stock_adjustments_access" on public.cafeteria_stock_adjustments;
create policy "cafeteria_stock_adjustments_access"
on public.cafeteria_stock_adjustments for select to authenticated
using (
  user_id = public.restaurant_effective_user_id()
  and (
    not public.restaurant_is_employee_session()
    or public.restaurant_employee_has_permission('inventory.manage')
    or public.restaurant_employee_has_permission('inventory.adjust')
  )
);

-- Permite cerrar incidencias desde el control de inventario.
alter table public.cafeteria_inventory_issues
  add column if not exists resolved_notes text;

-- Ajustar RLS de consumos/incidencias para que Supervisor/Administrador operativo pueda revisarlos.
drop policy if exists "cafeteria_inventory_consumptions_access" on public.cafeteria_inventory_consumptions;
create policy "cafeteria_inventory_consumptions_access"
on public.cafeteria_inventory_consumptions for select to authenticated
using (
  user_id = public.restaurant_effective_user_id()
  and (
    not public.restaurant_is_employee_session()
    or public.restaurant_employee_has_permission('inventory.manage')
    or public.restaurant_employee_has_permission('inventory.adjust')
    or public.restaurant_employee_has_permission('costs.view')
  )
);

drop policy if exists "cafeteria_inventory_issues_access" on public.cafeteria_inventory_issues;
create policy "cafeteria_inventory_issues_access"
on public.cafeteria_inventory_issues for select to authenticated
using (
  user_id = public.restaurant_effective_user_id()
  and (
    not public.restaurant_is_employee_session()
    or public.restaurant_employee_has_permission('inventory.manage')
    or public.restaurant_employee_has_permission('inventory.adjust')
  )
);

-- Permitir lectura de recetas/componentes al propietario o a perfiles gastronómicos con inventario/recetas.
drop policy if exists "production_recipes_owner_select" on public.production_recipes;
create policy "production_recipes_owner_select"
on public.production_recipes for select to authenticated
using (
  auth.uid() = user_id
  or (
    user_id = public.restaurant_effective_user_id()
    and public.restaurant_is_employee_session()
    and (
      public.restaurant_employee_has_permission('inventory.manage')
      or public.restaurant_employee_has_permission('inventory.adjust')
      or public.restaurant_employee_has_permission('recipes.manage')
      or public.restaurant_employee_has_permission('costs.view')
    )
  )
);

drop policy if exists "production_recipe_items_owner_select" on public.production_recipe_items;
create policy "production_recipe_items_owner_select"
on public.production_recipe_items for select to authenticated
using (
  auth.uid() = user_id
  or (
    user_id = public.restaurant_effective_user_id()
    and public.restaurant_is_employee_session()
    and (
      public.restaurant_employee_has_permission('inventory.manage')
      or public.restaurant_employee_has_permission('inventory.adjust')
      or public.restaurant_employee_has_permission('recipes.manage')
      or public.restaurant_employee_has_permission('costs.view')
    )
  )
);

-- Permitir lectura de lotes de producción al propietario o a perfiles gastronómicos con inventario.
drop policy if exists "production_batches_owner_select" on public.production_batches;
create policy "production_batches_owner_select"
on public.production_batches for select to authenticated
using (
  auth.uid() = user_id
  or (
    user_id = public.restaurant_effective_user_id()
    and public.restaurant_is_employee_session()
    and (
      public.restaurant_employee_has_permission('inventory.manage')
      or public.restaurant_employee_has_permission('inventory.adjust')
      or public.restaurant_employee_has_permission('recipes.manage')
    )
  )
);

drop policy if exists "production_batch_items_owner_select" on public.production_batch_items;
create policy "production_batch_items_owner_select"
on public.production_batch_items for select to authenticated
using (
  auth.uid() = user_id
  or (
    user_id = public.restaurant_effective_user_id()
    and public.restaurant_is_employee_session()
    and (
      public.restaurant_employee_has_permission('inventory.manage')
      or public.restaurant_employee_has_permission('inventory.adjust')
      or public.restaurant_employee_has_permission('recipes.manage')
    )
  )
);

-- 3) Nuevos tipos de movimiento de inventario de cafetería.
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
    check (movement_type in (
      'initial','purchase','sale','sale_return','adjustment_in','adjustment_out',
      'production_input','production_output','waste',
      'restaurant_consumption','restaurant_preparation_input','restaurant_preparation_output','restaurant_return',
      'cafeteria_consumption','cafeteria_preparation_input','cafeteria_preparation_output','cafeteria_waste'
    ));
end
$$;

-- 4) Registrar una preparación interna (cold brew, crema, salsa, base, etc.).
create or replace function public.register_cafeteria_preparation_batch(
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
  v_actor uuid := auth.uid();
  v_recipe public.production_recipes%rowtype;
  v_output public.products%rowtype;
  v_item public.production_recipe_items%rowtype;
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
  if auth.uid() is null or v_user_id is null then raise exception 'No existe una sesión activa.'; end if;
  perform public.restaurant_require_permission('inventory.adjust');

  if not exists (select 1 from public.profiles where id = v_user_id and business_type = 'cafeteria') then
    raise exception 'Esta función está disponible únicamente para cuentas Cafetería.';
  end if;
  if coalesce(p_produced_quantity,0) <= 0 then raise exception 'La cantidad elaborada debe ser mayor a cero.'; end if;

  select * into v_recipe
  from public.production_recipes
  where id = p_recipe_id and user_id = v_user_id and recipe_context = 'cafeteria'
  for update;
  if not found then raise exception 'La receta no existe o no pertenece a la cafetería.'; end if;
  if not v_recipe.is_active then raise exception 'La receta está inactiva.'; end if;

  select * into v_output
  from public.products
  where id = v_recipe.output_product_id and user_id = v_user_id
  for update;
  if not found then raise exception 'La preparación de salida ya no existe.'; end if;
  if coalesce(v_output.product_type,'') <> 'intermediate'
     and lower(trim(coalesce(v_output.category,''))) not like 'preparaciones -%'
     and lower(trim(coalesce(v_output.category,''))) not like 'preparación -%' then
    raise exception 'Solo se puede registrar producción de preparaciones internas.';
  end if;
  if not exists (
    select 1 from public.production_recipe_items
    where recipe_id = v_recipe.id and user_id = v_user_id
  ) then raise exception 'La preparación no tiene componentes registrados.'; end if;

  v_multiplier := p_produced_quantity / v_recipe.yield_quantity;
  v_output_stock_unit := coalesce(nullif(trim(v_output.stock_unit),''), nullif(trim(v_output.size),''), v_recipe.yield_unit);
  v_output_stock_quantity := public.inventiq_convert_quantity(p_produced_quantity, v_recipe.yield_unit, v_output_stock_unit);
  if v_output_stock_quantity is null or v_output_stock_quantity <= 0 then
    raise exception 'La unidad de rendimiento (%) no es compatible con la unidad de stock (%).', v_recipe.yield_unit, v_output_stock_unit;
  end if;

  if nullif(trim(coalesce(p_batch_code,'')),'') is not null then
    v_batch_code := upper(trim(p_batch_code));
    if exists (select 1 from public.production_batches where user_id = v_user_id and batch_code = v_batch_code) then
      raise exception 'Ya existe un lote con el código %.', v_batch_code;
    end if;
  else
    loop
      v_attempt := v_attempt + 1;
      v_batch_code := 'CAF-PREP-' || to_char(coalesce(p_production_date,current_date),'YYYYMMDD') || '-' || lpad((floor(random()*10000))::integer::text,4,'0');
      exit when not exists (select 1 from public.production_batches where user_id = v_user_id and batch_code = v_batch_code);
      if v_attempt >= 20 then raise exception 'No se pudo generar el código del lote.'; end if;
    end loop;
  end if;

  insert into public.production_batches(
    id,user_id,recipe_id,output_product_id,batch_code,production_date,
    produced_quantity,produced_unit,output_stock_quantity,output_stock_unit,
    recipe_multiplier,ingredient_cost,additional_cost,total_cost,unit_cost,
    output_product_name,recipe_name,status,notes,created_by,production_context
  ) values (
    v_batch_id,v_user_id,v_recipe.id,v_output.id,v_batch_code,coalesce(p_production_date,current_date),
    p_produced_quantity,v_recipe.yield_unit,v_output_stock_quantity,v_output_stock_unit,
    v_multiplier,0,0,0,0,v_output.name,v_recipe.name,'completed',
    nullif(trim(coalesce(p_notes,'')),''),coalesce(v_actor,v_user_id),'cafeteria'
  );

  for v_item in
    select * from public.production_recipe_items
    where recipe_id = v_recipe.id and user_id = v_user_id
    order by created_at,id
  loop
    select * into v_ingredient from public.products
    where id = v_item.ingredient_product_id and user_id = v_user_id
    for update;
    if not found then raise exception 'Uno de los componentes de la receta ya no existe.'; end if;

    v_required_recipe_quantity := (v_item.quantity * v_multiplier) * (1 + greatest(coalesce(v_item.waste_percent,0),0)/100);
    v_stock_unit := coalesce(nullif(trim(v_ingredient.stock_unit),''), nullif(trim(v_ingredient.size),''), v_item.unit);
    v_stock_quantity := public.inventiq_convert_quantity(v_required_recipe_quantity,v_item.unit,v_stock_unit);
    if v_stock_quantity is null or v_stock_quantity <= 0 then
      raise exception 'La unidad de % no es compatible con su unidad de stock.', v_ingredient.name;
    end if;

    v_stock_before := greatest(coalesce(v_ingredient.stock,0),0);
    if v_stock_before + 0.0000001 < v_stock_quantity then
      raise exception 'Stock insuficiente de %. Disponible: % %. Requerido: % %.',
        v_ingredient.name,round(v_stock_before,4),v_stock_unit,round(v_stock_quantity,4),v_stock_unit;
    end if;

    v_stock_after := greatest(v_stock_before-v_stock_quantity,0);
    v_line_cost := v_stock_quantity * greatest(coalesce(v_ingredient.cost,0),0);
    v_ingredient_cost := v_ingredient_cost + v_line_cost;

    update public.products
    set stock = v_stock_after,
        status = case when v_stock_after <= 0 then 'Inactivo' else 'Activo' end
    where id = v_ingredient.id and user_id = v_user_id;

    insert into public.production_batch_items(
      user_id,batch_id,ingredient_product_id,ingredient_name,recipe_quantity,
      waste_percent,required_quantity,recipe_unit,stock_quantity,stock_unit,
      unit_cost,total_cost,stock_before,stock_after
    ) values (
      v_user_id,v_batch_id,v_ingredient.id,v_ingredient.name,
      v_item.quantity*v_multiplier,v_item.waste_percent,v_required_recipe_quantity,
      v_item.unit,v_stock_quantity,v_stock_unit,greatest(coalesce(v_ingredient.cost,0),0),
      v_line_cost,v_stock_before,v_stock_after
    );

    insert into public.inventory_movements(
      user_id,product_id,product_name,movement_type,quantity,stock_before,stock_after,unit,
      reference_type,reference_id,notes,created_by
    ) values (
      v_user_id,v_ingredient.id,v_ingredient.name,'cafeteria_preparation_input',-v_stock_quantity,
      v_stock_before,v_stock_after,v_stock_unit,'cafeteria_preparation_batch',v_batch_id,
      'Consumo para '||v_output.name||' · '||v_batch_code,coalesce(v_actor,v_user_id)
    );
  end loop;

  v_total_cost := v_ingredient_cost
    + greatest(coalesce(v_recipe.additional_cost,0),0)*v_multiplier
    + greatest(coalesce(v_recipe.labor_cost,0),0)*v_multiplier
    + greatest(coalesce(v_recipe.overhead_cost,0),0)*v_multiplier;
  v_unit_cost := case when v_output_stock_quantity > 0 then v_total_cost/v_output_stock_quantity else 0 end;

  v_existing_output_stock := greatest(coalesce(v_output.stock,0),0);
  v_existing_output_cost := greatest(coalesce(v_output.cost,0),0);
  v_new_output_stock := v_existing_output_stock + v_output_stock_quantity;
  v_new_output_cost := case when v_new_output_stock > 0 then
    ((v_existing_output_stock*v_existing_output_cost)+v_total_cost)/v_new_output_stock
    else v_unit_cost end;

  update public.products
  set stock = v_new_output_stock,cost = v_new_output_cost,status='Activo'
  where id = v_output.id and user_id = v_user_id;

  insert into public.inventory_movements(
    user_id,product_id,product_name,movement_type,quantity,stock_before,stock_after,unit,
    reference_type,reference_id,notes,created_by
  ) values (
    v_user_id,v_output.id,v_output.name,'cafeteria_preparation_output',v_output_stock_quantity,
    v_existing_output_stock,v_new_output_stock,v_output_stock_unit,'cafeteria_preparation_batch',v_batch_id,
    'Preparación interna · '||v_batch_code,coalesce(v_actor,v_user_id)
  );

  update public.production_batches
  set ingredient_cost=round(v_ingredient_cost,4),
      additional_cost=round(v_total_cost-v_ingredient_cost,4),
      total_cost=round(v_total_cost,4),
      unit_cost=round(v_unit_cost,6)
  where id=v_batch_id and user_id=v_user_id;

  return jsonb_build_object(
    'batch_id',v_batch_id,'batch_code',v_batch_code,
    'output_product_id',v_output.id,'output_product_name',v_output.name,
    'produced_quantity',p_produced_quantity,'output_stock_quantity',v_output_stock_quantity,
    'output_stock_unit',v_output_stock_unit,'total_cost',round(v_total_cost,4),'unit_cost',round(v_unit_cost,6)
  );
end;
$$;

revoke all on function public.register_cafeteria_preparation_batch(uuid,numeric,date,text,text) from public;
grant execute on function public.register_cafeteria_preparation_batch(uuid,numeric,date,text,text) to authenticated;

-- 5) Registrar merma o conteo físico. Nunca restaura automáticamente ingredientes ya consumidos.
create or replace function public.register_cafeteria_stock_adjustment(
  p_product_id uuid,
  p_adjustment_kind text,
  p_quantity numeric,
  p_event_date date,
  p_reason_code text,
  p_reason_label text,
  p_notes text default '',
  p_batch_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.restaurant_effective_user_id();
  v_actor uuid := auth.uid();
  v_product public.products%rowtype;
  v_before numeric;
  v_after numeric;
  v_delta numeric;
  v_unit text;
  v_cost numeric;
  v_impact numeric;
  v_batch_code text;
begin
  if auth.uid() is null or v_user_id is null then raise exception 'No existe una sesión activa.'; end if;
  perform public.restaurant_require_permission('inventory.adjust');
  if not exists (select 1 from public.profiles where id=v_user_id and business_type='cafeteria') then
    raise exception 'Esta función está disponible únicamente para cuentas Cafetería.';
  end if;
  if p_adjustment_kind not in ('waste','physical_count') then raise exception 'Tipo de ajuste no válido.'; end if;
  if coalesce(p_quantity,-1) < 0 then raise exception 'La cantidad no puede ser negativa.'; end if;
  if nullif(trim(coalesce(p_reason_code,'')),'') is null then raise exception 'Selecciona un motivo.'; end if;

  select * into v_product from public.products
  where id=p_product_id and user_id=v_user_id
  for update;
  if not found then raise exception 'Producto no encontrado.'; end if;

  v_before := greatest(coalesce(v_product.stock,0),0);
  v_unit := coalesce(nullif(trim(v_product.stock_unit),''),nullif(trim(v_product.size),''),'unidad');
  v_cost := greatest(coalesce(v_product.cost,0),0);

  if p_adjustment_kind='waste' then
    if p_quantity <= 0 then raise exception 'La merma debe ser mayor a cero.'; end if;
    if p_quantity > v_before + 0.0000001 then raise exception 'La merma no puede superar el stock disponible.'; end if;
    v_after := greatest(v_before-p_quantity,0);
    v_delta := -p_quantity;
  else
    v_after := p_quantity;
    v_delta := v_after-v_before;
    if abs(v_delta) < 0.0000001 then raise exception 'El conteo coincide con el stock registrado.'; end if;
  end if;

  if p_batch_id is not null then
    select batch_code into v_batch_code
    from public.production_batches
    where id=p_batch_id and user_id=v_user_id and production_context='cafeteria';
  end if;

  v_impact := abs(v_delta)*v_cost;

  update public.products
  set stock=v_after,
      status=case when v_after <= 0 then 'Inactivo' else 'Activo' end
  where id=v_product.id and user_id=v_user_id;

  insert into public.cafeteria_stock_adjustments(
    user_id,product_id,production_batch_id,adjustment_kind,reason_code,reason_label,
    product_name,product_type,quantity_reported,quantity_delta,stock_before,stock_after,
    unit,unit_cost,cost_impact,event_date,batch_code,notes,created_by
  ) values (
    v_user_id,v_product.id,p_batch_id,p_adjustment_kind,trim(p_reason_code),
    coalesce(nullif(trim(p_reason_label),''),trim(p_reason_code)),v_product.name,
    coalesce(nullif(v_product.product_type,''),'stock_item'),p_quantity,v_delta,v_before,v_after,
    v_unit,v_cost,v_impact,coalesce(p_event_date,current_date),v_batch_code,
    nullif(trim(coalesce(p_notes,'')),''),coalesce(v_actor,v_user_id)
  );

  insert into public.inventory_movements(
    user_id,product_id,product_name,movement_type,quantity,stock_before,stock_after,unit,
    reference_type,reference_id,notes,created_by
  ) values (
    v_user_id,v_product.id,v_product.name,
    case when p_adjustment_kind='waste' then 'cafeteria_waste'
         when v_delta>0 then 'adjustment_in' else 'adjustment_out' end,
    v_delta,v_before,v_after,v_unit,'cafeteria_stock_adjustment',p_product_id,
    coalesce(nullif(trim(p_reason_label),''),trim(p_reason_code)) ||
      case when nullif(trim(coalesce(p_notes,'')),'') is not null then ' · '||trim(p_notes) else '' end,
    coalesce(v_actor,v_user_id)
  );

  return jsonb_build_object(
    'product_id',v_product.id,'product_name',v_product.name,'kind',p_adjustment_kind,
    'quantity_delta',v_delta,'stock_before',v_before,'stock_after',v_after,
    'unit',v_unit,'cost_impact',round(v_impact,4)
  );
end;
$$;

revoke all on function public.register_cafeteria_stock_adjustment(uuid,text,numeric,date,text,text,text,uuid) from public;
grant execute on function public.register_cafeteria_stock_adjustment(uuid,text,numeric,date,text,text,text,uuid) to authenticated;

-- 6) Resolver alertas técnicas después de revisar la causa.
create or replace function public.resolve_cafeteria_inventory_issue(
  p_issue_id uuid,
  p_notes text default ''
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_user_id uuid := public.restaurant_effective_user_id();
begin
  if auth.uid() is null or v_user_id is null then raise exception 'No existe una sesión activa.'; end if;
  perform public.restaurant_require_permission('inventory.adjust');
  update public.cafeteria_inventory_issues
  set resolved_at=now(),resolved_notes=nullif(trim(coalesce(p_notes,'')),'')
  where id=p_issue_id and user_id=v_user_id and resolved_at is null;
  if not found then raise exception 'La incidencia no existe o ya fue resuelta.'; end if;
end;
$$;

revoke all on function public.resolve_cafeteria_inventory_issue(uuid,text) from public;
grant execute on function public.resolve_cafeteria_inventory_issue(uuid,text) to authenticated;

-- 7) Realtime para que compras, barra y control de inventario se mantengan sincronizados.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='cafeteria_inventory_consumptions'
  ) then alter publication supabase_realtime add table public.cafeteria_inventory_consumptions; end if;
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='cafeteria_inventory_issues'
  ) then alter publication supabase_realtime add table public.cafeteria_inventory_issues; end if;
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='cafeteria_stock_adjustments'
  ) then alter publication supabase_realtime add table public.cafeteria_stock_adjustments; end if;
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='production_batches'
  ) then alter publication supabase_realtime add table public.production_batches; end if;
end $$;
