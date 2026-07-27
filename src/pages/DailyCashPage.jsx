import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CreditCard,
  DollarSign,
  Loader2,
  Lock,
  Plus,
  ReceiptText,
  RefreshCcw,
  TrendingUp,
  Unlock,
} from 'lucide-react';
import { supabase } from '../supabaseClient';

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function parseRecordDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  const text = String(value).trim();
  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) return direct;

  const ddmmyyyy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function getRecordDate(record) {
  return parseRecordDate(
    record?.createdAt ||
    record?.created_at ||
    record?.date ||
    record?.opened_at ||
    record?.created
  );
}

function isAfterStart(record, startDate) {
  const date = getRecordDate(record);
  if (!date || !startDate) return true;
  return date.getTime() >= startDate.getTime();
}

function paymentKey(value) {
  return String(value || 'Efectivo').trim().toLowerCase();
}

export default function DailyCashPage({ currentUser, sales = [], purchases = [] }) {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [openingAmount, setOpeningAmount] = useState('0');
  const [closingAmount, setClosingAmount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '', paymentMethod: 'Efectivo' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!currentUser?.id) return;
    loadCashData();
  }, [currentUser?.id]);

  const sessionStartDate = useMemo(() => {
    return activeSession?.opened_at ? new Date(activeSession.opened_at) : null;
  }, [activeSession?.opened_at]);

  const sessionSales = useMemo(() => {
    return (sales || [])
      .filter(sale => sale.status !== 'Anulada')
      .filter(sale => isAfterStart(sale, sessionStartDate));
  }, [sales, sessionStartDate]);

  const paymentTotals = useMemo(() => {
    return sessionSales.reduce((acc, sale) => {
      const method = paymentKey(sale.paymentMethod || sale.payment_method || 'Efectivo');
      acc[method] = (acc[method] || 0) + Number(sale.total || 0);
      return acc;
    }, {});
  }, [sessionSales]);

  const cashExpenses = useMemo(() => {
    return expenses
      .filter(expense => paymentKey(expense.payment_method) === 'efectivo')
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  }, [expenses]);

  const expenseTotal = useMemo(() => {
    return expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  }, [expenses]);

  const salesTotal = useMemo(() => {
    return sessionSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  }, [sessionSales]);

  const expectedCash = useMemo(() => {
    return Number(activeSession?.opening_amount || 0) + Number(paymentTotals.efectivo || 0) - cashExpenses;
  }, [activeSession?.opening_amount, paymentTotals.efectivo, cashExpenses]);

  const closingDifference = useMemo(() => {
    if (closingAmount === '') return 0;
    return Number(closingAmount || 0) - expectedCash;
  }, [closingAmount, expectedCash]);

  async function loadCashData() {
    try {
      setLoading(true);
      setNotice(null);

      const { data: sessionData, error: sessionError } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('opened_at', { ascending: false })
        .limit(20);

      if (sessionError) throw sessionError;

      const loadedSessions = sessionData || [];
      const openSession = loadedSessions.find(session => session.status === 'open') || null;

      setSessions(loadedSessions);
      setActiveSession(openSession);
      setClosingAmount('');
      setClosingNotes('');

      if (openSession) {
        await loadExpenses(openSession.id);
      } else {
        setExpenses([]);
      }
    } catch (error) {
      console.error('Error cargando caja diaria:', error);
      setNotice({ type: 'error', message: `No se pudo cargar la caja diaria: ${error.message}` });
    } finally {
      setLoading(false);
    }
  }

  async function loadExpenses(sessionId) {
    const { data, error } = await supabase
      .from('cash_expenses')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('cash_session_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setExpenses(data || []);
  }

  async function openCash(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setNotice(null);

      const amount = Number(openingAmount || 0);
      if (Number.isNaN(amount) || amount < 0) {
        setNotice({ type: 'error', message: 'El monto inicial no puede ser negativo.' });
        return;
      }

      const { data, error } = await supabase
        .from('cash_sessions')
        .insert({
          user_id: currentUser.id,
          opening_amount: amount,
          status: 'open',
        })
        .select()
        .single();

      if (error) throw error;

      setActiveSession(data);
      setSessions(prev => [data, ...prev]);
      setOpeningAmount('0');
      setExpenses([]);
      setNotice({ type: 'success', message: 'Caja abierta correctamente.' });
    } catch (error) {
      console.error('Error abriendo caja:', error);
      setNotice({ type: 'error', message: `No se pudo abrir la caja: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function addExpense(event) {
    event.preventDefault();

    if (!activeSession) {
      setNotice({ type: 'error', message: 'Primero abre una caja.' });
      return;
    }

    const description = expenseForm.description.trim();
    const amount = Number(expenseForm.amount || 0);

    if (!description) {
      setNotice({ type: 'error', message: 'Escribe una descripción para el gasto.' });
      return;
    }

    if (Number.isNaN(amount) || amount <= 0) {
      setNotice({ type: 'error', message: 'El gasto debe ser mayor a 0.' });
      return;
    }

    try {
      setSaving(true);
      setNotice(null);

      const { data, error } = await supabase
        .from('cash_expenses')
        .insert({
          user_id: currentUser.id,
          cash_session_id: activeSession.id,
          description,
          amount,
          payment_method: expenseForm.paymentMethod,
        })
        .select()
        .single();

      if (error) throw error;

      setExpenses(prev => [data, ...prev]);
      setExpenseForm({ description: '', amount: '', paymentMethod: 'Efectivo' });
      setNotice({ type: 'success', message: 'Gasto registrado en caja.' });
    } catch (error) {
      console.error('Error registrando gasto:', error);
      setNotice({ type: 'error', message: `No se pudo registrar el gasto: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function closeCash(event) {
    event.preventDefault();

    if (!activeSession) return;

    const counted = Number(closingAmount || 0);
    if (Number.isNaN(counted) || counted < 0) {
      setNotice({ type: 'error', message: 'El efectivo contado no puede ser negativo.' });
      return;
    }

    try {
      setSaving(true);
      setNotice(null);

      const payload = {
        closing_amount: counted,
        expected_cash: Number(expectedCash.toFixed(2)),
        difference: Number((counted - expectedCash).toFixed(2)),
        notes: closingNotes.trim(),
        status: 'closed',
        closed_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('cash_sessions')
        .update(payload)
        .eq('id', activeSession.id)
        .eq('user_id', currentUser.id)
        .select()
        .single();

      if (error) throw error;

      setSessions(prev => prev.map(session => session.id === data.id ? data : session));
      setActiveSession(null);
      setExpenses([]);
      setClosingAmount('');
      setClosingNotes('');
      setNotice({ type: 'success', message: 'Caja cerrada correctamente.' });
    } catch (error) {
      console.error('Error cerrando caja:', error);
      setNotice({ type: 'error', message: `No se pudo cerrar la caja: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  const openedText = activeSession?.opened_at
    ? new Date(activeSession.opened_at).toLocaleString('es-EC')
    : '';

  return (
    <div className="space-y-6">
      <section className="iq-module-hero iq-module-hero-finance">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-600">Control de caja</p>
            <h2 className="mt-2 flex items-center gap-3 text-3xl font-black text-slate-900">
              <DollarSign className="h-8 w-8 text-cyan-700" /> Caja diaria
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Controla apertura, ventas por método de pago, gastos y cierre del turno.
            </p>
          </div>

          <button
            type="button"
            onClick={loadCashData}
            disabled={loading}
            className="iq-action-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Actualizar caja
          </button>
        </div>
      </section>

      {notice && (
        <div className={`rounded-3xl p-4 text-sm font-semibold ${notice.type === 'success' ? 'border border-cyan-100 bg-cyan-50 text-cyan-800' : 'border border-red-100 bg-red-50 text-red-700'}`}>
          {notice.message}
        </div>
      )}

      {!activeSession ? (
        <section className="iq-operation-card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700">
              <Unlock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">Abrir caja</h3>
              <p className="text-sm text-slate-500">Registra el efectivo inicial para comenzar el turno.</p>
            </div>
          </div>

          <form onSubmit={openCash} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-600">Efectivo inicial</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={openingAmount}
                onChange={event => setOpeningAmount(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-200"
                placeholder="0.00"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-700 px-5 py-3 text-sm font-black text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
              Abrir caja
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <CashMetric icon={Unlock} title="Caja abierta" value={money(activeSession.opening_amount)} detail={openedText} tone="cyan" />
            <CashMetric icon={TrendingUp} title="Ventas del turno" value={money(salesTotal)} detail={`${sessionSales.length} venta(s)`} tone="blue" />
            <CashMetric icon={ReceiptText} title="Gastos" value={money(expenseTotal)} detail={`${expenses.length} movimiento(s)`} tone="amber" />
            <CashMetric icon={DollarSign} title="Efectivo esperado" value={money(expectedCash)} detail="Inicial + efectivo - gastos" tone="slate" />
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
            <div className="space-y-6">
              <div className="iq-operation-card p-6">
                <h3 className="mb-4 text-xl font-black text-slate-900">Resumen por método de pago</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <PaymentBox label="Efectivo" value={paymentTotals.efectivo || 0} />
                  <PaymentBox label="Transferencia" value={paymentTotals.transferencia || 0} />
                  <PaymentBox label="Tarjeta" value={paymentTotals.tarjeta || 0} />
                  <PaymentBox label="Crédito" value={paymentTotals['crédito'] || paymentTotals.credito || 0} />
                </div>
              </div>

              <div className="iq-operation-card p-6">
                <h3 className="mb-4 text-xl font-black text-slate-900">Registrar gasto del turno</h3>
                <form onSubmit={addExpense} className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_0.5fr_0.6fr_auto] lg:items-end">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-600">Descripción</span>
                    <input
                      value={expenseForm.description}
                      onChange={event => setExpenseForm(prev => ({ ...prev, description: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-200"
                      placeholder="Ej: fundas, transporte, limpieza"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-600">Monto</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={expenseForm.amount}
                      onChange={event => setExpenseForm(prev => ({ ...prev, amount: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-200"
                      placeholder="0.00"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-600">Método</span>
                    <select
                      value={expenseForm.paymentMethod}
                      onChange={event => setExpenseForm(prev => ({ ...prev, paymentMethod: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-200"
                    >
                      <option>Efectivo</option>
                      <option>Transferencia</option>
                      <option>Tarjeta</option>
                    </select>
                  </label>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-black text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Agregar
                  </button>
                </form>
              </div>

              <div className="iq-operation-card p-6">
                <h3 className="mb-4 text-xl font-black text-slate-900">Movimientos recientes</h3>
                <div className="space-y-3">
                  {expenses.length === 0 && sessionSales.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                      No hay movimientos en esta caja.
                    </div>
                  ) : (
                    <>
                      {expenses.slice(0, 6).map(expense => (
                        <MovementRow
                          key={expense.id}
                          title={expense.description}
                          detail={`Gasto · ${expense.payment_method}`}
                          value={-Number(expense.amount || 0)}
                          tone="red"
                        />
                      ))}

                      {sessionSales.slice(0, 6).map(sale => (
                        <MovementRow
                          key={sale.id}
                          title={sale.code || 'Venta'}
                          detail={`${sale.product || 'Pedido'} · ${sale.paymentMethod || 'Efectivo'}`}
                          value={Number(sale.total || 0)}
                          tone="cyan"
                        />
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>

            <form onSubmit={closeCash} className="iq-operation-card p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-2xl bg-red-50 p-3 text-red-600">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Cerrar caja</h3>
                  <p className="text-sm text-slate-500">Compara el efectivo esperado con el contado.</p>
                </div>
              </div>

              <div className="space-y-4">
                <SummaryLine label="Efectivo inicial" value={activeSession.opening_amount} />
                <SummaryLine label="Ventas en efectivo" value={paymentTotals.efectivo || 0} />
                <SummaryLine label="Gastos en efectivo" value={-cashExpenses} />
                <div className="rounded-2xl bg-cyan-50 p-4">
                  <SummaryLine label="Efectivo esperado" value={expectedCash} strong />
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-600">Efectivo contado</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={closingAmount}
                    onChange={event => setClosingAmount(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-200"
                    placeholder="0.00"
                  />
                </label>

                <div className={`rounded-2xl p-4 text-sm font-black ${closingDifference === 0 ? 'bg-slate-50 text-slate-600' : closingDifference > 0 ? 'bg-cyan-50 text-cyan-800' : 'bg-red-50 text-red-700'}`}>
                  Diferencia: {money(closingDifference)}
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-600">Observación</span>
                  <textarea
                    value={closingNotes}
                    onChange={event => setClosingNotes(event.target.value)}
                    className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-200"
                    placeholder="Ej: faltante por cambio, gasto no registrado, etc."
                  />
                </label>

                <button
                  type="submit"
                  disabled={saving || closingAmount === ''}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  Cerrar caja
                </button>
              </div>
            </form>
          </section>
        </>
      )}

      {sessions.filter(session => session.status === 'closed').length > 0 && (
        <section className="iq-operation-card p-6">
          <h3 className="mb-4 text-xl font-black text-slate-900">Cierres anteriores</h3>
          <div className="space-y-3">
            {sessions.filter(session => session.status === 'closed').slice(0, 5).map(session => (
              <div key={session.id} className="grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-4 md:items-center">
                <div>
                  <p className="font-black text-slate-900">{new Date(session.opened_at).toLocaleDateString('es-EC')}</p>
                  <p className="text-xs text-slate-400">Cierre registrado</p>
                </div>
                <p className="text-sm font-bold text-slate-600">Esperado: {money(session.expected_cash)}</p>
                <p className="text-sm font-bold text-slate-600">Contado: {money(session.closing_amount)}</p>
                <p className={`text-sm font-black ${Number(session.difference || 0) < 0 ? 'text-red-600' : 'text-cyan-700'}`}>
                  Diferencia: {money(session.difference)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CashMetric({ icon: Icon, title, value, detail, tone }) {
  const tones = {
    emerald: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
  };

  return (
    <div className="iq-operation-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{detail}</p>
        </div>
        <div className={`rounded-2xl border p-3 ${tones[tone] || tones.slate}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function PaymentBox({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-slate-500">
        <CreditCard className="h-4 w-4" />
        <p className="text-xs font-black uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-black text-slate-900">{money(value)}</p>
    </div>
  );
}

function MovementRow({ title, detail, value, tone }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
      <div className="min-w-0">
        <p className="truncate font-black text-slate-900">{title}</p>
        <p className="truncate text-sm text-slate-500">{detail}</p>
      </div>
      <p className={`shrink-0 font-black ${tone === 'red' ? 'text-red-600' : 'text-cyan-700'}`}>
        {value < 0 ? '-' : '+'}{money(Math.abs(value))}
      </p>
    </div>
  );
}

function SummaryLine({ label, value, strong = false }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${strong ? 'font-black text-cyan-900' : 'text-slate-600'}`}>
      <span>{label}</span>
      <span>{money(value)}</span>
    </div>
  );
}
