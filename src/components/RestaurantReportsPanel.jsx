import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Banknote,
  Boxes,
  ChefHat,
  CircleDollarSign,
  Clock3,
  Download,
  MapPin,
  Package,
  PackageSearch,
  Receipt,
  RefreshCw,
  Scale,
  ShoppingBag,
  TrendingUp,
  UserRound,
  Users,
  Utensils,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { exportToCSV } from '../utils/csv';
import {
  buildRestaurantReportModel,
  formatRestaurantMinutes,
  formatRestaurantMoney,
  formatRestaurantNumber,
  getRestaurantChannelLabel,
  getRestaurantOrderStatusLabel,
  getRestaurantPeriodStart,
  getRestaurantSuggestedPurchase,
  RESTAURANT_REPORT_PERIODS,
} from '../utils/restaurantReports';
import { cleanOperationalCategoryLabel } from '../config/productTypes';
import { getRestaurantProductRole, getRestaurantStationLabel } from '../utils/restaurantMenu';

const EMPTY_DATA = {
  orders: [],
  items: [],
  payments: [],
  consumptions: [],
  adjustments: [],
  issues: [],
  areas: [],
  tables: [],
};

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

    if (error) return { data: [], error };
    const page = data || [];
    rows = rows.concat(page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return { data: rows, error: null };
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function csvSafeModifiers(value) {
  if (!Array.isArray(value)) return '';
  return value
    .map(item => typeof item === 'string' ? item : item?.label || item?.name || '')
    .filter(Boolean)
    .join(' · ');
}

export default function RestaurantReportsPanel({ currentUser, products = [] }) {
  const [period, setPeriod] = useState('30');
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!currentUser?.id) {
      setData(EMPTY_DATA);
      return undefined;
    }

    let cancelled = false;

    async function loadReports() {
      setLoading(true);
      setNotice(null);

      try {
        const results = await Promise.all([
          fetchAllRows({
            table: 'restaurant_orders',
            select: 'id, table_id, area_id, order_code, order_type, order_reference, status, waiter_name, guest_count, customer_name, notes, subtotal, discount_amount, service_charge, total, paid_total, balance_due, payment_status, opened_at, sent_at, bill_requested_at, closed_at, sale_id, inventory_consumption_status, inventory_consumed_at, inventory_cost_total, inventory_shortage_count, inventory_issue_count, created_at, updated_at',
            userId: currentUser.id,
            orderBy: 'opened_at',
          }),
          fetchAllRows({
            table: 'restaurant_order_items',
            select: 'id, order_id, product_id, product_name, category, kitchen_station, course, seat_number, quantity, unit_price, modifiers, notes, status, sent_at, started_at, ready_at, served_at, cancelled_at, cancellation_reason, preparation_minutes, is_priority, created_at, updated_at',
            userId: currentUser.id,
            orderBy: 'created_at',
          }),
          fetchAllRows({
            table: 'restaurant_order_payments',
            select: 'id, order_id, payment_code, amount, payment_method, cash_amount, card_amount, transfer_amount, split_mode, split_label, allocation, notes, status, paid_at, voided_at, void_reason, sale_id, created_at',
            userId: currentUser.id,
            orderBy: 'paid_at',
          }),
          fetchAllRows({
            table: 'restaurant_inventory_consumptions',
            select: 'id, order_id, sale_id, order_item_id, menu_product_id, menu_product_name, ingredient_product_id, ingredient_name, source_kind, quantity_sold, recipe_quantity, recipe_unit, required_quantity, stock_quantity, applied_quantity, shortage_quantity, stock_unit, unit_cost, theoretical_cost, applied_cost, stock_before, stock_after, order_type, consumed_at, reversed_at',
            userId: currentUser.id,
            orderBy: 'consumed_at',
          }),
          fetchAllRows({
            table: 'restaurant_stock_adjustments',
            select: 'id, product_id, production_batch_id, adjustment_kind, reason_code, reason_label, product_name, product_type, quantity_reported, quantity_delta, stock_before, stock_after, unit, unit_cost, cost_impact, event_date, batch_code, notes, created_at',
            userId: currentUser.id,
            orderBy: 'event_date',
          }),
          fetchAllRows({
            table: 'restaurant_inventory_issues',
            select: 'id, order_id, order_item_id, menu_product_id, menu_product_name, issue_type, details, created_at, resolved_at, resolved_notes',
            userId: currentUser.id,
            orderBy: 'created_at',
          }),
          fetchAllRows({
            table: 'restaurant_areas',
            select: 'id, name, sort_order, is_active, created_at',
            userId: currentUser.id,
            orderBy: 'sort_order',
            ascending: true,
          }),
          fetchAllRows({
            table: 'restaurant_tables',
            select: 'id, area_id, name, capacity, status, waiter_name, guest_count, current_total, is_active, sort_order, created_at',
            userId: currentUser.id,
            orderBy: 'sort_order',
            ascending: true,
          }),
        ]);

        const firstError = results.find(result => result.error)?.error;
        if (firstError) throw firstError;
        if (cancelled) return;

        setData({
          orders: results[0].data,
          items: results[1].data,
          payments: results[2].data,
          consumptions: results[3].data,
          adjustments: results[4].data,
          issues: results[5].data,
          areas: results[6].data,
          tables: results[7].data,
        });
      } catch (error) {
        console.error('Error cargando reportes de restaurante:', error);
        if (!cancelled) setNotice(`No se pudo cargar el análisis gastronómico: ${error.message}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadReports();
    return () => { cancelled = true; };
  }, [currentUser?.id, refreshKey]);

  const report = useMemo(() => buildRestaurantReportModel({
    period,
    products,
    ...data,
  }), [period, products, data]);

  const periodLabel = RESTAURANT_REPORT_PERIODS.find(item => item.value === period)?.label || 'Periodo';
  const periodStart = getRestaurantPeriodStart(period);

  function exportOrders() {
    exportToCSV('inventiq_restaurante_cuentas.csv', report.periodOrders.map((order) => {
      const table = order.table_id ? report.tableById.get(String(order.table_id)) : null;
      const directArea = order.area_id ? report.areaById.get(String(order.area_id)) : null;
      const inheritedArea = table?.area_id ? report.areaById.get(String(table.area_id)) : null;
      return {
        Codigo: order.order_code,
        Tipo_servicio: getRestaurantChannelLabel(order.order_type),
        Area: directArea?.name || inheritedArea?.name || '',
        Mesa: table?.name || '',
        Mesero: order.waiter_name || '',
        Comensales: Number(order.guest_count || 0),
        Estado: getRestaurantOrderStatusLabel(order.status),
        Subtotal: Number(order.subtotal || 0).toFixed(2),
        Descuento: Number(order.discount_amount || 0).toFixed(2),
        Servicio: Number(order.service_charge || 0).toFixed(2),
        Total: Number(order.total || 0).toFixed(2),
        Pagado: Number(order.paid_total || 0).toFixed(2),
        Saldo: Number(order.balance_due || 0).toFixed(2),
        Apertura: formatDateTime(order.opened_at),
        Cierre: formatDateTime(order.closed_at),
        Estado_inventario: order.inventory_consumption_status || '',
        Costo_inventario: Number(order.inventory_cost_total || 0).toFixed(2),
      };
    }));
  }

  function exportItems() {
    const relevantOrderIds = new Set(report.periodOrders.map(order => String(order.id)));
    exportToCSV('inventiq_restaurante_detalle_comandas.csv', data.items
      .filter(item => relevantOrderIds.has(String(item.order_id)))
      .map((item) => {
        const order = report.orderLookup.get(String(item.order_id));
        return {
          Cuenta: order?.order_code || '',
          Tipo_servicio: getRestaurantChannelLabel(order?.order_type),
          Producto: item.product_name,
          Categoria: cleanOperationalCategoryLabel(item.category),
          Cantidad: Number(item.quantity || 0),
          Precio_unitario: Number(item.unit_price || 0).toFixed(2),
          Total_linea: (Number(item.quantity || 0) * Number(item.unit_price || 0)).toFixed(2),
          Curso: item.course,
          Asiento: item.seat_number || '',
          Estacion: getRestaurantStationLabel(item.kitchen_station),
          Estado: item.status,
          Modificadores: csvSafeModifiers(item.modifiers),
          Observaciones: item.notes || '',
          Motivo_cancelacion: item.cancellation_reason || '',
          Enviado: formatDateTime(item.sent_at),
          Inicio_preparacion: formatDateTime(item.started_at),
          Listo: formatDateTime(item.ready_at),
          Entregado: formatDateTime(item.served_at),
        };
      }));
  }

  function exportKitchen() {
    exportToCSV('inventiq_restaurante_tiempos_cocina.csv', report.kitchen.kitchenItems.map((item) => ({
      Cuenta: report.orderLookup.get(String(item.order_id))?.order_code || '',
      Producto: item.product_name,
      Estacion: getRestaurantStationLabel(item.kitchen_station),
      Tiempo_objetivo_min: Number(item.preparation_minutes || 0),
      Tiempo_real_min: item.ready_at && item.sent_at
        ? Math.round((new Date(item.ready_at).getTime() - new Date(item.sent_at).getTime()) / 60000)
        : '',
      Estado: item.status,
      Prioridad: item.is_priority ? 'Sí' : 'No',
      Enviado: formatDateTime(item.sent_at),
      Listo: formatDateTime(item.ready_at),
    })));
  }

  function exportPayments() {
    exportToCSV('inventiq_restaurante_cobros.csv', report.payments.map(payment => ({
      Codigo_cobro: payment.payment_code,
      Cuenta: report.orderLookup.get(String(payment.order_id))?.order_code || '',
      Fecha: formatDateTime(payment.paid_at),
      Metodo: payment.payment_method,
      Division: payment.split_label || payment.split_mode,
      Valor: Number(payment.amount || 0).toFixed(2),
      Efectivo: Number(payment.cash_amount || 0).toFixed(2),
      Tarjeta: Number(payment.card_amount || 0).toFixed(2),
      Transferencia: Number(payment.transfer_amount || 0).toFixed(2),
      Observacion: payment.notes || '',
    })));
  }

  function exportConsumption() {
    exportToCSV('inventiq_restaurante_consumo_ingredientes.csv', report.consumptions.map(item => ({
      Cuenta: report.orderLookup.get(String(item.order_id))?.order_code || '',
      Plato: item.menu_product_name,
      Ingrediente: item.ingredient_name,
      Tipo_componente: item.source_kind,
      Cantidad_requerida: Number(item.stock_quantity || item.required_quantity || 0),
      Cantidad_aplicada: Number(item.applied_quantity || 0),
      Faltante: Number(item.shortage_quantity || 0),
      Unidad: item.stock_unit,
      Costo_teorico: Number(item.theoretical_cost || 0).toFixed(4),
      Costo_aplicado: Number(item.applied_cost || 0).toFixed(4),
      Tipo_servicio: getRestaurantChannelLabel(item.order_type),
      Fecha: formatDateTime(item.consumed_at),
    })));
  }

  function exportWaste() {
    exportToCSV('inventiq_restaurante_mermas_conteos.csv', report.adjustments.map(item => ({
      Fecha: item.event_date,
      Tipo: item.adjustment_kind === 'waste' ? 'Merma' : 'Conteo físico',
      Motivo: item.reason_label,
      Producto: item.product_name,
      Tipo_articulo: item.product_type,
      Cantidad_reportada: Number(item.quantity_reported || 0),
      Movimiento: Number(item.quantity_delta || 0),
      Unidad: item.unit,
      Stock_anterior: Number(item.stock_before || 0),
      Stock_final: Number(item.stock_after || 0),
      Impacto_costo: Number(item.cost_impact || 0).toFixed(2),
      Observacion: item.notes || '',
    })));
  }

  function exportIssues() {
    exportToCSV('inventiq_restaurante_incidencias_inventario.csv', report.issues.map(issue => ({
      Cuenta: report.orderLookup.get(String(issue.order_id))?.order_code || '',
      Plato: issue.menu_product_name,
      Tipo_incidencia: issue.issue_type,
      Detalle: issue.details,
      Fecha: formatDateTime(issue.created_at),
      Resuelta: issue.resolved_at ? 'Sí' : 'No',
      Fecha_resolucion: formatDateTime(issue.resolved_at),
      Nota_resolucion: issue.resolved_notes || '',
    })));
  }

  function exportMenuEconomics() {
    exportToCSV('inventiq_restaurante_rentabilidad_menu.csv', report.menuEconomics.map(entry => ({
      Producto: entry.product.name,
      Categoria: cleanOperationalCategoryLabel(entry.product.category),
      Precio_venta: entry.price.toFixed(2),
      Costo_receta: entry.cost.toFixed(4),
      Costo_gastronomico_pct: entry.foodCostPercent.toFixed(2),
      Margen_unitario: entry.unitMargin.toFixed(2),
      Cantidad_vendida: Number(entry.sales?.quantity || 0),
      Ingresos: Number(entry.sales?.revenue || 0).toFixed(2),
      Margen_estimado: Number(entry.estimatedMargin || 0).toFixed(2),
    })));
  }

  function exportInventory() {
    exportToCSV('inventiq_restaurante_inventario_clasificado.csv', products.map(product => ({
      SKU: product.sku,
      Producto: product.name,
      Tipo_operativo: getRestaurantProductRole(product) === 'menu'
        ? 'Menú'
        : getRestaurantProductRole(product) === 'preparation'
          ? 'Preparación'
          : 'Insumo o empaque',
      Categoria: cleanOperationalCategoryLabel(product.category),
      Stock_actual: Number(product.stock || 0),
      Stock_minimo: Number(product.minStock || 0),
      Costo_unitario: Number(product.cost || 0).toFixed(4),
      Precio_venta: Number(product.price || 0).toFixed(2),
      Valor_inventario: (Number(product.stock || 0) * Number(product.cost || 0)).toFixed(2),
      Reposicion_sugerida: getRestaurantProductRole(product) === 'menu'
        ? ''
        : getRestaurantSuggestedPurchase(product),
    })));
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-950 p-5 text-white sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Análisis gastronómico</p>
              <h2 className="mt-2 text-2xl font-black sm:text-3xl">Ventas, cocina e inventario conectados</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Los platos se analizan por ventas y rentabilidad. Los ingredientes, preparaciones y empaques se analizan por consumo, costo, existencias y merma.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="sr-only" htmlFor="restaurant-report-period">Periodo del reporte</label>
              <select
                id="restaurant-report-period"
                value={period}
                onChange={event => setPeriod(event.target.value)}
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-bold text-white outline-none focus:border-cyan-300"
              >
                {RESTAURANT_REPORT_PERIODS.map(option => (
                  <option key={option.value} value={option.value} className="text-slate-950">{option.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setRefreshKey(key => key + 1)}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-50 disabled:cursor-wait disabled:opacity-70"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Actualizando' : 'Actualizar'}
              </button>
            </div>
          </div>
          <p className="mt-4 text-xs font-semibold text-slate-400">
            {periodStart ? `Información desde ${periodStart.toLocaleDateString('es-EC')}` : 'Todo el historial disponible'}
          </p>
        </div>

        {notice && <div className="border-b border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{notice}</div>}

        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
          <RestaurantMetric icon={Receipt} label="Cuentas cerradas" value={report.completedOrders.length} note={`${report.cancelledOrders.length} cancelada(s) · ${report.activeOrders.length} activa(s)`} tone="blue" />
          <RestaurantMetric icon={CircleDollarSign} label="Ventas de cuentas" value={formatRestaurantMoney(report.revenue)} note={`Cobros del periodo ${formatRestaurantMoney(report.collected)}`} tone="emerald" />
          <RestaurantMetric icon={Banknote} label="Ticket promedio" value={formatRestaurantMoney(report.averageTicket)} note={`${formatRestaurantMoney(report.averagePerGuest)} por comensal`} tone="violet" />
          <RestaurantMetric icon={TrendingUp} label="Costo gastronómico" value={`${report.foodCostPercent.toFixed(1)}%`} note={report.openIssues.length > 0 ? `Costo aplicado · ${report.openIssues.length} incidencia(s) abierta(s)` : `Margen antes de gastos ${formatRestaurantMoney(report.grossMargin)}`} tone={report.foodCostPercent > 40 ? 'red' : 'amber'} />
        </div>

        <div className="grid gap-3 border-t border-slate-100 bg-slate-50 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
          <RestaurantMiniMetric icon={Users} label="Comensales atendidos" value={formatRestaurantNumber(report.guests, 0)} />
          <RestaurantMiniMetric icon={Clock3} label="Tiempo medio de cocina" value={formatRestaurantMinutes(report.kitchen.averageMinutes)} />
          <RestaurantMiniMetric icon={Scale} label="Costo de mermas" value={formatRestaurantMoney(report.waste.wasteCost)} />
          <RestaurantMiniMetric icon={AlertTriangle} label="Incidencias abiertas" value={report.openIssues.length} />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ReportCard icon={Utensils} title="Ventas por canal" description="Compara el peso del consumo en local, para llevar y delivery.">
          <BarList
            rows={report.channelStats}
            valueKey="revenue"
            labelKey="label"
            valueFormatter={formatRestaurantMoney}
            subtitle={row => `${row.orders} cuenta(s) · ${row.guests} comensal(es)`}
            emptyText="Todavía no existen cuentas cerradas en este periodo."
          />
        </ReportCard>

        <ReportCard icon={ShoppingBag} title="Platos más vendidos" description="Solo incluye artículos del menú presentes en cuentas cerradas.">
          <RankedList
            rows={report.productStats.slice(0, 8)}
            title={row => row.name}
            subtitle={row => `${formatRestaurantNumber(row.quantity)} unidad(es) · ${row.orders} cuenta(s)`}
            right={row => formatRestaurantMoney(row.revenue)}
            emptyText="Todavía no existen platos vendidos en este periodo."
          />
        </ReportCard>

        <ReportCard icon={MapPin} title="Ventas por área" description="Permite comparar salón, terraza, barra y canales externos.">
          <BarList
            rows={report.areaStats.slice(0, 8)}
            valueKey="revenue"
            labelKey="name"
            valueFormatter={formatRestaurantMoney}
            subtitle={row => `${row.orders} cuenta(s) · ${row.guests} comensal(es)`}
            emptyText="No existen áreas con ventas cerradas en este periodo."
          />
        </ReportCard>

        <ReportCard icon={UserRound} title="Desempeño comercial por mesero" description="Muestra ventas atendidas; no debe utilizarse de forma aislada para evaluar desempeño laboral.">
          <RankedList
            rows={report.waiterStats.slice(0, 8)}
            title={row => row.name}
            subtitle={row => `${row.orders} cuenta(s) · ${row.guests} comensal(es)`}
            right={row => formatRestaurantMoney(row.revenue)}
            emptyText="Las cuentas cerradas no tienen mesero asignado o todavía no existen ventas."
          />
        </ReportCard>

        <ReportCard icon={Boxes} title="Ventas por categoría del menú" description="Entradas, platos fuertes, bebidas, postres y otras categorías comerciales.">
          <BarList
            rows={report.categoryStats.slice(0, 8)}
            valueKey="revenue"
            labelKey="name"
            valueFormatter={formatRestaurantMoney}
            subtitle={row => `${formatRestaurantNumber(row.quantity)} unidad(es) · ${row.orders} cuenta(s)`}
            emptyText="Todavía no existen categorías con ventas en este periodo."
          />
        </ReportCard>

        <ReportCard icon={Banknote} title="Cobros por método de pago" description="Valores efectivamente cobrados durante el periodo seleccionado.">
          <BarList
            rows={report.paymentMethods}
            valueKey="amount"
            labelKey="name"
            valueFormatter={formatRestaurantMoney}
            subtitle={row => `${row.records} cobro(s)`}
            emptyText="No existen cobros registrados en este periodo."
          />
        </ReportCard>
      </section>

      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Operación de cocina</p>
              <h3 className="mt-2 text-xl font-black text-slate-950 sm:text-2xl">Tiempos y carga por estación</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">El tiempo se mide desde el envío a cocina hasta que el producto se marca como listo.</p>
            </div>
            <button type="button" onClick={exportKitchen} className="iq-action-secondary justify-center"><Download className="h-4 w-4" /> Exportar tiempos</button>
          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3 sm:p-6">
          {report.kitchen.stationStats.length === 0 && <p className="text-sm text-slate-500">Todavía no existen comandas enviadas a cocina en este periodo.</p>}
          {report.kitchen.stationStats.map(station => (
            <article key={station.key} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-950">{station.label}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{station.totalItems} producto(s) recibido(s)</p>
                </div>
                <ChefHat className="h-5 w-5 text-cyan-700" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <KitchenStat label="Promedio" value={formatRestaurantMinutes(station.averageMinutes)} />
                <KitchenStat label="Atrasados" value={station.delayedItems} />
                <KitchenStat label="Pendientes" value={station.pendingItems} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ReportCard icon={PackageSearch} title="Consumo de ingredientes" description="Ordenado por costo aplicado en las cuentas cerradas.">
          <RankedList
            rows={report.consumption.ingredientStats.slice(0, 10)}
            title={row => row.name}
            subtitle={row => `${formatRestaurantNumber(row.appliedQuantity, 3)} ${row.stockUnit} · ${row.orders} cuenta(s)`}
            right={row => formatRestaurantMoney(row.appliedCost)}
            badge={row => row.shortageQuantity > 0 ? `Faltante ${formatRestaurantNumber(row.shortageQuantity, 3)}` : ''}
            emptyText="Todavía no existen consumos gastronómicos registrados."
          />
        </ReportCard>

        <ReportCard icon={AlertTriangle} title="Faltantes e incidencias" description="Recetas incompletas, unidades incompatibles y consumos que superaron la existencia disponible.">
          <div className="divide-y divide-slate-100">
            {report.consumption.shortages.length === 0 && report.openIssues.length === 0 && (
              <p className="p-5 text-sm text-slate-500">No existen faltantes ni incidencias abiertas en el periodo.</p>
            )}
            {report.consumption.shortages.slice(0, 5).map(row => (
              <ReportLine key={`shortage-${row.key}`} title={row.name} subtitle={`${formatRestaurantNumber(row.shortageQuantity, 3)} ${row.stockUnit} no descontados`} right="Stock insuficiente" tone="red" />
            ))}
            {report.openIssues.slice(0, 5).map(issue => (
              <ReportLine key={issue.id} title={issue.menu_product_name || 'Plato sin identificar'} subtitle={issue.details} right={issue.issue_type} tone="amber" />
            ))}
          </div>
        </ReportCard>

        <ReportCard icon={Scale} title="Mermas por motivo" description="Impacto económico de pérdidas registradas en cocina e inventario.">
          <RankedList
            rows={report.waste.byReason.slice(0, 8)}
            title={row => row.name}
            subtitle={row => `${row.records} registro(s) de merma`}
            right={row => formatRestaurantMoney(row.cost)}
            emptyText="No existen mermas registradas en el periodo."
          />
        </ReportCard>

        <ReportCard icon={Boxes} title="Reposición de insumos y preparaciones" description="Los platos del menú no se incluyen como compra sugerida.">
          <div className="divide-y divide-slate-100">
            {report.inventory.lowStock.length === 0 && <p className="p-5 text-sm text-slate-500">No existen artículos internos por debajo del stock mínimo.</p>}
            {report.inventory.lowStock.slice(0, 8).map(product => (
              <ReportLine
                key={product.id}
                title={product.name}
                subtitle={`Stock ${formatRestaurantNumber(product.stock, 3)} · mínimo ${formatRestaurantNumber(product.minStock, 3)}`}
                right={`Reponer ${formatRestaurantNumber(getRestaurantSuggestedPurchase(product), 3)}`}
                tone="blue"
              />
            ))}
          </div>
        </ReportCard>
      </section>

      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Rentabilidad del menú</p>
              <h3 className="mt-2 text-xl font-black text-slate-950 sm:text-2xl">Costo y margen por plato</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">El costo se toma de la receta vigente almacenada en el producto. Los ingredientes no aparecen como productos sin ventas.</p>
            </div>
            <button type="button" onClick={exportMenuEconomics} className="iq-action-secondary justify-center"><Download className="h-4 w-4" /> Exportar rentabilidad</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[780px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Plato</th>
                <th className="px-5 py-3">Precio</th>
                <th className="px-5 py-3">Costo</th>
                <th className="px-5 py-3">Costo %</th>
                <th className="px-5 py-3">Margen unitario</th>
                <th className="px-5 py-3">Ventas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.menuEconomics.length === 0 && (
                <tr><td colSpan="6" className="px-5 py-6 text-slate-500">Todavía no existen productos de menú para analizar.</td></tr>
              )}
              {report.menuEconomics.slice(0, 15).map(entry => (
                <tr key={entry.product.id} className="align-top">
                  <td className="px-5 py-4"><p className="font-black text-slate-950">{entry.product.name}</p><p className="mt-1 text-xs text-slate-500">{cleanOperationalCategoryLabel(entry.product.category)}</p></td>
                  <td className="px-5 py-4 font-bold text-slate-700">{formatRestaurantMoney(entry.price)}</td>
                  <td className="px-5 py-4 font-bold text-slate-700">{formatRestaurantMoney(entry.cost)}</td>
                  <td className="px-5 py-4"><CostBadge value={entry.foodCostPercent} /></td>
                  <td className="px-5 py-4 font-black text-emerald-700">{formatRestaurantMoney(entry.unitMargin)}</td>
                  <td className="px-5 py-4 font-bold text-slate-700">{formatRestaurantNumber(entry.sales?.quantity || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Inventario clasificado</p>
              <h3 className="mt-2 text-xl font-black text-slate-950 sm:text-2xl">Menú, preparaciones e insumos por separado</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">Valor total del inventario gastronómico: <strong>{formatRestaurantMoney(report.inventory.totalValue)}</strong>.</p>
            </div>
            <button type="button" onClick={exportInventory} className="iq-action-secondary justify-center"><Download className="h-4 w-4" /> Exportar inventario</button>
          </div>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
          {report.inventory.sections.map((section, index) => (
            <RestaurantInventoryCard key={section.key} section={section} icon={index === 0 ? Utensils : index === 1 ? ChefHat : Package} />
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-cyan-100 bg-cyan-50 p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-xl">
            <h3 className="text-lg font-black text-cyan-950">Exportaciones del restaurante</h3>
            <p className="mt-1 text-sm leading-6 text-cyan-900">Cada archivo respeta el periodo seleccionado ({periodLabel}) y separa ventas, cocina, inventario y mermas.</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <RestaurantExportButton onClick={exportOrders} label="Cuentas" />
            <RestaurantExportButton onClick={exportItems} label="Detalle de comandas" />
            <RestaurantExportButton onClick={exportPayments} label="Cobros" />
            <RestaurantExportButton onClick={exportKitchen} label="Tiempos de cocina" />
            <RestaurantExportButton onClick={exportConsumption} label="Consumo de ingredientes" />
            <RestaurantExportButton onClick={exportWaste} label="Mermas y conteos" />
            <RestaurantExportButton onClick={exportIssues} label="Incidencias" />
            <RestaurantExportButton onClick={exportMenuEconomics} label="Rentabilidad del menú" />
            <RestaurantExportButton onClick={exportInventory} label="Inventario clasificado" />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ReportCard icon={Activity} title="Platos sin ventas en el periodo" description="Solo se analizan productos del menú; ingredientes y empaques no aparecen aquí.">
          <div className="divide-y divide-slate-100">
            {report.menuWithoutSales.length === 0 && <p className="p-5 text-sm text-slate-500">Todos los platos activos registran ventas o todavía no existe menú para analizar.</p>}
            {report.menuWithoutSales.slice(0, 8).map(product => (
              <ReportLine key={product.id} title={product.name} subtitle={cleanOperationalCategoryLabel(product.category)} right="Sin ventas" tone="amber" />
            ))}
          </div>
        </ReportCard>

        <ReportCard icon={AlertTriangle} title="Productos cancelados en comanda" description="Ayuda a revisar errores de toma, devoluciones y anulaciones antes del cobro.">
          <div className="divide-y divide-slate-100">
            {report.kitchen.cancelledItems.length === 0 && <p className="p-5 text-sm text-slate-500">No existen productos cancelados en el periodo.</p>}
            {report.kitchen.cancelledItems.slice(0, 8).map(item => (
              <ReportLine
                key={item.id}
                title={item.product_name}
                subtitle={item.cancellation_reason || 'Sin motivo registrado'}
                right={report.orderLookup.get(String(item.order_id))?.order_code || 'Comanda'}
                tone="red"
              />
            ))}
          </div>
        </ReportCard>
      </section>
    </div>
  );
}

function RestaurantMetric({ icon: Icon, label, value, note, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    violet: 'bg-violet-50 text-violet-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  };
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone] || tones.blue}`}><Icon className="h-5 w-5" /></div>
      <p className="mt-4 text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{note}</p>
    </article>
  );
}

function RestaurantMiniMetric({ icon: Icon, label, value }) {
  return (
    <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700"><Icon className="h-5 w-5" /></div>
      <div><p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-lg font-black text-slate-950">{value}</p></div>
    </article>
  );
}

function ReportCard({ icon: Icon, title, description, children }) {
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <h3 className="flex items-center gap-2 text-xl font-black text-slate-950"><Icon className="h-5 w-5 text-cyan-700" />{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function BarList({ rows, valueKey, labelKey, valueFormatter, subtitle, emptyText }) {
  const max = Math.max(...rows.map(row => Number(row[valueKey] || 0)), 0);
  if (rows.length === 0) return <p className="p-5 text-sm text-slate-500 sm:p-6">{emptyText}</p>;

  return (
    <div className="space-y-4 p-5 sm:p-6">
      {rows.map(row => {
        const value = Number(row[valueKey] || 0);
        const width = max > 0 ? Math.max((value / max) * 100, 4) : 0;
        return (
          <div key={row.key || row[labelKey]}>
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-black text-slate-950">{row[labelKey]}</p><p className="mt-1 text-xs font-semibold text-slate-500">{subtitle(row)}</p></div>
              <p className="shrink-0 font-black text-slate-950">{valueFormatter(value)}</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-600" style={{ width: `${width}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

function RankedList({ rows, title, subtitle, right, badge, emptyText }) {
  if (rows.length === 0) return <p className="p-5 text-sm text-slate-500 sm:p-6">{emptyText}</p>;
  return (
    <div className="divide-y divide-slate-100">
      {rows.map((row, index) => (
        <div key={row.key || row.productId || row.name || index} className="flex items-start gap-3 p-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-600">{index + 1}</div>
          <div className="min-w-0 flex-1"><p className="truncate font-black text-slate-950">{title(row)}</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{subtitle(row)}</p>{badge?.(row) && <span className="mt-2 inline-flex rounded-full bg-red-50 px-2 py-1 text-[11px] font-black text-red-700">{badge(row)}</span>}</div>
          <p className="shrink-0 font-black text-slate-950">{right(row)}</p>
        </div>
      ))}
    </div>
  );
}

function ReportLine({ title, subtitle, right, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  };
  return (
    <div className="flex items-start justify-between gap-4 p-5">
      <div className="min-w-0"><p className="font-black text-slate-950">{title}</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{subtitle}</p></div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${tones[tone] || tones.blue}`}>{right}</span>
    </div>
  );
}

function KitchenStat({ label, value }) {
  return <div className="rounded-xl bg-white p-2"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-black text-slate-950">{value}</p></div>;
}

function CostBadge({ value }) {
  const tone = value <= 35
    ? 'bg-emerald-50 text-emerald-700'
    : value <= 45
      ? 'bg-amber-50 text-amber-700'
      : 'bg-red-50 text-red-700';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${tone}`}>{value.toFixed(1)}%</span>;
}

function RestaurantInventoryCard({ section, icon: Icon }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700"><Icon className="h-5 w-5" /></div>
      <p className="mt-4 text-sm font-black text-slate-950">{section.label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{formatRestaurantMoney(section.value)}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{section.count} artículo(s)</p>
    </article>
  );
}

function RestaurantExportButton({ onClick, label }) {
  return (
    <button type="button" onClick={onClick} className="rounded-2xl bg-white px-4 py-3 text-left text-sm font-bold text-cyan-800 shadow-sm transition hover:bg-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:ring-offset-2">
      <Download className="mr-2 inline h-4 w-4" />{label}
    </button>
  );
}
