export function statusText(product) {
  if (product.stock === 0) {
    return {
      label: 'Sin stock',
      color: 'text-red-600',
      badge: 'bg-red-50 text-red-700',
    };
  }

  if (product.stock <= product.minStock) {
    return {
      label: 'Stock bajo',
      color: 'text-amber-600',
      badge: 'bg-amber-50 text-amber-700',
    };
  }

  return {
    label: 'Disponible',
    color: 'text-emerald-600',
    badge: 'bg-emerald-50 text-emerald-700',
  };
}

export function expirationText(product) {
  if (!product.expirationDate) {
    return {
      label: 'Sin caducidad',
      color: 'text-slate-500',
      badge: 'bg-slate-50 text-slate-600',
      days: null,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiration = new Date(product.expirationDate);
  expiration.setHours(0, 0, 0, 0);

  const days = Math.ceil((expiration - today) / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return {
      label: 'Vencido',
      color: 'text-red-600',
      badge: 'bg-red-50 text-red-700',
      days,
    };
  }

  if (days <= 15) {
    return {
      label: 'Por vencer',
      color: 'text-amber-600',
      badge: 'bg-amber-50 text-amber-700',
      days,
    };
  }

  if (days <= 30) {
    return {
      label: 'Vence pronto',
      color: 'text-blue-600',
      badge: 'bg-blue-50 text-blue-700',
      days,
    };
  }

  return {
    label: 'Vigente',
    color: 'text-emerald-600',
    badge: 'bg-emerald-50 text-emerald-700',
    days,
  };
}