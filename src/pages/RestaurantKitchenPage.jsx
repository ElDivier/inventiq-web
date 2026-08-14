import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  CheckCheck,
  ChefHat,
  Clock3,
  Expand,
  Flame,
  ListChecks,
  MapPin,
  Play,
  RefreshCw,
  Search,
  Star,
  Timer,
  UtensilsCrossed,
  Users,
} from 'lucide-react';
import {
  fetchRestaurantKitchenOrders,
  getKitchenItemUrgency,
  getKitchenStationName,
  getKitchenStationsWithAll,
  getKitchenStatusMeta,
  getKitchenTicketUrgency,
  kitchenElapsedMinutes,
  kitchenOrderReference,
  setRestaurantKitchenItemStatus,
  setRestaurantKitchenStationStatus,
  subscribeRestaurantKitchen,
  toggleRestaurantKitchenPriority,
} from '../utils/restaurantKitchen';
import { getRestaurantCourseLabel } from '../utils/restaurantOrders';
import { auditRestaurantAction } from '../utils/restaurantStaff';

const STATUS_FILTERS = [
  { value: 'activas', label: 'Todas activas' },
  { value: 'enviado', label: 'Por iniciar' },
  { value: 'preparacion', label: 'En preparación' },
  { value: 'listo', label: 'Listas' },
];

function orderTypeLabel(value) {
  return ({ local: 'En local', takeaway: 'Para llevar', delivery: 'Delivery' })[value] || 'En local';
}

