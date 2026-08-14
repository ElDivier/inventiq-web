-- INVENTIQ · Rollback Fase 9.5 · Cafetería
-- Revierte únicamente el endurecimiento de permisos de esta fase.

-- Restaura permisos directos existentes al finalizar la Fase 9.4.
grant select, insert, update on public.cafeteria_orders to authenticated;
grant select, insert, update on public.cafeteria_order_items to authenticated;

drop policy if exists "cafeteria_orders_select" on public.cafeteria_orders;
drop policy if exists "cafeteria_orders_owner_access" on public.cafeteria_orders;
create policy "cafeteria_orders_owner_access"
on public.cafeteria_orders for all to authenticated
using (user_id = public.restaurant_effective_user_id())
with check (user_id = public.restaurant_effective_user_id());

drop policy if exists "cafeteria_order_items_select" on public.cafeteria_order_items;
drop policy if exists "cafeteria_order_items_owner_access" on public.cafeteria_order_items;
create policy "cafeteria_order_items_owner_access"
on public.cafeteria_order_items for all to authenticated
using (user_id = public.restaurant_effective_user_id())
with check (user_id = public.restaurant_effective_user_id());

-- Restaura políticas de lectura tal como estaban en Fase 9.4.
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

drop policy if exists "cafeteria_stock_adjustments_access" on public.cafeteria_stock_adjustments;
create policy "cafeteria_stock_adjustments_access"
on public.cafeteria_stock_adjustments for select to authenticated
using (
  user_id = public.restaurant_effective_user_id()
  and (
    not public.restaurant_is_employee_session()
    or public.restaurant_employee_has_permission('inventory.manage')
    or public.restaurant_employee_has_permission('inventory.adjust')
    or public.restaurant_employee_has_permission('costs.view')
  )
);
