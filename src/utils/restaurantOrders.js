import { supabase } from '../supabaseClient';
import { normalizeRestaurantProductMetadata } from './restaurantMenu';

export const RESTAURANT_ORDER_STATUSES = [
  { value: 'borrador', label: 'Borrador', badgeClass: 'border-slate-200 bg-slate-50 text-slate-600' },
  { value: 'enviada', label: 'Enviada', badgeClass: 'border-cyan-200 bg-cyan-50 text-cyan-700' },
  { value: 'preparacion', label: 'En preparación', badgeClass: 'border-amber-200 bg-amber-50 text-amber-700' },
  { value: 'lista', label: 'Lista', badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  { value: 'servida', label: 'Servida', badgeClass: 'border-blue-200 bg-blue-50 text-blue-700' },
  { value: 'cuenta', label: 'Cuenta solicitada', badgeClass: 'border-violet-200 bg-violet-50 text-violet-700' },
  { value: 'cerrada', label: 'Cerrada', badgeClass: 'border-slate-200 bg-slate-100 text-slate-500' },
  { value: 'cancelada', label: 'Cancelada', badgeClass: 'border-red-200 bg-red-50 text-red-700' },
];

export const RESTAURANT_ITEM_STATUSES = [
  { value: 'pendiente', label: 'Sin enviar', badgeClass: 'border-slate-200 bg-slate-50 text-slate-600' },
  { value: 'enviado', label: 'En cocina', badgeClass: 'border-cyan-200 bg-cyan-50 text-cyan-700' },
  { value: 'preparacion', label: 'Preparando', badgeClass: 'border-amber-200 bg-amber-50 text-amber-700' },
  { value: 'listo', label: 'Listo', badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  { value: 'servido', label: 'Servido', badgeClass: 'border-blue-200 bg-blue-50 text-blue-700' },
  { value: 'cancelado', label: 'Cancelado', badgeClass: 'border-red-200 bg-red-50 text-red-700' },
];

export const RESTAURANT_COURSES = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'principal', label: 'Plato fuerte' },
  { value: 'postre', label: 'Postre' },
  { value: 'bebida', label: 'Bebida' },
  { value: 'sin_curso', label: 'Sin curso' },
];

function safeModifiers(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function mapRestaurantOrderItem(row = {}) {
  return {
    id: row.id,
    userId: row.user_id,
    orderId: row.order_id,
    productId: row.product_id,
    product: row.product_name || 'Producto',
    productName: row.product_name || 'Producto',
    category: row.category || '',
    kitchenStation: row.kitchen_station || 'cocina',
    course: row.course || 'principal',
    seatNumber: row.seat_number ?? '',
    quantity: Number(row.quantity || 0),
    price: Number(row.unit_price || 0),
    unitPrice: Number(row.unit_price || 0),
    modifiers: safeModifiers(row.modifiers),
    notes: row.notes || '',
    status: row.status || 'pendiente',
    preparationMinutes: Number(row.preparation_minutes || 15),
    isPriority: Boolean(row.is_priority),
    priorityAt: row.priority_at,
    sentAt: row.sent_at,
    startedAt: row.started_at,
    readyAt: row.ready_at,
    servedAt: row.served_at,
    cancelledAt: row.cancelled_at,
    cancellationReason: row.cancellation_reason || '',
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at,
    subtotal: Number(row.quantity || 0) * Number(row.unit_price || 0),
  };
}

export function mapRestaurantOrder(row = {}) {
  return {
    id: row.id,
    userId: row.user_id,
    tableId: row.table_id,
    areaId: row.area_id,
    code: row.order_code || 'Comanda',
    orderCode: row.order_code || 'Comanda',
    orderType: row.order_type || 'local',
    orderReference: row.order_reference || '',
    status: row.status || 'borrador',
    waiterName: row.waiter_name || '',
    guestCount: Number(row.guest_count || 1),
    customerName: row.customer_name || '',
    notes: row.notes || '',
    subtotal: Number(row.subtotal || 0),
    discountAmount: Number(row.discount_amount || 0),
    serviceCharge: Number(row.service_charge || 0),
    total: Number(row.total || 0),
    paidTotal: Number(row.paid_total || 0),
    balanceDue: Number(row.balance_due ?? Math.max(Number(row.total || 0) - Number(row.paid_total || 0), 0)),
    paymentStatus: row.payment_status || 'pendiente',
    openedAt: row.opened_at,
    sentAt: row.sent_at,
    billRequestedAt: row.bill_requested_at,
    closedAt: row.closed_at,
    saleId: row.sale_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: Array.isArray(row.restaurant_order_items)
      ? row.restaurant_order_items.map(mapRestaurantOrderItem).sort((a, b) => a.sortOrder - b.sortOrder)
      : [],
  };
}

export function getRestaurantOrderStatusMeta(status) {
  return RESTAURANT_ORDER_STATUSES.find((item) => item.value === status) || RESTAURANT_ORDER_STATUSES[0];
}

export function getRestaurantItemStatusMeta(status) {
  return RESTAURANT_ITEM_STATUSES.find((item) => item.value === status) || RESTAURANT_ITEM_STATUSES[0];
}

export function getRestaurantCourseLabel(course) {
  return RESTAURANT_COURSES.find((item) => item.value === course)?.label || 'Plato fuerte';
}

export function buildRestaurantDraftItem(cartItem = {}, product = null) {
  const metadata = normalizeRestaurantProductMetadata(product?.productMetadata || product?.product_metadata);
  const category = product?.category || cartItem.category || '';
  const inferredCourse = category.toLowerCase().includes('bebida')
    ? 'bebida'
    : category.toLowerCase().includes('postre')
      ? 'postre'
      : category.toLowerCase().includes('entrada')
        ? 'entrada'
        : 'principal';

  return {
    productId: cartItem.productId,
    product: cartItem.product,
    category,
    kitchenStation: cartItem.kitchenStation || metadata.kitchenStation || 'cocina',
    course: cartItem.course || inferredCourse,
    seatNumber: cartItem.seatNumber || '',
    quantity: Number(cartItem.quantity || 1),
    price: Number(cartItem.price || 0),
    modifiers: Array.isArray(cartItem.modifiers) ? cartItem.modifiers : [],
    notes: cartItem.notes || '',
  };
}

export async function fetchRestaurantOrders(userId, { activeOnly = true, limit = 100 } = {}) {
  let query = supabase
    .from('restaurant_orders')
    .select('*, restaurant_order_items(*)')
    .eq('user_id', userId)
    .order('opened_at', { ascending: false })
    .limit(limit);

  if (activeOnly) query = query.not('status', 'in', '(cerrada,cancelada)');

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapRestaurantOrder);
}

