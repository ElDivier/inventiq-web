import { supabase } from '../supabaseClient';

function normalizeAccessCode(value = '') {
  return String(value || '').trim().toLowerCase();
}

async function extractFunctionError(error, fallback) {
  const networkMessage = String(error?.message || '').trim();
  if (/failed to fetch|failed to send a request|networkerror|load failed/i.test(networkMessage)) {
    return 'No se pudo conectar con el acceso de empleados. Verifica que la Edge Function restaurant-employee-auth esté publicada y activa en el mismo proyecto Supabase que usa INVENTIQ.';
  }

  const context = error?.context;
  if (context) {
    try {
      const response = typeof context.clone === 'function' ? context.clone() : context;
      if (typeof response.json === 'function') {
        const payload = await response.json();
        const message = String(payload?.error || payload?.message || '').trim();
        if (message) return message;
      }
    } catch {
      try {
        const response = typeof context.clone === 'function' ? context.clone() : context;
        if (typeof response.text === 'function') {
          const text = String(await response.text()).trim();
          if (text) return text;
        }
      } catch {
        // Se conserva el mensaje general de Supabase como último recurso.
      }
    }
  }

  return networkMessage
    .replace(/^Edge Function returned a non-2xx status code:?\s*/i, '')
    .trim() || fallback;
}

function employeeUnlockKey(userId) {
  return `inventiq_employee_unlocked_${userId}`;
}

function employeeBootstrapKey(userId) {
  return `inventiq_employee_bootstrap_${userId}`;
}

export function getRestaurantEmployeeBootstrap(userId) {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(employeeBootstrapKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveRestaurantEmployeeBootstrap(userId, context) {
  if (!userId || !context || typeof window === 'undefined') return;
  sessionStorage.setItem(employeeUnlockKey(userId), '1');
  sessionStorage.setItem(employeeBootstrapKey(userId), JSON.stringify(context));
}

export function clearRestaurantEmployeeBootstrap(userId) {
  if (!userId || typeof window === 'undefined') return;
  sessionStorage.removeItem(employeeUnlockKey(userId));
  sessionStorage.removeItem(employeeBootstrapKey(userId));
}

export async function lookupRestaurantEmployeeAccess({ accessCode, password }) {
  const code = normalizeAccessCode(accessCode);
  const secret = String(password || '');
  if (!code || !secret) throw new Error('Ingresa el código del negocio y la contraseña de acceso.');

  const { data, error } = await supabase.functions.invoke('restaurant-employee-auth', {
    body: {
      action: 'lookup',
      accessCode: code,
      password: secret,
    },
  });

  if (error) throw new Error(await extractFunctionError(error, 'No se pudo validar el acceso del negocio.'));
  if (!data?.ok) throw new Error(data?.error || 'Los datos de acceso no son correctos.');
  return data;
}

export async function loginRestaurantEmployee({ accessCode, password, profileId, pin }) {
  const code = normalizeAccessCode(accessCode);
  const secret = String(password || '');
  const staffPin = String(pin || '').trim();
  if (!code || !secret || !profileId || !staffPin) {
    throw new Error('Selecciona tu perfil e ingresa el PIN.');
  }

  const { data, error } = await supabase.functions.invoke('restaurant-employee-auth', {
    body: {
      action: 'login',
      accessCode: code,
      password: secret,
      profileId,
      pin: staffPin,
    },
  });

  if (error) throw new Error(await extractFunctionError(error, 'No se pudo iniciar la sesión del empleado.'));
  if (!data?.ok || !data?.session?.access_token || !data?.session?.refresh_token) {
    throw new Error(data?.error || 'No se pudo iniciar la sesión del empleado.');
  }

  if (data?.userId && data?.context) {
    saveRestaurantEmployeeBootstrap(data.userId, data.context);
  } else if (typeof window !== 'undefined' && data?.userId) {
    sessionStorage.setItem(employeeUnlockKey(data.userId), '1');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  if (sessionError) {
    if (data?.userId) clearRestaurantEmployeeBootstrap(data.userId);
    throw new Error(sessionError.message || 'No se pudo guardar la sesión del empleado en este dispositivo.');
  }

  const sessionUser = sessionData?.user || sessionData?.session?.user;
  if (!sessionUser) {
    if (data?.userId) clearRestaurantEmployeeBootstrap(data.userId);
    throw new Error('Supabase no devolvió el usuario de la sesión operativa.');
  }

  return {
    sessionUser,
    context: data?.context || getRestaurantEmployeeBootstrap(sessionUser.id),
  };
}

export async function fetchRestaurantEmployeeSessionContext() {
  const { data, error } = await supabase.rpc('restaurant_employee_session_context');
  if (error) throw error;
  if (!data?.ownerId || !data?.operator?.id) throw new Error('La sesión del empleado ya no está disponible.');
  return data;
}

export async function fetchRestaurantEmployeeAccessSettings() {
  const { data, error } = await supabase.rpc('restaurant_get_employee_access_settings');
  if (error) throw error;
  return data || { accessCode: '', isActive: false, passwordConfigured: false };
}

export async function saveRestaurantEmployeeAccessSettings({ accessCode, password = '', isActive = true }) {
  const { data, error } = await supabase.rpc('restaurant_set_employee_access', {
    p_access_code: normalizeAccessCode(accessCode),
    p_password: String(password || ''),
    p_is_active: Boolean(isActive),
  });
  if (error) throw error;
  return data;
}
