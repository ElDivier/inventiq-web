import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  Grid2X2,
  ListChecks,
  Loader2,
  ReceiptText,
  RefreshCw,
  Search,
  Split,
  UserRound,
  Users,
  WalletCards,
  XCircle,
} from 'lucide-react';
import {
  RESTAURANT_PAYMENT_METHODS,
  RESTAURANT_SPLIT_MODES,
  fetchRestaurantCheckoutOrders,
  fetchRestaurantSale,
  getActiveRestaurantPayments,
  getPaymentMethodBreakdown,
  getUnallocatedRestaurantItems,
  moneyNumber,
  registerRestaurantPayment,
  subscribeRestaurantCheckout,
  updateRestaurantOrderCharges,
  voidRestaurantPayment,
} from '../utils/restaurantCheckout';
import {
  formatRestaurantOrderElapsed,
  getRestaurantItemStatusMeta,
  getRestaurantOrderStatusMeta,
} from '../utils/restaurantOrders';
import { hasRestaurantPermission } from '../utils/restaurantPermissions';
import { auditRestaurantAction } from '../utils/restaurantStaff';

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

function orderTypeLabel(value) {
  return { local: 'Mesa', takeaway: 'Para llevar', delivery: 'Delivery' }[value] || 'Pedido';
}

function PaymentMethodIcon({ method, className = 'h-4 w-4' }) {
  if (method === 'Efectivo') return <Banknote className={className} />;
  if (method === 'Tarjeta') return <CreditCard className={className} />;
  return <WalletCards className={className} />;
}

function StatusBadge({ status, item = false }) {
  const meta = item ? getRestaurantItemStatusMeta(status) : getRestaurantOrderStatusMeta(status);
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${meta.badgeClass}`}>{meta.label}</span>;
}

function Summary({ label, value, strong = false, tone = '' }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${tone}`}>
      <span className={`text-sm ${strong ? 'font-black text-slate-900' : 'font-bold text-slate-500'}`}>{label}</span>
      <span className={`${strong ? 'text-lg font-black text-slate-950' : 'text-sm font-black text-slate-800'}`}>{money(value)}</span>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail, tone = 'cyan' }) {
  const tones = {
    cyan: 'border-cyan-100 bg-cyan-50 text-cyan-700',
    violet: 'border-violet-100 bg-violet-50 text-violet-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
  };
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
          <p className="mt-1 text-xs font-semibold text-slate-400">{detail}</p>
        </div>
        <div className={`rounded-2xl border p-3 ${tones[tone] || tones.cyan}`}><Icon className="h-5 w-5" /></div>
      </div>
    </article>
  );
}

