-- INVENTIQ · Fase 9.6 · Cierre operativo de Cafeterías
-- Ejecutar después de 20260807_phase_9_5_cafeteria_reports_security.sql
--
-- Objetivos:
-- 1) Serializar cambios de estado para trabajo simultáneo en varias tablets.
-- 2) Evitar regresiones de estado y cancelaciones aisladas que desalineen Venta ↔ Barra.
-- 3) Anular ventas de cafetería de forma atómica, restaurando únicamente stock directo
--    que todavía no había iniciado preparación y conservando consumos de recetas ya aplicados.
-- 4) Mantener Realtime idempotente para pedidos e inventario.
--
-- No elimina información existente.

-- -----------------------------------------------------------------------------
-- 0. Perfiles de supervisión ya existentes: asegurar acceso operativo a Barra.
-- -----------------------------------------------------------------------------
update public.restaurant_staff_profiles as staff
set permissions = coalesce(staff.permissions, '[]'::jsonb) || '["cafe.queue.manage"]'::jsonb
from public.profiles as profile
where profile.id = staff.user_id
  and profile.business_type = 'cafeteria'
  and staff.role in ('administrador','supervisor')
  and not (coalesce(staff.permissions, '[]'::jsonb) @> '["cafe.queue.manage"]'::jsonb);

create or replace function public.cafeteria_guard_staff_permissions()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.role in ('administrador','supervisor')
     and exists (select 1 from public.profiles where id=new.user_id and business_type='cafeteria')
     and not (coalesce(new.permissions,'[]'::jsonb) @> '["cafe.queue.manage"]'::jsonb) then
    new.permissions := coalesce(new.permissions,'[]'::jsonb) || '["cafe.queue.manage"]'::jsonb;
  end if;
  return new;
end;
$$;

drop trigger if exists cafeteria_staff_permissions_guard on public.restaurant_staff_profiles;
create trigger cafeteria_staff_permissions_guard
before insert or update of role,permissions on public.restaurant_staff_profiles
for each row execute function public.cafeteria_guard_staff_permissions();

