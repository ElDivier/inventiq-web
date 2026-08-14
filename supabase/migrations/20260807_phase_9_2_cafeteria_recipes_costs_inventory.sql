-- INVENTIQ · Fase 9.2 · Recetas, costos y consumo real para Cafeterías
-- Ejecutar después de 20260807_phase_9_1_cafeteria_operational_foundation.sql
-- No destructiva. Reutiliza production_recipes y agrega reglas de variantes específicas de cafetería.

create extension if not exists pgcrypto;

-- 1) Permitir un contexto propio para las recetas de cafetería.
alter table public.production_recipes
  drop constraint if exists production_recipes_context_check;

alter table public.production_recipes
  add constraint production_recipes_context_check
  check (recipe_context in ('bakery', 'restaurant', 'cafeteria'));

comment on column public.production_recipes.recipe_context is
'Contexto funcional de la receta: bakery, restaurant o cafeteria.';

-- Componentes de la receta base. component_key permite reemplazar leche/empaque/etc.
alter table public.production_recipe_items
  add column if not exists component_key text not null default 'standard',
  add column if not exists scale_with_size boolean not null default false;

comment on column public.production_recipe_items.component_key is
'Rol lógico del componente en cafetería: standard, coffee, milk, packaging, syrup, garnish u other.';
comment on column public.production_recipe_items.scale_with_size is
'Indica si la cantidad del componente se multiplica por el factor del tamaño seleccionado.';

-- 2) Reglas que transforman la receta según las opciones elegidas en Caja rápida.
create table if not exists public.cafeteria_recipe_variant_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.production_recipes(id) on delete cascade,
  option_key text not null,
  option_type text not null,
  option_label text not null,
  scale_factor numeric(10,4) not null default 1,
  replace_component_key text not null default '',
  replacement_product_id uuid references public.products(id) on delete set null,
  addition_product_id uuid references public.products(id) on delete set null,
  addition_quantity numeric(14,4) not null default 0,
  addition_unit text not null default '',
  addition_waste_percent numeric(6,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cafeteria_recipe_variant_rules_type_check
    check (option_type in ('size','milk','syrup','temperature','extra_shot')),
  constraint cafeteria_recipe_variant_rules_scale_check check (scale_factor > 0),
  constraint cafeteria_recipe_variant_rules_quantity_check check (addition_quantity >= 0),
  constraint cafeteria_recipe_variant_rules_waste_check check (addition_waste_percent between 0 and 100),
  unique (recipe_id, option_key)
);

create index if not exists cafeteria_recipe_variant_rules_user_recipe_idx
  on public.cafeteria_recipe_variant_rules(user_id, recipe_id, option_type);

drop trigger if exists cafeteria_recipe_variant_rules_touch_updated_at on public.cafeteria_recipe_variant_rules;
create trigger cafeteria_recipe_variant_rules_touch_updated_at
before update on public.cafeteria_recipe_variant_rules
for each row execute function public.inventiq_touch_updated_at();

alter table public.cafeteria_recipe_variant_rules enable row level security;
revoke insert, update, delete on public.cafeteria_recipe_variant_rules from authenticated;
grant select on public.cafeteria_recipe_variant_rules to authenticated;

drop policy if exists "cafeteria_recipe_variant_rules_access" on public.cafeteria_recipe_variant_rules;
drop policy if exists "cafeteria_recipe_variant_rules_select" on public.cafeteria_recipe_variant_rules;
create policy "cafeteria_recipe_variant_rules_select"
on public.cafeteria_recipe_variant_rules for select to authenticated
using (
  user_id = public.restaurant_effective_user_id()
  and (
    not public.restaurant_is_employee_session()
    or public.restaurant_employee_has_permission('recipes.manage')
    or public.restaurant_employee_has_permission('costs.view')
  )
);

-- 3) Trazabilidad del consumo real. El consumo ocurre cuando Barra inicia la preparación,
-- no al cobrar la venta. Si se cancela antes de preparar, no se descuenta inventario.
alter table public.cafeteria_order_items
  add column if not exists inventory_status text not null default 'pending',
  add column if not exists inventory_consumed_at timestamptz,
  add column if not exists inventory_cost numeric(14,4) not null default 0,
  add column if not exists inventory_shortage_count integer not null default 0,
  add column if not exists inventory_issue_count integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cafeteria_order_items_inventory_status_check'
      and conrelid = 'public.cafeteria_order_items'::regclass
  ) then
    alter table public.cafeteria_order_items
      add constraint cafeteria_order_items_inventory_status_check
      check (inventory_status in ('pending','complete','partial','error','legacy'));
  end if;
