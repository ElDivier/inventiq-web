import { cleanOperationalCategoryLabel } from '../config/productTypes';
import { getCafeteriaStationLabel, isCafeteriaMenuProductAvailable } from './cafeteriaMenu';
import { isCafeteriaPreparation, isCafeteriaSupply } from './cafeteriaRecipes';

export const CAFETERIA_REPORT_PERIODS = [
  { value: '7', label: 'Últimos 7 días' },
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
  { value: 'all', label: 'Todo el historial' },
];

const CHANNEL_LABELS = {
  local: 'En local',
  takeaway: 'Para llevar',
  delivery: 'Delivery',
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
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T12:00:00` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
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

function sortDescending(rows, selector) {
  return [...rows].sort((a, b) => number(selector(b)) - number(selector(a)));
}

function groupBy(rows, keySelector, initializer, updater) {
  const map = new Map();
  rows.forEach((row) => {
    const key = keySelector(row);
    if (!key) return;
    const current = map.get(key) || initializer(row, key);
    updater(current, row);
    map.set(key, current);
  });
  return Array.from(map.values());
}

function sum(rows, selector) {
  return rows.reduce((total, row) => total + number(selector(row)), 0);
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

function getOrderItemCost(item, productLookup) {
  const inventoryCost = number(item.inventory_cost);
  if (inventoryCost > 0) return inventoryCost;
  if (item.inventory_status !== 'legacy') return inventoryCost;
  const product = item.product_id
    ? productLookup.byId.get(String(item.product_id))
    : productLookup.byName.get(normalizeText(item.product_name));
  return number(product?.cost) * number(item.quantity);
}

function buildChannelStats(orders) {
  const base = Object.entries(CHANNEL_LABELS).map(([key, label]) => ({ key, label, orders: 0, revenue: 0 }));
  const lookup = new Map(base.map((item) => [item.key, item]));
  orders.forEach((order) => {
    const current = lookup.get(order.order_type) || lookup.get('local');
    current.orders += 1;
    current.revenue += number(order.total);
  });
  return sortDescending(base, (item) => item.revenue);
}

function buildProductStats(items, completedIds, products) {
  const valid = items.filter((item) => completedIds.has(String(item.order_id)) && item.status !== 'cancelado');
  const productLookup = getProductLookup(products);
  const productStats = sortDescending(groupBy(
    valid,
    (item) => String(item.product_id || normalizeText(item.product_name)),
    (item, key) => ({ key, productId: item.product_id || null, name: item.product_name || 'Producto', quantity: 0, revenue: 0, cost: 0, orders: new Set() }),
    (current, item) => {
      current.quantity += number(item.quantity);
      current.revenue += number(item.quantity) * number(item.unit_price);
      current.cost += getOrderItemCost(item, productLookup);
      current.orders.add(String(item.order_id));
    },
  ), (item) => item.revenue).map((item) => ({
    ...item,
    orders: item.orders.size,
    margin: item.revenue - item.cost,
    foodCostPercent: item.revenue > 0 ? (item.cost / item.revenue) * 100 : 0,
  }));

  const categoryStats = sortDescending(groupBy(
    valid,
    (item) => {
      const product = item.product_id ? productLookup.byId.get(String(item.product_id)) : productLookup.byName.get(normalizeText(item.product_name));
      return cleanOperationalCategoryLabel(product?.category || 'Sin categoría');
    },
    (_item, key) => ({ name: key, quantity: 0, revenue: 0, orders: new Set() }),
    (current, item) => {
      current.quantity += number(item.quantity);
      current.revenue += number(item.quantity) * number(item.unit_price);
      current.orders.add(String(item.order_id));
    },
  ), (item) => item.revenue).map((item) => ({ ...item, orders: item.orders.size }));

  const soldIds = new Set(productStats.map((item) => String(item.productId || '')).filter(Boolean));
  const soldNames = new Set(productStats.map((item) => normalizeText(item.name)));
  const menuWithoutSales = (products || [])
    .filter((product) => isCafeteriaMenuProductAvailable(product))
    .filter((product) => !soldIds.has(String(product.id)) && !soldNames.has(normalizeText(product.name)))
    .sort((a, b) => number(b.stock) - number(a.stock));

  return { valid, productStats, categoryStats, menuWithoutSales };
}

function buildVariantStats(items, completedIds) {
  return sortDescending(groupBy(
    items.filter((item) => completedIds.has(String(item.order_id)) && item.status !== 'cancelado' && String(item.variant_summary || '').trim()),
    (item) => `${normalizeText(item.product_name)}|${normalizeText(item.variant_summary)}`,
    (item) => ({ product: item.product_name || 'Producto', variant: item.variant_summary || 'Sin variante', quantity: 0, revenue: 0, orders: new Set() }),
    (current, item) => {
      current.quantity += number(item.quantity);
      current.revenue += number(item.quantity) * number(item.unit_price);
      current.orders.add(String(item.order_id));
    },
  ), (item) => item.quantity).map((item) => ({ ...item, orders: item.orders.size }));
}

function buildStationStats(items, start) {
  const periodItems = items.filter((item) => inPeriod(item.created_at, start) && item.status !== 'cancelado');
  const stats = groupBy(
    periodItems,
    (item) => item.station || 'barra',
    (_item, key) => ({ key, label: getCafeteriaStationLabel(key), totalItems: 0, completedItems: 0, totalMinutes: 0, delayedItems: 0, pendingItems: 0 }),
    (current, item) => {
      current.totalItems += 1;
      const elapsed = minutesBetween(item.started_at, item.ready_at);
      if (elapsed !== null) {
        current.completedItems += 1;
        current.totalMinutes += elapsed;
        if (number(item.target_minutes) > 0 && elapsed > number(item.target_minutes)) current.delayedItems += 1;
      } else if (!['listo', 'entregado'].includes(item.status)) {
        current.pendingItems += 1;
      }
    },
  ).map((item) => ({ ...item, averageMinutes: item.completedItems > 0 ? item.totalMinutes / item.completedItems : 0 }));

  const completed = periodItems
    .map((item) => ({ ...item, elapsedMinutes: minutesBetween(item.started_at, item.ready_at) }))
    .filter((item) => item.elapsedMinutes !== null);
  const averageMinutes = completed.length ? sum(completed, (item) => item.elapsedMinutes) / completed.length : 0;
  const delayedItems = completed.filter((item) => number(item.target_minutes) > 0 && item.elapsedMinutes > number(item.target_minutes));
  return { periodItems, stationStats: stats.sort((a, b) => b.totalItems - a.totalItems), completed, averageMinutes, delayedItems };
}

function buildServiceStats(orders) {
  const delivered = orders
    .map((order) => ({ ...order, serviceMinutes: minutesBetween(order.received_at || order.created_at, order.delivered_at) }))
    .filter((order) => order.serviceMinutes !== null);
  return {
    averageMinutes: delivered.length ? sum(delivered, (order) => order.serviceMinutes) / delivered.length : 0,
    delivered,
  };
}

function buildConsumptionStats(consumptions, start) {
  const filtered = consumptions.filter((item) => inPeriod(item.consumed_at, start));
  const ingredients = sortDescending(groupBy(
    filtered,
    (item) => String(item.ingredient_product_id || normalizeText(item.ingredient_name)),
    (item, key) => ({ key, productId: item.ingredient_product_id || null, name: item.ingredient_name || 'Insumo', quantity: 0, shortage: 0, unit: item.stock_unit || '', cost: 0, orders: new Set() }),
    (current, item) => {
      current.quantity += number(item.stock_quantity || item.required_quantity);
      current.shortage += number(item.shortage_quantity);
      current.cost += number(item.theoretical_cost);
      current.orders.add(String(item.order_id));
      if (!current.unit) current.unit = item.stock_unit || '';
    },
  ), (item) => item.cost).map((item) => ({ ...item, orders: item.orders.size }));
  return {
    filtered,
    ingredients,
    theoreticalCost: sum(filtered, (item) => item.theoretical_cost),
    appliedCost: sum(filtered, (item) => item.applied_cost),
    shortageQuantity: sum(filtered, (item) => item.shortage_quantity),
  };
}

function buildWasteStats(adjustments, start) {
  const filtered = adjustments.filter((item) => inPeriod(item.event_date || item.created_at, start));
  const waste = filtered.filter((item) => item.adjustment_kind === 'waste');
  const wasteByReason = sortDescending(groupBy(
    waste,
    (item) => item.reason_label || item.reason_code || 'Otro',
    (_item, key) => ({ name: key, records: 0, cost: 0 }),
    (current, item) => {
      current.records += 1;
      current.cost += number(item.cost_impact);
    },
  ), (item) => item.cost);
  return { filtered, waste, wasteCost: sum(waste, (item) => item.cost_impact), wasteByReason };
}

function buildReplenishment(products, consumptions, daysWindow = 14) {
  const rank = { urgent: 0, warning: 1, plan: 2, ok: 3 };
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - Math.max(daysWindow - 1, 1));
  const demand = new Map();
  consumptions.forEach((item) => {
    if (!inPeriod(item.consumed_at, start) || !item.ingredient_product_id) return;
    const key = String(item.ingredient_product_id);
    demand.set(key, (demand.get(key) || 0) + number(item.stock_quantity || item.required_quantity));
  });

  return (products || [])
    .filter((product) => isCafeteriaSupply(product) || isCafeteriaPreparation(product))
    .map((product) => {
      const stock = Math.max(number(product.stock), 0);
      const minStock = Math.max(number(product.minStock), 0);
      const windowDemand = demand.get(String(product.id)) || 0;
      const dailyDemand = windowDemand / Math.max(daysWindow, 1);
      const coverageDays = dailyDemand > 0 ? stock / dailyDemand : null;
      const target = Math.max(minStock * 2, dailyDemand * 7, minStock);
      const suggested = Math.max(target - stock, 0);
      const priority = stock <= 0 || (minStock > 0 && stock <= minStock) || (coverageDays !== null && coverageDays < 2)
        ? 'urgent'
        : coverageDays !== null && coverageDays < 4
          ? 'warning'
          : suggested > 0
            ? 'plan'
            : 'ok';
      return { product, stock, minStock, windowDemand, dailyDemand, coverageDays, suggested, priority };
    })
    .sort((a, b) => (rank[a.priority] - rank[b.priority]) || (a.coverageDays ?? 9999) - (b.coverageDays ?? 9999));
}

export function getCafeteriaPeriodStart(period, now = new Date()) {
  if (period === 'all') return null;
  const days = Number(period || 30);
  if (!Number.isFinite(days) || days <= 0) return null;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

export function formatCafeteriaMoney(value) {
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number(value));
}

export function formatCafeteriaNumber(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat('es-EC', { maximumFractionDigits }).format(number(value));
}

export function formatCafeteriaMinutes(value) {
  const minutes = number(value);
  if (minutes <= 0) return '—';
  if (minutes < 60) return `${minutes.toFixed(minutes < 10 ? 1 : 0)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function buildCafeteriaReportModel({ products = [], orders = [], items = [], consumptions = [], adjustments = [], issues = [], period = '30' } = {}) {
  const start = getCafeteriaPeriodStart(period);
  const periodOrders = orders.filter((order) => inPeriod(order.received_at || order.created_at, start));
  const completedOrders = periodOrders.filter((order) => order.status === 'entregado');
  const cancelledOrders = periodOrders.filter((order) => order.status === 'cancelado');
  const activeOrders = periodOrders.filter((order) => !['entregado', 'cancelado'].includes(order.status));
  const completedIds = new Set(completedOrders.map((order) => String(order.id)));
  const product = buildProductStats(items, completedIds, products);
  const variants = buildVariantStats(items, completedIds);
  const station = buildStationStats(items, start);
  const service = buildServiceStats(completedOrders);
  const consumption = buildConsumptionStats(consumptions, start);
  const waste = buildWasteStats(adjustments, start);
  const openIssues = issues.filter((issue) => !issue.resolved_at);
  const revenue = sum(completedOrders, (order) => order.total);
  const productLookup = getProductLookup(products);
  const itemCost = sum(product.valid, (item) => getOrderItemCost(item, productLookup));
  const grossMargin = revenue - itemCost - waste.wasteCost;
  const foodCostPercent = revenue > 0 ? (itemCost / revenue) * 100 : 0;
  const averageTicket = completedOrders.length ? revenue / completedOrders.length : 0;
  const replenishment = buildReplenishment(products, consumptions);

  return {
    start,
    periodOrders,
    completedOrders,
    cancelledOrders,
    activeOrders,
    revenue,
    averageTicket,
    itemCost,
    foodCostPercent,
    grossMargin,
    channelStats: buildChannelStats(completedOrders),
    productStats: product.productStats,
    categoryStats: product.categoryStats,
    menuWithoutSales: product.menuWithoutSales,
    variantStats: variants,
    station,
    service,
    consumption,
    waste,
    openIssues,
    replenishment,
  };
}
