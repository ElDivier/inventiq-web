import { useEffect, useMemo, useState } from 'react';
import { BellRing, CheckCircle2, Clock3, Coffee, RefreshCw, ShoppingBag, UserRound } from 'lucide-react';
import {
  callCafeteriaOrder,
  fetchCafeteriaOrders,
  subscribeCafeteriaOrders,
  updateCafeteriaOrderStatus,
} from '../utils/cafeteriaOrders';

function elapsedLabel(date) {
  if (!date) return 'Ahora';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
}

function orderTypeLabel(value) {
  if (value === 'takeaway') return 'Para llevar';
  if (value === 'delivery') return 'Delivery';
  return 'En local';
}

export default function CafeteriaPickupPage({ currentUser, setActive }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [showDelivered, setShowDelivered] = useState(false);

  async function loadOrders(silent = false) {
    if (!currentUser?.id) return;
    try {
      if (!silent) setLoading(true);
      const data = await fetchCafeteriaOrders({ userId: currentUser.id, includeDelivered: true, limit: 120 });
      setOrders(data);
      setNotice(null);
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo cargar la entrega: ${error.message}` });
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => { loadOrders(); }, [currentUser?.id]);
  useEffect(() => {
    if (!currentUser?.id) return undefined;
    return subscribeCafeteriaOrders(currentUser.id, () => loadOrders(true));
  }, [currentUser?.id]);
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
  }, [currentUser?.id]);

  const visibleOrders = useMemo(() => orders
    .filter((order) => order.status === 'listo' || (showDelivered && order.status === 'entregado'))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'listo' ? -1 : 1;
      if (a.priority !== b.priority) return a.priority ? -1 : 1;
      return new Date(a.readyAt || a.createdAt) - new Date(b.readyAt || b.createdAt);
    }), [orders, showDelivered]);

  const waiting = orders.filter((order) => order.status === 'listo').length;
  const called = orders.filter((order) => order.status === 'listo' && order.callCount > 0).length;
  const deliveredToday = orders.filter((order) => order.status === 'entregado').length;

  async function callOrder(orderId) {
    try {
      setBusyId(orderId);
      await callCafeteriaOrder(orderId);
      setNotice({ type: 'success', message: 'Pedido llamado. El contador quedó registrado.' });
      await loadOrders(true);
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally {
      setBusyId('');
    }
  }

  async function deliverOrder(orderId) {
    try {
      setBusyId(orderId);
      await updateCafeteriaOrderStatus(orderId, 'entregado');
      setNotice({ type: 'success', message: 'Pedido entregado correctamente.' });
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
            <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-600">Cafetería · Entrega</p>
            <h3 className="mt-2 flex items-center gap-3 text-3xl font-black text-slate-900"><BellRing className="h-8 w-8 text-cyan-700" /> Pedidos listos</h3>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">Llama por número o nombre, controla reintentos y confirma la entrega sin mezclar esta vista con la preparación de barra.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setActive?.('Barra')} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800"><Coffee className="h-4 w-4" /> Volver a barra</button>
            <button type="button" onClick={() => loadOrders()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /> Actualizar</button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric title="Esperando entrega" value={waiting} icon={ShoppingBag} />
        <Metric title="Ya llamados" value={called} icon={BellRing} />
        <Metric title="Entregados visibles" value={deliveredToday} icon={CheckCircle2} />
      </section>

      <section className="iq-operation-card p-4">
        <label className="flex items-center gap-2 text-sm font-bold text-slate-600"><input type="checkbox" checked={showDelivered} onChange={(event) => setShowDelivered(event.target.checked)} className="h-4 w-4 rounded" /> Mostrar pedidos entregados recientes</label>
      </section>

      {notice && <div className={`rounded-2xl p-4 text-sm font-bold ${notice.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{notice.message}</div>}

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-400">Cargando punto de entrega...</div>
      ) : visibleOrders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center"><BellRing className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-black text-slate-800">No hay pedidos listos</p><p className="mt-1 text-sm text-slate-400">Cuando Barra marque un pedido como listo aparecerá aquí automáticamente.</p></div>
      ) : (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleOrders.map((order) => {
            const identity = order.reference || order.customerName || `Pedido #${order.number}`;
            const isDelivered = order.status === 'entregado';
            return (
              <article key={order.id} className={`rounded-[30px] border bg-white p-5 shadow-sm ${order.priority ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-700">Pedido #{order.number}</p>
                    <h4 className="mt-1 text-2xl font-black text-slate-900">{identity}</h4>
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400"><span>{orderTypeLabel(order.orderType)}</span><span>·</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> listo hace {elapsedLabel(order.readyAt)}</span></p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${isDelivered ? 'bg-slate-100 text-slate-500' : order.callCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>{isDelivered ? 'Entregado' : order.callCount > 0 ? `Llamado ${order.callCount}×` : 'Listo'}</span>
                </div>

                {order.priority && <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">Prioridad{order.priorityNote ? ` · ${order.priorityNote}` : ''}</div>}

                <div className="mt-4 space-y-2 border-y border-slate-100 py-4">
                  {order.items.filter((item) => item.status !== 'cancelado').map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 text-sm"><div><p className="font-black text-slate-800">{item.quantity}× {item.product}</p>{item.variantSummary && <p className="text-xs text-slate-400">{item.variantSummary}</p>}</div><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /></div>
                  ))}
                </div>

                {!isDelivered && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" disabled={busyId === order.id} onClick={() => callOrder(order.id)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"><BellRing className="h-4 w-4" /> {order.callCount > 0 ? 'Volver a llamar' : 'Llamar'}</button>
                    <button type="button" disabled={busyId === order.id} onClick={() => deliverOrder(order.id)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-3 py-3 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> Entregar</button>
                  </div>
                )}

                {order.customerName && <p className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-400"><UserRound className="h-3.5 w-3.5" /> Cliente: {order.customerName}</p>}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

function Metric({ title, value, icon: Icon }) {
  return <div className="iq-operation-card p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-wide text-slate-400">{title}</p><p className="mt-2 text-3xl font-black text-slate-900">{value}</p></div><div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700"><Icon className="h-5 w-5" /></div></div></div>;
}
