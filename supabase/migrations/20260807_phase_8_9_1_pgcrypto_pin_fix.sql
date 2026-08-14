-- INVENTIQ · Corrección 8.9.1 · PIN de operadores / pgcrypto
-- Corrige: function gen_salt(unknown, integer) does not exist
-- Ejecutar después de 20260807_phase_8_9_restaurant_roles_permissions_stabilization.sql

-- En Supabase, pgcrypto normalmente está instalado en el esquema "extensions".
-- Las funciones de la Fase 8.9 tenían un search_path que no incluía ese esquema.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter function public.restaurant_create_staff_profile(text, text, text, jsonb)
  set search_path = public, auth, extensions;

alter function public.restaurant_update_staff_profile(uuid, text, text, jsonb, boolean, text)
  set search_path = public, auth, extensions;

alter function public.restaurant_verify_staff_pin(uuid, text)
  set search_path = public, auth, extensions;
