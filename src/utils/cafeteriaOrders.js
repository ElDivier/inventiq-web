import { supabase } from '../supabaseClient';

export const CAFETERIA_ORDER_STATUSES = [
  { value: 'recibido', label: 'Recibido', badgeClass: 'border-sky-200 bg-sky-50 text-sky-700' },
  { value: 'preparacion', label: 'En preparación', badgeClass: 'border-amber-200 bg-amber-50 text-amber-700' },
  { value: 'listo', label: 'Listo', badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  { value: 'entregado', label: 'Entregado', badgeClass: 'border-slate-200 bg-slate-100 text-slate-600' },
  { value: 'cancelado', label: 'Cancelado', badgeClass: 'border-red-200 bg-red-50 text-red-700' },
];

export function getCafeteriaOrderStatusMeta(value) {
  return CAFETERIA_ORDER_STATUSES.find((item) => item.value === value) || CAFETERIA_ORDER_STATUSES[0];
}

function mapItem(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    product: row.product_name,
    station: row.station,
    quantity: Number(row.quantity || 0),
    unitPrice: Number(row.unit_price || 0),
    variantSummary: row.variant_summary || '',
    modifiers: Array.isArray(row.modifiers) ? row.modifiers : [],
    notes: row.notes || '',
    status: row.status || 'recibido',
    inventoryStatus: row.inventory_status || 'pending',
    inventoryConsumedAt: row.inventory_consumed_at || null,
    inventoryCost: Number(row.inventory_cost || 0),
    inventoryShortageCount: Number(row.inventory_shortage_count || 0),
    inventoryIssueCount: Number(row.inventory_issue_count || 0),
    targetMinutes: Number(row.target_minutes || 0),
    startedAt: row.started_at || null,
    readyAt: row.ready_at || null,
    deliveredAt: row.delivered_at || null,
    createdAt: row.created_at,
  };
}

function mapOrder(row) {
  return {
    id: row.id,
    code: row.order_code,
    number: Number(row.order_number || 0),
    orderType: row.order_type,
    reference: row.order_reference || '',
    customerName: row.customer_name || '',
    status: row.status || 'recibido',
    notes: row.notes || '',
    total: Number(row.total || 0),
    priority: Boolean(row.priority),
    priorityNote: row.priority_note || '',
    calledAt: row.called_at || null,
    callCount: Number(row.call_count || 0),
    receivedAt: row.received_at,
    startedAt: row.started_at,
    readyAt: row.ready_at,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
    items: (row.cafeteria_order_items || []).map(mapItem),
  };
}

export async function fetchCafeteriaOrders({ userId, includeDelivered = false, limit = 80 } = {}) {
  if (!userId) return [];
  let query = supabase
    .from('cafeteria_orders')
    .select(`
      id, user_id, sale_id, order_number, order_code, order_type, order_reference,
      customer_name, status, notes, total, priority, priority_note, called_at, call_count,
      received_at, started_at, ready_at, delivered_at, created_at, updated_at,
      cafeteria_order_items (
        id, order_id, product_id, product_name, station, quantity, unit_price,
        variant_summary, modifiers, notes, status, inventory_status, inventory_consumed_at,
        inventory_cost, inventory_shortage_count, inventory_issue_count, target_minutes,
        started_at, ready_at, delivered_at, created_at
      )
    `)
    .eq('user_id', userId)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!includeDelivered) query = query.not('status', 'in', '(entregado,cancelado)');
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapOrder);
}

export async function updateCafeteriaOrderStatus(orderId, status) {
  const { data, error } = await supabase.rpc('cafeteria_set_order_status', {
    p_order_id: orderId,
    p_status: status,
  });
  if (error) throw error;
  return data;
}

export async function updateCafeteriaOrderItemStatus(itemId, status) {
  const { data, error } = await supabase.rpc('cafeteria_set_order_item_status', {
    p_item_id: itemId,
    p_status: status,
  });
  if (error) throw error;
  return data;
}

export async function setCafeteriaOrderPriority(orderId, priority, note = '') {
  const { data, error } = await supabase.rpc('cafeteria_set_order_priority', {
    p_order_id: orderId,
    p_priority: Boolean(priority),
    p_note: note || '',
  });
  if (error) throw error;
  return data;
}

export async function callCafeteriaOrder(orderId) {
  const { data, error } = await supabase.rpc('cafeteria_call_order', { p_order_id: orderId });
  if (error) throw error;
  return data;
}

export function subscribeCafeteriaOrders(userId, onChange) {
  if (!userId) return () => {};

  let refreshTimer = null;
  const queueRefresh = () => {
    if (refreshTimer) window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => onChange?.(), 90);
  };

  const channel = supabase
    .channel(`cafeteria-orders-${userId}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cafeteria_orders', filter: `user_id=eq.${userId}` }, queueRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cafeteria_order_items', filter: `user_id=eq.${userId}` }, queueRefresh)
    .subscribe();

  return () => {
    if (refreshTimer) window.clearTimeout(refreshTimer);
    supabase.removeChannel(channel);
  };
}
