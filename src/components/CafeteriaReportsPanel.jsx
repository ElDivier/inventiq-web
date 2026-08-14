import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Clock3,
  Coffee,
  Download,
  PackageSearch,
  Receipt,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  TimerReset,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { exportToCSV } from '../utils/csv';
import {
  buildCafeteriaReportModel,
  CAFETERIA_REPORT_PERIODS,
  formatCafeteriaMinutes,
  formatCafeteriaMoney,
  formatCafeteriaNumber,
  getCafeteriaPeriodStart,
} from '../utils/cafeteriaReports';
import { getCafeteriaStationLabel } from '../utils/cafeteriaMenu';

async function fetchAllRows({ table, select, userId, orderBy = 'created_at', ascending = false }) {
  const pageSize = 1000;
  let from = 0;
  let rows = [];
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq('user_id', userId)
      .order(orderBy, { ascending })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    rows = rows.concat(page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

function ReportMetric({ icon: Icon, label, value, note, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    violet: 'bg-violet-50 text-violet-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  };
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone] || tones.blue}`}><Icon className="h-5 w-5" /></div>
      <p className="mt-4 text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{note}</p>
    </article>
  );
}

function MiniMetric({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p><p className="truncate text-sm font-black text-slate-900">{value}</p></div>
    </div>
  );
}

function ReportCard({ icon: Icon, title, description, children }) {
  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5">
        <h3 className="flex items-center gap-2 text-lg font-black text-slate-950"><Icon className="h-5 w-5 text-cyan-700" />{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function RankedList({ rows, title, subtitle, right, emptyText }) {
  if (!rows.length) return <p className="text-sm text-slate-500">{emptyText}</p>;
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={row.key || `${title(row)}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3.5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-xs font-black text-slate-500 shadow-sm">{index + 1}</span>
            <div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{title(row)}</p><p className="truncate text-xs font-semibold text-slate-500">{subtitle(row)}</p></div>
          </div>
          <p className="shrink-0 text-sm font-black text-slate-900">{right(row)}</p>
        </div>
      ))}
    </div>
  );
}