end
$$;

create table if not exists public.cafeteria_inventory_consumptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.cafeteria_orders(id) on delete cascade,
  order_item_id uuid not null references public.cafeteria_order_items(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete set null,
  menu_product_id uuid references public.products(id) on delete set null,
  menu_product_name text not null,
  source_key text not null,
  source_label text not null,
  ingredient_product_id uuid references public.products(id) on delete set null,
  ingredient_name text not null,
  recipe_quantity numeric(14,4) not null,
  recipe_unit text not null,
  required_quantity numeric(14,4) not null,
  stock_quantity numeric(14,4) not null,
  applied_quantity numeric(14,4) not null default 0,
  shortage_quantity numeric(14,4) not null default 0,
  stock_unit text not null,
  unit_cost numeric(14,6) not null default 0,
  theoretical_cost numeric(14,4) not null default 0,
  applied_cost numeric(14,4) not null default 0,
  stock_before numeric(14,4) not null,
  stock_after numeric(14,4) not null,
  consumed_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  unique(user_id, order_item_id, source_key)
);

create index if not exists cafeteria_inventory_consumptions_user_date_idx
  on public.cafeteria_inventory_consumptions(user_id, consumed_at desc);
create index if not exists cafeteria_inventory_consumptions_item_idx
  on public.cafeteria_inventory_consumptions(order_item_id);
create index if not exists cafeteria_inventory_consumptions_ingredient_idx
  on public.cafeteria_inventory_consumptions(ingredient_product_id, consumed_at desc);

create table if not exists public.cafeteria_inventory_issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.cafeteria_orders(id) on delete cascade,
  order_item_id uuid not null references public.cafeteria_order_items(id) on delete cascade,
  menu_product_id uuid references public.products(id) on delete set null,
  menu_product_name text not null,
  issue_type text not null,
  details text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint cafeteria_inventory_issues_type_check
    check (issue_type in ('missing_recipe','missing_component','incompatible_unit','invalid_yield','processing_error'))
);

create index if not exists cafeteria_inventory_issues_user_date_idx
  on public.cafeteria_inventory_issues(user_id, created_at desc);

alter table public.cafeteria_inventory_consumptions enable row level security;
alter table public.cafeteria_inventory_issues enable row level security;
grant select on public.cafeteria_inventory_consumptions to authenticated;
grant select on public.cafeteria_inventory_issues to authenticated;

drop policy if exists "cafeteria_inventory_consumptions_access" on public.cafeteria_inventory_consumptions;
create policy "cafeteria_inventory_consumptions_access"
on public.cafeteria_inventory_consumptions for select to authenticated
using (user_id = public.restaurant_effective_user_id());

drop policy if exists "cafeteria_inventory_issues_access" on public.cafeteria_inventory_issues;
create policy "cafeteria_inventory_issues_access"
on public.cafeteria_inventory_issues for select to authenticated
using (user_id = public.restaurant_effective_user_id());

-- Añadir el tipo de movimiento de cafetería preservando todos los tipos existentes.
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
      'cafeteria_consumption'
    ));
end
$$;

-- Consulta segura para Caja: devuelve únicamente qué productos están controlados por receta,
-- sin exponer ingredientes, costos ni fórmulas a perfiles operativos.
create or replace function public.cafeteria_get_recipe_controlled_products(p_product_ids uuid[])
returns uuid[]
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.restaurant_effective_user_id();
  v_result uuid[] := array[]::uuid[];
begin
  if auth.uid() is null or v_user_id is null then raise exception 'No existe una sesión activa.'; end if;
  if public.restaurant_is_employee_session()
     and not (
       public.restaurant_employee_has_permission('sales.manage')
       or public.restaurant_employee_has_permission('orders.manage')
       or public.restaurant_employee_has_permission('cafe.queue.manage')
       or public.restaurant_employee_has_permission('recipes.manage')
     ) then
    raise exception 'Tu perfil no tiene permiso para validar productos de cafetería.';
  end if;

  select coalesce(array_agg(distinct output_product_id), array[]::uuid[])
    into v_result
  from public.production_recipes
  where user_id = v_user_id
    and recipe_context = 'cafeteria'
    and is_active = true
    and output_product_id = any(coalesce(p_product_ids, array[]::uuid[]));

  return v_result;
end;
$$;

revoke all on function public.cafeteria_get_recipe_controlled_products(uuid[]) from public;
grant execute on function public.cafeteria_get_recipe_controlled_products(uuid[]) to authenticated;

