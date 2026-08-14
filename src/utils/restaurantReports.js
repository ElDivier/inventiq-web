import { cleanOperationalCategoryLabel } from '../config/productTypes';
import {
  getRestaurantProductRole,
  getRestaurantStationLabel,
  isRestaurantMenuProduct,
  isRestaurantMenuProductAvailable,
} from './restaurantMenu';

export const RESTAURANT_REPORT_PERIODS = [
  { value: '7', label: 'Últimos 7 días' },
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
  { value: 'all', label: 'Todo el historial' },
];

const CHANNEL_LABELS = {
  local: 'Consumo en local',
  takeaway: 'Para llevar',
  delivery: 'Delivery',
};

const STATUS_LABELS = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  preparacion: 'En preparación',
  lista: 'Lista',
  servida: 'Servida',
  cuenta: 'Cuenta solicitada',
  cerrada: 'Cerrada',
  cancelada: 'Cancelada',
};

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('es-EC')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getRestaurantPeriodStart(period, now = new Date()) {
  if (period === 'all') return null;
  const days = Number(period || 30);
  if (!Number.isFinite(days) || days <= 0) return null;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

function inPeriod(value, start) {
  if (!start) return true;
  const date = toDate(value);
  return Boolean(date && date >= start);
}

function minutesBetween(startValue, endValue) {
  const start = toDate(startValue);
  const end = toDate(endValue);
  if (!start || !end || end < start) return null;
  return (end.getTime() - start.getTime()) / 60000;
}

function groupBy(rows, getKey, initializer, updater) {
  const map = new Map();
  rows.forEach((row) => {
    const key = getKey(row);
    if (!key) return;
    const current = map.get(key) || initializer(row, key);
    updater(current, row);
    map.set(key, current);
  });
  return Array.from(map.values());
}

function getProductLookup(products = []) {
  const byId = new Map();
  const byName = new Map();
  products.forEach((product) => {
    if (product?.id) byId.set(String(product.id), product);
    const name = normalizeText(product?.name);
    if (name && !byName.has(name)) byName.set(name, product);
  });
  return { byId, byName };
}

function getOrderLookup(orders = []) {
  return new Map(orders.map(order => [String(order.id), order]));
}

function getAreaAndTableLookups(areas = [], tables = []) {
  return {
    areaById: new Map(areas.map(area => [String(area.id), area])),
    tableById: new Map(tables.map(table => [String(table.id), table])),
  };
}

function sum(rows, selector) {
  return rows.reduce((total, row) => total + number(selector(row)), 0);
}

function sortDescending(rows, selector) {
  return [...rows].sort((a, b) => number(selector(b)) - number(selector(a)));
}

function buildChannelStats(completedOrders) {
  const stats = Object.keys(CHANNEL_LABELS).map(channel => ({
    key: channel,
    label: CHANNEL_LABELS[channel],
    orders: 0,
    revenue: 0,
    guests: 0,
  }));
  const byKey = new Map(stats.map(item => [item.key, item]));

  completedOrders.forEach((order) => {
    const current = byKey.get(order.order_type) || byKey.get('local');
    current.orders += 1;
    current.revenue += number(order.total);
    current.guests += number(order.guest_count);
  });

  return sortDescending(stats, item => item.revenue);
}

function buildWaiterStats(completedOrders) {
  return sortDescending(groupBy(
    completedOrders,
    order => String(order.waiter_name || 'Sin asignar').trim() || 'Sin asignar',
    (_order, key) => ({ name: key, orders: 0, revenue: 0, guests: 0 }),
    (current, order) => {
      current.orders += 1;
      current.revenue += number(order.total);
      current.guests += number(order.guest_count);
    },
  ), item => item.revenue);
}

function buildAreaStats(completedOrders, areaById, tableById) {
  return sortDescending(groupBy(
    completedOrders,
    (order) => {
      const directArea = order.area_id ? areaById.get(String(order.area_id)) : null;
      const table = order.table_id ? tableById.get(String(order.table_id)) : null;
      const inheritedArea = table?.area_id ? areaById.get(String(table.area_id)) : null;
      return directArea?.name || inheritedArea?.name || (order.order_type === 'local' ? 'Sin área' : CHANNEL_LABELS[order.order_type]);
    },
    (_order, key) => ({ name: key, orders: 0, revenue: 0, guests: 0 }),
    (current, order) => {
      current.orders += 1;
      current.revenue += number(order.total);
      current.guests += number(order.guest_count);
    },
  ), item => item.revenue);
}

function buildItemStats({ completedOrderIds, items, products }) {
  const productLookup = getProductLookup(products);
  const validItems = items.filter(item => completedOrderIds.has(String(item.order_id)) && item.status !== 'cancelado');

  const productStats = sortDescending(groupBy(
    validItems,
    item => String(item.product_id || normalizeText(item.product_name)),
    (item, key) => ({
      key,
      productId: item.product_id || null,
      name: item.product_name || 'Producto',
      category: cleanOperationalCategoryLabel(item.category || 'Sin categoría'),
      quantity: 0,
      revenue: 0,
      orders: new Set(),
      cost: 0,
      price: number(item.unit_price),
    }),
    (current, item) => {
      current.quantity += number(item.quantity);
      current.revenue += number(item.quantity) * number(item.unit_price);
      current.orders.add(String(item.order_id));
      const product = item.product_id
        ? productLookup.byId.get(String(item.product_id))
        : productLookup.byName.get(normalizeText(item.product_name));
      if (product) {
        current.cost = number(product.cost);
        current.price = number(product.price || item.unit_price);
      }
    },
  ), item => item.revenue).map(item => ({ ...item, orders: item.orders.size }));

  const categoryStats = sortDescending(groupBy(
    validItems,
    item => cleanOperationalCategoryLabel(item.category || 'Sin categoría'),
    (_item, key) => ({ name: key, quantity: 0, revenue: 0, orders: new Set() }),
    (current, item) => {
      current.quantity += number(item.quantity);
      current.revenue += number(item.quantity) * number(item.unit_price);
      current.orders.add(String(item.order_id));
    },
  ), item => item.revenue).map(item => ({ ...item, orders: item.orders.size }));

  const soldProductIds = new Set(productStats.map(item => String(item.productId || '')).filter(Boolean));
  const soldProductNames = new Set(productStats.map(item => normalizeText(item.name)));
  const menuWithoutSales = products
    .filter(product => isRestaurantMenuProductAvailable(product))
    .filter(product => !soldProductIds.has(String(product.id)) && !soldProductNames.has(normalizeText(product.name)))
    .sort((a, b) => number(b.stock) - number(a.stock));

  return { validItems, productStats, categoryStats, menuWithoutSales };
}

function buildKitchenStats(items, start) {
  const periodItems = items.filter(item => inPeriod(item.sent_at || item.cancelled_at || item.created_at, start));
  const kitchenItems = periodItems.filter(item => item.status !== 'cancelado' && (item.sent_at || item.status !== 'pendiente'));
  const completed = kitchenItems
    .map(item => ({
      ...item,
      elapsedMinutes: minutesBetween(item.sent_at, item.ready_at),
    }))
    .filter(item => item.elapsedMinutes !== null);

  const stationStats = groupBy(
    kitchenItems,
    item => item.kitchen_station || 'cocina',
    (item, key) => ({
      key,
      label: getRestaurantStationLabel(key),
      totalItems: 0,
      completedItems: 0,
      totalMinutes: 0,
      delayedItems: 0,
      pendingItems: 0,
    }),
    (current, item) => {
      current.totalItems += 1;
      const elapsed = minutesBetween(item.sent_at, item.ready_at);
      if (elapsed !== null) {
        current.completedItems += 1;
        current.totalMinutes += elapsed;
        if (number(item.preparation_minutes) > 0 && elapsed > number(item.preparation_minutes)) current.delayedItems += 1;
      } else if (!['servido', 'cancelado'].includes(item.status)) {
        current.pendingItems += 1;
      }
    },
  ).map(item => ({
    ...item,
    averageMinutes: item.completedItems > 0 ? item.totalMinutes / item.completedItems : 0,
  })).sort((a, b) => b.totalItems - a.totalItems);

  const averageMinutes = completed.length > 0
    ? sum(completed, item => item.elapsedMinutes) / completed.length
    : 0;
  const delayedItems = completed.filter(item => number(item.preparation_minutes) > 0 && item.elapsedMinutes > number(item.preparation_minutes));
  const cancelledItems = periodItems.filter(item => item.status === 'cancelado');

  return {
    kitchenItems,
    completed,
    stationStats,
    averageMinutes,
    delayedItems,
    cancelledItems,
  };
}

function buildConsumptionStats(consumptions, start) {
  const filtered = consumptions.filter(item => !item.reversed_at && inPeriod(item.consumed_at, start));
  const ingredientStats = sortDescending(groupBy(
    filtered,
    item => String(item.ingredient_product_id || normalizeText(item.ingredient_name)),
    (item, key) => ({
      key,
      productId: item.ingredient_product_id || null,
      name: item.ingredient_name || 'Ingrediente',
      sourceKind: item.source_kind || 'ingredient',
      requiredQuantity: 0,
      appliedQuantity: 0,
      shortageQuantity: 0,
      stockUnit: item.stock_unit || '',
      theoreticalCost: 0,
      appliedCost: 0,
      shortageCost: 0,
      orders: new Set(),
    }),
    (current, item) => {
      current.requiredQuantity += number(item.stock_quantity || item.required_quantity);
      current.appliedQuantity += number(item.applied_quantity);
      current.shortageQuantity += number(item.shortage_quantity);
      current.theoreticalCost += number(item.theoretical_cost);
      current.appliedCost += number(item.applied_cost);
      current.shortageCost += Math.max(number(item.theoretical_cost) - number(item.applied_cost), 0);
      current.orders.add(String(item.order_id));
      if (!current.stockUnit) current.stockUnit = item.stock_unit || '';
    },
  ), item => item.appliedCost).map(item => ({ ...item, orders: item.orders.size }));

  const shortages = ingredientStats
    .filter(item => item.shortageQuantity > 0)
    .sort((a, b) => b.shortageCost - a.shortageCost);

  return {
    rows: filtered,
    ingredientStats,
    shortages,
    theoreticalCost: sum(filtered, item => item.theoretical_cost),
    appliedCost: sum(filtered, item => item.applied_cost),
    shortageCount: filtered.filter(item => number(item.shortage_quantity) > 0).length,
  };
}

function buildWasteStats(adjustments, start) {
  const filtered = adjustments.filter(item => inPeriod(item.event_date || item.created_at, start));
  const wasteRows = filtered.filter(item => item.adjustment_kind === 'waste');
  const countRows = filtered.filter(item => item.adjustment_kind === 'physical_count');
  const byReason = sortDescending(groupBy(
    wasteRows,
    item => item.reason_label || item.reason_code || 'Sin motivo',
    (_item, key) => ({ name: key, records: 0, quantity: 0, cost: 0 }),
    (current, item) => {
      current.records += 1;
      current.quantity += Math.abs(number(item.quantity_delta));
      current.cost += number(item.cost_impact);
    },
  ), item => item.cost);

  return {
    rows: filtered,
    wasteRows,
    countRows,
    byReason,
    wasteCost: sum(wasteRows, item => item.cost_impact),
  };
}

function buildInventorySections(products) {
  const active = products.filter(product => normalizeText(product.status || 'Activo') !== 'inactivo');
  const sections = [
    { key: 'menu', label: 'Menú', roles: ['menu'] },
    { key: 'preparation', label: 'Preparaciones', roles: ['preparation'] },
    { key: 'supply', label: 'Insumos y empaques', roles: ['supply'] },
  ].map(section => {
    const rows = active.filter(product => section.roles.includes(getRestaurantProductRole(product)));
    return {
      ...section,
      products: rows,
      count: rows.length,
      value: sum(rows, product => number(product.stock) * number(product.cost)),
    };
  });

  const lowStock = active
    .filter(product => getRestaurantProductRole(product) !== 'menu')
    .filter(product => number(product.minStock) > 0 && number(product.stock) <= number(product.minStock))
    .sort((a, b) => (number(b.minStock) - number(b.stock)) - (number(a.minStock) - number(a.stock)));

  return {
    sections,
    lowStock,
    totalValue: sum(sections, section => section.value),
  };
}

function buildMenuEconomics(products, productStats) {
  const statsById = new Map(productStats.map(item => [String(item.productId || ''), item]));
  const statsByName = new Map(productStats.map(item => [normalizeText(item.name), item]));

  return products
    .filter(product => isRestaurantMenuProduct(product))
    .filter(product => normalizeText(product.status || 'Activo') !== 'inactivo')
    .map((product) => {
      const sales = statsById.get(String(product.id)) || statsByName.get(normalizeText(product.name));
      const price = number(product.price);
      const cost = number(product.cost);
      const foodCostPercent = price > 0 ? (cost / price) * 100 : 0;
      const unitMargin = price - cost;
      return {
        product,
        sales,
        price,
        cost,
        foodCostPercent,
        unitMargin,
        estimatedMargin: number(sales?.quantity) * unitMargin,
      };
    })
    .sort((a, b) => number(b.sales?.revenue) - number(a.sales?.revenue));
}

export function buildRestaurantReportModel({
  period = '30',
  products = [],
  orders = [],
  items = [],
  payments = [],
  consumptions = [],
  adjustments = [],
  issues = [],
  areas = [],
  tables = [],
  now = new Date(),
}) {
  const start = getRestaurantPeriodStart(period, now);
  const { areaById, tableById } = getAreaAndTableLookups(areas, tables);

  const completedOrders = orders
    .filter(order => order.status === 'cerrada')
    .filter(order => inPeriod(order.closed_at || order.updated_at || order.created_at, start));
  const activeOrders = orders
    .filter(order => !['cerrada', 'cancelada'].includes(order.status));
  const cancelledOrders = orders
    .filter(order => order.status === 'cancelada')
    .filter(order => inPeriod(order.closed_at || order.updated_at || order.created_at, start));
  const periodOrders = orders.filter(order => inPeriod(order.closed_at || order.opened_at || order.created_at, start));
  const completedOrderIds = new Set(completedOrders.map(order => String(order.id)));

  const revenue = sum(completedOrders, order => order.total);
  const subtotal = sum(completedOrders, order => order.subtotal);
  const discounts = sum(completedOrders, order => order.discount_amount);
  const serviceCharges = sum(completedOrders, order => order.service_charge);
  const guests = sum(completedOrders, order => order.guest_count);
  const averageTicket = completedOrders.length > 0 ? revenue / completedOrders.length : 0;
  const averagePerGuest = guests > 0 ? revenue / guests : 0;

  const activePayments = payments
    .filter(payment => payment.status === 'active')
    .filter(payment => inPeriod(payment.paid_at || payment.created_at, start));
  const collected = sum(activePayments, payment => payment.amount);
  const paymentMethods = sortDescending(groupBy(
    activePayments,
    payment => payment.payment_method || 'Sin método',
    (_payment, key) => ({ name: key, records: 0, amount: 0 }),
    (current, payment) => {
      current.records += 1;
      current.amount += number(payment.amount);
    },
  ), item => item.amount);

  const itemStats = buildItemStats({ completedOrderIds, items, products });
  const kitchen = buildKitchenStats(items, start);
  const consumption = buildConsumptionStats(consumptions, start);
  const waste = buildWasteStats(adjustments, start);
  const inventory = buildInventorySections(products);
  const menuEconomics = buildMenuEconomics(products, itemStats.productStats);
  const periodIssues = issues.filter(issue => inPeriod(issue.created_at, start));
  const openIssues = issues.filter(issue => !issue.resolved_at);
  const grossMargin = revenue - consumption.appliedCost;
  const foodCostPercent = revenue > 0 ? (consumption.appliedCost / revenue) * 100 : 0;

  return {
    period,
    start,
    periodOrders,
    completedOrders,
    activeOrders,
    cancelledOrders,
    completedOrderIds,
    revenue,
    subtotal,
    discounts,
    serviceCharges,
    guests,
    averageTicket,
    averagePerGuest,
    collected,
    paymentMethods,
    channelStats: buildChannelStats(completedOrders),
    waiterStats: buildWaiterStats(completedOrders),
    areaStats: buildAreaStats(completedOrders, areaById, tableById),
    ...itemStats,
    kitchen,
    consumption,
    waste,
    inventory,
    menuEconomics,
    issues: periodIssues,
    openIssues,
    grossMargin,
    foodCostPercent,
    orders,
    items,
    payments: activePayments,
    consumptions: consumption.rows,
    adjustments: waste.rows,
    areas,
    tables,
    orderLookup: getOrderLookup(orders),
    areaById,
    tableById,
  };
}

export function formatRestaurantMoney(value) {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(number(value));
}

export function formatRestaurantNumber(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat('es-EC', { maximumFractionDigits }).format(number(value));
}

export function formatRestaurantMinutes(value) {
  const minutes = number(value);
  if (minutes <= 0) return '—';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return remainder > 0 ? `${hours} h ${remainder} min` : `${hours} h`;
}

export function getRestaurantChannelLabel(value) {
  return CHANNEL_LABELS[value] || 'Consumo en local';
}

export function getRestaurantOrderStatusLabel(value) {
  return STATUS_LABELS[value] || value || 'Sin estado';
}

export function getRestaurantSuggestedPurchase(product) {
  return Math.max(number(product?.minStock) * 2 - number(product?.stock), 1);
}