function Metric({ icon: Icon, label, value, detail, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-700 bg-slate-900 text-slate-200',
    cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    red: 'border-red-500/30 bg-red-500/10 text-red-200',
  };

  return (
    <article className={`rounded-2xl border p-4 ${tones[tone] || tones.slate}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] opacity-70">{label}</p>
          <p className="mt-1 text-2xl font-black text-white">{value}</p>
          <p className="mt-1 text-xs font-bold opacity-70">{detail}</p>
        </div>
        <Icon className="h-5 w-5 shrink-0" />
      </div>
    </article>
  );
}

function KitchenItem({ item, now, savingKey, onAdvance, onPriority }) {
  const statusMeta = getKitchenStatusMeta(item.status);
  const urgency = getKitchenItemUrgency(item, now);
  const isSaving = savingKey === item.id || savingKey === `priority-${item.id}`;
  const nextAction = item.status === 'enviado'
    ? { status: 'preparacion', label: 'Iniciar', icon: Play, className: 'bg-amber-500 text-slate-950 hover:bg-amber-400' }
    : item.status === 'preparacion'
      ? { status: 'listo', label: 'Marcar listo', icon: CheckCheck, className: 'bg-emerald-500 text-slate-950 hover:bg-emerald-400' }
      : { status: 'servido', label: 'Entregado', icon: UtensilsCrossed, className: 'bg-blue-500 text-white hover:bg-blue-400' };
  const ActionIcon = nextAction.icon;

  return (
    <article className={`rounded-2xl border bg-slate-950/55 p-3.5 ${item.isPriority ? 'border-fuchsia-400 ring-1 ring-fuchsia-400/40' : 'border-slate-700'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-black text-white">{Number(item.quantity || 0).toLocaleString('es-EC')}×</span>
            <h4 className="text-base font-black leading-tight text-white">{item.product}</h4>
            {item.isPriority && (
              <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-400/50 bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-fuchsia-200">
                <BellRing className="h-3 w-3" /> Prioridad
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-400">
            <span>{getRestaurantCourseLabel(item.course)}</span>
            {item.seatNumber && <><span>·</span><span>Asiento {item.seatNumber}</span></>}
            <><span>·</span><span>{getKitchenStationName(item.kitchenStation)}</span></>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wide ${statusMeta.badgeClass}`}>
          {statusMeta.shortLabel}
        </span>
      </div>

      {item.modifiers?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.modifiers.map((modifier, index) => (
            <span key={`${item.id}-modifier-${index}`} className="rounded-lg bg-cyan-500/10 px-2 py-1 text-xs font-extrabold text-cyan-200">
              {typeof modifier === 'string' ? modifier : modifier?.label || modifier?.name || 'Modificación'}
            </span>
          ))}
        </div>
      )}

      {item.notes && (
        <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm font-extrabold leading-5 text-amber-100">
          {item.notes}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${urgency.className}`}>
          <Timer className="h-3.5 w-3.5" /> {urgency.label}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPriority(item)}
            disabled={isSaving}
            title={item.isPriority ? 'Quitar prioridad' : 'Marcar prioridad'}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border font-black transition disabled:opacity-50 ${item.isPriority ? 'border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-200' : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500 hover:text-white'}`}
          >
            <Star className={`h-4 w-4 ${item.isPriority ? 'fill-current' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => onAdvance(item, nextAction.status)}
            disabled={isSaving}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition disabled:opacity-50 ${nextAction.className}`}
          >
            <ActionIcon className="h-4 w-4" /> {isSaving ? 'Guardando...' : nextAction.label}
          </button>
        </div>
      </div>
    </article>
  );
}

function KitchenTicket({ order, items, station, now, savingKey, onItemAdvance, onPriority, onBulk }) {
  const urgency = getKitchenTicketUrgency(items, now);
  const sentAt = items
    .map((item) => item.sentAt || item.createdAt)
    .filter(Boolean)
    .sort()[0];
  const elapsed = kitchenElapsedMinutes(sentAt, now);
  const stations = [...new Set(items.map((item) => item.kitchenStation))];
  const hasSent = items.some((item) => item.status === 'enviado');
  const hasCooking = items.some((item) => ['enviado', 'preparacion'].includes(item.status));
  const hasReady = items.some((item) => item.status === 'listo');
  const bulkKey = `bulk-${order.id}`;
  const isSaving = savingKey === bulkKey;
  const borderClass = urgency.level === 'overdue'
    ? 'border-red-500'
    : urgency.level === 'warning'
      ? 'border-amber-500'
      : urgency.level === 'ready'
        ? 'border-emerald-500'
        : 'border-slate-700';

  return (
    <article className={`flex min-h-[320px] flex-col overflow-hidden rounded-3xl border-2 bg-slate-900 shadow-xl shadow-black/20 ${borderClass}`}>
      <header className="border-b border-slate-700 bg-slate-950/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-xl font-black text-white">{kitchenOrderReference(order)}</h3>
              <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-300">
                {orderTypeLabel(order.orderType)}
              </span>
            </div>
            <p className="mt-1 text-xs font-bold text-slate-400">{order.code} · {items.length} producto{items.length === 1 ? '' : 's'}</p>
          </div>
          <div className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-right ${urgency.level === 'overdue' ? 'border-red-500/50 bg-red-500/15 text-red-200' : urgency.level === 'warning' ? 'border-amber-500/50 bg-amber-500/15 text-amber-100' : 'border-slate-600 bg-slate-800 text-slate-200'}`}>
            <p className="text-lg font-black leading-none">{elapsed} min</p>
            <p className="mt-1 text-[9px] font-black uppercase tracking-wide opacity-70">desde envío</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-400">
          {order.waiterName && <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{order.waiterName}</span>}
          {order.guestCount > 0 && <span>{order.guestCount} comensal{order.guestCount === 1 ? '' : 'es'}</span>}
          {stations.map((value) => (
            <span key={value} className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{getKitchenStationName(value)}</span>
          ))}
        </div>
      </header>

      <div className="flex-1 space-y-3 p-3.5">
        {items.map((item) => (
          <KitchenItem
            key={item.id}
            item={item}
            now={now}
            savingKey={savingKey}
            onAdvance={onItemAdvance}
            onPriority={onPriority}
          />
        ))}
      </div>

      <footer className="border-t border-slate-700 bg-slate-950/60 p-3.5">
        <div className="grid gap-2 sm:grid-cols-3">
          {hasSent && (
            <button type="button" onClick={() => onBulk(order.id, station, 'preparacion')} disabled={isSaving} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2.5 text-xs font-black text-amber-100 hover:bg-amber-500/25 disabled:opacity-50">
              <Play className="h-4 w-4" /> Iniciar {station === 'todas' ? 'ticket' : 'estación'}
            </button>
          )}
          {hasCooking && (
            <button type="button" onClick={() => onBulk(order.id, station, 'listo')} disabled={isSaving} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-2.5 text-xs font-black text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50">
              <CheckCheck className="h-4 w-4" /> Marcar listo
            </button>
          )}
          {hasReady && (
            <button type="button" onClick={() => onBulk(order.id, station, 'servido')} disabled={isSaving} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-400/40 bg-blue-500/15 px-3 py-2.5 text-xs font-black text-blue-100 hover:bg-blue-500/25 disabled:opacity-50">
              <UtensilsCrossed className="h-4 w-4" /> Entregado
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}

export default function RestaurantKitchenPage({ currentUser, setActive }) {
  const [orders, setOrders] = useState([]);
  const [station, setStation] = useState('todas');
  const [statusFilter, setStatusFilter] = useState('activas');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [notice, setNotice] = useState(null);
  const [now, setNow] = useState(Date.now());

  const loadData = useCallback(async ({ quiet = false } = {}) => {
    if (!currentUser?.id) return;
    try {
      if (!quiet) setLoading(true);
      const rows = await fetchRestaurantKitchenOrders(currentUser.id);
      setOrders(rows);
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo actualizar cocina: ${error.message}` });
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    if (!currentUser?.id) return undefined;
    return subscribeRestaurantKitchen(currentUser.id, () => loadData({ quiet: true }));
  }, [currentUser?.id, loadData]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const allItems = useMemo(() => orders.flatMap((order) => order.items), [orders]);
  const stations = useMemo(() => getKitchenStationsWithAll().map((item) => ({
    ...item,
    count: item.value === 'todas'
      ? allItems.length
      : allItems.filter((orderItem) => orderItem.kitchenStation === item.value).length,
  })), [allItems]);

  const visibleTickets = useMemo(() => {
    const text = search.trim().toLowerCase();
    return orders
      .map((order) => {
        const items = order.items.filter((item) => {
          const stationMatch = station === 'todas' || item.kitchenStation === station;
          const statusMatch = statusFilter === 'activas' || item.status === statusFilter;
          return stationMatch && statusMatch;
        });
        return { ...order, visibleItems: items };
      })
      .filter((order) => order.visibleItems.length > 0)
      .filter((order) => !text || [order.code, order.orderReference, order.waiterName, order.customerName, ...order.visibleItems.map((item) => item.product)]
        .some((value) => String(value || '').toLowerCase().includes(text)))
      .sort((a, b) => {
        const aPriority = a.visibleItems.some((item) => item.isPriority) ? 1 : 0;
        const bPriority = b.visibleItems.some((item) => item.isPriority) ? 1 : 0;
        if (aPriority !== bPriority) return bPriority - aPriority;
        const aTime = Math.min(...a.visibleItems.map((item) => new Date(item.sentAt || item.createdAt || 0).getTime()));
        const bTime = Math.min(...b.visibleItems.map((item) => new Date(item.sentAt || item.createdAt || 0).getTime()));
        return aTime - bTime;
      });
  }, [orders, search, station, statusFilter]);

  const metrics = useMemo(() => {
    const overdue = allItems.filter((item) => getKitchenItemUrgency(item, now).level === 'overdue').length;
    return {
      waiting: allItems.filter((item) => item.status === 'enviado').length,
      cooking: allItems.filter((item) => item.status === 'preparacion').length,
      ready: allItems.filter((item) => item.status === 'listo').length,
      overdue,
    };
  }, [allItems, now]);

  async function handleItemAdvance(item, targetStatus) {
    try {
      setSavingKey(item.id); setNotice(null);
      await setRestaurantKitchenItemStatus(item.id, targetStatus);
      await auditRestaurantAction(currentUser, 'kitchen.item_status', 'restaurant_order_item', item.id, { targetStatus, product: item.product });
      await loadData({ quiet: true });
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally {
      setSavingKey('');
    }
  }

  async function handleBulk(orderId, selectedStation, targetStatus) {
    try {
      setSavingKey(`bulk-${orderId}`); setNotice(null);
      const count = await setRestaurantKitchenStationStatus(orderId, selectedStation, targetStatus);
      await auditRestaurantAction(currentUser, 'kitchen.station_status', 'restaurant_order', orderId, { station: selectedStation, targetStatus, count });
      await loadData({ quiet: true });
      const labels = { preparacion: 'iniciados', listo: 'marcados como listos', servido: 'marcados como entregados' };
      setNotice({ type: 'success', message: `${count} producto${count === 1 ? '' : 's'} ${labels[targetStatus]}.` });
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally {
      setSavingKey('');
    }
  }

  async function handlePriority(item) {
    try {
      setSavingKey(`priority-${item.id}`); setNotice(null);
      await toggleRestaurantKitchenPriority(item.id);
      await auditRestaurantAction(currentUser, 'kitchen.priority_toggled', 'restaurant_order_item', item.id, { product: item.product });
      await loadData({ quiet: true });
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally {
      setSavingKey('');
    }
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      setNotice({ type: 'error', message: 'El navegador no permitió activar la pantalla completa.' });
    }
  }

  if (currentUser?.businessType !== 'restaurante') {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8">
        <h2 className="text-xl font-black text-slate-900">Pantalla de cocina</h2>
        <p className="mt-2 text-sm text-slate-500">Este módulo está disponible para cuentas Restaurante.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[30px] bg-[#07111f] text-white shadow-2xl shadow-slate-900/20">
      <header className="border-b border-slate-700/80 bg-[#0a1728] p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
              <ChefHat className="h-4 w-4" /> Operación en tiempo real
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Pantalla de cocina</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Organiza tickets por estación, controla tiempos y entrega cada producto sin perder observaciones ni modificadores.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setActive('Comandas')} className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3.5 py-2.5 text-sm font-black text-slate-200 hover:bg-slate-700">
              <ListChecks className="h-4 w-4" /> Comandas
            </button>
            <button type="button" onClick={toggleFullscreen} className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3.5 py-2.5 text-sm font-black text-slate-200 hover:bg-slate-700">
              <Expand className="h-4 w-4" /> Pantalla completa
            </button>
            <button type="button" onClick={() => loadData()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-3.5 py-2.5 text-sm font-black text-slate-950 hover:bg-cyan-400 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Clock3} label="Por iniciar" value={metrics.waiting} detail="Productos nuevos" tone="cyan" />
          <Metric icon={Flame} label="Preparando" value={metrics.cooking} detail="En proceso" tone="amber" />
          <Metric icon={CheckCheck} label="Listos" value={metrics.ready} detail="Esperando entrega" tone="emerald" />
          <Metric icon={Timer} label="Atrasados" value={metrics.overdue} detail="Sobre el tiempo objetivo" tone={metrics.overdue > 0 ? 'red' : 'slate'} />
        </div>
      </header>

      <section className="border-b border-slate-700/80 bg-[#0a1728] px-5 pb-5 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {stations.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setStation(item.value)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition ${station === item.value ? 'border-cyan-400 bg-cyan-400/15 text-cyan-100' : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200'}`}
              >
                {item.label}<span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[10px]">{item.count}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm font-bold text-slate-200 outline-none focus:border-cyan-400">
              {STATUS_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <label className="relative min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Mesa, comanda o producto" className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-9 pr-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-cyan-400" />
            </label>
          </div>
        </div>
      </section>

      {notice && (
        <div className={`mx-5 mt-5 rounded-2xl border px-4 py-3 text-sm font-bold sm:mx-6 ${notice.type === 'success' ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-red-400/30 bg-red-500/10 text-red-200'}`}>
          {notice.message}
        </div>
      )}

      <main className="min-h-[420px] p-5 sm:p-6">
        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center text-center">
            <div><RefreshCw className="mx-auto h-8 w-8 animate-spin text-cyan-300" /><p className="mt-3 text-sm font-bold text-slate-400">Cargando tickets de cocina...</p></div>
          </div>
        ) : visibleTickets.length === 0 ? (
          <div className="flex min-h-[360px] items-center justify-center text-center">
            <div className="max-w-md">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-400"><ChefHat className="h-8 w-8" /></div>
              <h3 className="mt-4 text-xl font-black">No hay tickets en esta vista</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">Las nuevas rondas aparecerán automáticamente cuando sean enviadas desde Pedidos y comandas.</p>
            </div>
          </div>
        ) : (
          <div className="grid items-start gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            {visibleTickets.map((order) => (
              <KitchenTicket
                key={order.id}
                order={order}
                items={order.visibleItems}
                station={station}
                now={now}
                savingKey={savingKey}
                onItemAdvance={handleItemAdvance}
                onPriority={handlePriority}
                onBulk={handleBulk}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
