import { supabase } from '../supabaseClient';
import { getRestaurantRolePreset, normalizeRestaurantPermissions } from './restaurantPermissions';

export async function fetchRestaurantStaff(userId) {
  const { data, error } = await supabase
    .from('restaurant_staff_profiles')
    .select('id, user_id, name, role, permissions, is_active, last_used_at, created_at, updated_at')
    .eq('user_id', userId)
    .order('is_active', { ascending: false })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    role: row.role,
    permissions: normalizeRestaurantPermissions(row.permissions, row.role),
    isActive: Boolean(row.is_active),
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createRestaurantStaff({ name, role, pin, permissions }) {
  const { data, error } = await supabase.rpc('restaurant_create_staff_profile', {
    p_name: String(name || '').trim(),
    p_role: role,
    p_pin: String(pin || '').trim(),
    p_permissions: normalizeRestaurantPermissions(permissions, role),
  });
  if (error) throw error;
  return data;
}

export async function updateRestaurantStaff({ id, name, role, permissions, isActive, pin = '' }) {
  const { data, error } = await supabase.rpc('restaurant_update_staff_profile', {
    p_profile_id: id,
    p_name: String(name || '').trim(),
    p_role: role,
    p_permissions: normalizeRestaurantPermissions(permissions, role),
    p_is_active: Boolean(isActive),
    p_pin: String(pin || '').trim() || null,
  });
  if (error) throw error;
  return data;
}

export async function verifyRestaurantStaffPin(profileId, pin) {
  const { data, error } = await supabase.rpc('restaurant_verify_staff_pin', {
    p_profile_id: profileId,
    p_pin: String(pin || '').trim(),
  });
  if (error) throw error;
  const value = data || {};
  return {
    id: value.id,
    name: value.name,
    role: value.role,
    permissions: normalizeRestaurantPermissions(value.permissions, value.role),
  };
}

export async function fetchRestaurantAudit(userId, limit = 80) {
  const { data, error } = await supabase
    .from('restaurant_audit_log')
    .select('id, staff_profile_id, operator_name, operator_role, action, entity_type, entity_id, details, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function auditRestaurantAction(currentUser, action, entityType = null, entityId = null, details = {}) {
  if (!currentUser?.id || !['restaurante', 'cafeteria'].includes(currentUser.businessType)) return;
  try {
    await supabase.rpc('restaurant_log_audit', {
      p_staff_profile_id: currentUser.restaurantOperator?.id || null,
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId ? String(entityId) : null,
      p_details: details || {},
    });
  } catch (error) {
    console.warn('No se pudo registrar auditoría del restaurante:', error);
  }
}

export function buildRestaurantStaffDraft(role = 'mesero') {
  const preset = getRestaurantRolePreset(role);
  return {
    id: '',
    name: '',
    role,
    pin: '',
    isActive: true,
    permissions: [...preset.permissions],
  };
}

export async function fetchRestaurantEmployeeAccessSettings() {
  const { data, error } = await supabase.rpc('restaurant_get_employee_access_settings');
  if (error) throw error;
  return data || { accessCode: '', isActive: false, passwordConfigured: false };
}

export async function saveRestaurantEmployeeAccessSettings({ accessCode, password = '', isActive = true }) {
  const { data, error } = await supabase.rpc('restaurant_set_employee_access', {
    p_access_code: String(accessCode || '').trim().toLowerCase(),
    p_password: String(password || ''),
    p_is_active: Boolean(isActive),
  });
  if (error) throw error;
  return data;
}
