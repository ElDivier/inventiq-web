-- INVENTIQ · Fase 8.1 · Base gastronómica para restaurantes
-- Migración no destructiva. No elimina productos, ventas, clientes ni configuraciones.

alter table public.products
  add column if not exists product_type text not null default 'sale_product',
  add column if not exists stock_unit text,
  add column if not exists product_metadata jsonb not null default '{}'::jsonb;

-- Clasifica los artículos existentes de cuentas Restaurante según sus categorías operativas.
update public.products as product
set product_type = case
  when lower(trim(product.category)) like 'preparaciones -%' then 'intermediate'
  when lower(trim(product.category)) like 'preparación -%' then 'intermediate'
  when lower(trim(product.category)) like 'empaques -%' then 'packaging'
  when lower(trim(product.category)) like 'empaque -%' then 'packaging'
  when lower(trim(product.category)) like 'insumos -%' then 'raw_material'
  else 'sale_product'
end
from public.profiles as profile
where profile.id = product.user_id
  and profile.business_type = 'restaurante'
  and (
    lower(trim(product.category)) like 'menú -%'
    or lower(trim(product.category)) like 'menu -%'
    or lower(trim(product.category)) like 'preparaciones -%'
    or lower(trim(product.category)) like 'preparación -%'
    or lower(trim(product.category)) like 'insumos -%'
    or lower(trim(product.category)) like 'empaques -%'
    or lower(trim(product.category)) like 'empaque -%'
  );

-- Añade metadatos operativos por defecto a los platos del menú sin sobrescribir datos existentes.
update public.products as product
set product_metadata = jsonb_build_object(
  'menuStatus', 'available',
  'kitchenStation', 'cocina',
  'preparationMinutes', 0,
  'servicePeriods', jsonb_build_array('todo_dia'),
  'orderChannels', jsonb_build_array('local', 'takeaway', 'delivery'),
  'dietaryTags', '[]'::jsonb,
  'allergens', '',
  'preparationNotes', ''
) || coalesce(product.product_metadata, '{}'::jsonb)
from public.profiles as profile
where profile.id = product.user_id
  and profile.business_type = 'restaurante'
  and product.product_type = 'sale_product';

create index if not exists products_restaurant_operational_type_idx
  on public.products (user_id, product_type, category);

create index if not exists products_product_metadata_gin_idx
  on public.products using gin (product_metadata);

comment on column public.products.product_metadata is
'Metadatos operativos extensibles. En restaurantes contiene disponibilidad, estación, tiempo, horarios, canales, etiquetas y alérgenos del menú.';
