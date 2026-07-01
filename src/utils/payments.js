export function toMoneyNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

export function isSplitPaymentAvailable(currentUser) {
  const storeName = String(currentUser?.store || '').toLowerCase();
  return Boolean(currentUser?.splitPaymentEnabled) || storeName.includes('kuehns') || storeName.includes('kuehns 5');
}

export function getSplitPaymentAmounts(saleForm) {
  return {
    cashAmount: toMoneyNumber(saleForm?.cashAmount),
    cardAmount: toMoneyNumber(saleForm?.cardAmount),
    transferAmount: toMoneyNumber(saleForm?.transferAmount),
  };
}

export function getSplitPaymentTotal(saleForm) {
  const amounts = getSplitPaymentAmounts(saleForm);
  return toMoneyNumber(amounts.cashAmount + amounts.cardAmount + amounts.transferAmount);
}

export function getPaymentDisplay(sale) {
  const method = sale?.paymentMethod || sale?.payment_method || 'Efectivo';
  const cash = toMoneyNumber(sale?.cashAmount ?? sale?.cash_amount);
  const card = toMoneyNumber(sale?.cardAmount ?? sale?.card_amount);
  const transfer = toMoneyNumber(sale?.transferAmount ?? sale?.transfer_amount);

  if (method !== 'Mixto') return method;

  const parts = [];
  if (cash > 0) parts.push(`Efectivo $${cash.toFixed(2)}`);
  if (card > 0) parts.push(`Tarjeta $${card.toFixed(2)}`);
  if (transfer > 0) parts.push(`Transferencia $${transfer.toFixed(2)}`);

  return parts.length > 0 ? `Mixto · ${parts.join(' · ')}` : 'Mixto';
}

export function isCreditPaymentMethod(paymentMethod) {
  const text = String(paymentMethod || '').trim().toLowerCase();
  return text.includes('fiado') || text.includes('crédito') || text.includes('credito');
}
