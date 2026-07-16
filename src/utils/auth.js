import { ADMIN_EMAILS } from '../config/constants';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isInventiQAdmin(user) {
  const email = normalizeEmail(user?.email || user?.username);
  const adminEmails = ADMIN_EMAILS.map(normalizeEmail);

  return adminEmails.includes(email);
}

export function getAccountAccessBlockReason(profile, email) {
  const currentEmail = normalizeEmail(email);
  const adminEmails = ADMIN_EMAILS.map(normalizeEmail);

  if (adminEmails.includes(currentEmail)) {
    return null;
  }

  if (!profile) {
    return null;
  }

  const status = String(profile.subscription_status || '').trim().toLowerCase();

  if (profile.is_suspended || status === 'suspendido') {
    return 'Tu cuenta de InventiQ está suspendida. Comunícate con InventiQ para reactivar tu acceso.';
  }

  if (status === 'vencido') {
    return 'Tu plan de InventiQ está vencido. Comunícate con InventiQ para renovar tu acceso.';
  }

  if (profile.subscription_end) {
    const today = new Date();
    const endDate = new Date(profile.subscription_end);

    today.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    if (!Number.isNaN(endDate.getTime()) && endDate < today) {
      return 'Tu plan de InventiQ ha vencido. Comunícate con InventiQ para renovar tu acceso.';
    }
  }

  return null;
}

export function validatePasswordSecurity(password) {
  const value = String(password || '');

  if (value.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }

  if (!/[A-ZÁÉÍÓÚÑ]/.test(value)) {
    return 'La contraseña debe incluir al menos una letra mayúscula.';
  }

  if (!/[a-záéíóúñ]/.test(value)) {
    return 'La contraseña debe incluir al menos una letra minúscula.';
  }

  if (!/[0-9]/.test(value)) {
    return 'La contraseña debe incluir al menos un número.';
  }

  if (!/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/.test(value)) {
    return 'La contraseña debe incluir al menos un carácter especial, como @, #, $, %, &, * o !.';
  }

  return null;
}
