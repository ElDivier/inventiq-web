export const STORAGE_KEYS = {
  users: 'inventiq_users',
  currentUser: 'inventiq_current_user',
  products: 'inventiq_products',
  sales: 'inventiq_sales',
  clients: 'inventiq_clients',
  providers: 'inventiq_providers',
};

export function loadFromStorage(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

export function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('No se pudo guardar en localStorage:', error);
  }
}

export function getDraftKey(userId, name) {
  return `inventiq_draft_${userId || 'demo'}_${name}`;
}

export function saveDraft(userId, name, value) {
  if (!userId) return;
  saveToStorage(getDraftKey(userId, name), value);
}

export function loadDraft(userId, name, fallback) {
  if (!userId) return fallback;
  return loadFromStorage(getDraftKey(userId, name), fallback);
}

export function clearDraft(userId, name) {
  if (!userId) return;
  try {
    localStorage.removeItem(getDraftKey(userId, name));
  } catch (error) {
    console.error('No se pudo limpiar borrador:', error);
  }
}

export function hasDraftData(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (!value || typeof value !== 'object') return Boolean(value);
  return Object.values(value).some(item => {
    if (typeof item === 'boolean') return item;
    if (typeof item === 'number') return item !== 0 && item !== 1;
    if (Array.isArray(item)) return item.length > 0;
    return String(item || '').trim() !== '';
  });
}