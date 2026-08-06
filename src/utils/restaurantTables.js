import { supabase } from '../supabaseClient';

export const RESTAURANT_TABLE_STATUSES = [
  {
    value: 'libre',
    label: 'Libre',
    detail: 'Disponible para recibir clientes',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dotClass: 'bg-emerald-500',
  },
  {
    value: 'ocupada',
    label: 'Ocupada',
    detail: 'Mesa con cuenta abierta',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    dotClass: 'bg-amber-500',
  },
  {
    value: 'preparacion',
    label: 'En preparación',
    detail: 'Pedido enviado a cocina',
    badgeClass: 'border-orange-200 bg-orange-50 text-orange-700',
    dotClass: 'bg-orange-500',
  },
  {
    value: 'servida',
    label: 'Servida',
    detail: 'Pedido entregado a la mesa',
    badgeClass: 'border-sky-200 bg-sky-50 text-sky-700',
    dotClass: 'bg-sky-500',
  },
  {
    value: 'cobrar',
    label: 'Cuenta solicitada',
    detail: 'Mesa pendiente de cobro',
    badgeClass: 'border-cyan-200 bg-cyan-50 text-cyan-800',
    dotClass: 'bg-cyan-600',
  },
  {
    value: 'limpieza',
    label: 'Por limpiar',
    detail: 'Requiere limpieza antes de usarse',
    badgeClass: 'border-violet-200 bg-violet-50 text-violet-700',
    dotClass: 'bg-violet-500',
  },
  {
    value: 'reservada',
    label: 'Reservada',
    detail: 'Mesa separada para una reserva',
    badgeClass: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    dotClass: 'bg-indigo-500',
  },
];

export const RESTAURANT_TABLE_SHAPES = [
  { value: 'square', label: 'Cuadrada' },
  { value: 'round', label: 'Redonda' },
  { value: 'rectangle', label: 'Rectangular' },
  { value: 'bar', label: 'Barra' },
];

export function getRestaurantTableStatusMeta(status) {
  return RESTAURANT_TABLE_STATUSES.find((option) => option.value === status)
    || RESTAURANT_TABLE_STATUSES[0];
}

