export const fixedExpenseCategoryOptions = [
  'Servicios básicos',
  'Arriendo',
  'Internet / teléfono',
  'Sueldos trabajadores',
  'Honorarios',
  'Publicidad mensual',
  'Sistema / suscripciones',
  'Mantenimiento fijo',
  'Otros gastos fijos',
];

export const expenseCategoryOptions = fixedExpenseCategoryOptions;

export const expensePaymentMethodOptions = ['Efectivo', 'Transferencia', 'Tarjeta', 'Otro'];

export function getTodayInputDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 10);
}

export function getCurrentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getTodayDay(date = new Date()) {
  return date.getDate();
}

export function createEmptyExpenseForm() {
  return {
    category: 'Servicios básicos',
    description: '',
    amount: '',
    dueDay: String(new Date().getDate()),
    paymentMethod: 'Efectivo',
    isActive: true,
    notes: '',
  };
}

export function mapExpenseFromDb(row = {}) {
  const createdDate = row.created_at ? new Date(row.created_at) : new Date();
  const expenseDate = row.expense_date || row.date || createdDate.toISOString().slice(0, 10);
  const rawHistory = Array.isArray(row.payment_history) ? row.payment_history : [];

  return {
    id: row.id,
    storeId: row.store_id || row.user_id || 'demo',
    storeName: row.store_name || '',
    category: row.category || 'Otros gastos fijos',
    description: row.description || 'Gasto fijo sin descripción',
    amount: Number(row.amount || 0),
    paymentMethod: row.payment_method || 'Efectivo',
    expenseDate,
    dueDay: Number(row.due_day || 1),
    isActive: row.is_active !== false,
    lastPaidMonth: row.last_paid_month || '',
    paymentHistory: rawHistory,
    notes: row.notes || '',
    createdAt: row.created_at || '',
  };
}

export function mapExpenseToDb(expense, userId) {
  return {
    user_id: userId,
    store_id: expense.storeId,
    store_name: expense.storeName,
    category: expense.category,
    description: expense.description,
    amount: Number(expense.amount || 0),
    payment_method: expense.paymentMethod,
    expense_date: expense.expenseDate || getTodayInputDate(),
    due_day: Number(expense.dueDay || 1),
    is_active: expense.isActive !== false,
    last_paid_month: expense.lastPaidMonth || null,
    payment_history: Array.isArray(expense.paymentHistory) ? expense.paymentHistory : [],
    notes: expense.notes || '',
  };
}

export function formatExpenseDate(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function getDaysUntilDue(expense, todayDay = getTodayDay()) {
  return Number(expense?.dueDay || 1) - todayDay;
}

export function dueLabel(days) {
  if (days < 0) return `Vencido hace ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'Vence hoy';
  if (days === 1) return 'Vence mañana';
  return `Vence en ${days} días`;
}

export function formatPaidAt(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function isPaidThisMonth(expense, currentMonth = getCurrentMonthKey()) {
  if (expense?.lastPaidMonth === currentMonth) return true;
  return Array.isArray(expense?.paymentHistory) && expense.paymentHistory.some(payment => payment.month === currentMonth);
}

export function getCurrentMonthPayment(expense, currentMonth = getCurrentMonthKey()) {
  if (!Array.isArray(expense?.paymentHistory)) return null;
  return [...expense.paymentHistory].reverse().find(payment => payment.month === currentMonth) || null;
}
