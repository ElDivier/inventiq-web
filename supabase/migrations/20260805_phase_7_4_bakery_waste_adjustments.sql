-- INVENTIQ · Fase 7.4 · Mermas y ajustes de inventario para panadería
-- Ejecutar una sola vez en Supabase > SQL Editor.
-- Migración no destructiva: no elimina ni reescribe registros existentes.

create extension if not exists pgcrypto;

create table if not exists public.bakery_stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  production_batch_id uuid references public.production_batches(id) on delete set null,
  adjustment_kind text not null check (adjustment_kind in ('waste', 'physical_count')),
  reason_code text not null check (char_length(trim(reason_code)) between 2 and 80),
  reason_label text not null check (char_length(trim(reason_label)) between 2 and 160),
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

create index if not exists bakery_stock_adjustments_user_date_idx
  on public.bakery_stock_adjustments (user_id, event_date desc, created_at desc);

create index if not exists bakery_stock_adjustments_product_idx
  on public.bakery_stock_adjustments (product_id, created_at desc);

create index if not exists bakery_stock_adjustments_batch_idx
  on public.bakery_stock_adjustments (production_batch_id)
  where production_batch_id is not null;

create index if not exists bakery_stock_adjustments_kind_idx
  on public.bakery_stock_adjustments (user_id, adjustment_kind, event_date desc);

comment on table public.bakery_stock_adjustments is
'Registro inmutable de mermas y diferencias detectadas mediante conteo físico en negocios tipo panadería.';

comment on column public.bakery_stock_adjustments.quantity_reported is
'En una merma corresponde a la cantidad retirada; en un conteo físico corresponde a la existencia real encontrada.';

comment on column public.bakery_stock_adjustments.quantity_delta is
'Diferencia firmada aplicada al inventario: negativa para salidas y positiva para entradas.';

alter table public.bakery_stock_adjustments enable row level security;

drop policy if exists "bakery_stock_adjustments_owner_select" on public.bakery_stock_adjustments;
create policy "bakery_stock_adjustments_owner_select"
on public.bakery_stock_adjustments
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "bakery_stock_adjustments_owner_insert" on public.bakery_stock_adjustments;
create policy "bakery_stock_adjustments_owner_insert"
on public.bakery_stock_adjustments
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
  and (
    production_batch_id is null
    or exists (
      select 1
      from public.production_batches batch
      where batch.id = production_batch_id
        and batch.user_id = auth.uid()
    )
  )
);

-- No se habilitan update/delete: el historial queda inmutable.

grant select, insert on public.bakery_stock_adjustments to authenticated;

