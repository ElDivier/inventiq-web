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

function normalizeOrderText(sale) {
  return [sale?.customer, sale?.product, sale?.code]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getRestaurantOrderType(sale) {
  const text = normalizeOrderText(sale);

  if (text.includes('delivery')) return 'delivery';
  if (text.includes('para llevar')) return 'takeaway';
  if (text.includes('mesa')) return 'local';

  return 'local';
}

function getRestaurantOrderReference(sale) {
  const parts = String(sale?.customer || '')
    .split('·')
    .map(part => part.trim())
    .filter(Boolean);

  const tablePart = parts.find(part => /^mesa\s+/i.test(part));
  if (tablePart) return tablePart;

  const takeawayPart = parts.find(part => /para llevar/i.test(part));
  if (takeawayPart) return 'Para llevar';

  const deliveryPart = parts.find(part => /delivery/i.test(part));
  if (deliveryPart) return 'Delivery';

  return parts[1] || parts[0] || 'Sin referencia';
}

function addPaymentAmount(acc, key, amount) {
  const normalizedKey = paymentKey(key);
  acc[normalizedKey] = (acc[normalizedKey] || 0) + Number(amount || 0);
}

export default function FoodCashPage({ currentUser, sales = [], purchases = [], businessConfig = {} }) {
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

      if (method === 'mixto') {
        addPaymentAmount(acc, 'efectivo', sale.cashAmount || sale.cash_amount || 0);
        addPaymentAmount(acc, 'tarjeta', sale.cardAmount || sale.card_amount || 0);
        addPaymentAmount(acc, 'transferencia', sale.transferAmount || sale.transfer_amount || 0);
        return acc;
      }

      addPaymentAmount(acc, method, sale.total || 0);
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

  const sessionPurchases = useMemo(() => {
    return (purchases || []).filter(purchase => isAfterStart(purchase, sessionStartDate));
  }, [purchases, sessionStartDate]);

  const purchaseTotal = useMemo(() => {
    return sessionPurchases.reduce((sum, purchase) => sum + Number(purchase.total || 0), 0);
  }, [sessionPurchases]);

  const orderTypeStats = useMemo(() => {
    const base = {
      local: { label: 'Mesas', count: 0, total: 0 },
      takeaway: { label: 'Para llevar', count: 0, total: 0 },
      delivery: { label: 'Delivery', count: 0, total: 0 },
    };

    sessionSales.forEach((sale) => {
      const type = getRestaurantOrderType(sale);
      const key = base[type] ? type : 'local';
      base[key].count += 1;
      base[key].total += Number(sale.total || 0);
    });

    return base;
  }, [sessionSales]);

  const topServiceAreas = useMemo(() => {
    const totals = sessionSales.reduce((acc, sale) => {
      const reference = getRestaurantOrderReference(sale);
      if (!acc[reference]) {
        acc[reference] = { reference, count: 0, total: 0 };
      }
      acc[reference].count += 1;
      acc[reference].total += Number(sale.total || 0);
      return acc;
    }, {});

    return Object.values(totals)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [sessionSales]);

  const averageTicket = useMemo(() => {
    if (sessionSales.length === 0) return 0;
    return salesTotal / sessionSales.length;
  }, [salesTotal, sessionSales.length]);

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

  const isRestaurant = currentUser?.businessType === 'restaurante' || businessConfig?.label === 'Restaurante';
  const cashCopy = isRestaurant
    ? {
        eyebrow: 'Restaurante',
        title: 'Caja restaurante',
        description: 'Controla apertura, ventas por mesa, pedidos para llevar, delivery, gastos del turno y cierre de efectivo.',
        openTitle: 'Abrir caja restaurante',
        openDescription: 'Registra el efectivo inicial para comenzar el turno de atención.',
        movementTitle: 'Movimientos del turno',
        previousTitle: 'Cierres de caja anteriores',
      }
    : {
        eyebrow: 'Cafetería',
        title: 'Caja diaria',
        description: '{cashCopy.description}',
        openTitle: 'Abrir caja',
        openDescription: 'Registra el efectivo inicial para comenzar el turno.',
        movementTitle: 'Movimientos recientes',
        previousTitle: 'Cierres anteriores',
      };

  return (
    <div className="space-y-6">
      <section className="iq-module-hero iq-module-hero-food">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-600">{cashCopy.eyebrow}</p>
            <h2 className="mt-2 flex items-center gap-3 text-3xl font-black text-slate-900">
              <DollarSign className="h-8 w-8 text-cyan-700" /> {cashCopy.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              {cashCopy.description}
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
              <h3 className="text-xl font-black text-slate-900">{cashCopy.openTitle}</h3>
              <p className="text-sm text-slate-500">{cashCopy.openDescription}</p>
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
            <CashMetric icon={TrendingUp} title="Ventas del turno" value={money(salesTotal)} detail={`${sessionSales.length} orden(es)`} tone="blue" />
            <CashMetric icon={ReceiptText} title="Gastos del turno" value={money(expenseTotal)} detail={`${expenses.length} movimiento(s)`} tone="amber" />
            <CashMetric icon={DollarSign} title="Efectivo esperado" value={money(expectedCash)} detail="Inicial + efectivo - gastos" tone="slate" />
          </section>

          {isRestaurant && (
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="iq-operation-card p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Resumen operativo del restaurante</h3>
                    <p className="text-sm text-slate-500">Ventas del turno separadas por mesas, para llevar y delivery.</p>
                  </div>
                  <div className="rounded-2xl bg-cyan-50 px-4 py-3 text-right">
                    <p className="text-xs font-black uppercase tracking-wide text-cyan-800">Ticket promedio</p>
                    <p className="text-2xl font-black text-cyan-900">{money(averageTicket)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <RestaurantChannelBox label="Mesas" count={orderTypeStats.local.count} total={orderTypeStats.local.total} />
                  <RestaurantChannelBox label="Para llevar" count={orderTypeStats.takeaway.count} total={orderTypeStats.takeaway.total} />
                  <RestaurantChannelBox label="Delivery" count={orderTypeStats.delivery.count} total={orderTypeStats.delivery.total} />
                </div>
              </div>

              <div className="iq-operation-card p-6">
                <h3 className="text-xl font-black text-slate-900">Mesas y canales destacados</h3>
                <p className="mb-4 text-sm text-slate-500">Referencias con mayor movimiento en la caja actual.</p>
                <div className="space-y-3">
                  {topServiceAreas.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
                      Aún no hay órdenes registradas en este turno.
                    </div>
                  ) : topServiceAreas.map(area => (
                    <div key={area.reference} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
                      <div>
                        <p className="font-black text-slate-900">{area.reference}</p>
                        <p className="text-xs text-slate-500">{area.count} orden(es)</p>
                      </div>
                      <p className="font-black text-cyan-800">{money(area.total)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

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

              {isRestaurant && (
                <div className="iq-operation-card p-6">
                  <h3 className="mb-4 text-xl font-black text-slate-900">Abastecimiento del turno</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <PaymentBox label="Compras registradas" value={purchaseTotal} />
                    <PaymentBox label="Órdenes cobradas" value={salesTotal} />
                    <PaymentBox label="Ventas - compras" value={salesTotal - purchaseTotal} />
                  </div>
                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    Este resumen ayuda a comparar lo vendido con compras o abastecimientos registrados durante la caja actual.
                  </p>
                </div>
              )}

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
                <h3 className="mb-4 text-xl font-black text-slate-900">{cashCopy.movementTitle}</h3>
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
                          detail={`${getRestaurantOrderReference(sale)} · ${sale.product || 'Pedido'} · ${sale.paymentMethod || 'Efectivo'}`}
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
          <h3 className="mb-4 text-xl font-black text-slate-900">{cashCopy.previousTitle}</h3>
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


function RestaurantChannelBox({ label, count, total }) {
  return (
    <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-cyan-800">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{money(total)}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{count} orden(es)</p>
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
