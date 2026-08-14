select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='cafeteria_orders'
  and column_name in ('priority','priority_note','called_at','call_count')
order by column_name;

select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='cafeteria_order_items'
  and column_name='target_minutes';

select routine_name
from information_schema.routines
where routine_schema='public'
  and routine_name in ('cafeteria_set_order_priority','cafeteria_call_order','cafeteria_create_order_from_sale')
order by routine_name;
