-- INVENTIQ · Fase 9.3 · Barra avanzada y entrega para Cafeterías
-- No destructiva. Agrega prioridad, tiempo objetivo por ítem y flujo de llamado/entrega.

alter table public.cafeteria_orders
  add column if not exists priority boolean not null default false,
  add column if not exists priority_note text not null default '',
  add column if not exists called_at timestamptz,
  add column if not exists call_count integer not null default 0;

alter table public.cafeteria_order_items
  add column if not exists target_minutes integer not null default 0;

alter table public.cafeteria_orders
  drop constraint if exists cafeteria_orders_call_count_check;
alter table public.cafeteria_orders
  add constraint cafeteria_orders_call_count_check check (call_count >= 0);

alter table public.cafeteria_order_items
  drop constraint if exists cafeteria_order_items_target_minutes_check;
alter table public.cafeteria_order_items
  add constraint cafeteria_order_items_target_minutes_check check (target_minutes >= 0 and target_minutes <= 240);

create index if not exists cafeteria_orders_priority_status_idx
  on public.cafeteria_orders(user_id, priority desc, status, received_at);

-- Completa tiempo objetivo en pedidos existentes usando la configuración actual del producto.
update public.cafeteria_order_items as item
set target_minutes = case
  when coalesce(product.product_metadata->>'preparationMinutes','') ~ '^[0-9]+$'
    then least(240, greatest(0, (product.product_metadata->>'preparationMinutes')::integer))
  else 0
end
from public.products as product
where item.product_id = product.id
  and item.user_id = product.user_id
  and item.target_minutes = 0;

