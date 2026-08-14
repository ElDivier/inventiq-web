import { supabase } from '../supabaseClient';
import { mapRestaurantOrder } from './restaurantOrders';
import { getRestaurantStationLabel, RESTAURANT_STATIONS } from './restaurantMenu';

export const KITCHEN_ACTIVE_STATUSES = ['enviado', 'preparacion', 'listo'];

export const KITCHEN_STATUS_META = {
  enviado: {
    label: 'Por iniciar',
    shortLabel: 'Nuevo',
    badgeClass: 'border-cyan-300 bg-cyan-50 text-cyan-800',
    cardClass: 'border-cyan-400/60',
  },
  preparacion: {
    label: 'En preparación',
    shortLabel: 'Preparando',
    badgeClass: 'border-amber-300 bg-amber-50 text-amber-800',
    cardClass: 'border-amber-400/70',
  },
  listo: {
    label: 'Listo para entregar',
    shortLabel: 'Listo',
    badgeClass: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    cardClass: 'border-emerald-400/70',
  },
};

export function getKitchenStatusMeta(status) {
  return KITCHEN_STATUS_META[status] || KITCHEN_STATUS_META.enviado;
}

export function getKitchenStationsWithAll() {
  return [{ value: 'todas', label: 'Todas las estaciones' }, ...RESTAURANT_STATIONS];
}

export function getKitchenStationName(value) {
  return value === 'todas' ? 'Todas las estaciones' : getRestaurantStationLabel(value);
}

export async function fetchRestaurantKitchenOrders(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('restaurant_orders')
    .select('*, restaurant_order_items(*)')
    .eq('user_id', userId)
    .not('status', 'in', '(cerrada,cancelada)')
    .order('sent_at', { ascending: true, nullsFirst: false })
    .limit(200);

  if (error) throw error;

  return (data || [])
    .map(mapRestaurantOrder)
    .map((order) => ({
      ...order,
      items: order.items.filter((item) => KITCHEN_ACTIVE_STATUSES.includes(item.status)),
    }))
    .filter((order) => order.items.length > 0);
}

export async function setRestaurantKitchenItemStatus(itemId, status) {
  const { data, error } = await supabase.rpc('restaurant_kitchen_set_item_status', {
    p_item_id: itemId,
    p_status: status,
  });
  if (error) throw error;
  return data;
}

export async function setRestaurantKitchenStationStatus(orderId, station, status) {
  const { data, error } = await supabase.rpc('restaurant_kitchen_set_station_status', {
    p_order_id: orderId,
    p_station: station || 'todas',
    p_status: status,
  });
  if (error) throw error;
  return Number(data || 0);
}

export async function toggleRestaurantKitchenPriority(itemId) {
  const { data, error } = await supabase.rpc('restaurant_kitchen_toggle_priority', {
    p_item_id: itemId,
  });
  if (error) throw error;
  return data;
}

export function subscribeRestaurantKitchen(userId, onChange) {
  if (!userId) return () => {};
  const channel = supabase
    .channel(`restaurant-kitchen-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'restaurant_orders', filter: `user_id=eq.${userId}` },
      onChange
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'restaurant_order_items', filter: `user_id=eq.${userId}` },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function kitchenElapsedMinutes(date, now = Date.now()) {
  if (!date) return 0;
  return Math.max(0, Math.floor((now - new Date(date).getTime()) / 60000));
}

export function getKitchenItemUrgency(item, now = Date.now()) {
  const elapsed = kitchenElapsedMinutes(item.sentAt || item.createdAt, now);
  const target = Math.max(1, Number(item.preparationMinutes || 15));

  if (item.status === 'listo') {
    return {
      level: 'ready',
      elapsed,
      target,
      label: `Listo hace ${kitchenElapsedMinutes(item.readyAt || item.sentAt, now)} min`,
      className: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    };
  }

  if (elapsed >= target + 5) {
    return {
      level: 'overdue',
      elapsed,
      target,
      label: `${elapsed} min · atrasado`,
      className: 'border-red-300 bg-red-50 text-red-800',
    };
  }

  if (elapsed >= target) {
    return {
      level: 'warning',
      elapsed,
      target,
      label: `${elapsed}/${target} min`,
      className: 'border-amber-300 bg-amber-50 text-amber-800',
    };
  }

  return {
    level: 'normal',
    elapsed,
    target,
    label: `${elapsed}/${target} min`,
    className: 'border-slate-600 bg-slate-800 text-slate-200',
  };
}

export function getKitchenTicketUrgency(items = [], now = Date.now()) {
  const ranks = { normal: 0, ready: 1, warning: 2, overdue: 3 };
  return items.reduce(
    (worst, item) => {
      const urgency = getKitchenItemUrgency(item, now);
      return ranks[urgency.level] > ranks[worst.level] ? urgency : worst;
    },
    { level: 'normal', elapsed: 0, target: 15, label: 'A tiempo' }
  );
}

export function kitchenOrderReference(order = {}) {
  if (order.orderType === 'local') return order.orderReference || order.code || 'Mesa';
  if (order.orderType === 'takeaway') return order.orderReference || order.customerName || 'Para llevar';
  return order.orderReference || order.customerName || 'Delivery';
}
