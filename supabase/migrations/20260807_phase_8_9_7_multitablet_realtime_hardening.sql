-- INVENTIQ · Corrección 8.9.7
-- Sincronización multi-tablet y endurecimiento de permisos del módulo Restaurante.
--
-- 1) Completa Supabase Realtime para cobros e inventario gastronómico.
-- 2) Evita modificaciones directas de pedidos/ítems desde clientes autenticados;
--    las escrituras continúan realizándose mediante las RPC de restaurante,
--    donde se validan rol, permisos, estado y reglas de negocio.
--
-- No modifica ni elimina datos existentes.

-- Las pantallas ya se suscriben a estas tablas. Se agregan a la publicación
-- solo si existen y todavía no están publicadas.
do $$
declare
  v_table text;
  v_tables text[] := array[
    'restaurant_order_payments',
    'restaurant_inventory_consumptions',
    'restaurant_inventory_issues',
    'restaurant_stock_adjustments',
    'production_batches'
  ];
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array v_tables loop
      if to_regclass('public.' || v_table) is not null
         and not exists (
           select 1
           from pg_publication_tables
           where pubname = 'supabase_realtime'
             and schemaname = 'public'
             and tablename = v_table
         ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end;
$$;

-- Pedidos y productos de comanda se modifican únicamente por funciones RPC
-- (restaurant_save_order, restaurant_send_order, funciones de cocina, etc.).
-- Esto evita que un cliente autenticado intente saltarse las reglas mediante
-- una actualización directa a las tablas.
revoke insert, update, delete on table public.restaurant_orders from authenticated;
revoke insert, update, delete on table public.restaurant_order_items from authenticated;
grant select on table public.restaurant_orders to authenticated;
grant select on table public.restaurant_order_items to authenticated;
