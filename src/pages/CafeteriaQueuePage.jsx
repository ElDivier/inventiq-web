import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChefHat, Clock3, Coffee, Flame, PackageCheck,
  RefreshCw, ShoppingBag, Star, Timer,
} from 'lucide-react';
import {
  fetchCafeteriaOrders,
  getCafeteriaOrderStatusMeta,
  setCafeteriaOrderPriority,
  subscribeCafeteriaOrders,
  updateCafeteriaOrderItemStatus,
  updateCafeteriaOrderStatus,
} from '../utils/cafeteriaOrders';
import { getCafeteriaStationLabel } from '../utils/cafeteriaMenu';

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function elapsedMinutes(date) {
  if (!date) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
}

function elapsedLabel(date) {
  const minutes = elapsedMinutes(date);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
}

function getOrderTarget(order) {
  const targets = (order.visibleItems || order.items || []).map((item) => Number(item.targetMinutes || 0)).filter((value) => value > 0);
  return targets.length ? Math.max(...targets) : 5;
}

function getUrgency(order) {
  if (['listo', 'entregado', 'cancelado'].includes(order.status)) return { tone: 'normal', label: '' };
  const elapsed = elapsedMinutes(order.receivedAt || order.createdAt);
  const target = getOrderTarget(order);
  if (elapsed > target) return { tone: 'late', label: `${elapsed - target} min tarde` };
  if (elapsed >= Math.max(1, Math.floor(target * 0.75))) return { tone: 'warning', label: `${Math.max(0, target - elapsed)} min restantes` };
  return { tone: 'normal', label: `${Math.max(0, target - elapsed)} min objetivo` };
}

