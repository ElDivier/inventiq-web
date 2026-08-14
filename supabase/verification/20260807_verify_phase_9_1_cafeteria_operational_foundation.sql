-- Verificación Fase 9.1 Cafeterías
select to_regclass('public.cafeteria_orders') as cafeteria_orders,
       to_regclass('public.cafeteria_order_items') as cafeteria_order_items;

select routine_name
from information_schema.routines
where routine_schema='public'
  and routine_name in ('cafeteria_create_order_from_sale','cafeteria_set_order_status','cafeteria_set_order_item_status')
order by routine_name;

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid='public.restaurant_staff_profiles'::regclass
  and conname='restaurant_staff_profiles_role_check';

select schemaname, tablename
from pg_publication_tables
where pubname='supabase_realtime'
  and tablename in ('cafeteria_orders','cafeteria_order_items')
order by tablename;
