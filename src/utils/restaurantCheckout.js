import { supabase } from '../supabaseClient';
import { mapRestaurantOrder, mapRestaurantOrderItem } from './restaurantOrders';
import { mapSaleFromDb, mapSaleItemFromDb } from './mappers';

export const RESTAURANT_SPLIT_MODES = [
  { value: 'completa', label: 'Cuenta completa', description: 'Cobrar todo el saldo pendiente.' },
  { value: 'partes', label: 'Partes iguales', description: 'Dividir el saldo entre varias personas.' },
  { value: 'asientos', label: 'Por asiento', description: 'Cobrar los productos asignados a uno o más asientos.' },
  { value: 'productos', label: 'Por productos', description: 'Seleccionar productos específicos de la cuenta.' },
  { value: 'monto', label: 'Monto libre', description: 'Registrar un abono parcial definido manualmente.' },
];

export const RESTAURANT_PAYMENT_METHODS = ['Efectivo', 'Tarjeta', 'Transferencia', 'Mixto'];

export function moneyNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

export function mapRestaurantPayment(row = {}) {
  return {
    id: row.id,
    userId: row.user_id,
    orderId: row.order_id,
    code: row.payment_code || '',
    amount: moneyNumber(row.amount),
    paymentMethod: row.payment_method || 'Efectivo',
    cashAmount: moneyNumber(row.cash_amount),
    cardAmount: moneyNumber(row.card_amount),
    transferAmount: moneyNumber(row.transfer_amount),
    splitMode: row.split_mode || 'completa',
    splitLabel: row.split_label || '',
    allocation: row.allocation && typeof row.allocation === 'object' ? row.allocation : {},
    notes: row.notes || '',
    status: row.status || 'active',
    paidAt: row.paid_at || row.created_at,
    voidedAt: row.voided_at,
    voidReason: row.void_reason || '',
    saleId: row.sale_id,
    createdAt: row.created_at,
  };
}

export function mapRestaurantCheckoutOrder(row = {}) {
  return {
    ...mapRestaurantOrder(row),
    discountAmount: moneyNumber(row.discount_amount),
    serviceCharge: moneyNumber(row.service_charge),
    paidTotal: moneyNumber(row.paid_total),
    balanceDue: moneyNumber(row.balance_due ?? (Number(row.total || 0) - Number(row.paid_total || 0))),
    paymentStatus: row.payment_status || 'pendiente',
    payments: Array.isArray(row.restaurant_order_payments)
      ? row.restaurant_order_payments.map(mapRestaurantPayment).sort((a, b) => new Date(b.paidAt || 0) - new Date(a.paidAt || 0))
      : [],
  };
}

export async function fetchRestaurantCheckoutOrders(userId, { includeClosed = false, limit = 120 } = {}) {
  let query = supabase
    .from('restaurant_orders')
    .select('*, restaurant_order_items(*), restaurant_order_payments(*)')
    .eq('user_id', userId)
    .order('bill_requested_at', { ascending: false, nullsFirst: false })
    .order('opened_at', { ascending: false })
    .limit(limit);

  if (!includeClosed) {
    query = query.not('status', 'in', '(cerrada,cancelada)');
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapRestaurantCheckoutOrder);
}

export async function updateRestaurantOrderCharges(orderId, discountAmount, serviceCharge) {
  const { data, error } = await supabase.rpc('restaurant_update_order_charges', {
    p_order_id: orderId,
    p_discount_amount: moneyNumber(discountAmount),
    p_service_charge: moneyNumber(serviceCharge),
  });
  if (error) throw error;
  return mapRestaurantCheckoutOrder(data);
}

export async function registerRestaurantPayment({
  orderId,
  amount,
  paymentMethod,
  cashAmount = 0,
  cardAmount = 0,
  transferAmount = 0,
  splitMode = 'completa',
  splitLabel = '',
  allocation = {},
  notes = '',
}) {
  const { data, error } = await supabase.rpc('restaurant_register_payment', {
    p_order_id: orderId,
    p_amount: moneyNumber(amount),
    p_payment_method: paymentMethod,
    p_cash_amount: moneyNumber(cashAmount),
    p_card_amount: moneyNumber(cardAmount),
    p_transfer_amount: moneyNumber(transferAmount),
    p_split_mode: splitMode,
    p_split_label: splitLabel,
    p_allocation: allocation || {},
    p_notes: notes,
  });
  if (error) throw error;
  return data;
}

export async function voidRestaurantPayment(paymentId, reason) {
  const { data, error } = await supabase.rpc('restaurant_void_payment', {
    p_payment_id: paymentId,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function fetchRestaurantSale(saleId, userId) {
  if (!saleId || !userId) return null;
  const { data: sale, error } = await supabase
    .from('sales')
    .select('*')
    .eq('id', saleId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!sale) return null;

  const { data: items, error: itemsError } = await supabase
    .from('sale_items')
    .select('*')
    .eq('sale_id', saleId)
    .eq('user_id', userId);
  if (itemsError) throw itemsError;

  return {
    ...mapSaleFromDb(sale),
    cashAmount: moneyNumber(sale.cash_amount),
    cardAmount: moneyNumber(sale.card_amount),
    transferAmount: moneyNumber(sale.transfer_amount),
    items: (items || []).map(mapSaleItemFromDb),
  };
}

export function getActiveRestaurantPayments(order = {}) {
  return (order.payments || []).filter((payment) => payment.status !== 'voided');
}

export function buildAllocatedItemIds(order = {}) {
  const ids = new Set();
  getActiveRestaurantPayments(order).forEach((payment) => {
    const itemIds = Array.isArray(payment.allocation?.itemIds) ? payment.allocation.itemIds : [];
    itemIds.forEach((id) => ids.add(String(id)));
  });
  return ids;
}

export function getUnallocatedRestaurantItems(order = {}) {
  const allocated = buildAllocatedItemIds(order);
  return (order.items || []).filter((item) => item.status !== 'cancelado' && !allocated.has(String(item.id)));
}

export function subscribeRestaurantCheckout(userId, onChange) {
  if (!userId) return () => {};
  const channel = supabase
    .channel(`restaurant-checkout-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_orders', filter: `user_id=eq.${userId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_order_items', filter: `user_id=eq.${userId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_order_payments', filter: `user_id=eq.${userId}` }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function getPaymentMethodBreakdown(payment = {}) {
  if (payment.paymentMethod !== 'Mixto') return payment.paymentMethod;
  const parts = [];
  if (payment.cashAmount > 0) parts.push(`Efectivo $${payment.cashAmount.toFixed(2)}`);
  if (payment.cardAmount > 0) parts.push(`Tarjeta $${payment.cardAmount.toFixed(2)}`);
  if (payment.transferAmount > 0) parts.push(`Transferencia $${payment.transferAmount.toFixed(2)}`);
  return parts.length ? parts.join(' · ') : 'Mixto';
}

export { mapRestaurantOrderItem };
