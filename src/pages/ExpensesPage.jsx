import React, { useMemo, useState } from 'react';
import Field from '../components/Field';
import Metric from '../components/Metric';
import EmptyState from '../components/EmptyState';
import {
  dueLabel,
  expensePaymentMethodOptions,
  fixedExpenseCategoryOptions,
  formatPaidAt,
  getCurrentMonthKey,
  getCurrentMonthPayment,
  getDaysUntilDue,
  getTodayDay,
  isPaidThisMonth,
} from '../utils/expenses';
import { AlertCircle, BellRing, CalendarDays, CheckCircle2, DollarSign, Edit, ReceiptText, Trash2, WalletCards } from 'lucide-react';

export default function ExpensesPage({
  expenses,
  expenseForm,
  setExpenseForm,
  saveExpense,
  resetExpenseForm,
  editExpense,
  deleteExpense,
  markExpensePaid,
  editingExpenseId,
  pendingDeleteExpenseId,
  setPendingDeleteExpenseId,
  expenseNotice,
  expensesLoading,
}) {
  const [statusFilter, setStatusFilter] = useState('Pendientes');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [paymentExpense, setPaymentExpense] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', paymentMethod: 'Efectivo', notes: '' });

  const currentMonth = getCurrentMonthKey();
  const todayDay = getTodayDay();

  const fixedExpenses = useMemo(() => [...expenses].sort((a, b) => Number(a.dueDay || 1) - Number(b.dueDay || 1)), [expenses]);
  const activeExpenses = fixedExpenses.filter(expense => expense.isActive !== false);
  const paidExpenses = activeExpenses.filter(expense => isPaidThisMonth(expense, currentMonth));
  const pendingExpenses = activeExpenses.filter(expense => !isPaidThisMonth(expense, currentMonth));
  const overdueExpenses = pendingExpenses.filter(expense => Number(expense.dueDay || 1) < todayDay);
  const dueSoonExpenses = pendingExpenses.filter(expense => {
    const days = getDaysUntilDue(expense, todayDay);
    return days >= 0 && days <= 3;
  });
  const alertExpenses = [...overdueExpenses, ...dueSoonExpenses].sort((a, b) => Number(a.dueDay || 1) - Number(b.dueDay || 1));

  const estimatedMonthTotal = activeExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const paidMonthTotal = paidExpenses.reduce((sum, expense) => {
    const payment = getCurrentMonthPayment(expense, currentMonth);
    return sum + Number(payment?.amount ?? expense.amount ?? 0);
  }, 0);
  const pendingMonthTotal = Math.max(estimatedMonthTotal - paidMonthTotal, 0);

  const statusCounts = {
    Pendientes: pendingExpenses.length,
    Pagados: paidExpenses.length,
    Todos: activeExpenses.length,
    Inactivos: fixedExpenses.filter(expense => expense.isActive === false).length,
  };

  const filteredExpenses = fixedExpenses.filter(expense => {
    const paid = isPaidThisMonth(expense, currentMonth);
    const active = expense.isActive !== false;

    if (statusFilter === 'Pendientes' && (!active || paid)) return false;
    if (statusFilter === 'Pagados' && (!active || !paid)) return false;
    if (statusFilter === 'Todos' && !active) return false;
    if (statusFilter === 'Inactivos' && active) return false;
    if (categoryFilter !== 'Todas' && expense.category !== categoryFilter) return false;
    return true;
  });

  function openPaymentModal(expense) {
    setPaymentExpense(expense);
    setPaymentForm({
      amount: Number(expense.amount || 0).toFixed(2),
      paymentMethod: expense.paymentMethod || 'Efectivo',
      notes: '',
    });
  }

  async function submitPayment(event) {
    event.preventDefault();
    if (!paymentExpense) return;

    await markExpensePaid(paymentExpense, {
      amount: paymentForm.amount,
      paymentMethod: paymentForm.paymentMethod,
      notes: paymentForm.notes,
    });

    setPaymentExpense(null);
    setPaymentForm({ amount: '', paymentMethod: 'Efectivo', notes: '' });
  }

  return (
    <div className="space-y-5">
      {alertExpenses.length > 0 && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white p-3 text-amber-600 shadow-sm">
                <BellRing className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-amber-900">Alertas de gastos fijos</h3>
                <p className="mt-1 text-sm font-medium text-amber-800">Estos pagos están vencidos o se acercan en los próximos 3 días.</p>
              </div>
            </div>
            <div className="grid w-full gap-2 lg:max-w-xl">
              {alertExpenses.slice(0, 4).map(expense => {
                const days = getDaysUntilDue(expense, todayDay);
                const danger = days < 0;
                return (
                  <div key={expense.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm shadow-sm">
                    <div>
                      <p className="font-bold text-slate-900">{expense.description}</p>
                      <p className="text-xs text-slate-500">Día {expense.dueDay || 1} · {expense.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-slate-900">${Number(expense.amount || 0).toFixed(2)}</p>
                      <p className={danger ? 'text-xs font-bold text-red-600' : 'text-xs font-bold text-amber-600'}>{dueLabel(days)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric icon={DollarSign} label="Estimado mensual" value={`$${estimatedMonthTotal.toFixed(2)}`} note="gastos fijos activos" color="red" />
        <Metric icon={CheckCircle2} label="Pagado este mes" value={`$${paidMonthTotal.toFixed(2)}`} note={`${paidExpenses.length} pago(s)`} color="emerald" />
        <Metric icon={AlertCircle} label="Pendiente por pagar" value={`$${pendingMonthTotal.toFixed(2)}`} note={`${pendingExpenses.length} pendiente(s)`} color="amber" />
        <Metric icon={BellRing} label="Por vencer" value={dueSoonExpenses.length} note={`${overdueExpenses.length} vencido(s)`} color="amber" />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
        <section className="order-2 rounded-3xl border border-slate-200 bg-white shadow-sm xl:order-1">
          {expensesLoading && <div className="border-b border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Cargando gastos fijos desde Supabase...</div>}
          <div className="border-b border-slate-100 p-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-xl font-bold"><ReceiptText className="h-5 w-5 text-emerald-600" /> Gastos fijos del mes</h3>
                  <p className="mt-1 text-sm text-slate-500">Controla pagos repetitivos. Los gastos pequeños del día se registran en Caja diaria.</p>
                </div>
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-200">
                  <option>Todas</option>
                  {fixedExpenseCategoryOptions.map(category => <option key={category}>{category}</option>)}
                </select>
              </div>

              <div className="flex flex-wrap gap-2">
                {['Pendientes', 'Pagados', 'Todos', 'Inactivos'].map(status => {
                  const active = statusFilter === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setStatusFilter(status)}
                      className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${active ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {status} ({statusCounts[status] || 0})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredExpenses.length === 0 && (
              <div className="p-5">
                <EmptyState icon={ReceiptText} title="No hay gastos en este filtro" text="Cambia el filtro o registra arriendo, luz, agua, internet, sueldos u otros pagos repetitivos." />
              </div>
            )}

            {filteredExpenses.map(expense => {
              const isDeleting = pendingDeleteExpenseId === expense.id;
              const paid = isPaidThisMonth(expense, currentMonth);
              const isInactive = expense.isActive === false;
              const days = getDaysUntilDue(expense, todayDay);
              const isOverdue = !paid && !isInactive && Number(expense.dueDay || 1) < todayDay;
              const latestPayment = Array.isArray(expense.paymentHistory) ? [...expense.paymentHistory].reverse()[0] : null;
              const currentPayment = getCurrentMonthPayment(expense, currentMonth);

              return (
                <div key={expense.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`rounded-2xl p-3 ${paid ? 'bg-emerald-50 text-emerald-600' : isOverdue ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
                      {paid ? <CheckCircle2 className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-900">{expense.description}</p>
                        {paid && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Pagado este mes</span>}
                        {isOverdue && <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">Vencido</span>}
                        {!paid && !isOverdue && !isInactive && days <= 3 && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-600">{dueLabel(days)}</span>}
                        {isInactive && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">Inactivo</span>}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{expense.category} · día {expense.dueDay || 1} de cada mes · habitual: {expense.paymentMethod}</p>
                      {currentPayment && <p className="mt-1 text-xs font-semibold text-emerald-600">Pago del mes: ${Number(currentPayment.amount || 0).toFixed(2)} · {currentPayment.paymentMethod} · {formatPaidAt(currentPayment.paidAt)}</p>}
                      {!currentPayment && latestPayment && <p className="mt-1 text-xs text-slate-500">Último pago: ${Number(latestPayment.amount || 0).toFixed(2)} · {latestPayment.paymentMethod} · {formatPaidAt(latestPayment.paidAt)}</p>}
                      {expense.notes && <p className="mt-1 text-xs text-slate-400">Nota: {expense.notes}</p>}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
                    <p className="text-left text-lg font-extrabold text-red-600 sm:text-right">${Number(expense.amount || 0).toFixed(2)}</p>
                    {isDeleting ? (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => deleteExpense(expense.id)} className="rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-white hover:bg-red-600">Confirmar</button>
                        <button type="button" onClick={() => setPendingDeleteExpenseId(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50">Cancelar</button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {!paid && !isInactive && (
                          <button type="button" onClick={() => openPaymentModal(expense)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">Marcar pagado</button>
                        )}
                        <button type="button" onClick={() => editExpense(expense)} className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50"><Edit className="h-4 w-4" /></button>
                        <button type="button" onClick={() => setPendingDeleteExpenseId(expense.id)} className="rounded-xl border border-red-100 p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <form onSubmit={saveExpense} className="order-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:order-2">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">{editingExpenseId ? 'Editar gasto fijo' : 'Registrar gasto fijo'}</h3>
              <p className="text-sm text-slate-500">Solo pagos repetitivos del negocio.</p>
            </div>
            <button type="button" onClick={resetExpenseForm} className="rounded-xl p-2 hover:bg-slate-50">×</button>
          </div>

          {expenseNotice && (
            <div className={`mb-4 rounded-2xl p-4 text-sm font-semibold ${expenseNotice.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {expenseNotice.message}
            </div>
          )}

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Categoría</span>
              <select value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200">
                {fixedExpenseCategoryOptions.map(category => <option key={category}>{category}</option>)}
              </select>
            </label>
            <Field label="Nombre del gasto" value={expenseForm.description} onChange={v => setExpenseForm({ ...expenseForm, description: v })} placeholder="Ej: Arriendo, luz, internet, sueldo vendedor" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Monto estimado" type="number" value={expenseForm.amount} onChange={v => setExpenseForm({ ...expenseForm, amount: v })} placeholder="0.00" min="0" step="0.01" />
              <Field label="Día de pago" type="number" value={expenseForm.dueDay} onChange={v => setExpenseForm({ ...expenseForm, dueDay: v })} placeholder="Ej: 5" min="1" max="31" step="1" />
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Método habitual</span>
              <select value={expenseForm.paymentMethod} onChange={e => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200">
                {expensePaymentMethodOptions.map(method => <option key={method}>{method}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={expenseForm.isActive !== false} onChange={e => setExpenseForm({ ...expenseForm, isActive: e.target.checked })} className="h-4 w-4 accent-emerald-600" />
              Gasto activo
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Observaciones</span>
              <textarea value={expenseForm.notes} onChange={e => setExpenseForm({ ...expenseForm, notes: e.target.value })} className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200" placeholder="Detalle adicional del gasto fijo..." />
            </label>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button type="button" onClick={resetExpenseForm} className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold hover:bg-slate-50">Cancelar</button>
              <button type="submit" className="rounded-2xl bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700">{editingExpenseId ? 'Actualizar' : 'Guardar'}</button>
            </div>
          </div>
        </form>
      </div>

      {paymentExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <form onSubmit={submitPayment} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-xl font-extrabold text-slate-900"><WalletCards className="h-5 w-5 text-emerald-600" /> Confirmar pago</h3>
                <p className="mt-1 text-sm text-slate-500">{paymentExpense.description}</p>
              </div>
              <button type="button" onClick={() => setPaymentExpense(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">×</button>
            </div>

            <div className="mb-5 rounded-2xl bg-slate-50 p-4 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Monto estimado</span>
                <strong>${Number(paymentExpense.amount || 0).toFixed(2)}</strong>
              </div>
              <div className="mt-2 flex justify-between gap-3">
                <span className="text-slate-500">Método habitual</span>
                <strong>{paymentExpense.paymentMethod || 'Efectivo'}</strong>
              </div>
            </div>

            <div className="space-y-4">
              <Field label="Monto pagado" type="number" value={paymentForm.amount} onChange={v => setPaymentForm({ ...paymentForm, amount: v })} placeholder="0.00" min="0" step="0.01" />
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Método usado este mes</span>
                <select value={paymentForm.paymentMethod} onChange={e => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200">
                  {expensePaymentMethodOptions.map(method => <option key={method}>{method}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Nota del pago</span>
                <textarea value={paymentForm.notes} onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })} className="min-h-20 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200" placeholder="Ej: pagado con transferencia del banco..." />
              </label>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button type="button" onClick={() => setPaymentExpense(null)} className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold hover:bg-slate-50">Cancelar</button>
                <button type="submit" className="rounded-2xl bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700">Guardar pago</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
