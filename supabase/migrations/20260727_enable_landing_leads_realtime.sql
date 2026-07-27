-- INVENTIQ · Actualización en tiempo real de solicitudes de la landing
-- Permite que el panel Admin muestre nuevas solicitudes sin recargar manualmente.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'landing_leads'
  ) then
    alter publication supabase_realtime add table public.landing_leads;
  end if;
end
$$;
