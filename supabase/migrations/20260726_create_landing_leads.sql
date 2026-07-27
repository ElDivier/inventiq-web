-- INVENTIQ · Landing page Fase 4
-- Ejecutar una sola vez en Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.landing_leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  business_name text not null check (char_length(business_name) between 2 and 160),
  whatsapp text not null check (char_length(whatsapp) between 7 and 40),
  email text,
  business_type text not null default 'general',
  plan_code text not null default 'por_definir',
  billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'annual')),
  request_type text not null default 'demostracion'
    check (request_type in ('demostracion', 'personalizacion')),
  preferred_contact text not null default 'whatsapp'
    check (preferred_contact in ('whatsapp', 'email')),
  message text,
  status text not null default 'nuevo'
    check (status in ('nuevo', 'contactado', 'seguimiento', 'convertido', 'descartado')),
  source text not null default 'landing_page',
  source_page text,
  admin_notes text,
  consent_at timestamptz not null default now(),
  contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists landing_leads_created_at_idx
  on public.landing_leads (created_at desc);

create index if not exists landing_leads_status_idx
  on public.landing_leads (status);

create or replace function public.set_landing_leads_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists landing_leads_set_updated_at on public.landing_leads;
create trigger landing_leads_set_updated_at
before update on public.landing_leads
for each row
execute function public.set_landing_leads_updated_at();

alter table public.landing_leads enable row level security;

-- El visitante puede enviar una solicitud, pero no leer, modificar ni eliminar registros.
drop policy if exists "landing_leads_public_insert" on public.landing_leads;
create policy "landing_leads_public_insert"
on public.landing_leads
for insert
to anon, authenticated
with check (
  status = 'nuevo'
  and admin_notes is null
  and contacted_at is null
  and source = 'landing_page'
);

-- Solo el correo administrador actual puede consultar y gestionar los prospectos.
drop policy if exists "landing_leads_admin_select" on public.landing_leads;
create policy "landing_leads_admin_select"
on public.landing_leads
for select
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'inventiqweb@gmail.com');

drop policy if exists "landing_leads_admin_update" on public.landing_leads;
create policy "landing_leads_admin_update"
on public.landing_leads
for update
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'inventiqweb@gmail.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'inventiqweb@gmail.com');

drop policy if exists "landing_leads_admin_delete" on public.landing_leads;
create policy "landing_leads_admin_delete"
on public.landing_leads
for delete
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'inventiqweb@gmail.com');

grant insert on public.landing_leads to anon, authenticated;
grant select, update, delete on public.landing_leads to authenticated;

comment on table public.landing_leads is
'Solicitudes comerciales recibidas desde la landing page de InventIQ.';