create or replace function public.register_bakery_stock_adjustment(
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
security invoker
set search_path = public
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
  v_quantity_reported numeric;
  v_unit text;
  v_unit_cost numeric;
  v_cost_impact numeric;
  v_movement_type text;
  v_batch_code text;
begin
  if v_user_id is null then
    raise exception 'No existe una sesión autenticada.';
  end if;

  if p_product_id is null then
    raise exception 'Selecciona el producto o insumo.';
  end if;

  if v_kind not in ('waste', 'physical_count') then
    raise exception 'El tipo de registro no es válido.';
  end if;

  if nullif(trim(coalesce(p_reason_code, '')), '') is null
     or nullif(trim(coalesce(p_reason_label, '')), '') is null then
    raise exception 'Selecciona el motivo del registro.';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
    and user_id = v_user_id
  for update;

  if v_product.id is null then
    raise exception 'El producto no existe o no pertenece al negocio actual.';
  end if;

  if coalesce(v_product.product_type, 'sale_product') = 'service' then
    raise exception 'Los servicios no manejan existencias y no pueden ajustarse.';
  end if;

  v_stock_before := coalesce(v_product.stock, 0);
  v_quantity_reported := coalesce(p_quantity, 0);
  v_unit := coalesce(nullif(trim(v_product.stock_unit), ''), nullif(trim(v_product.size), ''), 'unidad');
  v_unit_cost := greatest(coalesce(v_product.cost, 0), 0);

  if v_kind = 'waste' then
    if v_quantity_reported <= 0 then
      raise exception 'La cantidad de la merma debe ser mayor a cero.';
    end if;

    v_quantity_delta := -v_quantity_reported;
    v_stock_after := v_stock_before + v_quantity_delta;
    v_movement_type := 'waste';

    if v_stock_after < 0 then
      raise exception 'La merma (%) supera el stock disponible (% %).',
        v_quantity_reported, v_stock_before, v_unit;
    end if;
  else
    if p_quantity is null or v_quantity_reported < 0 then
      raise exception 'La cantidad encontrada no puede ser negativa.';
    end if;

    v_stock_after := v_quantity_reported;
    v_quantity_delta := v_stock_after - v_stock_before;

    if abs(v_quantity_delta) < 0.000001 then
      raise exception 'El conteo coincide con el stock actual; no existe una diferencia que registrar.';
    end if;

    v_movement_type := case when v_quantity_delta > 0 then 'adjustment_in' else 'adjustment_out' end;
  end if;

  if p_batch_id is not null then
    select * into v_batch
    from public.production_batches
    where id = p_batch_id
      and user_id = v_user_id;

    if v_batch.id is null then
      raise exception 'El lote seleccionado no existe o no pertenece al negocio actual.';
    end if;

    if v_batch.output_product_id <> v_product.id
       and not exists (
         select 1
         from public.production_batch_items batch_item
         where batch_item.batch_id = v_batch.id
           and batch_item.user_id = v_user_id
           and batch_item.ingredient_product_id = v_product.id
       ) then
      raise exception 'El producto seleccionado no está relacionado con el lote indicado.';
    end if;

    v_batch_code := v_batch.batch_code;
  end if;

  v_cost_impact := abs(v_quantity_delta) * v_unit_cost;

  update public.products
  set
    stock = v_stock_after,
    status = case when v_stock_after <= 0 then 'Inactivo' else 'Activo' end
  where id = v_product.id
    and user_id = v_user_id;

  insert into public.bakery_stock_adjustments (
    id,
    user_id,
    product_id,
    production_batch_id,
    adjustment_kind,
    reason_code,
    reason_label,
    product_name,
    product_type,
    quantity_reported,
    quantity_delta,
    stock_before,
    stock_after,
    unit,
    unit_cost,
    cost_impact,
    event_date,
    batch_code,
    notes,
    created_by
  ) values (
    v_adjustment_id,
    v_user_id,
    v_product.id,
    p_batch_id,
    v_kind,
    trim(p_reason_code),
    trim(p_reason_label),
    v_product.name,
    coalesce(v_product.product_type, 'sale_product'),
    v_quantity_reported,
    v_quantity_delta,
    v_stock_before,
    v_stock_after,
    v_unit,
    v_unit_cost,
    v_cost_impact,
    coalesce(p_event_date, current_date),
    v_batch_code,
    nullif(trim(coalesce(p_notes, '')), ''),
    v_user_id
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
    v_product.id,
    v_product.name,
    v_movement_type,
    v_quantity_delta,
    v_stock_before,
    v_stock_after,
    v_unit,
    'bakery_stock_adjustment',
    v_adjustment_id,
    trim(p_reason_label) || case when v_batch_code is not null then ' · Lote ' || v_batch_code else '' end,
    v_user_id
  );

  return jsonb_build_object(
    'adjustment_id', v_adjustment_id,
    'product_id', v_product.id,
    'product_name', v_product.name,
    'adjustment_kind', v_kind,
    'quantity_reported', v_quantity_reported,
    'quantity_delta', v_quantity_delta,
    'stock_before', v_stock_before,
    'stock_after', v_stock_after,
    'unit', v_unit,
    'unit_cost', round(v_unit_cost, 6),
    'cost_impact', round(v_cost_impact, 4),
    'batch_code', v_batch_code
  );
end;
$$;

revoke all on function public.register_bakery_stock_adjustment(
  uuid, text, numeric, date, text, text, text, uuid
) from public;

grant execute on function public.register_bakery_stock_adjustment(
  uuid, text, numeric, date, text, text, text, uuid
) to authenticated;