-- 4) Guardar receta base + reglas de variantes en una sola operación.
create or replace function public.save_cafeteria_recipe(
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
  p_items jsonb,
  p_variant_rules jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.restaurant_effective_user_id();
  v_recipe_id uuid;
  v_item jsonb;
  v_rule jsonb;
  v_ingredient_id uuid;
  v_replacement_id uuid;
  v_addition_id uuid;
  v_category text;
  v_product_type text;
begin
  if auth.uid() is null or v_user_id is null then raise exception 'No existe una sesión activa.'; end if;
  perform public.restaurant_require_permission('recipes.manage');

  if not exists (select 1 from public.profiles where id = v_user_id and business_type = 'cafeteria') then
    raise exception 'Esta función está disponible únicamente para cuentas tipo Cafetería.';
  end if;

  select lower(trim(coalesce(category,''))), coalesce(product_type,'sale_product')
    into v_category, v_product_type
  from public.products where id = p_output_product_id and user_id = v_user_id;
  if v_category is null then raise exception 'El producto de salida no pertenece a la cafetería.'; end if;

  if v_category like 'insumos -%' or v_category like 'empaques -%' or v_category like 'empaque -%' then
    raise exception 'Un insumo o empaque no puede ser el resultado de una receta.';
  end if;
  if not (v_product_type in ('sale_product','intermediate') or v_category like 'menú -%' or v_category like 'menu -%' or v_category like 'preparaciones -%' or v_category like 'preparación -%') then
    raise exception 'La receta debe producir un producto del menú o una preparación interna.';
  end if;
  if char_length(trim(coalesce(p_name,''))) < 2 then raise exception 'Ingresa un nombre válido para la receta.'; end if;
  if coalesce(p_yield_quantity,0) <= 0 then raise exception 'El rendimiento debe ser mayor a cero.'; end if;
  if nullif(trim(coalesce(p_yield_unit,'')),'') is null then raise exception 'Selecciona la unidad del rendimiento.'; end if;
  if coalesce(p_labor_cost,0) < 0 or coalesce(p_overhead_cost,0) < 0 then raise exception 'Los costos adicionales no pueden ser negativos.'; end if;
  if coalesce(p_target_food_cost_percent,0) <= 0 or p_target_food_cost_percent > 100 then raise exception 'El costo objetivo debe estar entre 1 y 100 por ciento.'; end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items,'[]'::jsonb)) = 0 then
    raise exception 'La receta debe contener al menos un componente.';
  end if;

  if p_recipe_id is null then
    if exists (
      select 1 from public.production_recipes
      where user_id = v_user_id and output_product_id = p_output_product_id and recipe_context = 'cafeteria'
    ) then raise exception 'Este producto ya tiene una receta de cafetería.'; end if;

    insert into public.production_recipes(
      user_id, output_product_id, name, yield_quantity, yield_unit, version,
      is_active, notes, additional_cost, labor_cost, overhead_cost,
      target_food_cost_percent, recipe_context
    ) values (
      v_user_id, p_output_product_id, trim(p_name), p_yield_quantity, trim(p_yield_unit), 1,
      coalesce(p_is_active,true), nullif(trim(coalesce(p_notes,'')),''), 0,
      greatest(coalesce(p_labor_cost,0),0), greatest(coalesce(p_overhead_cost,0),0),
      p_target_food_cost_percent, 'cafeteria'
    ) returning id into v_recipe_id;
  else
    update public.production_recipes
    set name = trim(p_name), yield_quantity = p_yield_quantity, yield_unit = trim(p_yield_unit),
        is_active = coalesce(p_is_active,true), notes = nullif(trim(coalesce(p_notes,'')),''),
        labor_cost = greatest(coalesce(p_labor_cost,0),0), overhead_cost = greatest(coalesce(p_overhead_cost,0),0),
        target_food_cost_percent = p_target_food_cost_percent, recipe_context = 'cafeteria'
    where id = p_recipe_id and user_id = v_user_id and output_product_id = p_output_product_id and recipe_context = 'cafeteria'
    returning id into v_recipe_id;
    if v_recipe_id is null then raise exception 'No se encontró la receta o no tienes permisos para editarla.'; end if;
    delete from public.production_recipe_items where recipe_id = v_recipe_id and user_id = v_user_id;
    delete from public.cafeteria_recipe_variant_rules where recipe_id = v_recipe_id and user_id = v_user_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_ingredient_id := nullif(v_item->>'ingredient_product_id','')::uuid;
    if v_ingredient_id is null or v_ingredient_id = p_output_product_id then raise exception 'Uno de los componentes de la receta no es válido.'; end if;
    if not exists (select 1 from public.products where id = v_ingredient_id and user_id = v_user_id) then raise exception 'Uno de los componentes no pertenece a la cafetería.'; end if;
    if coalesce((v_item->>'quantity')::numeric,0) <= 0 then raise exception 'Todas las cantidades deben ser mayores a cero.'; end if;
    if nullif(trim(coalesce(v_item->>'unit','')),'') is null then raise exception 'Todos los componentes deben tener unidad.'; end if;
    if coalesce((v_item->>'waste_percent')::numeric,0) < 0 or coalesce((v_item->>'waste_percent')::numeric,0) > 100 then raise exception 'La merma prevista debe estar entre 0 y 100 por ciento.'; end if;

    insert into public.production_recipe_items(
      user_id, recipe_id, ingredient_product_id, quantity, unit, waste_percent, notes,
      component_key, scale_with_size
    ) values (
      v_user_id, v_recipe_id, v_ingredient_id, (v_item->>'quantity')::numeric,
      trim(v_item->>'unit'), coalesce((v_item->>'waste_percent')::numeric,0),
      nullif(trim(coalesce(v_item->>'notes','')),''),
      coalesce(nullif(trim(v_item->>'component_key'),''),'standard'),
      coalesce((v_item->>'scale_with_size')::boolean,false)
    );
  end loop;

  if jsonb_typeof(coalesce(p_variant_rules,'[]'::jsonb)) = 'array' then
    for v_rule in select value from jsonb_array_elements(p_variant_rules)
    loop
      if nullif(trim(coalesce(v_rule->>'option_key','')),'') is null then continue; end if;
      if coalesce(v_rule->>'option_type','') not in ('size','milk','syrup','temperature','extra_shot') then raise exception 'Una regla de variante tiene un tipo no válido.'; end if;
      v_replacement_id := nullif(v_rule->>'replacement_product_id','')::uuid;
      v_addition_id := nullif(v_rule->>'addition_product_id','')::uuid;
      if v_replacement_id is not null and not exists (select 1 from public.products where id = v_replacement_id and user_id = v_user_id) then raise exception 'El reemplazo de una variante no pertenece a la cafetería.'; end if;
      if v_addition_id is not null and not exists (select 1 from public.products where id = v_addition_id and user_id = v_user_id) then raise exception 'El insumo adicional de una variante no pertenece a la cafetería.'; end if;

      insert into public.cafeteria_recipe_variant_rules(
        user_id, recipe_id, option_key, option_type, option_label, scale_factor,
        replace_component_key, replacement_product_id, addition_product_id,
        addition_quantity, addition_unit, addition_waste_percent, is_active
      ) values (
        v_user_id, v_recipe_id, trim(v_rule->>'option_key'), trim(v_rule->>'option_type'),
        coalesce(nullif(trim(v_rule->>'option_label'),''), trim(v_rule->>'option_key')),
        greatest(coalesce((v_rule->>'scale_factor')::numeric,1),0.0001),
        coalesce(trim(v_rule->>'replace_component_key'),''), v_replacement_id, v_addition_id,
        greatest(coalesce((v_rule->>'addition_quantity')::numeric,0),0),
        coalesce(trim(v_rule->>'addition_unit'),''),
        least(100,greatest(0,coalesce((v_rule->>'addition_waste_percent')::numeric,0))), true
      );
    end loop;
  end if;

  return v_recipe_id;