export async function fetchRestaurantOrder(orderId, userId) {
  if (!orderId || !userId) return null;
  const { data, error } = await supabase
    .from('restaurant_orders')
    .select('*, restaurant_order_items(*)')
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRestaurantOrder(data) : null;
}

export async function fetchActiveRestaurantOrderByTable(tableId, userId) {
  if (!tableId || !userId) return null;
  const { data, error } = await supabase
    .from('restaurant_orders')
    .select('*, restaurant_order_items(*)')
    .eq('table_id', tableId)
    .eq('user_id', userId)
    .not('status', 'in', '(cerrada,cancelada)')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRestaurantOrder(data) : null;
}

export async function saveRestaurantOrder({
  orderId = null,
  tableId = null,
  areaId = null,
  orderType = 'local',
  orderReference = '',
  waiterName = '',
  guestCount = 1,
  customerName = '',
  notes = '',
  items = [],
}) {
  const { data, error } = await supabase.rpc('restaurant_save_order', {
    p_order_id: orderId || null,
    p_table_id: tableId || null,
    p_area_id: areaId || null,
    p_order_type: orderType,
    p_order_reference: orderReference,
    p_waiter_name: waiterName,
    p_guest_count: Math.max(1, Number(guestCount || 1)),
    p_customer_name: customerName,
    p_notes: notes,
    p_items: items,
  });
  if (error) throw error;
  return data;
}

export async function sendRestaurantOrder(orderId) {
  const { data, error } = await supabase.rpc('restaurant_send_order', { p_order_id: orderId });
  if (error) throw error;
  return mapRestaurantOrder(data);
}

export async function requestRestaurantBill(orderId) {
  const { data, error } = await supabase.rpc('restaurant_request_bill', { p_order_id: orderId });
  if (error) throw error;
  return mapRestaurantOrder(data);
}

export async function cancelRestaurantOrderItem(itemId, reason) {
  const { data, error } = await supabase.rpc('restaurant_cancel_order_item', {
    p_item_id: itemId,
    p_reason: reason,
  });
  if (error) throw error;
  return mapRestaurantOrder(data);
}

export async function transferRestaurantOrder(orderId, targetTableId) {
  const { data, error } = await supabase.rpc('restaurant_transfer_order', {
    p_order_id: orderId,
    p_target_table_id: targetTableId,
  });
  if (error) throw error;
  return mapRestaurantOrder(data);
}

export function subscribeRestaurantOrders(userId, onChange) {
  if (!userId) return () => {};
  const channel = supabase
    .channel(`restaurant-orders-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_orders', filter: `user_id=eq.${userId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_order_items', filter: `user_id=eq.${userId}` }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function formatRestaurantOrderElapsed(openedAt, now = Date.now()) {
  if (!openedAt) return 'Sin hora';
  const minutes = Math.max(0, Math.floor((now - new Date(openedAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
}