export function normalizeRestaurantArea(row = {}) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name || 'Área',
    sortOrder: Number(row.sort_order || 0),
    isActive: row.is_active !== false,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export function normalizeRestaurantTable(row = {}) {
  return {
    id: row.id,
    userId: row.user_id,
    areaId: row.area_id,
    name: row.name || 'Mesa',
    capacity: Math.max(1, Number(row.capacity || 1)),
    shape: row.shape || 'square',
    status: row.status || 'libre',
    sortOrder: Number(row.sort_order || 0),
    waiterName: row.waiter_name || '',
    guestCount: Math.max(0, Number(row.guest_count || 0)),
    openedAt: row.opened_at || null,
    billRequestedAt: row.bill_requested_at || null,
    reservationName: row.reservation_name || '',
    reservedFor: row.reserved_for || null,
    notes: row.notes || '',
    joinedTo: row.joined_to || null,
    currentTotal: Number(row.current_total || 0),
    isActive: row.is_active !== false,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export async function fetchRestaurantFloor(userId) {
  if (!userId) return { areas: [], tables: [] };

  const [areasResult, tablesResult] = await Promise.all([
    supabase
      .from('restaurant_areas')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('restaurant_tables')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ]);

  if (areasResult.error) throw areasResult.error;
  if (tablesResult.error) throw tablesResult.error;

  return {
    areas: (areasResult.data || []).map(normalizeRestaurantArea),
    tables: (tablesResult.data || []).map(normalizeRestaurantTable),
  };
}

export async function seedRestaurantFloor() {
  const { data, error } = await supabase.rpc('restaurant_seed_default_floor');
  if (error) throw error;
  return data;
}

export async function clearRestaurantFloor() {
  const { data, error } = await supabase.rpc('restaurant_clear_floor');
  if (error) throw error;
  return data;
}

export async function createRestaurantArea({ userId, name, sortOrder = 0 }) {
  const { data, error } = await supabase
    .from('restaurant_areas')
    .insert({
      user_id: userId,
      name: String(name || '').trim(),
      sort_order: Number(sortOrder || 0),
      is_active: true,
    })
    .select('*')
    .single();

  if (error) throw error;
  return normalizeRestaurantArea(data);
}

export async function updateRestaurantArea(areaId, patch = {}) {
  const payload = {};
  if (patch.name !== undefined) payload.name = String(patch.name || '').trim();
  if (patch.sortOrder !== undefined) payload.sort_order = Number(patch.sortOrder || 0);
  if (patch.isActive !== undefined) payload.is_active = Boolean(patch.isActive);

  const { data, error } = await supabase
    .from('restaurant_areas')
    .update(payload)
    .eq('id', areaId)
    .select('*')
    .single();

  if (error) throw error;
  return normalizeRestaurantArea(data);
}

export async function createRestaurantTable({
  userId,
  areaId,
  name,
  capacity = 4,
  shape = 'square',
  sortOrder = 0,
}) {
  const { data, error } = await supabase
    .from('restaurant_tables')
    .insert({
      user_id: userId,
      area_id: areaId,
      name: String(name || '').trim(),
      capacity: Math.max(1, Number(capacity || 1)),
      shape,
      sort_order: Number(sortOrder || 0),
      status: 'libre',
      is_active: true,
    })
    .select('*')
    .single();

  if (error) throw error;
  return normalizeRestaurantTable(data);
}

export async function updateRestaurantTable(tableId, patch = {}) {
  const payload = {};
  if (patch.areaId !== undefined) payload.area_id = patch.areaId;
  if (patch.name !== undefined) payload.name = String(patch.name || '').trim();
  if (patch.capacity !== undefined) payload.capacity = Math.max(1, Number(patch.capacity || 1));
  if (patch.shape !== undefined) payload.shape = patch.shape;
  if (patch.sortOrder !== undefined) payload.sort_order = Number(patch.sortOrder || 0);
  if (patch.isActive !== undefined) payload.is_active = Boolean(patch.isActive);

  const { data, error } = await supabase
    .from('restaurant_tables')
    .update(payload)
    .eq('id', tableId)
    .select('*')
    .single();

  if (error) throw error;
  return normalizeRestaurantTable(data);
}

export async function openRestaurantTable({ tableId, guestCount = 1, waiterName = '', notes = '' }) {
  const { data, error } = await supabase.rpc('restaurant_open_table', {
    p_table_id: tableId,
    p_guest_count: Math.max(1, Number(guestCount || 1)),
    p_waiter_name: String(waiterName || '').trim(),
    p_notes: String(notes || '').trim(),
  });

  if (error) throw error;
  return normalizeRestaurantTable(data);
}

export async function updateRestaurantTableService({
  tableId,
  status,
  guestCount = 0,
  waiterName = '',
  notes = '',
  reservationName = '',
  reservedFor = null,
}) {
  const { data, error } = await supabase.rpc('restaurant_update_table_service', {
    p_table_id: tableId,
    p_status: status,
    p_guest_count: Math.max(0, Number(guestCount || 0)),
    p_waiter_name: String(waiterName || '').trim(),
    p_notes: String(notes || '').trim(),
    p_reservation_name: String(reservationName || '').trim(),
    p_reserved_for: reservedFor || null,
  });

  if (error) throw error;
  return normalizeRestaurantTable(data);
}

export async function releaseRestaurantTable(tableId, nextStatus = 'libre') {
  const { data, error } = await supabase.rpc('restaurant_release_table', {
    p_table_id: tableId,
    p_next_status: nextStatus,
  });

  if (error) throw error;
  return normalizeRestaurantTable(data);
}

export async function transferRestaurantTable(sourceTableId, targetTableId) {
  const { data, error } = await supabase.rpc('restaurant_transfer_table', {
    p_source_table_id: sourceTableId,
    p_target_table_id: targetTableId,
  });

  if (error) throw error;
  return data;
}

export async function joinRestaurantTables(primaryTableId, secondaryTableId) {
  const { data, error } = await supabase.rpc('restaurant_join_tables', {
    p_primary_table_id: primaryTableId,
    p_secondary_table_id: secondaryTableId,
  });

  if (error) throw error;
  return data;
}

export async function unjoinRestaurantTable(tableId) {
  const { data, error } = await supabase.rpc('restaurant_unjoin_table', {
    p_table_id: tableId,
  });

  if (error) throw error;
  return normalizeRestaurantTable(data);
}

export async function reorderRestaurantTables(tables = []) {
  if (!tables.length) return;

  const results = await Promise.all(
    tables.map((table, index) => supabase
      .from('restaurant_tables')
      .update({ sort_order: index + 1 })
      .eq('id', table.id))
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}

export function subscribeRestaurantFloor(userId, onChange) {
  if (!userId || typeof onChange !== 'function') return () => {};

  const channel = supabase
    .channel(`restaurant-floor-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'restaurant_areas', filter: `user_id=eq.${userId}` },
      onChange
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'restaurant_tables', filter: `user_id=eq.${userId}` },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function getOpenDurationLabel(openedAt, now = Date.now()) {
  if (!openedAt) return 'Sin hora de apertura';
  const start = new Date(openedAt).getTime();
  if (!Number.isFinite(start)) return 'Sin hora de apertura';
  const minutes = Math.max(0, Math.floor((now - start) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours} h${remaining ? ` ${remaining} min` : ''}`;
}

export function formatReservedFor(value) {
  if (!value) return 'Sin hora definida';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin hora definida';
  return date.toLocaleString('es-EC', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
