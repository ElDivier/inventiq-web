import { ADMIN_EMAILS } from '../config/constants';

export function isInventiQAdmin(user) {
  const email = String(user?.email || user?.username || '').trim().toLowerCase();
  return ADMIN_EMAILS.includes(email);
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