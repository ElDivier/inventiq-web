export const BAKERY_ORDER_STATUSES = [
  { value: 'quote', label: 'Cotización', tone: 'slate' },
  { value: 'confirmed', label: 'Confirmado', tone: 'blue' },
  { value: 'in_production', label: 'En producción', tone: 'amber' },
  { value: 'ready', label: 'Listo para entregar', tone: 'violet' },
  { value: 'delivered', label: 'Entregado', tone: 'emerald' },
  { value: 'cancelled', label: 'Cancelado', tone: 'red' },
];

export const BAKERY_FULFILLMENT_OPTIONS = [
  { value: 'pickup', label: 'Retiro en el local' },
  { value: 'delivery', label: 'Entrega a domicilio' },
];

export const BAKERY_PAYMENT_METHODS = [
  'Efectivo',
  'Transferencia',
  'Tarjeta',
  'Otro',
];

export function createBakeryOrderItem(overrides = {}) {
  return {
    key: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId: '',
    name: '',
    quantity: '1',
    unit: 'unidad',
    unitPrice: '',
    notes: '',
    ...overrides,
  };
}

export function createEmptyBakeryOrderForm() {
  const today = new Date();
  today.setDate(today.getDate() + 1);

  return {
    id: null,
    clientId: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    fulfillmentType: 'pickup',
    deliveryDate: toDateInputValue(today),
    deliveryTime: '10:00',
    deliveryAddress: '',
    status: 'quote',
    occasion: '',
    flavor: '',
    filling: '',
    sizeLabel: '',
    servings: '',
    theme: '',
    inscription: '',
    notes: '',
    discount: '0',
    deliveryFee: '0',
    initialPayment: '0',
    paymentMethod: 'Efectivo',
    paymentNotes: '',
    items: [createBakeryOrderItem()],
  };
}

export function toDateInputValue(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDateInput() {
  return toDateInputValue(new Date());
}

export function formatBakeryOrderMoney(value) {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatBakeryOrderDate(value, options = {}) {
  if (!value) return 'Sin fecha';
  const [year, month, day] = String(value).split('-').map(Number);
  const date = new Date(year, Math.max(0, month - 1), day || 1);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: options.short ? 'short' : 'long',
    year: options.hideYear ? undefined : 'numeric',
  }).format(date);
}

export function formatBakeryOrderTime(value) {
  if (!value) return 'Hora por confirmar';
  const [hours, minutes] = String(value).slice(0, 5).split(':').map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return new Intl.DateTimeFormat('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function getBakeryOrderStatus(status) {
  return BAKERY_ORDER_STATUSES.find(item => item.value === status) || BAKERY_ORDER_STATUSES[0];
}

export function getBakeryOrderTotals(formOrOrder) {
  const items = Array.isArray(formOrOrder?.items) ? formOrOrder.items : [];
  const subtotal = items.reduce((sum, item) => {
    const quantity = Math.max(0, Number(item.quantity || 0));
    const unitPrice = Math.max(0, Number(item.unitPrice ?? item.unit_price ?? 0));
    return sum + quantity * unitPrice;
  }, 0);
  const discount = Math.max(0, Number(formOrOrder?.discount || 0));
  const deliveryFee = Math.max(0, Number(formOrOrder?.deliveryFee ?? formOrOrder?.delivery_fee ?? 0));
  const total = Math.max(0, subtotal - discount + deliveryFee);
  const paidSource = formOrOrder?.paidAmount ?? formOrOrder?.paid_amount ?? formOrOrder?.initialPayment ?? 0;
  const paid = Math.max(0, Number(paidSource));
  const balance = Math.max(0, total - paid);

  return { subtotal, discount, deliveryFee, total, paid, balance };
}

export function normalizeBakeryOrder(order) {
  return {
    ...order,
    items: Array.isArray(order?.items) ? order.items : [],
    payments: Array.isArray(order?.payments) ? order.payments : [],
    subtotal: Number(order?.subtotal || 0),
    discount: Number(order?.discount || 0),
    delivery_fee: Number(order?.delivery_fee || 0),
    total: Number(order?.total || 0),
    paid_amount: Number(order?.paid_amount || 0),
    sale_id: order?.sale_id || null,
    sale_registered_at: order?.sale_registered_at || null,
    servings: order?.servings === null || order?.servings === undefined ? '' : Number(order.servings),
  };
}

export function getNextBakeryOrderStatus(status) {
  const transitions = {
    quote: 'confirmed',
    confirmed: 'in_production',
    in_production: 'ready',
    ready: 'delivered',
  };
  return transitions[status] || null;
}

export function getNextBakeryOrderActionLabel(status) {
  const labels = {
    quote: 'Confirmar pedido',
    confirmed: 'Iniciar producción',
    in_production: 'Marcar como listo',
    ready: 'Entregar y registrar venta',
  };
  return labels[status] || '';
}

export function isBakeryOrderOverdue(order, today = getTodayDateInput()) {
  return Boolean(
    order?.delivery_date
    && order.delivery_date < today
    && !['delivered', 'cancelled'].includes(order.status)
  );
}

export function isBakeryOrderDueToday(order, today = getTodayDateInput()) {
  return order?.delivery_date === today && !['delivered', 'cancelled'].includes(order.status);
}

export function isBakeryOrderDueWithinDays(order, days = 7, today = getTodayDateInput()) {
  if (!order?.delivery_date || ['delivered', 'cancelled'].includes(order.status)) return false;
  const start = new Date(`${today}T00:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + days);
  const due = new Date(`${order.delivery_date}T00:00:00`);
  return due >= start && due <= end;
}

export function buildBakeryOrderSummary(order) {
  const status = getBakeryOrderStatus(order.status).label;
  const itemLines = (order.items || []).map(item => (
    `• ${Number(item.quantity || 0)} ${item.unit || 'unidad'} · ${item.item_name}`
  ));
  const balance = Math.max(0, Number(order.total || 0) - Number(order.paid_amount || 0));

  return [
    `Pedido ${order.order_code}`,
    `Cliente: ${order.customer_name}`,
    `Entrega: ${formatBakeryOrderDate(order.delivery_date)} · ${formatBakeryOrderTime(order.delivery_time)}`,
    `Modalidad: ${order.fulfillment_type === 'delivery' ? 'Entrega a domicilio' : 'Retiro en el local'}`,
    `Estado: ${status}`,
    '',
    ...itemLines,
    '',
    `Total: ${formatBakeryOrderMoney(order.total)}`,
    `Abonado: ${formatBakeryOrderMoney(order.paid_amount)}`,
    `Saldo: ${formatBakeryOrderMoney(balance)}`,
    order.inscription ? `Texto: ${order.inscription}` : '',
    order.notes ? `Observaciones: ${order.notes}` : '',
  ].filter(Boolean).join('\n');
}

export function normalizePhoneForWhatsApp(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('593')) return digits;
  if (digits.startsWith('0') && digits.length >= 10) return `593${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith('9')) return `593${digits}`;
  return digits;
}