-- Crea el ticket guardando una fotografía del tiempo objetivo de preparación.
create or replace function public.cafeteria_create_order_from_sale(
  p_sale_id uuid,
  p_order_type text,
  p_order_reference text,
  p_customer_name text,
  p_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.restaurant_effective_user_id();
  v_sale public.sales%rowtype;
  v_order_id uuid;
  v_number integer;
  v_code text;
  v_item jsonb;
  v_product public.products%rowtype;
  v_metadata jsonb;
  v_station text;
  v_target integer;
begin
  if auth.uid() is null or v_user_id is null then raise exception 'No existe una sesión activa.'; end if;
  perform public.restaurant_require_permission('sales.manage');

  if not exists (select 1 from public.profiles where id = v_user_id and business_type = 'cafeteria') then
    raise exception 'La cola de barra solo está disponible para cuentas Cafetería.';
  end if;

  select * into v_sale from public.sales where id = p_sale_id and user_id = v_user_id;
  if not found then raise exception 'Venta no encontrada.'; end if;

  select id, order_number, order_code into v_order_id, v_number, v_code
  from public.cafeteria_orders where sale_id = p_sale_id limit 1;
  if found then
    return jsonb_build_object('id', v_order_id, 'number', v_number, 'code', v_code);
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user_id::text || current_date::text));
  select coalesce(max(order_number), 0) + 1 into v_number
  from public.cafeteria_orders where user_id = v_user_id and order_date = current_date;
  v_code := 'CAF-' || to_char(current_date, 'YYMMDD') || '-' || lpad(v_number::text, 3, '0');

  insert into public.cafeteria_orders (
    user_id, sale_id, order_date, order_number, order_code, order_type,
    order_reference, customer_name, notes, total
  ) values (
    v_user_id, p_sale_id, current_date, v_number, v_code,
    case when lower(coalesce(p_order_type,'')) in ('local','takeaway','delivery') then lower(p_order_type) else 'local' end,
    trim(coalesce(p_order_reference,'')), trim(coalesce(p_customer_name,'')), trim(coalesce(p_notes,'')), coalesce(v_sale.total,0)
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    select * into v_product from public.products
    where id = nullif(v_item->>'productId','')::uuid and user_id = v_user_id;

    v_metadata := coalesce(v_product.product_metadata, '{}'::jsonb);
    v_station := coalesce(nullif(v_item->>'station',''), nullif(v_metadata->>'station',''), 'barra');
    v_target := case
      when coalesce(v_metadata->>'preparationMinutes','') ~ '^[0-9]+$'
        then least(240, greatest(0, (v_metadata->>'preparationMinutes')::integer))
      else 0
    end;

    insert into public.cafeteria_order_items (
      user_id, order_id, product_id, product_name, station, quantity, unit_price,
      variant_summary, modifiers, notes, target_minutes
    ) values (
      v_user_id,
      v_order_id,
      case when v_product.id is null then null else v_product.id end,
      coalesce(nullif(v_item->>'baseProduct',''), nullif(v_item->>'product',''), coalesce(v_product.name,'Producto')),
      v_station,
      greatest(0.001, coalesce((v_item->>'quantity')::numeric, 1)),
      greatest(0, coalesce((v_item->>'price')::numeric, 0)),
      coalesce(v_item->>'variantSummary',''),
      case when jsonb_typeof(v_item->'modifiers') = 'array' then v_item->'modifiers' else '[]'::jsonb end,
      coalesce(v_item->>'notes',''),
      v_target
    );
  end loop;

  return jsonb_build_object('id', v_order_id, 'number', v_number, 'code', v_code);
end;
$$;

-- Prioridad visible para barra/cocina. No modifica precios ni inventario.
create or replace function public.cafeteria_set_order_priority(
  p_order_id uuid,
  p_priority boolean,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.restaurant_effective_user_id();
  v_order public.cafeteria_orders%rowtype;
begin
  if auth.uid() is null or v_user_id is null then raise exception 'No existe una sesión activa.'; end if;
  if public.restaurant_is_employee_session()
     and not (public.restaurant_employee_has_permission('cafe.queue.manage') or public.restaurant_employee_has_permission('sales.manage')) then
    raise exception 'Tu perfil no tiene permiso para priorizar pedidos.';
  end if;

  update public.cafeteria_orders
  set priority = coalesce(p_priority,false),
      priority_note = case when coalesce(p_priority,false) then left(trim(coalesce(p_note,'')),180) else '' end
  where id = p_order_id and user_id = v_user_id
  returning * into v_order;
  if not found then raise exception 'Pedido no encontrado.'; end if;

  return jsonb_build_object('id',v_order.id,'priority',v_order.priority,'priorityNote',v_order.priority_note);
end;
$$;

-- Registra el llamado del pedido listo en el punto de entrega.
create or replace function public.cafeteria_call_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.restaurant_effective_user_id();
  v_order public.cafeteria_orders%rowtype;
begin
  if auth.uid() is null or v_user_id is null then raise exception 'No existe una sesión activa.'; end if;
  if public.restaurant_is_employee_session()
     and not (public.restaurant_employee_has_permission('cafe.queue.manage') or public.restaurant_employee_has_permission('sales.manage')) then
    raise exception 'Tu perfil no tiene permiso para gestionar la entrega.';
  end if;

  update public.cafeteria_orders
  set called_at = now(), call_count = call_count + 1
  where id = p_order_id and user_id = v_user_id and status = 'listo'
  returning * into v_order;
  if not found then raise exception 'Solo se pueden llamar pedidos que estén listos.'; end if;

  return jsonb_build_object('id',v_order.id,'calledAt',v_order.called_at,'callCount',v_order.call_count);
end;
$$;

revoke all on function public.cafeteria_set_order_priority(uuid,boolean,text) from public;
revoke all on function public.cafeteria_call_order(uuid) from public;
grant execute on function public.cafeteria_set_order_priority(uuid,boolean,text) to authenticated;
grant execute on function public.cafeteria_call_order(uuid) to authenticated;

-- Realtime ya se habilitó en 9.1. Se mantiene idempotente para instalaciones incompletas.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='cafeteria_orders'
  ) then alter publication supabase_realtime add table public.cafeteria_orders; end if;
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='cafeteria_order_items'
  ) then alter publication supabase_realtime add table public.cafeteria_order_items; end if;
end $$;
