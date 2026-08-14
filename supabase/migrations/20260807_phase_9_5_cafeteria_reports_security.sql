-- INVENTIQ · Fase 9.5 · Reportes operativos y endurecimiento de Cafetería
-- Ejecutar después de 20260807_phase_9_4_cafeteria_inventory_waste_replenishment.sql
-- No destructiva. Habilita lectura de reportes por permiso y evita escrituras directas
-- sobre pedidos/tickets: la operación continúa exclusivamente mediante las RPC controladas.

-- 1) Pedidos: lectura según función operativa; las escrituras se realizan por RPC SECURITY DEFINER.
revoke insert, update, delete on public.cafeteria_orders from authenticated;
revoke insert, update, delete on public.cafeteria_order_items from authenticated;
grant select on public.cafeteria_orders to authenticated;
grant select on public.cafeteria_order_items to authenticated;

drop policy if exists "cafeteria_orders_owner_access" on public.cafeteria_orders;
drop policy if exists "cafeteria_orders_select" on public.cafeteria_orders;
create policy "cafeteria_orders_select"
on public.cafeteria_orders for select to authenticated
using (
  user_id = public.restaurant_effective_user_id()
  and (
    not public.restaurant_is_employee_session()
    or public.restaurant_employee_has_permission('sales.manage')
    or public.restaurant_employee_has_permission('cafe.queue.manage')
    or public.restaurant_employee_has_permission('reports.view')
  )
);

drop policy if exists "cafeteria_order_items_owner_access" on public.cafeteria_order_items;
drop policy if exists "cafeteria_order_items_select" on public.cafeteria_order_items;
create policy "cafeteria_order_items_select"
on public.cafeteria_order_items for select to authenticated
using (
  user_id = public.restaurant_effective_user_id()
  and (
    not public.restaurant_is_employee_session()
    or public.restaurant_employee_has_permission('sales.manage')
    or public.restaurant_employee_has_permission('cafe.queue.manage')
    or public.restaurant_employee_has_permission('reports.view')
  )
);

-- 2) El permiso Reportes puede leer consumo, incidencias y mermas sin otorgar capacidad de ajuste.
drop policy if exists "cafeteria_inventory_consumptions_access" on public.cafeteria_inventory_consumptions;
create policy "cafeteria_inventory_consumptions_access"
on public.cafeteria_inventory_consumptions for select to authenticated
using (
  user_id = public.restaurant_effective_user_id()
  and (
    not public.restaurant_is_employee_session()
    or public.restaurant_employee_has_permission('inventory.manage')
    or public.restaurant_employee_has_permission('inventory.adjust')
    or public.restaurant_employee_has_permission('reports.view')
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
    or public.restaurant_employee_has_permission('reports.view')
    or public.restaurant_employee_has_permission('costs.view')
  )
);

drop policy if exists "cafeteria_stock_adjustments_access" on public.cafeteria_stock_adjustments;
create policy "cafeteria_stock_adjustments_access"
on public.cafeteria_stock_adjustments for select to authenticated
using (
  user_id = public.restaurant_effective_user_id()
  and (
    not public.restaurant_is_employee_session()
    or public.restaurant_employee_has_permission('inventory.manage')
    or public.restaurant_employee_has_permission('inventory.adjust')
    or public.restaurant_employee_has_permission('reports.view')
    or public.restaurant_employee_has_permission('costs.view')
  )
);

comment on table public.cafeteria_orders is
'Pedidos rápidos de Cafetería. Fase 9.5: lectura por rol y escrituras únicamente mediante RPC operativas.';
comment on table public.cafeteria_inventory_consumptions is
'Consumo real de recetas de Cafetería. Disponible para inventario, costos y reportes según permisos.';
