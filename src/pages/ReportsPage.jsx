import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Factory,
  PackageCheck,
  Package,
  Boxes,
  ShoppingCart,
  BarChart3,
  ClipboardList,
  DollarSign,
  Download,
  TrendingUp,
} from 'lucide-react';
import Metric from '../components/Metric';
import ReportRow from '../components/ReportRow';
import { exportToCSV } from '../utils/csv';
import { getBusinessConfig } from '../config/businessTypes';
import { supabase } from '../supabaseClient';
import RestaurantReportsPanel from '../components/RestaurantReportsPanel';
import CafeteriaReportsPanel from '../components/CafeteriaReportsPanel';
import {
  buildBakeryReportModel,
  formatBakeryReportQuantity,
  getBakeryProductStockUnit,
  getBakeryReportProductTypeLabel,
  getBakerySuggestedQuantity,
} from '../utils/bakeryReports';


async function fetchAllBakeryReportRows({ table, select, userId, orderBy }) {
  const pageSize = 1000;
  let from = 0;
  let rows = [];

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq('user_id', userId)
      .order(orderBy, { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) return { data: [], error };

    const page = data || [];
    rows = rows.concat(page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return { data: rows, error: null };
}

export default function ReportsPage({
  currentUser,
  products,
  sales,
  purchases,
  clients,
  providers,
  totalSales,
  inventoryValue,
  potentialProfit,
  bestSeller,
  totalProfit,
  expirationText,
}) {
  const businessConfig = getBusinessConfig(currentUser?.businessType);
  const isBakery = currentUser?.businessType === 'panaderia';
  const isRestaurant = currentUser?.businessType === 'restaurante';
  const isCafeteria = currentUser?.businessType === 'cafeteria';
  const usesOperationalReports = isRestaurant || isCafeteria;
  const [bakeryData, setBakeryData] = useState({
    batches: [],
    adjustments: [],
    orders: [],
    payments: [],
    batchItems: [],
  });
  const [bakeryLoading, setBakeryLoading] = useState(false);
  const [bakeryNotice, setBakeryNotice] = useState(null);

  useEffect(() => {
    if (!isBakery || !currentUser?.id) {
      setBakeryData({ batches: [], adjustments: [], orders: [], payments: [], batchItems: [] });
      return;
    }

    let cancelled = false;

    async function loadBakeryReports() {
      try {
        setBakeryLoading(true);
        setBakeryNotice(null);

        const [batchesResult, adjustmentsResult, ordersResult, paymentsResult, batchItemsResult] = await Promise.all([
          fetchAllBakeryReportRows({
            table: 'production_batches',
            select: 'id, batch_code, production_date, produced_quantity, produced_unit, total_cost, unit_cost, output_product_name, status, created_at',
            userId: currentUser.id,
            orderBy: 'production_date',
          }),
          fetchAllBakeryReportRows({
            table: 'bakery_stock_adjustments',
            select: 'id, adjustment_kind, reason_label, product_name, quantity_reported, quantity_delta, unit, cost_impact, event_date, batch_code, created_at',
            userId: currentUser.id,
            orderBy: 'event_date',
          }),
          fetchAllBakeryReportRows({
            table: 'bakery_custom_orders',
            select: 'id, order_code, customer_name, delivery_date, status, total, paid_amount, sale_id, sale_registered_at, created_at',
            userId: currentUser.id,
            orderBy: 'delivery_date',
          }),
          fetchAllBakeryReportRows({
            table: 'bakery_custom_order_payments',
            select: 'id, order_id, amount, payment_method, paid_at, notes, order:bakery_custom_orders(order_code, customer_name)',
            userId: currentUser.id,
            orderBy: 'paid_at',
          }),
          fetchAllBakeryReportRows({
            table: 'production_batch_items',
            select: 'id, batch_id, ingredient_product_id, ingredient_name, stock_quantity, stock_unit, total_cost, created_at',
            userId: currentUser.id,
            orderBy: 'created_at',
          }),
        ]);

        const firstError = batchesResult.error || adjustmentsResult.error || ordersResult.error || paymentsResult.error || batchItemsResult.error;
        if (firstError) throw firstError;
        if (cancelled) return;

        setBakeryData({
          batches: batchesResult.data || [],
          adjustments: adjustmentsResult.data || [],
          orders: ordersResult.data || [],
          payments: paymentsResult.data || [],
          batchItems: batchItemsResult.data || [],
        });
      } catch (error) {
        console.error('Error cargando reportes de panadería:', error);
        if (!cancelled) setBakeryNotice(`No se pudo cargar el resumen de panadería: ${error.message}`);
      } finally {
        if (!cancelled) setBakeryLoading(false);
      }
    }

    loadBakeryReports();
    return () => { cancelled = true; };
  }, [isBakery, currentUser?.id]);

  const bakerySummary = useMemo(() => {
    const completedBatches = bakeryData.batches.filter(batch => batch.status !== 'cancelled');
    const producedQuantity = completedBatches.reduce((sum, batch) => sum + Number(batch.produced_quantity || 0), 0);
    const productionCost = completedBatches.reduce((sum, batch) => sum + Number(batch.total_cost || 0), 0);
    const wasteRecords = bakeryData.adjustments.filter(item => item.adjustment_kind === 'waste');
    const wasteCost = wasteRecords.reduce((sum, item) => sum + Number(item.cost_impact || 0), 0);
    const activeOrders = bakeryData.orders.filter(order => !['delivered', 'cancelled'].includes(order.status));
    const pendingBalance = bakeryData.orders
      .filter(order => order.status !== 'cancelled')
      .reduce((sum, order) => sum + Math.max(0, Number(order.total || 0) - Number(order.paid_amount || 0)), 0);
    const integratedOrders = bakeryData.orders.filter(order => order.sale_id);
    const integratedRevenue = integratedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const collectedOrders = bakeryData.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const wasteRate = productionCost > 0 ? (wasteCost / productionCost) * 100 : 0;

    return {
      completedBatches,
      producedQuantity,
      productionCost,
      wasteRecords,
      wasteCost,
      activeOrders,
      pendingBalance,
      integratedOrders,
      integratedRevenue,
      collectedOrders,
      wasteRate,
    };
  }, [bakeryData]);

  const bakeryReportModel = useMemo(() => buildBakeryReportModel({
    products,
    sales,
    batches: bakeryData.batches,
    batchItems: bakeryData.batchItems,
  }), [products, sales, bakeryData.batches, bakeryData.batchItems]);

  const completedSales = sales.filter(sale => sale.status !== 'Anulada');
  const totalPurchases = purchases.reduce((sum, purchase) => sum + Number(purchase.total || 0), 0);
  const netBalance = totalSales - totalPurchases;

  const lowRotation = isBakery
    ? bakeryReportModel.finishedWithoutSales.slice(0, 8)
    : products
      .filter(product => !completedSales.some(sale => String(sale.product || '').includes(product.name)))
      .slice(0, 8);

  const purchaseSuggestions = isBakery
    ? bakeryReportModel.inputRestockSuggestions.slice(0, 8)
    : products
      .filter(product => Number(product.stock || 0) <= Number(product.minStock || 0))
      .slice(0, 8);

  function exportSales() {
    exportToCSV('inventiq_ventas.csv', sales.map(sale => ({
      Codigo: sale.code,
      Fecha: sale.date,
      Cliente: sale.customer,
      Producto: sale.product,
      Cantidad: sale.quantity,
      Subtotal: Number(sale.subtotal || 0).toFixed(2),
      Descuento: Number(sale.discount || 0).toFixed(2),
      Total: Number(sale.total || 0).toFixed(2),
      Utilidad: Number(sale.profit || 0).toFixed(2),
      Origen: sale.sourceType === 'bakery_order' ? 'Pedido especial' : sale.sourceType === 'bakery_order_cancelled' ? 'Pedido especial anulado' : 'Venta directa',
      Referencia_origen: sale.sourceId || '',
      Estado: sale.status,
    })));
  }

  function exportPurchases() {
    exportToCSV('inventiq_compras.csv', purchases.map(purchase => ({
      Codigo: purchase.code,
      Fecha: purchase.date,
      Proveedor: purchase.provider,
      Producto: purchase.product,
      Cantidad: purchase.quantity,
      Costo_unitario: Number(purchase.unitCost || 0).toFixed(2),
      Total: Number(purchase.total || 0).toFixed(2),
      Nota: purchase.note || '',
    })));
  }

  function exportProducts() {
    exportToCSV('inventiq_productos.csv', products.map(product => {
      const baseRow = {
        SKU: product.sku,
        Codigo_barras: product.barcode || '',
        Producto: product.name,
        Categoria: product.category,
        Precio_venta: Number(product.price || 0).toFixed(2),
        Costo_unitario: Number(product.cost || 0).toFixed(2),
        Stock_actual: product.stock,
        Stock_minimo: product.minStock,
        Estado: product.status,
        Marca: product.brand || '',
        Talla_medida: product.size || '',
        Color_modelo: product.color || '',
        Descripcion: product.description || '',
        Valor_inventario: (Number(product.cost || 0) * Number(product.stock || 0)).toFixed(2),
        Ganancia_potencial: ((Number(product.price || 0) - Number(product.cost || 0)) * Number(product.stock || 0)).toFixed(2),
        ...(isBakery ? {
          Tipo_articulo: getBakeryReportProductTypeLabel(product),
          Unidad_stock: getBakeryProductStockUnit(product),
        } : {}),
      };

      if (!businessConfig.usesExpiration) return baseRow;

      return {
        ...baseRow,
        Lote: product.batchNumber || '',
        Fecha_ingreso: product.entryDate || '',
        Fecha_caducidad: product.expirationDate || '',
        Estado_caducidad: expirationText ? expirationText(product).label : '',
      };
    }));
  }

  function exportClients() {
    exportToCSV('inventiq_clientes.csv', clients.map(client => ({
      Cliente: client.name,
      Telefono: client.phone,
      Correo: client.email || '',
      Cedula_RUC: client.identification || '',
      Direccion: client.address || '',
      Nombre_factura: client.invoiceName || '',
      Solicita_factura: client.wantsInvoice ? 'Sí' : 'No',
      Tipo: client.type,
      Compras_registradas: client.purchases || 0,
      Observaciones: client.notes || '',
    })));
  }

  function exportProviders() {
    exportToCSV('inventiq_proveedores.csv', providers.map(provider => ({
      Proveedor: provider.name,
      Categoria: provider.category,
      Telefono_WhatsApp: provider.contact,
      Correo: provider.email || '',
      Entrega_estimada: provider.delivery || '',
      Observaciones: provider.notes || '',
    })));
  }

  function exportLowStock() {
    const filename = isBakery
      ? 'inventiq_panaderia_reposicion_insumos.csv'
      : 'inventiq_reposicion_sugerida.csv';

    exportToCSV(filename, purchaseSuggestions.map(product => {
      const suggestedQuantity = isBakery
        ? getBakerySuggestedQuantity(product)
        : Math.max((Number(product.minStock || 0) * 2) - Number(product.stock || 0), 1);
      const estimatedInvestment = suggestedQuantity * Number(product.cost || 0);

      return {
        SKU: product.sku,
        Producto: product.name,
        Categoria: product.category,
        ...(isBakery ? {
          Tipo_articulo: getBakeryReportProductTypeLabel(product),
          Unidad_stock: getBakeryProductStockUnit(product),
        } : {}),
        Stock_actual: product.stock,
        Stock_minimo: product.minStock,
        Cantidad_sugerida: suggestedQuantity,
        Costo_unitario: Number(product.cost || 0).toFixed(2),
        Inversion_estimada: estimatedInvestment.toFixed(2),
      };
    }));
  }

  function exportBakeryProduction() {
    exportToCSV('inventiq_panaderia_produccion.csv', bakeryData.batches.map(batch => ({
      Lote: batch.batch_code,
      Fecha_produccion: batch.production_date,
      Producto: batch.output_product_name,
      Cantidad_producida: Number(batch.produced_quantity || 0),
      Unidad: batch.produced_unit,
      Costo_total: Number(batch.total_cost || 0).toFixed(2),
      Costo_unitario: Number(batch.unit_cost || 0).toFixed(4),
      Estado: batch.status,
    })));
  }

  function exportBakeryAdjustments() {
    exportToCSV('inventiq_panaderia_mermas_ajustes.csv', bakeryData.adjustments.map(item => ({
      Fecha: item.event_date,
      Tipo: item.adjustment_kind === 'waste' ? 'Merma' : 'Conteo físico',
      Motivo: item.reason_label,
      Producto: item.product_name,
      Cantidad_reportada: Number(item.quantity_reported || 0),
      Movimiento_stock: Number(item.quantity_delta || 0),
      Unidad: item.unit,
      Impacto_costo: Number(item.cost_impact || 0).toFixed(2),
      Lote: item.batch_code || '',
    })));
  }

  function exportBakeryOrders() {
    exportToCSV('inventiq_panaderia_pedidos.csv', bakeryData.orders.map(order => ({
      Codigo: order.order_code,
      Cliente: order.customer_name,
      Fecha_entrega: order.delivery_date,
      Estado: order.status,
      Total: Number(order.total || 0).toFixed(2),
      Abonado: Number(order.paid_amount || 0).toFixed(2),
      Saldo: Math.max(0, Number(order.total || 0) - Number(order.paid_amount || 0)).toFixed(2),
      Registrado_como_venta: order.sale_id ? 'Sí' : 'No',
      Fecha_registro_venta: order.sale_registered_at || '',
    })));
  }

  function exportBakeryPayments() {
    exportToCSV('inventiq_panaderia_cobros_pedidos.csv', bakeryData.payments.map(payment => ({
      Pedido: payment.order?.order_code || '',
      Cliente: payment.order?.customer_name || '',
      Fecha_cobro: payment.paid_at,
      Metodo: payment.payment_method,
      Valor: Number(payment.amount || 0).toFixed(2),
      Observacion: payment.notes || '',
    })));
  }

  function exportBakeryFinishedProducts() {
    exportToCSV('inventiq_panaderia_productos_terminados.csv', bakeryReportModel.finishedProducts.map(product => {
      const salesStats = bakeryReportModel.salesByProduct.get(String(product.id));
      return {
        SKU: product.sku,
        Producto: product.name,
        Categoria: product.category,
        Unidad_stock: getBakeryProductStockUnit(product),
        Stock_actual: Number(product.stock || 0),
        Stock_minimo: Number(product.minStock || 0),
        Precio_venta: Number(product.price || 0).toFixed(2),
        Costo_unitario: Number(product.cost || 0).toFixed(4),
        Valor_inventario: (Number(product.stock || 0) * Number(product.cost || 0)).toFixed(2),
        Cantidad_vendida: Number(salesStats?.quantity || 0),
        Ingresos_ventas: Number(salesStats?.revenue || 0).toFixed(2),
        Utilidad_ventas: Number(salesStats?.profit || 0).toFixed(2),
        Ultima_venta: salesStats?.lastSaleAt || '',
      };
    }));
  }

  function exportBakeryInputs() {
    exportToCSV('inventiq_panaderia_materias_primas_insumos.csv', bakeryReportModel.ingredientProducts.map(product => {
      const consumption = bakeryReportModel.consumptionByProduct.get(String(product.id));
      return {
        SKU: product.sku,
        Articulo: product.name,
        Tipo_articulo: getBakeryReportProductTypeLabel(product),
        Categoria: product.category,
        Unidad_stock: getBakeryProductStockUnit(product),
        Stock_actual: Number(product.stock || 0),
        Stock_minimo: Number(product.minStock || 0),
        Costo_unitario: Number(product.cost || 0).toFixed(4),
        Valor_inventario: (Number(product.stock || 0) * Number(product.cost || 0)).toFixed(2),
        Cantidad_consumida: Number(consumption?.quantity || 0),
        Unidad_consumida: consumption?.unit || getBakeryProductStockUnit(product),
        Costo_consumido: Number(consumption?.totalCost || 0).toFixed(2),
        Lotes_utilizados: consumption?.batchIds?.size || 0,
        Ultimo_consumo: consumption?.lastConsumedAt || '',
      };
    }));
  }

  function exportBakeryConsumption() {
    exportToCSV('inventiq_panaderia_consumo_produccion.csv', bakeryReportModel.topConsumedInputs.map(({ product, consumption }) => ({
      SKU: product.sku,
      Articulo: product.name,
      Tipo_articulo: getBakeryReportProductTypeLabel(product),
      Categoria: product.category,
      Cantidad_consumida: Number(consumption.quantity || 0),
      Unidad: consumption.unit || getBakeryProductStockUnit(product),
      Costo_consumido: Number(consumption.totalCost || 0).toFixed(2),
      Lotes_utilizados: consumption.batchIds?.size || 0,
      Ultimo_consumo: consumption.lastConsumedAt || '',
      Stock_actual: Number(product.stock || 0),
    })));
  }

  function exportBakeryProductionSuggestions() {
    exportToCSV('inventiq_panaderia_produccion_sugerida.csv', bakeryReportModel.productionSuggestions.map(product => ({
      SKU: product.sku,
      Producto: product.name,
      Categoria: product.category,
      Unidad_stock: getBakeryProductStockUnit(product),
      Stock_actual: Number(product.stock || 0),
      Stock_minimo: Number(product.minStock || 0),
      Cantidad_sugerida: getBakerySuggestedQuantity(product),
      Costo_unitario: Number(product.cost || 0).toFixed(4),
      Costo_estimado_produccion: (getBakerySuggestedQuantity(product) * Number(product.cost || 0)).toFixed(2),
    })));
  }

  return (
    <div className="space-y-5">
      {!usesOperationalReports && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Metric
          icon={DollarSign}
          label="Ventas"
          value={`$${totalSales.toFixed(2)}`}
          note="acumuladas"
          color="emerald"
        />

        <Metric
          icon={TrendingUp}
          label="Utilidad"
          value={`$${totalProfit.toFixed(2)}`}
          note="estimada"
          color="blue"
        />

        <Metric
          icon={ClipboardList}
          label="Compras"
          value={`$${totalPurchases.toFixed(2)}`}
          note="registradas"
          color="amber"
        />

        <Metric
          icon={BarChart3}
          label="Balance"
          value={`$${netBalance.toFixed(2)}`}
          note="ventas - compras"
          color={netBalance >= 0 ? 'emerald' : 'red'}
        />
        </section>
      )}

      {isRestaurant && (
        <RestaurantReportsPanel currentUser={currentUser} products={products} />
      )}

      {isCafeteria && (
        <CafeteriaReportsPanel currentUser={currentUser} products={products} />
      )}

      {isBakery && (
        <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-950 p-5 text-white sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Operación de panadería</p>
                <h3 className="mt-2 text-2xl font-black">Producción, mermas y pedidos en un solo resumen</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Las ventas originadas en encargos se suman una sola vez en Ventas. Los anticipos se muestran en Caja según la fecha real de cobro.</p>
              </div>
              {bakeryLoading && <span className="text-sm font-bold text-cyan-200">Actualizando información...</span>}
            </div>
          </div>

          {bakeryNotice && <div className="border-b border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{bakeryNotice}</div>}

          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
            <BakeryReportMetric icon={Factory} label="Producción acumulada" value={bakerySummary.producedQuantity.toLocaleString('es-EC', { maximumFractionDigits: 2 })} note={`${bakerySummary.completedBatches.length} lote(s) · costo $${bakerySummary.productionCost.toFixed(2)}`} tone="blue" />
            <BakeryReportMetric icon={AlertTriangle} label="Costo de mermas" value={`$${bakerySummary.wasteCost.toFixed(2)}`} note={`${bakerySummary.wasteRecords.length} registro(s) · ${bakerySummary.wasteRate.toFixed(2)}% del costo producido`} tone="amber" />
            <BakeryReportMetric icon={CalendarDays} label="Pedidos activos" value={bakerySummary.activeOrders.length} note={`Saldo pendiente $${bakerySummary.pendingBalance.toFixed(2)}`} tone="violet" />
            <BakeryReportMetric icon={PackageCheck} label="Pedidos integrados" value={bakerySummary.integratedOrders.length} note={`Ventas $${bakerySummary.integratedRevenue.toFixed(2)} · cobrado $${bakerySummary.collectedOrders.toFixed(2)}`} tone="emerald" />
          </div>

          <div className="grid gap-2 border-t border-slate-100 bg-slate-50 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
            <button onClick={exportBakeryProduction} className="iq-action-secondary justify-center"><Download className="h-4 w-4" /> Producción</button>
            <button onClick={exportBakeryAdjustments} className="iq-action-secondary justify-center"><Download className="h-4 w-4" /> Mermas y ajustes</button>
            <button onClick={exportBakeryOrders} className="iq-action-secondary justify-center"><Download className="h-4 w-4" /> Pedidos</button>
            <button onClick={exportBakeryPayments} className="iq-action-secondary justify-center"><Download className="h-4 w-4" /> Cobros de pedidos</button>
          </div>
        </section>
      )}

      {isBakery && (
        <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Inventario clasificado</p>
                <h3 className="mt-2 text-xl font-black text-slate-950 sm:text-2xl">Cada artículo se analiza según su función</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Los productos terminados se evalúan por ventas y producción. Las materias primas, empaques y productos intermedios se evalúan por consumo, existencias y reposición.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-950 px-4 py-3 text-white">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Valor total clasificado</p>
                <p className="mt-1 text-xl font-black">${bakeryReportModel.inventoryValue.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
            <BakeryInventoryMetric icon={Package} section={bakeryReportModel.inventorySections[0]} tone="amber" />
            <BakeryInventoryMetric icon={Boxes} section={bakeryReportModel.inventorySections[1]} tone="violet" />
            <BakeryInventoryMetric icon={Factory} section={bakeryReportModel.inventorySections[2]} tone="blue" />
            <BakeryInventoryMetric icon={ShoppingCart} section={bakeryReportModel.inventorySections[3]} tone="emerald" />
          </div>
        </section>
      )}

      {!usesOperationalReports && (
        <section className="rounded-3xl border border-cyan-100 bg-cyan-50 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-xl">
            <h3 className="text-lg font-bold text-cyan-950">{isBakery ? 'Reportes exportables de panadería' : 'Reportes exportables'}</h3>
            <p className="text-sm leading-6 text-cyan-900">
              {isBakery
                ? 'Los reportes comerciales incluyen solo productos terminados. Las materias primas, empaques y productos intermedios se exportan por separado con su consumo y valor de inventario.'
                : 'Descarga ventas, compras, productos, clientes, proveedores y reposición sugerida para análisis externo.'}
            </p>
          </div>

          <div className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${isBakery ? 'xl:grid-cols-3' : 'xl:grid-cols-3'}`}>
            <ExportButton onClick={exportSales} label="Ventas" />
            <ExportButton onClick={exportPurchases} label="Compras" />

            {isBakery ? (
              <>
                <ExportButton onClick={exportBakeryFinishedProducts} label="Productos terminados" />
                <ExportButton onClick={exportBakeryInputs} label="Materias primas e insumos" />
                <ExportButton onClick={exportBakeryConsumption} label="Consumo en producción" />
                <ExportButton onClick={exportBakeryProductionSuggestions} label="Producción sugerida" />
                <ExportButton onClick={exportLowStock} label="Reposición de insumos" />
              </>
            ) : (
              <>
                <ExportButton onClick={exportProducts} label="Productos" />
                <ExportButton onClick={exportLowStock} label="Reposición" />
              </>
            )}

            <ExportButton onClick={exportClients} label="Clientes" />
            <ExportButton onClick={exportProviders} label="Proveedores" />
          </div>
        </div>
        </section>
      )}

      {isBakery ? (
        <>
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <BakeryReportListCard
              icon={Activity}
              title="Productos terminados sin ventas"
              description="Solo se consideran artículos elaborados y disponibles para la venta. Las materias primas y empaques no aparecen en este reporte."
              emptyText="Todos los productos terminados registran ventas o todavía no existen productos para analizar."
              isEmpty={bakeryReportModel.finishedWithoutSales.length === 0}
            >
              {bakeryReportModel.finishedWithoutSales.slice(0, 8).map(product => (
                <ReportRow
                  key={product.id}
                  title={product.name}
                  subtitle={`${product.category} · stock ${formatBakeryReportQuantity(product.stock, getBakeryProductStockUnit(product))}`}
                  right="Sin ventas"
                  badge="Revisar oferta"
                />
              ))}
            </BakeryReportListCard>

            <BakeryReportListCard
              icon={Factory}
              title="Producción sugerida"
              description="Productos terminados cuyo stock alcanzó o bajó del mínimo definido. Se recomienda producir, no comprar."
              emptyText="No existen productos terminados que requieran producción por stock bajo."
              isEmpty={bakeryReportModel.productionSuggestions.length === 0}
            >
              {bakeryReportModel.productionSuggestions.slice(0, 8).map(product => (
                <ReportRow
                  key={product.id}
                  title={product.name}
                  subtitle={`Stock ${formatBakeryReportQuantity(product.stock, getBakeryProductStockUnit(product))} · mínimo ${formatBakeryReportQuantity(product.minStock, getBakeryProductStockUnit(product))}`}
                  right={`Producir ${formatBakeryReportQuantity(getBakerySuggestedQuantity(product), getBakeryProductStockUnit(product))}`}
                  badge="Stock bajo"
                />
              ))}
            </BakeryReportListCard>

            <BakeryReportListCard
              icon={ClipboardList}
              title="Reposición de materias primas e insumos"
              description="Incluye materias primas, empaques y productos intermedios que deben comprarse o reponerse."
              emptyText="No existen materias primas o insumos por debajo del stock mínimo."
              isEmpty={bakeryReportModel.inputRestockSuggestions.length === 0}
            >
              {bakeryReportModel.inputRestockSuggestions.slice(0, 8).map(product => (
                <ReportRow
                  key={product.id}
                  title={product.name}
                  subtitle={`${getBakeryReportProductTypeLabel(product)} · stock ${formatBakeryReportQuantity(product.stock, getBakeryProductStockUnit(product))}`}
                  right={`Comprar ${formatBakeryReportQuantity(getBakerySuggestedQuantity(product), getBakeryProductStockUnit(product))}`}
                  badge="Reposición"
                />
              ))}
            </BakeryReportListCard>

            <BakeryReportListCard
              icon={AlertTriangle}
              title="Insumos sin consumo registrado"
              description="Artículos internos que todavía no aparecen en ningún lote de producción completado."
              emptyText="Todos los insumos activos ya registran consumo en producción."
              isEmpty={bakeryReportModel.inputsWithoutConsumption.length === 0}
            >
              {bakeryReportModel.inputsWithoutConsumption.slice(0, 8).map(product => (
                <ReportRow
                  key={product.id}
                  title={product.name}
                  subtitle={`${getBakeryReportProductTypeLabel(product)} · stock ${formatBakeryReportQuantity(product.stock, getBakeryProductStockUnit(product))}`}
                  right="Sin consumo"
                  badge="Revisar receta"
                />
              ))}
            </BakeryReportListCard>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5 sm:p-6">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-xl font-bold text-slate-950">
                    <PackageCheck className="h-5 w-5 text-cyan-700" />
                    Consumo acumulado en producción
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Se calcula a partir del detalle real de los lotes completados, no de las ventas. Las cantidades se mantienen en la unidad de stock de cada insumo.
                  </p>
                </div>
                <button onClick={exportBakeryConsumption} className="iq-action-secondary justify-center">
                  <Download className="h-4 w-4" /> Exportar consumo
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {bakeryReportModel.topConsumedInputs.length === 0 && (
                <p className="p-5 text-sm text-slate-500 sm:p-6">Todavía no existen consumos registrados en lotes de producción.</p>
              )}

              {bakeryReportModel.topConsumedInputs.slice(0, 12).map(({ product, consumption }) => (
                <ReportRow
                  key={product.id}
                  title={product.name}
                  subtitle={`${formatBakeryReportQuantity(consumption.quantity, consumption.unit || getBakeryProductStockUnit(product))} consumidos · stock actual ${formatBakeryReportQuantity(product.stock, getBakeryProductStockUnit(product))}`}
                  right={`$${Number(consumption.totalCost || 0).toFixed(2)}`}
                  badge={`${consumption.batchIds?.size || 0} lote(s)`}
                />
              ))}
            </div>
          </section>
        </>
      ) : usesOperationalReports ? null : (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <h3 className="flex items-center gap-2 text-xl font-bold">
                <Activity className="h-5 w-5 text-cyan-700" />
                Baja rotación o sin movimiento
              </h3>
            </div>

            <div className="divide-y divide-slate-100">
              {lowRotation.length === 0 && (
                <p className="p-5 text-sm text-slate-500">No existen productos de baja rotación por el momento.</p>
              )}

              {lowRotation.map(product => (
                <ReportRow
                  key={product.id}
                  title={product.name}
                  subtitle={`${product.category} · stock actual ${product.stock}`}
                  right="Sin ventas"
                  badge="Promocionar"
                />
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <h3 className="flex items-center gap-2 text-xl font-bold">
                <ClipboardList className="h-5 w-5 text-cyan-700" />
                Compra sugerida
              </h3>
            </div>

            <div className="divide-y divide-slate-100">
              {purchaseSuggestions.length === 0 && (
                <p className="p-5 text-sm text-slate-500">No existen compras sugeridas por el momento.</p>
              )}

              {purchaseSuggestions.map(product => (
                <ReportRow
                  key={product.id}
                  title={product.name}
                  subtitle={`Stock ${product.stock} · mínimo ${product.minStock}`}
                  right={`Comprar ${Math.max((Number(product.minStock || 0) * 2) - Number(product.stock || 0), 1)}`}
                  badge="Reposición"
                />
              ))}
            </div>
          </section>
        </section>
      )}
    </div>
  );
}

function BakeryReportMetric({ icon: Icon, label, value, note, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
    emerald: 'bg-emerald-50 text-emerald-700',
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


function BakeryInventoryMetric({ icon: Icon, section, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  };
  const safeSection = section || { label: 'Sin clasificación', productCount: 0, inventoryValue: 0 };

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone] || tones.blue}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm font-black text-slate-950">{safeSection.label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">${Number(safeSection.inventoryValue || 0).toFixed(2)}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{safeSection.productCount || 0} artículo(s)</p>
    </article>
  );
}

function BakeryReportListCard({ icon: Icon, title, description, emptyText, isEmpty, children }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <h3 className="flex items-center gap-2 text-xl font-bold text-slate-950">
          <Icon className="h-5 w-5 text-cyan-700" />
          {title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <div className="divide-y divide-slate-100">
        {isEmpty ? <p className="p-5 text-sm text-slate-500 sm:p-6">{emptyText}</p> : children}
      </div>
    </section>
  );
}

function ExportButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl bg-white px-4 py-3 text-left text-sm font-bold text-cyan-800 shadow-sm transition hover:bg-cyan-50 focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:ring-offset-2"
    >
      <Download className="mr-2 inline h-4 w-4" />
      {label}
    </button>
  );
}
