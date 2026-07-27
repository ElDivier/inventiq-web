import {
  Activity,
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
  const completedSales = sales.filter(sale => sale.status !== 'Anulada');
  const totalPurchases = purchases.reduce((sum, purchase) => sum + Number(purchase.total || 0), 0);
  const netBalance = totalSales - totalPurchases;

  const lowRotation = products
    .filter(product => !completedSales.some(sale => String(sale.product || '').includes(product.name)))
    .slice(0, 8);

  const purchaseSuggestions = products
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
    exportToCSV('inventiq_reposicion_sugerida.csv', purchaseSuggestions.map(product => {
      const suggestedQuantity = Math.max((Number(product.minStock || 0) * 2) - Number(product.stock || 0), 1);
      const estimatedInvestment = suggestedQuantity * Number(product.cost || 0);

      return {
        SKU: product.sku,
        Producto: product.name,
        Categoria: product.category,
        Stock_actual: product.stock,
        Stock_minimo: product.minStock,
        Cantidad_sugerida: suggestedQuantity,
        Costo_unitario: Number(product.cost || 0).toFixed(2),
        Inversion_estimada: estimatedInvestment.toFixed(2),
      };
    }));
  }

  return (
    <div className="space-y-5">
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

      <section className="rounded-3xl border border-cyan-100 bg-cyan-50 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-lg font-bold text-cyan-950">Reportes exportables</h3>
            <p className="text-sm text-cyan-900">
              Descarga ventas, compras, productos, clientes, proveedores y reposición sugerida para análisis externo.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <button
              onClick={exportSales}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-cyan-800 shadow-sm hover:bg-cyan-50"
            >
              <Download className="mr-2 inline h-4 w-4" />
              Ventas
            </button>

            <button
              onClick={exportPurchases}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-cyan-800 shadow-sm hover:bg-cyan-50"
            >
              <Download className="mr-2 inline h-4 w-4" />
              Compras
            </button>

            <button
              onClick={exportProducts}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-cyan-800 shadow-sm hover:bg-cyan-50"
            >
              <Download className="mr-2 inline h-4 w-4" />
              Productos
            </button>

            <button
              onClick={exportClients}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-cyan-800 shadow-sm hover:bg-cyan-50"
            >
              <Download className="mr-2 inline h-4 w-4" />
              Clientes
            </button>

            <button
              onClick={exportProviders}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-cyan-800 shadow-sm hover:bg-cyan-50"
            >
              <Download className="mr-2 inline h-4 w-4" />
              Proveedores
            </button>

            <button
              onClick={exportLowStock}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-cyan-800 shadow-sm hover:bg-cyan-50"
            >
              <Download className="mr-2 inline h-4 w-4" />
              Reposición
            </button>
          </div>
        </div>
      </section>

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
              <p className="p-5 text-sm text-slate-500">
                No existen productos de baja rotación por el momento.
              </p>
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
              <p className="p-5 text-sm text-slate-500">
                No existen compras sugeridas por el momento.
              </p>
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
    </div>
  );
}