export default function CafeteriaQueuePage({ currentUser, setActive }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [station, setStation] = useState('todas');
  const [includeDelivered, setIncludeDelivered] = useState(false);
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [, forceClock] = useState(0);

  async function loadOrders(silent = false) {
    if (!currentUser?.id) return;
    try {
      if (!silent) setLoading(true);
      const data = await fetchCafeteriaOrders({ userId: currentUser.id, includeDelivered, limit: 120 });
      setOrders(data);
      setNotice(null);
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo cargar la barra: ${error.message}` });
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => { loadOrders(); }, [currentUser?.id, includeDelivered]);
  useEffect(() => {
    const timer = window.setInterval(() => forceClock((value) => value + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!currentUser?.id) return undefined;
    return subscribeCafeteriaOrders(currentUser.id, () => loadOrders(true));
  }, [currentUser?.id, includeDelivered]);
  useEffect(() => {
    if (!currentUser?.id) return undefined;
    const refresh = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') loadOrders(true);
    };
    const interval = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [currentUser?.id, includeDelivered]);

  const filteredOrders = useMemo(() => orders
    .map((order) => ({
      ...order,
      visibleItems: station === 'todas' ? order.items : order.items.filter((item) => item.station === station),
    }))
    .filter((order) => order.visibleItems.length > 0)
    .filter((order) => !priorityOnly || order.priority), [orders, station, priorityOnly]);

  const stats = useMemo(() => ({
    received: orders.filter((order) => order.status === 'recibido').length,
    preparing: orders.filter((order) => order.status === 'preparacion').length,
    ready: orders.filter((order) => order.status === 'listo').length,
    late: orders.filter((order) => getUrgency(order).tone === 'late').length,
  }), [orders]);

  async function setOrderStatus(orderId, status) {
    try {
      setBusyId(orderId);
      await updateCafeteriaOrderStatus(orderId, status);
      await loadOrders(true);
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally {
      setBusyId('');
    }
  }

  async function setItemStatus(itemId, status) {
    try {
      setBusyId(itemId);
      await updateCafeteriaOrderItemStatus(itemId, status);
      await loadOrders(true);
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally {
      setBusyId('');
    }
  }

  async function togglePriority(order) {
    const next = !order.priority;
    let note = '';
    if (next) note = window.prompt('Motivo de prioridad (opcional):', order.priorityNote || '') || '';
    try {
      setBusyId(order.id);
      await setCafeteriaOrderPriority(order.id, next, note);
      await loadOrders(true);
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="space-y-6">
      <section className="iq-module-hero iq-module-hero-food">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-600">Cafetería · Barra</p>
            <h3 className="mt-2 flex items-center gap-3 text-3xl font-black text-slate-900"><Coffee className="h-8 w-8 text-cyan-700" /> Producción en tiempo real</h3>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">Prioriza pedidos, controla tiempos objetivo y trabaja por estación sin perder el consumo real de recetas.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setActive?.('Entrega')} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800"><PackageCheck className="h-4 w-4" /> Ir a entrega</button>
            <button type="button" onClick={() => loadOrders()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /> Actualizar</button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <QueueMetric title="Pendientes" value={stats.received} icon={Clock3} />
        <QueueMetric title="En preparación" value={stats.preparing} icon={ChefHat} />
        <QueueMetric title="Listos" value={stats.ready} icon={CheckCircle2} />
        <QueueMetric title="Fuera de tiempo" value={stats.late} icon={AlertTriangle} danger={stats.late > 0} />
      </section>

      <section className="iq-operation-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {[
              ['todas', 'Todas'], ['barra', 'Barra'], ['cocina', 'Cocina'], ['reposteria', 'Repostería'], ['entrega', 'Entrega'],
            ].map(([value, label]) => (
              <button key={value} type="button" onClick={() => setStation(value)} className={`rounded-xl px-4 py-2 text-xs font-black ${station === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{label}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-600"><input type="checkbox" checked={priorityOnly} onChange={(event) => setPriorityOnly(event.target.checked)} className="h-4 w-4 rounded" /> Solo prioridad</label>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-600"><input type="checkbox" checked={includeDelivered} onChange={(event) => setIncludeDelivered(event.target.checked)} className="h-4 w-4 rounded" /> Mostrar entregados</label>
          </div>
        </div>
      </section>

      {notice && <div className={`rounded-2xl p-4 text-sm font-bold ${notice.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{notice.message}</div>}

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-400">Cargando pedidos de barra...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center"><Coffee className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-black text-slate-800">No hay pedidos para esta vista</p><p className="mt-1 text-sm text-slate-400">Los nuevos pedidos aparecerán aquí automáticamente.</p></div>
      ) : (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {filteredOrders.map((order) => {
            const status = getCafeteriaOrderStatusMeta(order.status);
            const urgency = getUrgency(order);
            const target = getOrderTarget(order);
            return (
              <article key={order.id} className={`rounded-[28px] border bg-white p-5 shadow-sm ${order.priority ? 'border-amber-300 ring-2 ring-amber-100' : urgency.tone === 'late' ? 'border-red-200' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">Pedido #{order.number}</p>
                      {order.priority && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black uppercase text-amber-800"><Star className="h-3 w-3" /> Prioridad</span>}
                    </div>
                    <h4 className="mt-1 text-xl font-black text-slate-900">{order.reference || order.customerName || 'Pedido de mostrador'}</h4>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400"><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {elapsedLabel(order.receivedAt || order.createdAt)}</span><span>·</span><span>{formatMoney(order.total)}</span><span>·</span><span className="inline-flex items-center gap-1"><Timer className="h-3.5 w-3.5" /> objetivo {target} min</span></div>
                    {urgency.label && <p className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${urgency.tone === 'late' ? 'bg-red-50 text-red-700' : urgency.tone === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-500'}`}>{urgency.tone === 'late' ? <Flame className="h-3 w-3" /> : <Timer className="h-3 w-3" />}{urgency.label}</p>}
                    {order.priorityNote && <p className="mt-2 text-xs font-bold text-amber-700">Prioridad: {order.priorityNote}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${status.badgeClass}`}>{status.label}</span>
                    {!['entregado', 'cancelado'].includes(order.status) && <button type="button" disabled={busyId === order.id} onClick={() => togglePriority(order)} className={`rounded-xl px-3 py-2 text-[10px] font-black ${order.priority ? 'bg-amber-100 text-amber-800' : 'border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{order.priority ? 'Quitar prioridad' : 'Marcar prioridad'}</button>}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {order.visibleItems.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-slate-900">{item.quantity}× {item.product}</p>
                          <p className="mt-1 text-[11px] font-bold text-cyan-700">{getCafeteriaStationLabel(item.station)}{item.targetMinutes > 0 ? ` · ${item.targetMinutes} min` : ''}</p>
                          {item.variantSummary && <p className="mt-1 text-xs text-slate-500">{item.variantSummary}</p>}
                          {item.notes && <p className="mt-1 rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-600">Nota: {item.notes}</p>}
                          {item.inventoryStatus !== 'pending' && <div className="mt-2 flex flex-wrap items-center gap-2"><InventoryBadge item={item} />{item.inventoryCost > 0 && <span className="text-[10px] font-black text-slate-400">Costo aplicado: {formatMoney(item.inventoryCost)}</span>}</div>}
                        </div>
                        <span className="text-xs font-black text-slate-400">{getCafeteriaOrderStatusMeta(item.status).label}</span>
                      </div>
                      {!['entregado', 'cancelado'].includes(order.status) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.status === 'recibido' && <SmallAction disabled={busyId === item.id} active={false} onClick={() => setItemStatus(item.id, 'preparacion')}>Preparar</SmallAction>}
                          {['recibido', 'preparacion'].includes(item.status) && <SmallAction disabled={busyId === item.id} active={false} onClick={() => setItemStatus(item.id, 'listo')}>Marcar listo</SmallAction>}
                          {item.status === 'listo' && <span className="rounded-xl bg-emerald-50 px-3 py-2 text-[10px] font-black text-emerald-700">Listo para entrega</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {!['entregado', 'cancelado'].includes(order.status) && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    {station === 'todas' && ['recibido', 'preparacion'].includes(order.status) ? (
                      <div className="flex flex-wrap gap-2">
                        {order.status === 'recibido' && <SmallAction disabled={busyId === order.id} active={false} onClick={() => setOrderStatus(order.id, 'preparacion')}>Preparar pedido</SmallAction>}
                        <SmallAction disabled={busyId === order.id} active={false} onClick={() => setOrderStatus(order.id, 'listo')}>Marcar todo listo</SmallAction>
                      </div>
                    ) : order.status === 'listo' ? (
                      <div className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-50 px-3 py-2.5">
                        <span className="text-xs font-black text-emerald-700">Pedido listo · confirma la salida desde Entrega</span>
                        <button type="button" onClick={() => setActive?.('Entrega')} className="rounded-xl bg-emerald-700 px-3 py-2 text-[10px] font-black text-white">Ir a entrega</button>
                      </div>
                    ) : station !== 'todas' ? (
                      <p className="text-[11px] font-bold text-slate-400">Vista por estación: cambia a “Todas” para aplicar acciones al pedido completo.</p>
                    ) : null}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

function InventoryBadge({ item }) {
  if (item.inventoryStatus === 'complete') return <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase text-emerald-700">Inventario aplicado</span>;
  if (item.inventoryStatus === 'partial') return <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-black uppercase text-amber-700">Faltante · {item.inventoryShortageCount || 1}</span>;
  if (item.inventoryStatus === 'error') return <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[9px] font-black uppercase text-red-700">Revisar receta · {item.inventoryIssueCount || 1}</span>;
  if (item.inventoryStatus === 'legacy') return <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-black uppercase text-slate-500">Stock directo</span>;
  return null;
}

function QueueMetric({ title, value, icon: Icon, danger = false }) {
  return <div className="iq-operation-card p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-wide text-slate-400">{title}</p><p className={`mt-2 text-3xl font-black ${danger ? 'text-red-700' : 'text-slate-900'}`}>{value}</p></div><div className={`rounded-2xl p-3 ${danger ? 'bg-red-50 text-red-700' : 'bg-cyan-50 text-cyan-700'}`}><Icon className="h-5 w-5" /></div></div></div>;
}

function SmallAction({ children, onClick, active, disabled }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`rounded-xl px-2 py-2 text-[10px] font-black transition disabled:opacity-50 ${active ? 'bg-cyan-700 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`}>{children}</button>;
}
