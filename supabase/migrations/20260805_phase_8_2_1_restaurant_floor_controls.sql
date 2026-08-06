-- INVENTIQ · Fase 8.2.1 · Controles del plano y estabilidad de interfaz
-- Migración no destructiva. Agrega una función segura para retirar el plano completo.

create or replace function public.restaurant_clear_floor()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_busy_tables integer := 0;
  v_table_count integer := 0;
  v_area_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'No existe una sesión activa.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_user_id
      and business_type = 'restaurante'
  ) then
    raise exception 'El plano de mesas solo está disponible para cuentas Restaurante.';
  end if;

  select count(*)
  into v_busy_tables
  from public.restaurant_tables
  where user_id = v_user_id
    and is_active = true
    and status <> 'libre';

  if v_busy_tables > 0 then
    raise exception 'Primero marca todas las mesas como libres antes de eliminar el plano.';
  end if;

  select count(*)
  into v_table_count
  from public.restaurant_tables
  where user_id = v_user_id
    and is_active = true;

  select count(*)
  into v_area_count
  from public.restaurant_areas
  where user_id = v_user_id
    and is_active = true;

  update public.restaurant_tables
  set is_active = false,
      joined_to = null
  where user_id = v_user_id
    and is_active = true;

  update public.restaurant_areas
  set is_active = false
  where user_id = v_user_id
    and is_active = true;

  return jsonb_build_object(
    'cleared', true,
    'areas', v_area_count,
    'tables', v_table_count
  );
end;
$$;

grant execute on function public.restaurant_clear_floor() to authenticated;

comment on function public.restaurant_clear_floor() is
'Retira de forma lógica todas las áreas y mesas activas del restaurante cuando todas se encuentran libres.';