function BarList({ rows, label, value, subtitle, emptyText }) {
  const maximum = Math.max(...rows.map((row) => Number(value(row) || 0)), 0);
  if (!rows.length || maximum <= 0) return <p className="text-sm text-slate-500">{emptyText}</p>;
  return (
    <div className="space-y-4">
      {rows.map((row, index) => {
        const rawValue = Number(value(row) || 0);
        return (
          <div key={row.key || `${label(row)}-${index}`}>
            <div className="mb-1.5 flex items-end justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{label(row)}</p><p className="truncate text-xs font-semibold text-slate-500">{subtitle(row)}</p></div><p className="shrink-0 text-sm font-black text-slate-900">{formatCafeteriaMoney(rawValue)}</p></div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-700" style={{ width: `${Math.max(4, (rawValue / maximum) * 100)}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

function priorityLabel(priority) {
  if (priority === 'urgent') return 'Urgente';
  if (priority === 'warning') return 'Próximo';
  if (priority === 'plan') return 'Planificar';
  return 'Correcto';
}

export default function CafeteriaReportsPanel({ currentUser, products = [] }) {
  const [period, setPeriod] = useState('30');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [data, setData] = useState({ orders: [], items: [], consumptions: [], adjustments: [], issues: [] });

  useEffect(() => {
    if (!currentUser?.id || currentUser?.businessType !== 'cafeteria') return undefined;
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setNotice('');
        const [orders, items, consumptions, adjustments, issues] = await Promise.all([
          fetchAllRows({ table: 'cafeteria_orders', select: 'id,sale_id,order_number,order_code,order_type,order_reference,customer_name,status,notes,total,priority,priority_note,called_at,call_count,received_at,started_at,ready_at,delivered_at,created_at', userId: currentUser.id, orderBy: 'created_at' }),
          fetchAllRows({ table: 'cafeteria_order_items', select: 'id,order_id,product_id,product_name,station,quantity,unit_price,variant_summary,modifiers,notes,status,inventory_status,inventory_consumed_at,inventory_cost,inventory_shortage_count,inventory_issue_count,target_minutes,started_at,ready_at,delivered_at,created_at', userId: currentUser.id, orderBy: 'created_at' }),
          fetchAllRows({ table: 'cafeteria_inventory_consumptions', select: 'id,order_id,order_item_id,sale_id,menu_product_id,menu_product_name,ingredient_product_id,ingredient_name,required_quantity,stock_quantity,applied_quantity,shortage_quantity,stock_unit,unit_cost,theoretical_cost,applied_cost,consumed_at', userId: currentUser.id, orderBy: 'consumed_at' }),
          fetchAllRows({ table: 'cafeteria_stock_adjustments', select: 'id,product_id,adjustment_kind,reason_code,reason_label,product_name,product_type,quantity_reported,quantity_delta,stock_before,stock_after,unit,unit_cost,cost_impact,event_date,batch_code,notes,created_at', userId: currentUser.id, orderBy: 'event_date' }),
          fetchAllRows({ table: 'cafeteria_inventory_issues', select: 'id,order_id,order_item_id,menu_product_id,menu_product_name,issue_type,details,created_at,resolved_at,resolved_notes', userId: currentUser.id, orderBy: 'created_at' }),
        ]);
        if (!cancelled) setData({ orders, items, consumptions, adjustments, issues });
      } catch (error) {
        if (!cancelled) setNotice(error.message || 'No se pudieron cargar los reportes de cafetería.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [currentUser?.id, currentUser?.businessType, refreshKey]);

  const report = useMemo(() => buildCafeteriaReportModel({ ...data, products, period }), [data, products, period]);
  const periodStart = getCafeteriaPeriodStart(period);

  function exportOrders() {
    exportToCSV('inventiq_cafeteria_pedidos.csv', report.periodOrders.map((order) => ({
      Pedido: order.order_code,
      Numero: order.order_number,
      Fecha: order.received_at || order.created_at,
      Canal: order.order_type === 'takeaway' ? 'Para llevar' : order.order_type === 'delivery' ? 'Delivery' : 'En local',
      Cliente: order.customer_name || '',
      Referencia: order.order_reference || '',
      Estado: order.status,
      Prioridad: order.priority ? 'Sí' : 'No',
      Total: Number(order.total || 0).toFixed(2),
      Listo: order.ready_at || '',
      Entregado: order.delivered_at || '',
    })));
  }

  function exportItems() {
    const allowedOrders = new Set(report.periodOrders.map((order) => String(order.id)));
    exportToCSV('inventiq_cafeteria_detalle_pedidos.csv', data.items.filter((item) => allowedOrders.has(String(item.order_id))).map((item) => ({
      Pedido: data.orders.find((order) => String(order.id) === String(item.order_id))?.order_code || '',
      Producto: item.product_name,
      Variante: item.variant_summary || '',
      Estacion: getCafeteriaStationLabel(item.station),
      Cantidad: Number(item.quantity || 0),
      Precio_unitario: Number(item.unit_price || 0).toFixed(2),
      Estado: item.status,
      Tiempo_objetivo_min: Number(item.target_minutes || 0),
      Costo_inventario: Number(item.inventory_cost || 0).toFixed(4),
      Incidencias: Number(item.inventory_issue_count || 0),
      Faltantes: Number(item.inventory_shortage_count || 0),
    })));
  }

  function exportTimes() {
    exportToCSV('inventiq_cafeteria_tiempos_barra.csv', report.station.completed.map((item) => ({
      Producto: item.product_name,
      Estacion: getCafeteriaStationLabel(item.station),
      Inicio: item.started_at || '',
      Listo: item.ready_at || '',
      Tiempo_real_min: Number(item.elapsedMinutes || 0).toFixed(2),
      Tiempo_objetivo_min: Number(item.target_minutes || 0),
      Fuera_de_objetivo: Number(item.target_minutes || 0) > 0 && Number(item.elapsedMinutes || 0) > Number(item.target_minutes || 0) ? 'Sí' : 'No',
    })));
  }

  function exportConsumption() {
    exportToCSV('inventiq_cafeteria_consumo_insumos.csv', report.consumption.filtered.map((item) => ({
      Fecha: item.consumed_at,
      Producto_menu: item.menu_product_name,
      Insumo: item.ingredient_name,
      Cantidad_teorica: Number(item.stock_quantity || item.required_quantity || 0),
      Cantidad_aplicada: Number(item.applied_quantity || 0),
      Faltante: Number(item.shortage_quantity || 0),
      Unidad: item.stock_unit || '',
      Costo_teorico: Number(item.theoretical_cost || 0).toFixed(4),
      Costo_aplicado: Number(item.applied_cost || 0).toFixed(4),
    })));
  }

  function exportWaste() {
    exportToCSV('inventiq_cafeteria_mermas_ajustes.csv', report.waste.filtered.map((item) => ({
      Fecha: item.event_date || item.created_at,
      Tipo: item.adjustment_kind === 'waste' ? 'Merma' : 'Conteo físico',
      Producto: item.product_name,
      Motivo: item.reason_label || item.reason_code,
      Variacion: Number(item.quantity_delta || 0),
      Unidad: item.unit || '',
      Costo_impacto: Number(item.cost_impact || 0).toFixed(4),
      Stock_antes: Number(item.stock_before || 0),
      Stock_despues: Number(item.stock_after || 0),
      Notas: item.notes || '',
    })));
  }

  function exportReplenishment() {
    exportToCSV('inventiq_cafeteria_reposicion_sugerida.csv', report.replenishment.map((entry) => ({
      Producto: entry.product.name,
      Categoria: entry.product.category,
      Stock_actual: entry.stock,
      Stock_minimo: entry.minStock,
      Consumo_14_dias: Number(entry.windowDemand || 0).toFixed(3),
      Cobertura_dias: entry.coverageDays === null ? '' : Number(entry.coverageDays).toFixed(1),
      Reposicion_sugerida: Number(entry.suggested || 0).toFixed(3),
      Prioridad: priorityLabel(entry.priority),
    })));
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-950 p-5 text-white sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Análisis de cafetería</p>
              <h2 className="mt-2 text-2xl font-black sm:text-3xl">Caja, barra e inventario en una sola lectura</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Mide pedidos, tiempos de preparación, variantes, consumo real de insumos, mermas y reposición sin añadir complejidad de restaurante.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select value={period} onChange={(event) => setPeriod(event.target.value)} className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-bold text-white outline-none focus:border-cyan-300">
                {CAFETERIA_REPORT_PERIODS.map((option) => <option key={option.value} value={option.value} className="text-slate-950">{option.label}</option>)}
              </select>
              <button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-cyan-50 disabled:opacity-70"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{loading ? 'Actualizando' : 'Actualizar'}</button>
            </div>
          </div>
          <p className="mt-4 text-xs font-semibold text-slate-400">{periodStart ? `Información desde ${periodStart.toLocaleDateString('es-EC')}` : 'Todo el historial disponible'}</p>
        </div>
        {notice && <div className="border-b border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{notice}</div>}
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
          <ReportMetric icon={Receipt} label="Pedidos entregados" value={report.completedOrders.length} note={`${report.activeOrders.length} activo(s) · ${report.cancelledOrders.length} cancelado(s)`} tone="blue" />
          <ReportMetric icon={TrendingUp} label="Venta entregada" value={formatCafeteriaMoney(report.revenue)} note={`Ticket promedio ${formatCafeteriaMoney(report.averageTicket)}`} tone="emerald" />
          <ReportMetric icon={Coffee} label="Costo de preparación" value={`${report.foodCostPercent.toFixed(1)}%`} note={`Costo registrado ${formatCafeteriaMoney(report.itemCost)}`} tone={report.foodCostPercent > 40 ? 'red' : 'amber'} />
          <ReportMetric icon={Sparkles} label="Margen operativo bruto" value={formatCafeteriaMoney(report.grossMargin)} note={`Después de consumo y mermas ${formatCafeteriaMoney(report.waste.wasteCost)}`} tone="violet" />
        </div>
        <div className="grid gap-3 border-t border-slate-100 bg-slate-50 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
          <MiniMetric icon={Clock3} label="Preparación promedio" value={formatCafeteriaMinutes(report.station.averageMinutes)} />
          <MiniMetric icon={TimerReset} label="Entrega total promedio" value={formatCafeteriaMinutes(report.service.averageMinutes)} />
          <MiniMetric icon={AlertTriangle} label="Fuera de tiempo objetivo" value={report.station.delayedItems.length} />
          <MiniMetric icon={PackageSearch} label="Incidencias abiertas" value={report.openIssues.length} />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ReportCard icon={BarChart3} title="Ventas por canal" description="Compara consumo en local, para llevar y delivery.">
          <BarList rows={report.channelStats} label={(row) => row.label} value={(row) => row.revenue} subtitle={(row) => `${row.orders} pedido(s)`} emptyText="Todavía no existen pedidos entregados en este periodo." />
        </ReportCard>
        <ReportCard icon={ShoppingBag} title="Productos más vendidos" description="Ordena los productos entregados por facturación.">
          <RankedList rows={report.productStats.slice(0, 8)} title={(row) => row.name} subtitle={(row) => `${formatCafeteriaNumber(row.quantity)} unidad(es) · ${row.orders} pedido(s)`} right={(row) => formatCafeteriaMoney(row.revenue)} emptyText="Todavía no existen productos vendidos en este periodo." />
        </ReportCard>
        <ReportCard icon={Sparkles} title="Variantes más pedidas" description="Permite ver qué tamaños, leches, jarabes y combinaciones se solicitan realmente.">
          <RankedList rows={report.variantStats.slice(0, 8)} title={(row) => row.product} subtitle={(row) => `${row.variant} · ${row.orders} pedido(s)`} right={(row) => `${formatCafeteriaNumber(row.quantity)} u.`} emptyText="Todavía no existen ventas con variantes registradas." />
        </ReportCard>
        <ReportCard icon={Boxes} title="Ventas por categoría" description="Resume el peso comercial de café, bebidas, repostería, desayunos y demás familias del menú.">
          <BarList rows={report.categoryStats.slice(0, 8)} label={(row) => row.name} value={(row) => row.revenue} subtitle={(row) => `${formatCafeteriaNumber(row.quantity)} unidad(es) · ${row.orders} pedido(s)`} emptyText="No existen categorías con ventas entregadas en este periodo." />
        </ReportCard>
      </section>

      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5 sm:p-6"><h3 className="text-xl font-black text-slate-950">Rendimiento de barra por estación</h3><p className="mt-1 text-sm text-slate-500">El tiempo se mide desde que el producto inicia preparación hasta que queda listo.</p></div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
          {report.station.stationStats.length === 0 && <p className="text-sm text-slate-500">Todavía no existen productos preparados en el periodo.</p>}
          {report.station.stationStats.map((station) => (
            <article key={station.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-950">{station.label}</p><p className="mt-1 text-xs font-semibold text-slate-500">{station.totalItems} producto(s)</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div><p className="text-[10px] font-black uppercase text-slate-400">Promedio</p><p className="mt-1 text-sm font-black">{formatCafeteriaMinutes(station.averageMinutes)}</p></div><div><p className="text-[10px] font-black uppercase text-slate-400">Atrasados</p><p className="mt-1 text-sm font-black">{station.delayedItems}</p></div><div><p className="text-[10px] font-black uppercase text-slate-400">Pendientes</p><p className="mt-1 text-sm font-black">{station.pendingItems}</p></div></div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ReportCard icon={Coffee} title="Insumos de mayor consumo" description="Se calcula con el consumo real registrado cuando Barra inicia la preparación.">
          <RankedList rows={report.consumption.ingredients.slice(0, 10)} title={(row) => row.name} subtitle={(row) => `${formatCafeteriaNumber(row.quantity, 3)} ${row.unit} · ${row.orders} pedido(s)`} right={(row) => formatCafeteriaMoney(row.cost)} emptyText="Todavía no existen consumos de receta registrados." />
        </ReportCard>
        <ReportCard icon={AlertTriangle} title="Reposición prioritaria" description="Combina stock mínimo y consumo reciente para sugerir qué revisar primero.">
          <RankedList rows={report.replenishment.filter((row) => row.priority !== 'ok').slice(0, 10)} title={(row) => row.product.name} subtitle={(row) => `${priorityLabel(row.priority)} · stock ${formatCafeteriaNumber(row.stock, 3)}${row.coverageDays === null ? '' : ` · ${row.coverageDays.toFixed(1)} días de cobertura`}`} right={(row) => `+${formatCafeteriaNumber(row.suggested, 3)}`} emptyText="El inventario no presenta reposiciones prioritarias." />
        </ReportCard>
        <ReportCard icon={PackageSearch} title="Mermas por motivo" description="Muestra el costo registrado por errores de preparación, leche sobrante, calibración, caducidad y otras causas.">
          <RankedList rows={report.waste.wasteByReason.slice(0, 8)} title={(row) => row.name} subtitle={(row) => `${row.records} registro(s)`} right={(row) => formatCafeteriaMoney(row.cost)} emptyText="No existen mermas registradas en este periodo." />
        </ReportCard>
        <ReportCard icon={ShoppingBag} title="Productos sin ventas" description="Productos disponibles del menú que no aparecen en pedidos entregados durante el periodo.">
          <RankedList rows={report.menuWithoutSales.slice(0, 8)} title={(row) => row.name} subtitle={(row) => row.category || 'Sin categoría'} right={() => 'Sin ventas'} emptyText="Todos los productos disponibles registran movimiento o todavía no existe menú para analizar." />
        </ReportCard>
      </section>

      <section className="rounded-[1.5rem] border border-cyan-100 bg-cyan-50 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div className="max-w-xl"><h3 className="text-lg font-black text-cyan-950">Reportes exportables de cafetería</h3><p className="mt-1 text-sm leading-6 text-cyan-900">Exporta operación de barra e inventario para análisis externo sin mezclar productos del menú con insumos internos.</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button onClick={exportOrders} className="iq-action-secondary justify-center"><Download className="h-4 w-4" /> Pedidos</button>
          <button onClick={exportItems} className="iq-action-secondary justify-center"><Download className="h-4 w-4" /> Detalle</button>
          <button onClick={exportTimes} className="iq-action-secondary justify-center"><Download className="h-4 w-4" /> Tiempos</button>
          <button onClick={exportConsumption} className="iq-action-secondary justify-center"><Download className="h-4 w-4" /> Consumo</button>
          <button onClick={exportWaste} className="iq-action-secondary justify-center"><Download className="h-4 w-4" /> Mermas</button>
          <button onClick={exportReplenishment} className="iq-action-secondary justify-center"><Download className="h-4 w-4" /> Reposición</button>
        </div></div>
      </section>
    </div>
  );
}
