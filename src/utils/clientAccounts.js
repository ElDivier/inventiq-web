import { mapClientFromDb } from './mappers';
import { toMoneyNumber } from './payments';

export function isCustomerAccountsAvailable(currentUser) {
  const storeName = String(currentUser?.store || '').toLowerCase();
  return Boolean(currentUser?.customerAccountsEnabled) || storeName.includes('kuehns') || storeName.includes('kuehns 5');
}

export function safeJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

export function makeLocalId(prefix = 'item') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function mapClientWithAccountsFromDb(row = {}) {
  const base = mapClientFromDb(row);
  return {
    ...base,
    accountItems: safeJsonArray(row.account_items),
    paymentHistory: safeJsonArray(row.payment_history),
  };
}

export function getClientAccountTotals(client = {}) {
  const items = safeJsonArray(client.accountItems);
  return items.reduce((acc, item) => {
    const total = toMoneyNumber(item.total);
    const paid = toMoneyNumber(item.paid);
    const pending = Math.max(total - paid, 0);

    if (item.status !== 'Cancelado') {
      acc.total += total;
      acc.paid += paid;
      acc.pending += pending;
    }

    if (item.status === 'Pagado') acc.paidItems += 1;
    if (item.status === 'Cancelado') acc.canceledItems += 1;
    if (item.status !== 'Pagado' && item.status !== 'Cancelado') acc.pendingItems += 1;

    return acc;
  }, { total: 0, paid: 0, pending: 0, pendingItems: 0, paidItems: 0, canceledItems: 0 });
}