end;
$$;

create or replace function public.delete_cafeteria_recipe(p_recipe_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_user_id uuid := public.restaurant_effective_user_id();
begin
  if auth.uid() is null or v_user_id is null then raise exception 'No existe una sesión activa.'; end if;
  perform public.restaurant_require_permission('recipes.manage');
  delete from public.production_recipes
  where id = p_recipe_id and user_id = v_user_id and recipe_context = 'cafeteria';
end;
$$;

revoke all on function public.save_cafeteria_recipe(uuid,uuid,text,numeric,text,text,boolean,numeric,numeric,numeric,jsonb,jsonb) from public;
revoke all on function public.delete_cafeteria_recipe(uuid) from public;
grant execute on function public.save_cafeteria_recipe(uuid,uuid,text,numeric,text,text,boolean,numeric,numeric,numeric,jsonb,jsonb) to authenticated;
grant execute on function public.delete_cafeteria_recipe(uuid) to authenticated;

-- 5) Aplicar un componente concreto al inventario y dejar auditoría.
create or replace function public.cafeteria_consume_component(
  p_order_item_id uuid,
  p_source_key text,
  p_source_label text,
  p_ingredient_product_id uuid,
  p_recipe_quantity numeric,
  p_recipe_unit text,
  p_required_recipe_quantity numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_item public.cafeteria_order_items%rowtype;
  v_order public.cafeteria_orders%rowtype;
  v_ingredient public.products%rowtype;
  v_stock_unit text;
  v_stock_quantity numeric;
  v_before numeric;
  v_after numeric;
  v_applied numeric;
  v_shortage numeric;
  v_unit_cost numeric;
  v_theoretical_cost numeric;
  v_applied_cost numeric;
  v_actor uuid := auth.uid();
begin
  select * into v_item from public.cafeteria_order_items where id = p_order_item_id;
  if not found then return jsonb_build_object('issue',1,'cost',0,'shortage',0); end if;
  select * into v_order from public.cafeteria_orders where id = v_item.order_id;

  select * into v_ingredient from public.products
  where id = p_ingredient_product_id and user_id = v_item.user_id for update;
  if not found then
    insert into public.cafeteria_inventory_issues(user_id,order_id,order_item_id,menu_product_id,menu_product_name,issue_type,details)
    values(v_item.user_id,v_item.order_id,v_item.id,v_item.product_id,v_item.product_name,'missing_component','No se encontró el componente: '||coalesce(p_source_label,'componente')||'.');
    return jsonb_build_object('issue',1,'cost',0,'shortage',0);
  end if;

  v_stock_unit := coalesce(nullif(trim(v_ingredient.stock_unit),''), nullif(trim(v_ingredient.size),''), trim(p_recipe_unit));
  v_stock_quantity := public.inventiq_convert_quantity(p_required_recipe_quantity, p_recipe_unit, v_stock_unit);
  if v_stock_quantity is null or v_stock_quantity <= 0 then
    insert into public.cafeteria_inventory_issues(user_id,order_id,order_item_id,menu_product_id,menu_product_name,issue_type,details)
    values(v_item.user_id,v_item.order_id,v_item.id,v_item.product_id,v_item.product_name,'incompatible_unit',
      v_ingredient.name||': '||coalesce(p_recipe_unit,'sin unidad')||' no coincide con '||coalesce(v_stock_unit,'la unidad de stock')||'.');
    return jsonb_build_object('issue',1,'cost',0,'shortage',0);
  end if;

  if exists (
    select 1 from public.cafeteria_inventory_consumptions
    where user_id = v_item.user_id and order_item_id = v_item.id and source_key = p_source_key
  ) then return jsonb_build_object('issue',0,'cost',0,'shortage',0,'duplicate',true); end if;

  v_before := greatest(coalesce(v_ingredient.stock,0),0);
  v_applied := least(v_before,v_stock_quantity);
  v_shortage := greatest(v_stock_quantity-v_before,0);
  v_after := greatest(v_before-v_stock_quantity,0);
  v_unit_cost := greatest(coalesce(v_ingredient.cost,0),0);
  v_theoretical_cost := v_stock_quantity*v_unit_cost;
  v_applied_cost := v_applied*v_unit_cost;

  update public.products
  set stock = v_after, status = case when v_after <= 0 then 'Inactivo' else 'Activo' end
  where id = v_ingredient.id and user_id = v_item.user_id;

  insert into public.cafeteria_inventory_consumptions(
    user_id,order_id,order_item_id,sale_id,menu_product_id,menu_product_name,
    source_key,source_label,ingredient_product_id,ingredient_name,
    recipe_quantity,recipe_unit,required_quantity,stock_quantity,applied_quantity,shortage_quantity,
    stock_unit,unit_cost,theoretical_cost,applied_cost,stock_before,stock_after,created_by
  ) values (
    v_item.user_id,v_item.order_id,v_item.id,v_order.sale_id,v_item.product_id,v_item.product_name,
    p_source_key,coalesce(p_source_label,'Componente'),v_ingredient.id,v_ingredient.name,
    p_recipe_quantity,p_recipe_unit,p_required_recipe_quantity,v_stock_quantity,v_applied,v_shortage,
    v_stock_unit,v_unit_cost,v_theoretical_cost,v_applied_cost,v_before,v_after,coalesce(v_actor,v_item.user_id)
  );

  if v_applied > 0 then
    insert into public.inventory_movements(
      user_id,product_id,product_name,movement_type,quantity,stock_before,stock_after,unit,
      reference_type,reference_id,notes,created_by
    ) values (
      v_item.user_id,v_ingredient.id,v_ingredient.name,'cafeteria_consumption',-v_applied,v_before,v_after,v_stock_unit,
      'cafeteria_order_item',v_item.id,v_item.product_name||' · '||coalesce(p_source_label,'receta'),coalesce(v_actor,v_item.user_id)
    );
  end if;

  return jsonb_build_object('issue',0,'cost',v_theoretical_cost,'appliedCost',v_applied_cost,'shortage',v_shortage);
end;
$$;

-- 6) Resolver receta base + tamaño/leche/jarabe/temperatura/shot al iniciar preparación.
create or replace function public.cafeteria_apply_order_item_inventory(p_order_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.restaurant_effective_user_id();
  v_item public.cafeteria_order_items%rowtype;
  v_recipe public.production_recipes%rowtype;
  v_component public.production_recipe_items%rowtype;
  v_rule public.cafeteria_recipe_variant_rules%rowtype;
  v_option_keys text[] := array[]::text[];
  v_scale numeric := 1;
  v_replacement uuid;
  v_required numeric;
  v_result jsonb;
  v_cost numeric := 0;
  v_shortages integer := 0;
  v_issues integer := 0;
  v_count integer := 0;
begin
  if auth.uid() is null or v_user_id is null then raise exception 'No existe una sesión activa.'; end if;

  select * into v_item from public.cafeteria_order_items
  where id = p_order_item_id and user_id = v_user_id for update;
  if not found then raise exception 'Producto del pedido no encontrado.'; end if;
  if v_item.inventory_consumed_at is not null or v_item.inventory_status in ('complete','partial','legacy') then
    return jsonb_build_object('processed',false,'reason','already_processed');
  end if;

  select * into v_recipe from public.production_recipes
  where user_id = v_user_id and output_product_id = v_item.product_id
    and recipe_context = 'cafeteria' and is_active = true
  order by version desc, updated_at desc limit 1;

  if not found then
    -- Los productos sin receta se consideran productos de inventario directo.
    -- Su stock ya fue descontado al registrar la venta y no deben generar una falsa incidencia en Barra.
    update public.cafeteria_order_items
    set inventory_status='legacy', inventory_consumed_at=coalesce(inventory_consumed_at,now()),
        inventory_cost=greatest(coalesce(inventory_cost,0),0), inventory_issue_count=0, inventory_shortage_count=0
    where id=v_item.id and user_id=v_user_id;
    return jsonb_build_object('processed',false,'reason','direct_stock','issues',0);
  end if;
  if coalesce(v_recipe.yield_quantity,0) <= 0 then
    insert into public.cafeteria_inventory_issues(user_id,order_id,order_item_id,menu_product_id,menu_product_name,issue_type,details)
    values(v_user_id,v_item.order_id,v_item.id,v_item.product_id,v_item.product_name,'invalid_yield','La receta tiene un rendimiento inválido.');
    update public.cafeteria_order_items set inventory_status='error',inventory_issue_count=1 where id=v_item.id;
    return jsonb_build_object('processed',false,'reason','invalid_yield','issues',1);
  end if;

  select coalesce(array_agg(value->>'id') filter (where nullif(value->>'id','') is not null),array[]::text[])
    into v_option_keys
  from jsonb_array_elements(coalesce(v_item.modifiers,'[]'::jsonb));

  select coalesce(max(scale_factor),1) into v_scale
  from public.cafeteria_recipe_variant_rules
  where user_id=v_user_id and recipe_id=v_recipe.id and is_active=true
    and option_type='size' and option_key=any(v_option_keys);
  v_scale := greatest(coalesce(v_scale,1),0.0001);

  for v_component in
    select * from public.production_recipe_items
    where user_id=v_user_id and recipe_id=v_recipe.id order by created_at,id
  loop
    v_replacement := null;
    if nullif(trim(v_component.component_key),'') is not null then
      select replacement_product_id into v_replacement
      from public.cafeteria_recipe_variant_rules
      where user_id=v_user_id and recipe_id=v_recipe.id and is_active=true
        and option_key=any(v_option_keys)
        and replace_component_key=v_component.component_key
        and replacement_product_id is not null
      order by case option_type when 'milk' then 1 when 'size' then 2 else 3 end, created_at
      limit 1;
    end if;

    v_required := (v_component.quantity * v_item.quantity / v_recipe.yield_quantity)
      * (1 + v_component.waste_percent/100)
      * (case when v_component.scale_with_size then v_scale else 1 end);

    v_result := public.cafeteria_consume_component(
      v_item.id,'base:'||v_component.id::text,
      case when v_replacement is not null then 'Reemplazo '||v_component.component_key else 'Receta base · '||v_component.component_key end,
      coalesce(v_replacement,v_component.ingredient_product_id),v_component.quantity,v_component.unit,v_required
    );
    v_cost := v_cost + coalesce((v_result->>'cost')::numeric,0);
    v_issues := v_issues + coalesce((v_result->>'issue')::integer,0);
    if coalesce((v_result->>'shortage')::numeric,0) > 0 then v_shortages := v_shortages + 1; end if;
    v_count := v_count + 1;
  end loop;

  for v_rule in
    select * from public.cafeteria_recipe_variant_rules
    where user_id=v_user_id and recipe_id=v_recipe.id and is_active=true
      and option_key=any(v_option_keys) and addition_product_id is not null and addition_quantity>0
    order by created_at,id
  loop
    v_required := v_rule.addition_quantity * v_item.quantity * (1 + v_rule.addition_waste_percent/100);
    v_result := public.cafeteria_consume_component(
      v_item.id,'variant:'||v_rule.id::text,v_rule.option_label,
      v_rule.addition_product_id,v_rule.addition_quantity,v_rule.addition_unit,v_required
    );
    v_cost := v_cost + coalesce((v_result->>'cost')::numeric,0);
    v_issues := v_issues + coalesce((v_result->>'issue')::integer,0);
    if coalesce((v_result->>'shortage')::numeric,0) > 0 then v_shortages := v_shortages + 1; end if;
    v_count := v_count + 1;
  end loop;

  v_cost := v_cost + ((greatest(coalesce(v_recipe.labor_cost,0),0)+greatest(coalesce(v_recipe.overhead_cost,0),0)) * v_item.quantity / v_recipe.yield_quantity);

  update public.cafeteria_order_items
  set inventory_status = case when v_issues>0 then 'error' when v_shortages>0 then 'partial' else 'complete' end,
      inventory_consumed_at = now(), inventory_cost=round(v_cost,4),
      inventory_shortage_count=v_shortages, inventory_issue_count=v_issues
  where id=v_item.id and user_id=v_user_id;

  return jsonb_build_object('processed',true,'components',v_count,'cost',round(v_cost,4),'shortages',v_shortages,'issues',v_issues);
exception when others then
  update public.cafeteria_order_items set inventory_status='error',inventory_issue_count=greatest(inventory_issue_count,1)
  where id=p_order_item_id and user_id=v_user_id;
  insert into public.cafeteria_inventory_issues(user_id,order_id,order_item_id,menu_product_id,menu_product_name,issue_type,details)
  select user_id,order_id,id,product_id,product_name,'processing_error',sqlerrm
  from public.cafeteria_order_items where id=p_order_item_id and user_id=v_user_id;
  return jsonb_build_object('processed',false,'reason','processing_error','message',sqlerrm);
end;
$$;

revoke all on function public.cafeteria_consume_component(uuid,text,text,uuid,numeric,text,numeric) from public;
revoke all on function public.cafeteria_consume_component(uuid,text,text,uuid,numeric,text,numeric) from authenticated;
revoke all on function public.cafeteria_apply_order_item_inventory(uuid) from public;
revoke all on function public.cafeteria_apply_order_item_inventory(uuid) from authenticated;
-- El consumo solo se invoca internamente desde las funciones controladas de estado de Barra.

-- 7) Reemplazar los estados de barra para consumir inventario exactamente al comenzar la preparación.
create or replace function public.cafeteria_set_order_item_status(p_item_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.restaurant_effective_user_id();
  v_status text := lower(trim(coalesce(p_status,'')));
  v_before public.cafeteria_order_items%rowtype;
  v_item public.cafeteria_order_items%rowtype;
  v_order_status text;
  v_inventory jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then raise exception 'No existe una sesión activa.'; end if;
  if public.restaurant_is_employee_session()
     and not (public.restaurant_employee_has_permission('cafe.queue.manage') or public.restaurant_employee_has_permission('sales.manage')) then
    raise exception 'Tu perfil no tiene permiso para gestionar la barra.';
  end if;
  if v_status not in ('recibido','preparacion','listo','entregado','cancelado') then raise exception 'Estado no válido.'; end if;

  select * into v_before from public.cafeteria_order_items where id=p_item_id and user_id=v_user_id;
  if not found then raise exception 'Producto del pedido no encontrado.'; end if;
  if v_before.inventory_consumed_at is not null and v_status='recibido' then
    raise exception 'El producto ya inició preparación y su consumo fue registrado; no puede volver a Recibido.';
  end if;

  update public.cafeteria_order_items
  set status=v_status,
      started_at=case when v_status in ('preparacion','listo','entregado') then coalesce(started_at,now()) else started_at end,
      ready_at=case when v_status in ('listo','entregado') then coalesce(ready_at,now()) else ready_at end,
      delivered_at=case when v_status='entregado' then coalesce(delivered_at,now()) else delivered_at end
  where id=p_item_id and user_id=v_user_id returning * into v_item;

  if v_status in ('preparacion','listo','entregado') and v_item.inventory_consumed_at is null then
    v_inventory := public.cafeteria_apply_order_item_inventory(v_item.id);
  end if;

  select case
    when bool_and(status in ('entregado','cancelado')) then 'entregado'
    when bool_and(status in ('listo','entregado','cancelado')) then 'listo'
    when bool_or(status='preparacion') then 'preparacion'
    else 'recibido'
  end into v_order_status
  from public.cafeteria_order_items where order_id=v_item.order_id;

  update public.cafeteria_orders
  set status=coalesce(v_order_status,status),
      started_at=case when v_order_status in ('preparacion','listo','entregado') then coalesce(started_at,now()) else started_at end,
      ready_at=case when v_order_status in ('listo','entregado') then coalesce(ready_at,now()) else ready_at end,
      delivered_at=case when v_order_status='entregado' then coalesce(delivered_at,now()) else delivered_at end
  where id=v_item.order_id and user_id=v_user_id;

  return jsonb_build_object('id',v_item.id,'orderId',v_item.order_id,'status',v_status,'orderStatus',v_order_status,'inventory',v_inventory);
end;
$$;

create or replace function public.cafeteria_set_order_status(p_order_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.restaurant_effective_user_id();
  v_status text := lower(trim(coalesce(p_status,'')));
  v_order public.cafeteria_orders%rowtype;
  v_item record;
  v_processed integer := 0;
begin
  if auth.uid() is null then raise exception 'No existe una sesión activa.'; end if;
  if public.restaurant_is_employee_session()
     and not (public.restaurant_employee_has_permission('cafe.queue.manage') or public.restaurant_employee_has_permission('sales.manage')) then
    raise exception 'Tu perfil no tiene permiso para gestionar la barra.';
  end if;
  if v_status not in ('recibido','preparacion','listo','entregado','cancelado') then raise exception 'Estado no válido.'; end if;

  select * into v_order from public.cafeteria_orders where id=p_order_id and user_id=v_user_id;
  if not found then raise exception 'Pedido no encontrado.'; end if;
  if v_status='recibido' and exists(select 1 from public.cafeteria_order_items where order_id=p_order_id and inventory_consumed_at is not null) then
    raise exception 'El pedido ya tiene productos en preparación y no puede volver completo a Recibido.';
  end if;

  update public.cafeteria_orders
  set status=v_status,
      started_at=case when v_status in ('preparacion','listo','entregado') then coalesce(started_at,now()) else started_at end,
      ready_at=case when v_status in ('listo','entregado') then coalesce(ready_at,now()) else ready_at end,
      delivered_at=case when v_status='entregado' then coalesce(delivered_at,now()) else delivered_at end
  where id=p_order_id and user_id=v_user_id returning * into v_order;

  update public.cafeteria_order_items
  set status=v_status,
      started_at=case when v_status in ('preparacion','listo','entregado') then coalesce(started_at,now()) else started_at end,
      ready_at=case when v_status in ('listo','entregado') then coalesce(ready_at,now()) else ready_at end,
      delivered_at=case when v_status='entregado' then coalesce(delivered_at,now()) else delivered_at end
  where order_id=p_order_id and user_id=v_user_id and status<>'cancelado';

  if v_status in ('preparacion','listo','entregado') then
    for v_item in select id from public.cafeteria_order_items
      where order_id=p_order_id and user_id=v_user_id and status<>'cancelado' and inventory_consumed_at is null
    loop
      perform public.cafeteria_apply_order_item_inventory(v_item.id);
      v_processed := v_processed+1;
    end loop;
  end if;

  return jsonb_build_object('id',v_order.id,'status',v_status,'inventoryItemsProcessed',v_processed);
end;
$$;

revoke all on function public.cafeteria_set_order_status(uuid,text) from public;
revoke all on function public.cafeteria_set_order_item_status(uuid,text) from public;
grant execute on function public.cafeteria_set_order_status(uuid,text) to authenticated;
grant execute on function public.cafeteria_set_order_item_status(uuid,text) to authenticated;

-- Las filas creadas antes de esta fase quedan pendientes; no se descuenta inventario retroactivamente.
