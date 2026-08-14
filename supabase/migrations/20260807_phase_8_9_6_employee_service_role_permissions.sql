-- INVENTIQ · Corrección 8.9.6
-- Permisos del backend para el acceso independiente de empleados.
--
-- La Edge Function restaurant-employee-auth utiliza la clave service_role
-- exclusivamente en el servidor. Esta corrección le concede únicamente los
-- privilegios de tabla que necesita para cargar el perfil del negocio y
-- registrar la auditoría del acceso.
--
-- No concede permisos nuevos a anon ni authenticated y no modifica datos.

grant usage on schema public to service_role;

grant select on table public.profiles to service_role;
grant insert on table public.restaurant_audit_log to service_role;