export default function RestaurantCheckoutPage({ currentUser, setActive, setReceiptSale, refreshSales }) {
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('pendientes');
  const [now, setNow] = useState(Date.now());

  const [discountAmount, setDiscountAmount] = useState('0');
  const [serviceCharge, setServiceCharge] = useState('0');
  const [splitMode, setSplitMode] = useState('completa');
  const [equalParts, setEqualParts] = useState('2');
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [manualAmount, setManualAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [cashAmount, setCashAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const canAdjustCharges = hasRestaurantPermission(currentUser, 'discounts.apply');
  const canVoidPayments = hasRestaurantPermission(currentUser, 'payments.void');

  const loadOrders = useCallback(async ({ keepSelection = true } = {}) => {
    if (!currentUser?.id) return;
    try {
      setLoading(true);
      const data = await fetchRestaurantCheckoutOrders(currentUser.id);
      setOrders(data);

      const requestedId = sessionStorage.getItem('inventiq-restaurant-checkout-order');
      const requestedTableId = sessionStorage.getItem('inventiq-restaurant-checkout-table');
      if (requestedId) sessionStorage.removeItem('inventiq-restaurant-checkout-order');
      if (requestedTableId) sessionStorage.removeItem('inventiq-restaurant-checkout-table');
      const currentId = keepSelection ? selectedOrderId : '';
      const tableOrder = requestedTableId
        ? data.find((order) => String(order.tableId) === String(requestedTableId))
        : null;
      const preferredId = requestedId || tableOrder?.id || currentId;
      const nextId = data.some((order) => String(order.id) === String(preferredId))
        ? preferredId
        : data[0]?.id || '';
      setSelectedOrderId(nextId);
    } catch (error) {
      console.error('Error cargando cobros:', error);
      setNotice({ type: 'error', message: `No se pudieron cargar las cuentas: ${error.message}` });
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, selectedOrderId]);

  useEffect(() => {
    loadOrders({ keepSelection: false });
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;
    const unsubscribe = subscribeRestaurantCheckout(currentUser.id, () => loadOrders());
    return unsubscribe;
  }, [currentUser?.id, loadOrders]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedOrder = useMemo(
    () => orders.find((order) => String(order.id) === String(selectedOrderId)) || null,
    [orders, selectedOrderId]
  );

  useEffect(() => {
    if (!selectedOrder) return;
    setDiscountAmount(String(selectedOrder.discountAmount || 0));
    setServiceCharge(String(selectedOrder.serviceCharge || 0));
    setSplitMode('completa');
    setEqualParts('2');
    setSelectedSeats([]);
    setSelectedItemIds([]);
    setManualAmount('');
    setPaymentMethod('Efectivo');
    setCashAmount('');
    setCardAmount('');
    setTransferAmount('');
    setCashReceived('');
    setPaymentNotes('');
  }, [selectedOrder?.id]);

  const activePayments = useMemo(() => getActiveRestaurantPayments(selectedOrder || {}), [selectedOrder]);
  const unallocatedItems = useMemo(() => getUnallocatedRestaurantItems(selectedOrder || {}), [selectedOrder]);
  const activeItems = useMemo(() => (selectedOrder?.items || []).filter((item) => item.status !== 'cancelado'), [selectedOrder]);
  const allItemsServed = activeItems.length > 0 && activeItems.every((item) => item.status === 'servido');

  const availableSeats = useMemo(() => {
    const values = new Set();
    unallocatedItems.forEach((item) => values.add(item.seatNumber ? String(item.seatNumber) : 'sin_asiento'));
    return [...values].sort((a, b) => {
      if (a === 'sin_asiento') return 1;
      if (b === 'sin_asiento') return -1;
      return Number(a) - Number(b);
    });
  }, [unallocatedItems]);

  const selectedSeatItems = useMemo(
    () => unallocatedItems.filter((item) => selectedSeats.includes(item.seatNumber ? String(item.seatNumber) : 'sin_asiento')),
    [unallocatedItems, selectedSeats]
  );

  const selectedProductItems = useMemo(
    () => unallocatedItems.filter((item) => selectedItemIds.includes(String(item.id))),
    [unallocatedItems, selectedItemIds]
  );

  const paymentAmount = useMemo(() => {
    const balance = Number(selectedOrder?.balanceDue || 0);
    if (!selectedOrder) return 0;
    if (splitMode === 'completa') return moneyNumber(balance);
    if (splitMode === 'partes') return moneyNumber(balance / Math.max(2, Number(equalParts || 2)));
    if (splitMode === 'asientos') return moneyNumber(selectedSeatItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0));
    if (splitMode === 'productos') return moneyNumber(selectedProductItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0));
    return moneyNumber(manualAmount);
  }, [selectedOrder, splitMode, equalParts, selectedSeatItems, selectedProductItems, manualAmount]);

  useEffect(() => {
    if (paymentMethod !== 'Mixto') return;
    const amount = paymentAmount.toFixed(2);
    setCashAmount(amount);
    setCardAmount('0');
    setTransferAmount('0');
  }, [paymentMethod, paymentAmount]);

  const mixedTotal = moneyNumber(Number(cashAmount || 0) + Number(cardAmount || 0) + Number(transferAmount || 0));
  const changeDue = paymentMethod === 'Efectivo'
    ? Math.max(moneyNumber(Number(cashReceived || 0) - paymentAmount), 0)
    : 0;
  const isFinalPayment = selectedOrder && paymentAmount > 0 && Math.abs(paymentAmount - Number(selectedOrder.balanceDue || 0)) <= 0.01;
  const canChargeStatus = selectedOrder && ['lista', 'servida', 'cuenta'].includes(selectedOrder.status);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (filter === 'pendientes' && Number(order.balanceDue || 0) <= 0.01) return false;
      if (filter === 'parciales' && order.paymentStatus !== 'parcial') return false;
      if (filter === 'cuenta' && order.status !== 'cuenta') return false;
      if (query) {
        const haystack = [order.orderReference, order.orderCode, order.waiterName, order.customerName, order.code]
          .filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [orders, search, filter]);

  const stats = useMemo(() => {
    const dueOrders = orders.filter((order) => Number(order.balanceDue || 0) > 0.01);
    return {
      active: dueOrders.length,
      partial: dueOrders.filter((order) => order.paymentStatus === 'parcial').length,
      requested: dueOrders.filter((order) => order.status === 'cuenta').length,
      balance: dueOrders.reduce((sum, order) => sum + Number(order.balanceDue || 0), 0),
    };
  }, [orders]);

  async function handleCharges() {
    if (!selectedOrder) return;
    if (!canAdjustCharges) {
      setNotice({ type: 'error', message: 'El operador actual no tiene permiso para aplicar descuentos o cargos.' });
      return;
    }
    try {
      setSaving(true);
      setNotice(null);
      await updateRestaurantOrderCharges(selectedOrder.id, discountAmount, serviceCharge);
      await loadOrders();
      setNotice({ type: 'success', message: 'Descuento y cargo de servicio actualizados.' });
      await auditRestaurantAction(currentUser, 'checkout.charges_updated', 'restaurant_order', selectedOrder.id, { discountAmount: Number(discountAmount || 0), serviceCharge: Number(serviceCharge || 0) });
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  }

  function toggleSeat(seat) {
    setSelectedSeats((current) => current.includes(seat) ? current.filter((item) => item !== seat) : [...current, seat]);
  }

  function toggleItem(itemId) {
    const id = String(itemId);
    setSelectedItemIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function buildSplitPayload() {
    if (splitMode === 'partes') {
      return {
        label: `1 de ${Math.max(2, Number(equalParts || 2))} partes iguales`,
        allocation: { parts: Math.max(2, Number(equalParts || 2)) },
      };
    }
    if (splitMode === 'asientos') {
      return {
        label: selectedSeats.map((seat) => seat === 'sin_asiento' ? 'Sin asiento' : `Asiento ${seat}`).join(', '),
        allocation: { seats: selectedSeats, itemIds: selectedSeatItems.map((item) => item.id) },
      };
    }
    if (splitMode === 'productos') {
      return {
        label: `${selectedProductItems.length} producto(s)`,
        allocation: { itemIds: selectedProductItems.map((item) => item.id) },
      };
    }
    if (splitMode === 'monto') return { label: 'Abono parcial', allocation: {} };
    return { label: 'Cuenta completa', allocation: { itemIds: unallocatedItems.map((item) => item.id) } };
  }

  function validatePayment() {
    if (!selectedOrder) return 'Selecciona una cuenta.';
    if (!canChargeStatus) return 'La cuenta debe estar lista, servida o solicitada antes de cobrar.';
    if (paymentAmount <= 0) return 'Selecciona productos, asientos o ingresa un monto válido.';
    if (paymentAmount > Number(selectedOrder.balanceDue || 0) + 0.01) return 'El monto supera el saldo pendiente.';
    if (splitMode === 'asientos' && selectedSeats.length === 0) return 'Selecciona al menos un asiento.';
    if (splitMode === 'productos' && selectedItemIds.length === 0) return 'Selecciona al menos un producto.';
    if (paymentMethod === 'Mixto' && Math.abs(mixedTotal - paymentAmount) > 0.01) return 'El pago mixto debe sumar exactamente el monto a cobrar.';
    if (paymentMethod === 'Efectivo' && cashReceived !== '' && Number(cashReceived || 0) + 0.001 < paymentAmount) return 'El efectivo recibido no cubre el monto a cobrar.';
    if (isFinalPayment && !allItemsServed) return 'Para cerrar la cuenta, todos los productos deben estar marcados como entregados.';
    return '';
  }

  async function handlePayment() {
    const errorMessage = validatePayment();
    if (errorMessage) {
      setNotice({ type: 'error', message: errorMessage });
      return;
    }

    const split = buildSplitPayload();
    try {
      setSaving(true);
      setNotice(null);
      const result = await registerRestaurantPayment({
        orderId: selectedOrder.id,
        amount: paymentAmount,
        paymentMethod,
        cashAmount: paymentMethod === 'Mixto' ? cashAmount : 0,
        cardAmount: paymentMethod === 'Mixto' ? cardAmount : 0,
        transferAmount: paymentMethod === 'Mixto' ? transferAmount : 0,
        splitMode,
        splitLabel: split.label,
        allocation: split.allocation,
        notes: paymentNotes,
      });

      await auditRestaurantAction(currentUser, 'checkout.payment_registered', 'restaurant_order', selectedOrder.id, { amount: paymentAmount, paymentMethod, splitMode, closed: Boolean(result?.closed) });

      if (result?.closed && result?.sale_id) {
        const sale = await fetchRestaurantSale(result.sale_id, currentUser.id);
        if (sale && setReceiptSale) setReceiptSale(sale);
        if (refreshSales) await refreshSales();
        setNotice({ type: 'success', message: 'Cuenta pagada y cerrada. La mesa quedó pendiente de limpieza.' });
      } else {
        setNotice({ type: 'success', message: `Cobro registrado. Saldo pendiente: ${money(result?.balance_due)}.` });
      }

      await loadOrders({ keepSelection: !result?.closed });
      setSelectedSeats([]);
      setSelectedItemIds([]);
      setManualAmount('');
      setPaymentNotes('');
      setCashReceived('');
    } catch (error) {
      console.error('Error registrando cobro:', error);
      setNotice({ type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleVoid(payment) {
    if (!canVoidPayments) {
      setNotice({ type: 'error', message: 'El operador actual no tiene permiso para anular cobros.' });
      return;
    }
    const reason = window.prompt(`Motivo para anular ${payment.code || 'el cobro'}:`);
    if (!reason) return;
    try {
      setSaving(true);
      setNotice(null);
      await voidRestaurantPayment(payment.id, reason);
      await loadOrders();
      setNotice({ type: 'success', message: 'Cobro parcial anulado correctamente.' });
      await auditRestaurantAction(currentUser, 'checkout.payment_voided', 'restaurant_payment', payment.id, { code: payment.code, reason });
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">Restaurante · Caja</p>
            <h2 className="mt-3 flex items-center gap-3 text-3xl font-black"><WalletCards className="h-8 w-8 text-cyan-300" /> Cobro y división de cuentas</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Cobra una cuenta completa o divídela por personas, asientos, productos o montos. Los pagos parciales quedan registrados sin duplicarse en Caja.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setActive('Comandas')} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-black hover:bg-white/15"><ListChecks className="h-4 w-4" /> Comandas</button>
            <button type="button" onClick={() => setActive('Mesas')} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-black hover:bg-white/15"><Grid2X2 className="h-4 w-4" /> Mesas</button>
            <button type="button" onClick={() => loadOrders()} disabled={loading} className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300 disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Actualizar</button>
          </div>
        </div>
      </section>

      {notice && <div className={`rounded-3xl border p-4 text-sm font-bold ${notice.type === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-red-100 bg-red-50 text-red-700'}`}>{notice.message}</div>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={ReceiptText} label="Cuentas pendientes" value={stats.active} detail="Con saldo por cobrar" />
        <Metric icon={Split} label="Pagos parciales" value={stats.partial} detail="Cuentas divididas" tone="violet" />
        <Metric icon={Clock} label="Cuenta solicitada" value={stats.requested} detail="Esperando cobro" tone="amber" />
        <Metric icon={WalletCards} label="Saldo pendiente" value={money(stats.balance)} detail="Total por recaudar" tone="emerald" />
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-5 2xl:grid-cols-[330px_minmax(0,1fr)_390px]">
        <aside className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-3 text-sm font-bold outline-none focus:ring-2 focus:ring-cyan-100" placeholder="Buscar mesa, comanda o mesero..." /></div>
            <select value={filter} onChange={(event) => setFilter(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none"><option value="pendientes">Pendientes de cobro</option><option value="parciales">Con pago parcial</option><option value="cuenta">Cuenta solicitada</option><option value="todas">Todas las activas</option></select>
          </div>
          <div className="mt-4 max-h-[760px] space-y-2 overflow-y-auto pr-1">
            {loading ? <p className="p-6 text-center text-sm font-bold text-slate-400">Cargando cuentas...</p> : filteredOrders.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No hay cuentas para este filtro.</p> : filteredOrders.map((order) => (
              <button key={order.id} type="button" onClick={() => setSelectedOrderId(order.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedOrderId === order.id ? 'border-cyan-300 bg-cyan-50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{order.orderReference || order.code}</p><p className="mt-1 truncate text-xs font-bold text-slate-400">{order.code} · {orderTypeLabel(order.orderType)}</p></div><StatusBadge status={order.status} /></div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><p className="font-bold text-slate-400">Total</p><p className="mt-0.5 font-black text-slate-800">{money(order.total)}</p></div><div><p className="font-bold text-slate-400">Saldo</p><p className={`mt-0.5 font-black ${order.paymentStatus === 'parcial' ? 'text-violet-700' : 'text-cyan-700'}`}>{money(order.balanceDue)}</p></div></div>
                <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-slate-400"><span>{formatRestaurantOrderElapsed(order.openedAt, now)}</span>{order.paymentStatus === 'parcial' && <span className="text-violet-700">Pago parcial</span>}</div>
              </button>
            ))}
          </div>
        </aside>

        <main className="min-w-0 rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {!selectedOrder ? <div className="flex min-h-[520px] flex-col items-center justify-center text-center"><ReceiptText className="h-12 w-12 text-slate-200" /><h3 className="mt-4 text-xl font-black text-slate-900">Selecciona una cuenta</h3><p className="mt-2 text-sm text-slate-500">Revisa productos, cargos y cobros registrados.</p></div> : <>
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
              <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-2xl font-black text-slate-950">{selectedOrder.orderReference || selectedOrder.code}</h3><StatusBadge status={selectedOrder.status} /></div><p className="mt-2 text-sm font-semibold text-slate-500">{selectedOrder.code} · {orderTypeLabel(selectedOrder.orderType)}</p><div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-slate-500"><span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" /> {selectedOrder.guestCount} comensal(es)</span><span className="inline-flex items-center gap-1.5"><UserRound className="h-4 w-4" /> {selectedOrder.waiterName || 'Sin mesero'}</span><span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> {formatRestaurantOrderElapsed(selectedOrder.openedAt, now)}</span></div></div>
              <div className="rounded-2xl bg-slate-950 px-5 py-4 text-right text-white"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Saldo pendiente</p><p className="mt-1 text-3xl font-black text-cyan-300">{money(selectedOrder.balanceDue)}</p></div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Productos</p><p className="mt-2 text-2xl font-black text-slate-900">{activeItems.length}</p><p className="mt-1 text-xs font-semibold text-slate-500">{allItemsServed ? 'Todos entregados' : 'Servicio aún en curso'}</p></div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Cobrado</p><p className="mt-2 text-2xl font-black text-violet-700">{money(selectedOrder.paidTotal)}</p><p className="mt-1 text-xs font-semibold text-slate-500">{activePayments.length} cobro(s)</p></div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Estado de pago</p><p className="mt-2 text-lg font-black capitalize text-slate-900">{selectedOrder.paymentStatus}</p><p className="mt-1 text-xs font-semibold text-slate-500">Trazabilidad de la cuenta</p></div>
            </div>

            <div className="mt-5 space-y-2">
              {activeItems.map((item) => (
                <article key={item.id} className="flex items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">{item.quantity} × {item.product}</p><StatusBadge status={item.status} item /></div><p className="mt-1 text-xs font-bold text-slate-400">{item.seatNumber ? `Asiento ${item.seatNumber}` : 'Sin asiento'} · {item.kitchenStation}</p>{item.modifiers?.length > 0 && <p className="mt-2 text-xs font-semibold text-cyan-700">{item.modifiers.map((modifier) => modifier.name).join(' · ')}</p>}</div>
                  <p className="shrink-0 font-black text-slate-900">{money(item.subtotal)}</p>
                </article>
              ))}
            </div>

            <section className="mt-6 rounded-3xl border border-slate-200 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h4 className="font-black text-slate-950">Descuento y cargo de servicio</h4><p className="mt-1 text-sm text-slate-500">Solo pueden cambiarse antes del primer cobro.</p></div>{activePayments.length > 0 && <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">Bloqueado por cobros</span>}</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><label><span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Descuento fijo</span><input type="number" min="0" step="0.01" value={discountAmount} onChange={(event) => setDiscountAmount(event.target.value)} disabled={activePayments.length > 0 || !canAdjustCharges} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100" /></label><label><span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Cargo de servicio</span><input type="number" min="0" step="0.01" value={serviceCharge} onChange={(event) => setServiceCharge(event.target.value)} disabled={activePayments.length > 0 || !canAdjustCharges} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100" /></label><button type="button" onClick={handleCharges} disabled={saving || activePayments.length > 0 || !canAdjustCharges} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:opacity-40">Aplicar</button></div>
            </section>

            <section className="mt-6 rounded-3xl bg-slate-50 p-5">
              <h4 className="font-black text-slate-950">Resumen de cuenta</h4>
              <div className="mt-4 space-y-3"><Summary label="Consumo" value={selectedOrder.subtotal} /><Summary label="Cargo de servicio" value={selectedOrder.serviceCharge} /><Summary label="Descuento" value={-selectedOrder.discountAmount} /><div className="border-t border-slate-200 pt-3"><Summary label="Total" value={selectedOrder.total} strong /></div><Summary label="Cobrado" value={-selectedOrder.paidTotal} /><div className="rounded-2xl bg-white p-4"><Summary label="Saldo pendiente" value={selectedOrder.balanceDue} strong /></div></div>
            </section>

            <section className="mt-6">
              <div className="flex items-center justify-between"><div><h4 className="font-black text-slate-950">Historial de cobros</h4><p className="mt-1 text-sm text-slate-500">Cada abono conserva método, división y hora.</p></div></div>
              <div className="mt-4 space-y-2">{selectedOrder.payments?.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Todavía no existen cobros.</div> : selectedOrder.payments.map((payment) => <article key={payment.id} className={`rounded-2xl border p-4 ${payment.status === 'voided' ? 'border-red-100 bg-red-50/60 opacity-70' : 'border-slate-100 bg-white'}`}><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">{payment.code}</p>{payment.status === 'voided' && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700">Anulado</span>}</div><p className="mt-1 text-xs font-bold text-slate-500">{getPaymentMethodBreakdown(payment)} · {payment.splitLabel || payment.splitMode}</p><p className="mt-1 text-[11px] text-slate-400">{new Date(payment.paidAt).toLocaleString('es-EC')}</p>{payment.voidReason && <p className="mt-2 text-xs font-bold text-red-600">Motivo: {payment.voidReason}</p>}</div><div className="text-right"><p className="text-lg font-black text-slate-950">{money(payment.amount)}</p>{payment.status !== 'voided' && !payment.saleId && canVoidPayments && <button type="button" onClick={() => handleVoid(payment)} disabled={saving} className="mt-2 inline-flex items-center gap-1 text-xs font-black text-red-500 hover:text-red-600"><XCircle className="h-3.5 w-3.5" /> Anular</button>}</div></div></article>)}</div>
            </section>
          </>}
        </main>

        <aside className="h-fit rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 2xl:sticky 2xl:top-6">
          <div className="flex items-center gap-3"><div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700"><WalletCards className="h-5 w-5" /></div><div><h3 className="text-xl font-black text-slate-950">Registrar cobro</h3><p className="text-sm text-slate-500">Divide y cobra sin duplicar ingresos.</p></div></div>
          {!selectedOrder ? <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Selecciona una cuenta.</div> : <div className="mt-6 space-y-5">
            {!canChargeStatus && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800"><AlertTriangle className="mr-2 inline h-4 w-4" /> La cuenta debe estar lista, servida o solicitada antes de cobrar.</div>}

            <div><p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Forma de división</p><div className="grid grid-cols-2 gap-2">{RESTAURANT_SPLIT_MODES.map((mode) => <button key={mode.value} type="button" onClick={() => { setSplitMode(mode.value); setSelectedSeats([]); setSelectedItemIds([]); setManualAmount(''); }} className={`rounded-2xl border p-3 text-left transition ${splitMode === mode.value ? 'border-cyan-300 bg-cyan-50 text-cyan-900' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}><p className="text-xs font-black">{mode.label}</p><p className="mt-1 text-[10px] leading-4 opacity-75">{mode.description}</p></button>)}</div></div>

            {splitMode === 'partes' && <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Personas / partes restantes</span><input type="number" min="2" max="50" value={equalParts} onChange={(event) => setEqualParts(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-cyan-100" /></label>}

            {splitMode === 'asientos' && <div><p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Seleccionar asientos</p><div className="flex flex-wrap gap-2">{availableSeats.length === 0 ? <p className="text-sm text-slate-500">No quedan asientos sin cobrar.</p> : availableSeats.map((seat) => <button key={seat} type="button" onClick={() => toggleSeat(seat)} className={`rounded-full border px-3 py-2 text-xs font-black ${selectedSeats.includes(seat) ? 'border-cyan-300 bg-cyan-50 text-cyan-800' : 'border-slate-200 text-slate-600'}`}>{seat === 'sin_asiento' ? 'Sin asiento' : `Asiento ${seat}`}</button>)}</div></div>}

            {splitMode === 'productos' && <div><p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Productos pendientes</p><div className="max-h-60 space-y-2 overflow-y-auto pr-1">{unallocatedItems.length === 0 ? <p className="text-sm text-slate-500">No quedan productos sin asignar.</p> : unallocatedItems.map((item) => <label key={item.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3 ${selectedItemIds.includes(String(item.id)) ? 'border-cyan-300 bg-cyan-50' : 'border-slate-200'}`}><div className="flex min-w-0 items-center gap-3"><input type="checkbox" checked={selectedItemIds.includes(String(item.id))} onChange={() => toggleItem(item.id)} /><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{item.quantity} × {item.product}</p><p className="text-[11px] font-bold text-slate-400">{item.seatNumber ? `Asiento ${item.seatNumber}` : 'Sin asiento'}</p></div></div><span className="shrink-0 text-sm font-black">{money(item.subtotal)}</span></label>)}</div></div>}

            {splitMode === 'monto' && <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Monto del abono</span><input type="number" min="0.01" max={selectedOrder.balanceDue} step="0.01" value={manualAmount} onChange={(event) => setManualAmount(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-cyan-100" placeholder="0.00" /></label>}

            <div className="rounded-3xl bg-slate-950 p-5 text-white"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Monto a cobrar</p><p className="mt-2 text-4xl font-black text-cyan-300">{money(paymentAmount)}</p><p className="mt-2 text-xs text-slate-400">Saldo actual {money(selectedOrder.balanceDue)}</p></div>

            <div><p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Método de pago</p><div className="grid grid-cols-2 gap-2">{RESTAURANT_PAYMENT_METHODS.map((method) => <button key={method} type="button" onClick={() => setPaymentMethod(method)} className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-3 text-xs font-black ${paymentMethod === method ? 'border-cyan-300 bg-cyan-50 text-cyan-800' : 'border-slate-200 text-slate-600'}`}><PaymentMethodIcon method={method} /> {method}</button>)}</div></div>

            {paymentMethod === 'Mixto' && <div className="grid grid-cols-3 gap-2"><label><span className="mb-1 block text-[10px] font-black uppercase text-slate-400">Efectivo</span><input type="number" min="0" step="0.01" value={cashAmount} onChange={(event) => setCashAmount(event.target.value)} className="w-full rounded-xl border border-slate-200 px-2 py-2 text-sm font-bold" /></label><label><span className="mb-1 block text-[10px] font-black uppercase text-slate-400">Tarjeta</span><input type="number" min="0" step="0.01" value={cardAmount} onChange={(event) => setCardAmount(event.target.value)} className="w-full rounded-xl border border-slate-200 px-2 py-2 text-sm font-bold" /></label><label><span className="mb-1 block text-[10px] font-black uppercase text-slate-400">Transfer.</span><input type="number" min="0" step="0.01" value={transferAmount} onChange={(event) => setTransferAmount(event.target.value)} className="w-full rounded-xl border border-slate-200 px-2 py-2 text-sm font-bold" /></label><p className={`col-span-3 text-right text-xs font-black ${Math.abs(mixedTotal - paymentAmount) <= 0.01 ? 'text-emerald-600' : 'text-red-500'}`}>Suma: {money(mixedTotal)}</p></div>}

            {paymentMethod === 'Efectivo' && <div className="grid grid-cols-2 gap-3"><label><span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Efectivo recibido</span><input type="number" min="0" step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold" placeholder={paymentAmount.toFixed(2)} /></label><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Cambio</p><p className="mt-2 text-xl font-black text-slate-900">{money(changeDue)}</p></div></div>}

            <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Nota del cobro</span><textarea value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} className="min-h-20 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-cyan-100" placeholder="Opcional: nombre de quien paga, referencia, autorización..." /></label>

            {isFinalPayment && !allItemsServed && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-5 text-amber-800"><AlertTriangle className="mr-1 inline h-4 w-4" /> El pago final se habilitará cuando todos los productos estén entregados. Puedes registrar un abono menor al saldo.</div>}

            <button type="button" onClick={handlePayment} disabled={saving || !canChargeStatus || paymentAmount <= 0 || (isFinalPayment && !allItemsServed)} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-700 px-5 py-4 text-sm font-black text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-40">{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />} {isFinalPayment ? 'Cobrar y cerrar cuenta' : 'Registrar cobro parcial'}</button>
          </div>}
        </aside>
      </section>
    </div>
  );
}