-- -----------------------------------------------------------------------------
-- 1. Estados de pedido: secuencia protegida y consumo de inventario sin regresiones.
-- -----------------------------------------------------------------------------
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
  if auth.uid() is null or v_user_id is null then
    raise exception 'No existe una sesión activa.';
  end if;

  if public.restaurant_is_employee_session()
     and not (
       public.restaurant_employee_has_permission('cafe.queue.manage')
       or public.restaurant_employee_has_permission('sales.manage')
     ) then
    raise exception 'Tu perfil no tiene permiso para gestionar la barra.';
  end if;

  if v_status not in ('recibido','preparacion','listo','entregado','cancelado') then
    raise exception 'Estado no válido.';
  end if;

  -- La anulación comercial debe hacerse desde Ventas para mantener venta, stock y ticket alineados.
  if v_status = 'cancelado' then
    raise exception 'Para cancelar un pedido de cafetería, anula la venta desde Ventas.';
  end if;

  -- El bloqueo de la cabecera serializa los cambios de todas las tablets para este pedido.
  select * into v_order
  from public.cafeteria_orders
  where id = p_order_id and user_id = v_user_id
  for update;

  if not found then raise exception 'Pedido no encontrado.'; end if;
  if v_order.status = 'cancelado' then raise exception 'El pedido está cancelado.'; end if;

  -- Repetir el mismo estado es idempotente y no vuelve a tocar consumos.
  if v_order.status = v_status then
    return jsonb_build_object('id',v_order.id,'status',v_order.status,'unchanged',true,'inventoryItemsProcessed',0);
  end if;

  if v_order.status = 'entregado' then
    raise exception 'El pedido ya fue entregado y no puede regresar a un estado anterior.';
  end if;

  if v_status = 'recibido' then
    raise exception 'Un pedido que ya avanzó no puede volver a Recibido.';
  end if;

  if v_status = 'preparacion' and v_order.status <> 'recibido' then
    raise exception 'Solo un pedido recibido puede pasar a preparación.';
  end if;

  if v_status = 'listo' and v_order.status not in ('recibido','preparacion') then
    raise exception 'Solo un pedido recibido o en preparación puede marcarse como listo.';
  end if;

  if v_status = 'entregado' and v_order.status <> 'listo' then
    raise exception 'Solo un pedido listo puede marcarse como entregado.';
  end if;

  update public.cafeteria_orders
  set status = v_status,
      started_at = case when v_status in ('preparacion','listo','entregado') then coalesce(started_at,now()) else started_at end,
      ready_at = case when v_status in ('listo','entregado') then coalesce(ready_at,now()) else ready_at end,
      delivered_at = case when v_status='entregado' then coalesce(delivered_at,now()) else delivered_at end
  where id=p_order_id and user_id=v_user_id
  returning * into v_order;

  -- Nunca se hace retroceder un ítem que ya está más adelantado que la cabecera.
  if v_status = 'preparacion' then
    update public.cafeteria_order_items
    set status='preparacion', started_at=coalesce(started_at,now())
    where order_id=p_order_id and user_id=v_user_id and status='recibido';
  elsif v_status = 'listo' then
    update public.cafeteria_order_items
    set status='listo',
        started_at=coalesce(started_at,now()),
        ready_at=coalesce(ready_at,now())
    where order_id=p_order_id and user_id=v_user_id and status in ('recibido','preparacion');
  elsif v_status = 'entregado' then
    update public.cafeteria_order_items
    set status='entregado',
        started_at=coalesce(started_at,now()),
        ready_at=coalesce(ready_at,now()),
        delivered_at=coalesce(delivered_at,now())
    where order_id=p_order_id and user_id=v_user_id and status='listo';
  end if;

  if v_status in ('preparacion','listo','entregado') then
    for v_item in
      select id
      from public.cafeteria_order_items
      where order_id=p_order_id
        and user_id=v_user_id
        and status <> 'cancelado'
        and inventory_consumed_at is null
      order by created_at,id
    loop
      perform public.cafeteria_apply_order_item_inventory(v_item.id);
      v_processed := v_processed + 1;
    end loop;
  end if;

  return jsonb_build_object(
    'id',v_order.id,
    'status',v_status,
    'unchanged',false,
    'inventoryItemsProcessed',v_processed
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Estados por ítem: bloqueo de cabecera para evitar carreras entre tablets.
-- -----------------------------------------------------------------------------
create or replace function public.cafeteria_set_order_item_status(p_item_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.restaurant_effective_user_id();
  v_status text := lower(trim(coalesce(p_status,'')));
  v_order_id uuid;
  v_order public.cafeteria_orders%rowtype;
  v_before public.cafeteria_order_items%rowtype;
  v_item public.cafeteria_order_items%rowtype;
  v_order_status text;
  v_inventory jsonb := '{}'::jsonb;
begin
  if auth.uid() is null or v_user_id is null then raise exception 'No existe una sesión activa.'; end if;

  if public.restaurant_is_employee_session()
     and not (
       public.restaurant_employee_has_permission('cafe.queue.manage')
       or public.restaurant_employee_has_permission('sales.manage')
     ) then
    raise exception 'Tu perfil no tiene permiso para gestionar la barra.';
  end if;

  if v_status not in ('recibido','preparacion','listo','entregado','cancelado') then raise exception 'Estado no válido.'; end if;
  if v_status='cancelado' then raise exception 'Para cancelar productos de una venta de cafetería, anula la venta desde Ventas.'; end if;

  select order_id into v_order_id
  from public.cafeteria_order_items
  where id=p_item_id and user_id=v_user_id;
  if v_order_id is null then raise exception 'Producto del pedido no encontrado.'; end if;

  -- Todas las actualizaciones de ítems del mismo pedido pasan por este bloqueo común.
  select * into v_order
  from public.cafeteria_orders
  where id=v_order_id and user_id=v_user_id
  for update;
  if not found then raise exception 'Pedido no encontrado.'; end if;
  if v_order.status in ('entregado','cancelado') then raise exception 'El pedido ya está cerrado.'; end if;

  select * into v_before
  from public.cafeteria_order_items
  where id=p_item_id and user_id=v_user_id
  for update;
  if not found then raise exception 'Producto del pedido no encontrado.'; end if;
  if v_before.status='cancelado' then raise exception 'El producto está cancelado.'; end if;

  if v_before.status = v_status then
    return jsonb_build_object('id',v_before.id,'orderId',v_before.order_id,'status',v_before.status,'orderStatus',v_order.status,'unchanged',true,'inventory','{}'::jsonb);
  end if;

  if v_before.status='entregado' then raise exception 'El producto ya fue entregado.'; end if;
  if v_status='recibido' then raise exception 'Un producto que ya avanzó no puede volver a Recibido.'; end if;
  if v_status='preparacion' and v_before.status <> 'recibido' then raise exception 'Solo un producto recibido puede pasar a preparación.'; end if;
  if v_status='listo' and v_before.status not in ('recibido','preparacion') then raise exception 'Solo un producto recibido o en preparación puede marcarse como listo.'; end if;
  if v_status='entregado' and v_before.status <> 'listo' then raise exception 'Solo un producto listo puede marcarse como entregado.'; end if;

  update public.cafeteria_order_items
  set status=v_status,
      started_at=case when v_status in ('preparacion','listo','entregado') then coalesce(started_at,now()) else started_at end,
      ready_at=case when v_status in ('listo','entregado') then coalesce(ready_at,now()) else ready_at end,
      delivered_at=case when v_status='entregado' then coalesce(delivered_at,now()) else delivered_at end
  where id=p_item_id and user_id=v_user_id
  returning * into v_item;

  if v_status in ('preparacion','listo','entregado') and v_item.inventory_consumed_at is null then
    v_inventory := public.cafeteria_apply_order_item_inventory(v_item.id);
  end if;

  select case
    when count(*) filter (where status <> 'cancelado') = 0 then 'cancelado'
    when bool_and(status in ('entregado','cancelado')) then 'entregado'
    when bool_and(status in ('listo','entregado','cancelado')) then 'listo'
    when bool_or(status in ('preparacion','listo','entregado')) then 'preparacion'
    else 'recibido'
  end into v_order_status
  from public.cafeteria_order_items
  where order_id=v_item.order_id and user_id=v_user_id;

  update public.cafeteria_orders
  set status=coalesce(v_order_status,status),
      started_at=case when v_order_status in ('preparacion','listo','entregado') then coalesce(started_at,now()) else started_at end,
      ready_at=case when v_order_status in ('listo','entregado') then coalesce(ready_at,now()) else ready_at end,
      delivered_at=case when v_order_status='entregado' then coalesce(delivered_at,now()) else delivered_at end
  where id=v_item.order_id and user_id=v_user_id;

  return jsonb_build_object(
    'id',v_item.id,
    'orderId',v_item.order_id,
    'status',v_status,
    'orderStatus',v_order_status,
    'unchanged',false,
    'inventory',v_inventory
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Prioridad: no se modifican pedidos ya cerrados.
-- -----------------------------------------------------------------------------
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

  select * into v_order
  from public.cafeteria_orders
  where id=p_order_id and user_id=v_user_id
  for update;
  if not found then raise exception 'Pedido no encontrado.'; end if;
  if v_order.status in ('entregado','cancelado') then raise exception 'No se puede cambiar la prioridad de un pedido cerrado.'; end if;

  update public.cafeteria_orders
  set priority=coalesce(p_priority,false),
      priority_note=case when coalesce(p_priority,false) then left(trim(coalesce(p_note,'')),180) else '' end
  where id=p_order_id and user_id=v_user_id
  returning * into v_order;

  return jsonb_build_object('id',v_order.id,'priority',v_order.priority,'priorityNote',v_order.priority_note);
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Anulación transaccional de una venta de cafetería.
-- -----------------------------------------------------------------------------
create or replace function public.cancel_cafeteria_sale(p_sale_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := public.restaurant_effective_user_id();
  v_sale public.sales%rowtype;
  v_order public.cafeteria_orders%rowtype;
  v_restore record;
  v_product public.products%rowtype;
  v_stock_before numeric;
  v_stock_after numeric;
  v_stock_unit text;
  v_restored_products integer := 0;
  v_restored_quantity numeric := 0;
  v_consumption_records integer := 0;
begin
  if auth.uid() is null or v_user_id is null then raise exception 'No existe una sesión activa.'; end if;
  perform public.restaurant_require_permission('cancellations.manage');

  if not exists (
    select 1 from public.profiles where id=v_user_id and business_type='cafeteria'
  ) then
    raise exception 'Esta función solo está disponible para cuentas Cafetería.';
  end if;

  select * into v_sale
  from public.sales
  where id=p_sale_id and user_id=v_user_id
  for update;
  if not found then raise exception 'Venta no encontrada.'; end if;

  if v_sale.status='Anulada' then
    return jsonb_build_object(
      'already_cancelled',true,
      'sale_id',v_sale.id,
      'sale_code',v_sale.code,
      'restored_products',0,
      'restored_quantity',0,
      'consumption_records',0
    );
  end if;

  select * into v_order
  from public.cafeteria_orders
  where sale_id=v_sale.id and user_id=v_user_id
  for update;

  if v_order.id is not null then
    select count(*)::integer into v_consumption_records
    from public.cafeteria_inventory_consumptions
    where order_id=v_order.id and user_id=v_user_id;

    -- Solo se devuelve stock directo de líneas que jamás comenzaron preparación.
    -- Los productos con receta no descontaron el producto terminado al venderse y
    -- los ingredientes ya consumidos tampoco se revierten automáticamente.
    for v_restore in
      select coi.product_id, sum(coi.quantity)::numeric as quantity
      from public.cafeteria_order_items coi
      where coi.order_id=v_order.id
        and coi.user_id=v_user_id
        and coi.product_id is not null
        and coi.status='recibido'
        and coi.inventory_status='pending'
        and not exists (
          select 1
          from public.production_recipes pr
          where pr.user_id=v_user_id
            and pr.output_product_id=coi.product_id
            and pr.recipe_context='cafeteria'
            and pr.is_active=true
        )
      group by coi.product_id
    loop
      select * into v_product
      from public.products
      where id=v_restore.product_id and user_id=v_user_id
      for update;

      if v_product.id is null or coalesce(v_product.product_type,'sale_product')='service' then
        continue;
      end if;

      v_stock_before := coalesce(v_product.stock,0);
      v_stock_after := v_stock_before + greatest(coalesce(v_restore.quantity,0),0);
      v_stock_unit := coalesce(nullif(trim(v_product.stock_unit),''), nullif(trim(v_product.size),''), 'unidad');

      update public.products
      set stock=v_stock_after, status='Activo'
      where id=v_product.id and user_id=v_user_id;

      insert into public.inventory_movements(
        user_id,product_id,product_name,movement_type,quantity,stock_before,stock_after,
        unit,reference_type,reference_id,notes,created_by
      ) values (
        v_user_id,v_product.id,v_product.name,'sale_return',greatest(coalesce(v_restore.quantity,0),0),
        v_stock_before,v_stock_after,v_stock_unit,'cafeteria_sale_cancel',v_sale.id,
        'Anulación de venta de cafetería '||coalesce(v_sale.code,'' )||'. Stock directo aún no preparado.',
        auth.uid()
      );

      v_restored_products := v_restored_products + 1;
      v_restored_quantity := v_restored_quantity + greatest(coalesce(v_restore.quantity,0),0);
    end loop;
  else
    -- Si el ticket no llegó a crearse, se devuelve todo el stock directo vendido.
    for v_restore in
      select si.product_id, sum(si.quantity)::numeric as quantity
      from public.sale_items si
      where si.sale_id=v_sale.id
        and si.user_id=v_user_id
        and si.product_id is not null
        and not exists (
          select 1
          from public.production_recipes pr
          where pr.user_id=v_user_id
            and pr.output_product_id=si.product_id
            and pr.recipe_context='cafeteria'
            and pr.is_active=true
        )
      group by si.product_id
    loop
      select * into v_product
      from public.products
      where id=v_restore.product_id and user_id=v_user_id
      for update;

      if v_product.id is null or coalesce(v_product.product_type,'sale_product')='service' then continue; end if;

      v_stock_before := coalesce(v_product.stock,0);
      v_stock_after := v_stock_before + greatest(coalesce(v_restore.quantity,0),0);
      v_stock_unit := coalesce(nullif(trim(v_product.stock_unit),''), nullif(trim(v_product.size),''), 'unidad');

      update public.products set stock=v_stock_after,status='Activo'
      where id=v_product.id and user_id=v_user_id;

      insert into public.inventory_movements(
        user_id,product_id,product_name,movement_type,quantity,stock_before,stock_after,
        unit,reference_type,reference_id,notes,created_by
      ) values (
        v_user_id,v_product.id,v_product.name,'sale_return',greatest(coalesce(v_restore.quantity,0),0),
        v_stock_before,v_stock_after,v_stock_unit,'cafeteria_sale_cancel',v_sale.id,
        'Anulación de venta de cafetería '||coalesce(v_sale.code,'')||'. El ticket de Barra no llegó a crearse.',
        auth.uid()
      );

      v_restored_products := v_restored_products + 1;
      v_restored_quantity := v_restored_quantity + greatest(coalesce(v_restore.quantity,0),0);
    end loop;
  end if;

  update public.sales
  set status='Anulada'
  where id=v_sale.id and user_id=v_user_id;

  if v_order.id is not null then
    update public.cafeteria_order_items
    set status='cancelado'
    where order_id=v_order.id and user_id=v_user_id and status<>'cancelado';

    update public.cafeteria_orders
    set status='cancelado', priority=false, priority_note=''
    where id=v_order.id and user_id=v_user_id;
  end if;

  return jsonb_build_object(
    'already_cancelled',false,
    'sale_id',v_sale.id,
    'sale_code',v_sale.code,
    'order_id',v_order.id,
    'restored_products',v_restored_products,
    'restored_quantity',round(v_restored_quantity,4),
    'consumption_records',v_consumption_records,
    'consumed_inventory_preserved',true
  );
end;
$$;

revoke all on function public.cafeteria_set_order_status(uuid,text) from public;
revoke all on function public.cafeteria_set_order_item_status(uuid,text) from public;
revoke all on function public.cafeteria_set_order_priority(uuid,boolean,text) from public;
revoke all on function public.cancel_cafeteria_sale(uuid) from public;

grant execute on function public.cafeteria_set_order_status(uuid,text) to authenticated;
grant execute on function public.cafeteria_set_order_item_status(uuid,text) to authenticated;
grant execute on function public.cafeteria_set_order_priority(uuid,boolean,text) to authenticated;
grant execute on function public.cancel_cafeteria_sale(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Realtime idempotente para instalaciones parciales y trabajo multi-tablet.
-- -----------------------------------------------------------------------------
do $$
declare
  v_table text;
  v_tables text[] := array[
    'cafeteria_orders',
    'cafeteria_order_items',
    'cafeteria_inventory_consumptions',
    'cafeteria_inventory_issues',
    'cafeteria_stock_adjustments',
    'production_batches'
  ];
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    foreach v_table in array v_tables loop
      if to_regclass('public.'||v_table) is not null
         and not exists (
           select 1 from pg_publication_tables
           where pubname='supabase_realtime' and schemaname='public' and tablename=v_table
         ) then
        execute format('alter publication supabase_realtime add table public.%I',v_table);
      end if;
    end loop;
  end if;
end;
$$;

comment on function public.cancel_cafeteria_sale(uuid) is
'Anula una venta de cafetería en una sola transacción. Devuelve únicamente stock directo no iniciado y conserva ingredientes ya consumidos.';
comment on function public.cafeteria_set_order_item_status(uuid,text) is
'Secuencia operativa de Barra serializada por pedido para evitar estados inconsistentes entre múltiples tablets.';
