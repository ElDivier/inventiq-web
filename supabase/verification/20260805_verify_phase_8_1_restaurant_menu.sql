-- Verificación de Fase 8.1 · Restaurante

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'products'
  and column_name in ('product_type', 'stock_unit', 'product_metadata')
order by column_name;

select
  profile.store_name,
  product.product_type,
  count(*) as total_items
from public.products as product
join public.profiles as profile on profile.id = product.user_id
where profile.business_type = 'restaurante'
group by profile.store_name, product.product_type
order by profile.store_name, product.product_type;

select
  product.name,
  product.category,
  product.product_type,
  product.product_metadata ->> 'menuStatus' as menu_status,
  product.product_metadata ->> 'kitchenStation' as kitchen_station
from public.products as product
join public.profiles as profile on profile.id = product.user_id
where profile.business_type = 'restaurante'
order by product.created_at desc
limit 20;
