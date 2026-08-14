import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  ChefHat,
  Clock,
  Grid2X2,
  ListChecks,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  UserRound,
  Users,
  WalletCards,
} from 'lucide-react';
import {
  cancelRestaurantOrderItem,
  fetchRestaurantOrders,
  formatRestaurantOrderElapsed,
  getRestaurantCourseLabel,
  getRestaurantItemStatusMeta,
  getRestaurantOrderStatusMeta,
  requestRestaurantBill,
  sendRestaurantOrder,
  subscribeRestaurantOrders,
  transferRestaurantOrder,
} from '../utils/restaurantOrders';
import { fetchRestaurantFloor } from '../utils/restaurantTables';
import { hasRestaurantPermission } from '../utils/restaurantPermissions';
import { auditRestaurantAction } from '../utils/restaurantStaff';

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function StatusBadge({ status, item = false }) {
  const meta = item ? getRestaurantItemStatusMeta(status) : getRestaurantOrderStatusMeta(status);
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${meta.badgeClass}`}>{meta.label}</span>;
}

function orderTypeLabel(value) {
  return ({ local: 'En local', takeaway: 'Para llevar', delivery: 'Delivery' })[value] || 'En local';
}

function Metric({ icon: Icon, label, value, detail }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
          <p className="mt-1 text-xs font-bold text-slate-400">{detail}</p>
        </div>
        <span className="rounded-2xl bg-cyan-50 p-2.5 text-cyan-700"><Icon className="h-5 w-5" /></span>
      </div>
    </article>
  );
}

export default function RestaurantOrdersPage({ currentUser, setActive, setSaleForm, setSaleCart, clearSaleCart }) {
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [areas, setAreas] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('activas');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [now, setNow] = useState(Date.now());

  const canManageOrders = hasRestaurantPermission(currentUser, 'orders.manage');
  const canCheckout = hasRestaurantPermission(currentUser, 'checkout.manage');
  const canCancelItems = hasRestaurantPermission(currentUser, 'cancellations.manage');

  const loadData = useCallback(async ({ quiet = false } = {}) => {
    if (!currentUser?.id) return;
    try {
      if (!quiet) setLoading(true);
      const [orderRows, floor] = await Promise.all([
        fetchRestaurantOrders(currentUser.id, { activeOnly: false, limit: 150 }),
        fetchRestaurantFloor(currentUser.id),
      ]);
      setOrders(orderRows);
      setAreas(floor.areas);
      setTables(floor.tables);
      setSelectedOrderId((current) => current && orderRows.some((order) => order.id === current)
        ? current
        : orderRows.find((order) => !['cerrada', 'cancelada'].includes(order.status))?.id || orderRows[0]?.id || '');
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudieron cargar las comandas: ${error.message}` });
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    if (!currentUser?.id) return undefined;
    return subscribeRestaurantOrders(currentUser.id, () => loadData({ quiet: true }));
  }, [currentUser?.id, loadData]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const activeOrders = useMemo(() => orders.filter((order) => !['cerrada', 'cancelada'].includes(order.status)), [orders]);
  const selectedOrder = useMemo(() => orders.find((order) => order.id === selectedOrderId) || null, [orders, selectedOrderId]);

  const filteredOrders = useMemo(() => {
    const text = search.trim().toLowerCase();
    return orders.filter((order) => {
      const statusMatch = statusFilter === 'todas'
        || (statusFilter === 'activas' && !['cerrada', 'cancelada'].includes(order.status))
        || order.status === statusFilter;
      const textMatch = !text || [order.code, order.orderReference, order.waiterName, order.customerName]
        .some((value) => String(value || '').toLowerCase().includes(text));
      return statusMatch && textMatch;
    });
  }, [orders, search, statusFilter]);

  const stats = useMemo(() => ({
    active: activeOrders.length,
    kitchen: activeOrders.filter((order) => ['enviada', 'preparacion'].includes(order.status)).length,
    bill: activeOrders.filter((order) => order.status === 'cuenta').length,
    pendingItems: activeOrders.reduce((sum, order) => sum + order.items.filter((item) => item.status === 'pendiente').length, 0),
  }), [activeOrders]);

  const availableTables = useMemo(() => tables.filter((table) => table.status === 'libre' && table.id !== selectedOrder?.tableId), [tables, selectedOrder?.tableId]);

  function areaName(areaId) {
    return areas.find((area) => area.id === areaId)?.name || 'Salón';
  }

  function openCheckout(order) {
    if (!order?.id || !canCheckout) return;
    sessionStorage.setItem('inventiq-restaurant-checkout-order', order.id);
    setActive('Cobros');
  }

  function continueOrder(order) {
    if (!canManageOrders) { setNotice({ type: 'error', message: 'El operador actual solo puede consultar comandas.' }); return; }
    if (typeof clearSaleCart === 'function') clearSaleCart();
    if (typeof setSaleCart === 'function') setSaleCart([]);
    if (typeof setSaleForm === 'function') {
      setSaleForm((current) => ({
        ...current,
        orderType: order.orderType,
        orderReference: order.orderReference,
        orderNotes: order.notes,
        restaurantOrderId: order.id,
        restaurantTableId: order.tableId || '',
        restaurantAreaId: order.areaId || '',
        restaurantWaiterName: order.waiterName,
        restaurantGuestCount: order.guestCount,
      }));
    }
    setActive('Ventas');
  }

  async function handleSend(orderId) {
    if (!canManageOrders) { setNotice({ type: 'error', message: 'El operador actual no tiene permiso para enviar comandas.' }); return; }
    try {
      setSaving(true); setNotice(null);
      await sendRestaurantOrder(orderId);
      await loadData({ quiet: true });
      setNotice({ type: 'success', message: 'La nueva ronda fue enviada a cocina.' });
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally { setSaving(false); }
  }

  async function handleBill(orderId) {
    if (!canManageOrders) { setNotice({ type: 'error', message: 'El operador actual no tiene permiso para solicitar cuentas.' }); return; }
    try {
      setSaving(true); setNotice(null);
      await requestRestaurantBill(orderId);
      await loadData({ quiet: true });
      setNotice({ type: 'success', message: 'La cuenta quedó solicitada y la mesa pasó a cobro.' });
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally { setSaving(false); }
  }

  async function handleCancelItem(item) {
    if (!canCancelItems || !canManageOrders) { setNotice({ type: 'error', message: 'El operador actual no tiene permiso para cancelar productos.' }); return; }
    const reason = window.prompt(`Motivo para cancelar “${item.product}”:`);
    if (!reason) return;
    try {
      setSaving(true); setNotice(null);
      await cancelRestaurantOrderItem(item.id, reason);
      await loadData({ quiet: true });
      setNotice({ type: 'success', message: 'El producto fue cancelado con trazabilidad.' });
      await auditRestaurantAction(currentUser, 'order_item.cancelled', 'restaurant_order_item', item.id, { product: item.product, reason });
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally { setSaving(false); }
  }

  async function handleTransfer() {
    if (!canManageOrders) { setNotice({ type: 'error', message: 'El operador actual no tiene permiso para transferir cuentas.' }); return; }
    if (!selectedOrder || !transferTargetId) return;
    try {
      setSaving(true); setNotice(null);
      await transferRestaurantOrder(selectedOrder.id, transferTargetId);
      setTransferTargetId('');
      await loadData({ quiet: true });
      setNotice({ type: 'success', message: 'La cuenta fue transferida a la nueva mesa.' });
      await auditRestaurantAction(currentUser, 'order.transferred', 'restaurant_order', selectedOrder.id, { targetTableId: transferTargetId });
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally { setSaving(false); }
  }

  if (currentUser?.businessType !== 'restaurante') {
    return <div className="rounded-3xl border border-slate-200 bg-white p-8"><h2 className="text-xl font-black text-slate-900">Comandas</h2><p className="mt-2 text-sm text-slate-500">Este módulo está disponible para cuentas Restaurante.</p></div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-700"><ListChecks className="h-4 w-4" /> Operación gastronómica</div>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Pedidos y comandas</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Controla cuentas abiertas, rondas enviadas a cocina, observaciones por plato y solicitud de cuenta.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => loadData()} disabled={loading} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar</button>
            <button type="button" onClick={() => setActive('Mesas')} className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-black text-cyan-800 hover:bg-cyan-100"><Grid2X2 className="h-4 w-4" /> Ver mesas</button>
            <button type="button" onClick={() => setActive('Cocina')} className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-black text-amber-800 hover:bg-amber-100"><ChefHat className="h-4 w-4" /> Ver cocina</button>
            {canManageOrders && <button type="button" onClick={() => { clearSaleCart?.(); setSaleCart?.([]); setSaleForm?.((current) => ({ ...current, restaurantOrderId: '', restaurantTableId: '', restaurantAreaId: '', orderType: 'local', orderReference: '' })); setActive('Ventas'); }} className="inline-flex items-center gap-2 rounded-2xl bg-cyan-700 px-4 py-2.5 text-sm font-black text-white hover:bg-cyan-800"><ShoppingCart className="h-4 w-4" /> Nueva orden</button>}
          </div>
        </div>
      </section>

      {notice && <div className={`rounded-3xl border p-4 text-sm font-bold ${notice.type === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-red-100 bg-red-50 text-red-700'}`}>{notice.message}</div>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={ReceiptText} label="Cuentas activas" value={stats.active} detail="Mesas y pedidos abiertos" />
        <Metric icon={ChefHat} label="En cocina" value={stats.kitchen} detail="Comandas enviadas" />
        <Metric icon={Send} label="Sin enviar" value={stats.pendingItems} detail="Ítems de nueva ronda" />
        <Metric icon={Clock} label="Por cobrar" value={stats.bill} detail="Cuenta solicitada" />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-3 text-sm font-bold outline-none focus:ring-2 focus:ring-cyan-100" placeholder="Buscar mesa, código o mesero..." /></div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none"><option value="activas">Cuentas activas</option><option value="todas">Todas</option><option value="borrador">Borradores</option><option value="enviada">Enviadas</option><option value="preparacion">En preparación</option><option value="servida">Servidas</option><option value="cuenta">Por cobrar</option></select>
          </div>

          <div className="mt-4 max-h-[680px] space-y-2 overflow-y-auto pr-1">
            {loading ? <p className="p-6 text-center text-sm font-bold text-slate-400">Cargando comandas...</p> : filteredOrders.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No hay comandas para este filtro.</p> : filteredOrders.map((order) => {
              const pending = order.items.filter((item) => item.status === 'pendiente').length;
              return <button key={order.id} type="button" onClick={() => setSelectedOrderId(order.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedOrderId === order.id ? 'border-cyan-300 bg-cyan-50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{order.orderReference || order.code}</p><p className="mt-1 truncate text-xs font-bold text-slate-400">{order.code} · {orderTypeLabel(order.orderType)}</p></div><StatusBadge status={order.status} /></div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{order.items.filter((item) => item.status !== 'cancelado').length} producto(s)</span><span className="font-black text-slate-800">{money(order.total)}</span></div>
                <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-slate-400"><span>{formatRestaurantOrderElapsed(order.openedAt, now)}</span>{pending > 0 && <span className="text-amber-600">{pending} sin enviar</span>}</div>
              </button>;
            })}
          </div>
        </aside>

        <main className="min-w-0 rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {!selectedOrder ? <div className="flex min-h-[420px] flex-col items-center justify-center text-center"><ListChecks className="h-12 w-12 text-slate-200" /><h3 className="mt-4 text-xl font-black text-slate-900">Selecciona una comanda</h3><p className="mt-2 text-sm text-slate-500">Aquí verás productos, rondas, observaciones y acciones del servicio.</p></div> : <>
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
              <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-2xl font-black text-slate-900">{selectedOrder.orderReference || selectedOrder.code}</h3><StatusBadge status={selectedOrder.status} /></div><p className="mt-2 text-sm text-slate-500">{selectedOrder.code} · {orderTypeLabel(selectedOrder.orderType)}{selectedOrder.areaId ? ` · ${areaName(selectedOrder.areaId)}` : ''}</p><div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-slate-500"><span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" /> {selectedOrder.guestCount} comensal(es)</span><span className="inline-flex items-center gap-1.5"><UserRound className="h-4 w-4" /> {selectedOrder.waiterName || 'Sin mesero'}</span><span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> {formatRestaurantOrderElapsed(selectedOrder.openedAt, now)}</span></div></div>
              <div className="flex flex-wrap gap-2">{canManageOrders && <button type="button" onClick={() => continueOrder(selectedOrder)} className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-black text-cyan-800 hover:bg-cyan-100">Agregar consumo</button>}{canManageOrders && selectedOrder.items.some((item) => item.status === 'pendiente') && <button type="button" onClick={() => handleSend(selectedOrder.id)} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-cyan-700 px-4 py-2.5 text-sm font-black text-white hover:bg-cyan-800 disabled:opacity-50"><Send className="h-4 w-4" /> Enviar ronda</button>} {canManageOrders && !['cuenta', 'cerrada', 'cancelada'].includes(selectedOrder.status) && <button type="button" onClick={() => handleBill(selectedOrder.id)} disabled={saving} className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-50">Solicitar cuenta</button>}{canCheckout && ['lista', 'servida', 'cuenta'].includes(selectedOrder.status) && <button type="button" onClick={() => openCheckout(selectedOrder)} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700"><WalletCards className="h-4 w-4" /> Cobrar cuenta</button>}</div>
            </div>

            {selectedOrder.notes && <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800"><span className="font-black">Nota general:</span> {selectedOrder.notes}</div>}

            <div className="mt-5 space-y-4">
              {selectedOrder.items.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">La cuenta está abierta, pero todavía no tiene productos.</div> : ['entrada', 'principal', 'postre', 'bebida', 'sin_curso'].map((course) => {
                const items = selectedOrder.items.filter((item) => item.course === course);
                if (items.length === 0) return null;
                return <section key={course} className="rounded-3xl border border-slate-100 bg-slate-50 p-4"><div className="mb-3 flex items-center justify-between"><h4 className="text-sm font-black uppercase tracking-wide text-slate-600">{getRestaurantCourseLabel(course)}</h4><span className="text-xs font-bold text-slate-400">{items.length} línea(s)</span></div><div className="space-y-2">{items.map((item) => <article key={item.id} className={`rounded-2xl border bg-white p-4 ${item.status === 'cancelado' ? 'border-red-100 opacity-65' : 'border-slate-100'}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">{item.quantity} × {item.product}</p><StatusBadge status={item.status} item /></div><p className="mt-1 text-xs font-bold text-slate-400">{item.kitchenStation}{item.seatNumber ? ` · Asiento ${item.seatNumber}` : ''}</p>{item.modifiers.length > 0 && <p className="mt-2 text-xs text-cyan-700">{item.modifiers.map((modifier) => modifier.name).join(' · ')}</p>}{item.notes && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">{item.notes}</p>}{item.status === 'cancelado' && <p className="mt-2 text-xs font-bold text-red-600">Motivo: {item.cancellationReason}</p>}</div><div className="shrink-0 text-right"><p className="font-black text-slate-900">{money(item.subtotal)}</p>{canManageOrders && canCancelItems && !['cancelado', 'servido'].includes(item.status) && <button type="button" onClick={() => handleCancelItem(item)} disabled={saving} className="mt-2 inline-flex items-center gap-1 text-xs font-black text-red-500 hover:text-red-600 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /> Cancelar</button>}</div></div></article>)}</div></section>;
              })}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_260px]">
              {canManageOrders && selectedOrder.tableId && <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500"><ArrowRightLeft className="h-4 w-4" /> Transferir cuenta</p><div className="mt-3 flex gap-2"><select value={transferTargetId} onChange={(event) => setTransferTargetId(event.target.value)} className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none"><option value="">Seleccionar mesa libre</option>{availableTables.map((table) => <option key={table.id} value={table.id}>{table.name} · {areaName(table.areaId)}</option>)}</select><button type="button" onClick={handleTransfer} disabled={!transferTargetId || saving} className="rounded-2xl bg-white px-4 py-2.5 text-sm font-black text-cyan-700 ring-1 ring-slate-200 disabled:opacity-40">Mover</button></div></div>}
              <div className="rounded-3xl bg-slate-950 p-5 text-white"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Saldo de la cuenta</p><p className="mt-2 text-3xl font-black text-cyan-300">{money(selectedOrder.balanceDue ?? selectedOrder.total)}</p><p className="mt-2 text-xs text-slate-400">Cobrado: {money(selectedOrder.paidTotal || 0)} · Divide por personas, asientos o productos.</p><button type="button" onClick={() => openCheckout(selectedOrder)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300"><WalletCards className="h-4 w-4" /> Ir a cobro</button></div>
            </div>
          </>}
        </main>
      </section>
    </div>
  );
}
