-- INVENTIQ · Verificación Fase 9.6 · Cafeterías
-- Solo lectura. No modifica datos.

select
  to_regprocedure('public.cafeteria_set_order_status(uuid,text)') is not null as order_status_rpc_ok,
  to_regprocedure('public.cafeteria_set_order_item_status(uuid,text)') is not null as item_status_rpc_ok,
  to_regprocedure('public.cafeteria_set_order_priority(uuid,boolean,text)') is not null as priority_rpc_ok,
  to_regprocedure('public.cancel_cafeteria_sale(uuid)') is not null as cancel_sale_rpc_ok;

select
  has_function_privilege('authenticated','public.cafeteria_set_order_status(uuid,text)','EXECUTE') as order_status_execute,
  has_function_privilege('authenticated','public.cafeteria_set_order_item_status(uuid,text)','EXECUTE') as item_status_execute,
  has_function_privilege('authenticated','public.cancel_cafeteria_sale(uuid)','EXECUTE') as cancel_sale_execute;

select tablename,
       exists (
         select 1 from pg_publication_tables p
         where p.pubname='supabase_realtime' and p.schemaname='public' and p.tablename=t.tablename
       ) as realtime_enabled
from (values
  ('cafeteria_orders'),
  ('cafeteria_order_items'),
  ('cafeteria_inventory_consumptions'),
  ('cafeteria_inventory_issues'),
  ('cafeteria_stock_adjustments'),
  ('production_batches')
) as t(tablename)
order by tablename;

select
  count(*) filter (where status='entregado' and delivered_at is null) as delivered_without_timestamp,
  count(*) filter (where status='listo' and ready_at is null) as ready_without_timestamp,
  count(*) filter (where status='preparacion' and started_at is null) as preparing_without_timestamp
from public.cafeteria_orders;

select
  count(*) filter (
    where staff.role in ('administrador','supervisor')
      and not (coalesce(staff.permissions,'[]'::jsonb) @> '["cafe.queue.manage"]'::jsonb)
  ) as cafeteria_supervisors_without_bar_access,
  count(*) filter (where staff.role in ('mesero','cocina')) as legacy_restaurant_roles_in_cafeteria
from public.restaurant_staff_profiles staff
join public.profiles profile on profile.id=staff.user_id
where profile.business_type='cafeteria';
