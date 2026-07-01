import React from 'react';
import { getBusinessConfig } from '../config/businessTypes';
import DashboardKpi from '../components/DashboardKpi';
import DashboardMiniStat from '../components/DashboardMiniStat';
import QuickAction from '../components/QuickAction';
import SummaryBox from '../components/SummaryBox';
import DashboardListCard from '../components/DashboardListCard';
import EmptyDashboardMessage from '../components/EmptyDashboardMessage';
import {
  Activity,
  DollarSign,
  TrendingUp,
  Package,
  AlertTriangle,
  Boxes,
  ShoppingCart,
  ClipboardList,
  Plus,
  BarChart3,
} from 'lucide-react';

function HomePage({ currentUser, totalSales, totalProducts, lowStock, noStock, inventoryValue, sales, products, bestSeller, totalProfit, setActive, expirationText }) {
  const businessConfig = getBusinessConfig(currentUser?.businessType);
  const completedSales = sales.filter(sale => sale.status !== 'Anulada');
  const recentSales = completedSales.slice(0, 5);
  const lowStockProducts = products
    .filter(product => Number(product.stock || 0) > 0 && Number(product.stock || 0) <= Number(product.minStock || 0))
    .slice(0, 5);
  const expiringProducts = businessConfig.usesExpiration
    ? products
      .filter(product => {
        const exp = expirationText ? expirationText(product) : null;
        return exp && ['Por vencer', 'Vence pronto'].includes(exp.label);
      })
      .slice(0, 5)
    : [];

  const soldMap = completedSales.reduce((acc, sale) => {
    if (sale.items?.length > 0) {
      sale.items.forEach(item => {
        const key = item.product || 'Producto';
        acc[key] = acc[key] || { name: key, quantity: 0, total: 0 };
        acc[key].quantity += Number(item.quantity || 0);
        acc[key].total += Number(item.subtotal || 0);
      });
    } else {
      const key = sale.product || 'Producto';
      acc[key] = acc[key] || { name: key, quantity: 0, total: 0 };
      acc[key].quantity += Number(sale.quantity || 0);
      acc[key].total += Number(sale.total || 0);
    }
    return acc;
  }, {});

  const topSoldProducts = Object.values(soldMap).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  const alertCount = lowStock + noStock + expiringProducts.length;
  const stockOk = products.filter(product => Number(product.stock || 0) > Number(product.minStock || 0)).length;
  const inventoryHealth = totalProducts > 0 ? Math.round((stockOk / totalProducts) * 100) : 0;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-500 p-6 text-white shadow-xl shadow-emerald-100 sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-50 backdrop-blur">
              <Activity className="h-4 w-4" /> Dashboard principal
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Bienvenido, {currentUser?.name || 'Usuario'}</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-50 sm:text-base">
              Resumen inteligente de {currentUser?.store || 'tu tienda'}: ventas, inventario, alertas y productos clave en un solo lugar.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:w-[560px]">
            <DashboardMiniStat icon={DollarSign} label="Ventas" value={`$${totalSales.toFixed(2)}`} />
            <DashboardMiniStat icon={TrendingUp} label="Utilidad" value={`$${totalProfit.toFixed(2)}`} />
            <DashboardMiniStat icon={Package} label="Productos" value={totalProducts} />
            <DashboardMiniStat icon={AlertTriangle} label="Alertas" value={alertCount} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <DashboardKpi icon={DollarSign} title="Ventas acumuladas" value={`$${totalSales.toFixed(2)}`} subtitle="registradas" tone="emerald" />
        <DashboardKpi icon={TrendingUp} title="Utilidad registrada" value={`$${totalProfit.toFixed(2)}`} subtitle="estimada" tone="blue" />
        <DashboardKpi icon={Boxes} title="Stock bajo" value={lowStock} subtitle="por revisar" tone="amber" />
        <DashboardKpi icon={ShoppingCart} title="Sin stock" value={noStock} subtitle="requiere compra" tone="red" />
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <QuickAction icon={ShoppingCart} label="Nueva venta" onClick={() => setActive('Ventas')} tone="emerald" />
        <QuickAction icon={ClipboardList} label="Registrar compra" onClick={() => setActive('Compras')} tone="teal" />
        <QuickAction icon={Plus} label="Agregar producto" onClick={() => setActive('Productos')} tone="blue" />
        <QuickAction icon={BarChart3} label="Ver reportes" onClick={() => setActive('Reportes')} tone="slate" />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-2xl font-extrabold text-slate-900">Resumen de tienda</h3>
              <p className="text-sm text-slate-500">Control general de inventario y rendimiento.</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">Salud del inventario: {inventoryHealth}%</span>
          </div>

          <div className="rounded-[1.75rem] bg-gradient-to-br from-emerald-600 to-teal-600 p-6 text-white">
            <p className="text-sm font-semibold text-emerald-100">Inventario valorizado</p>
            <h4 className="mt-2 text-4xl font-extrabold">${inventoryValue.toFixed(2)}</h4>
            <p className="mt-3 text-sm leading-6 text-emerald-50">
              Producto estrella: <strong>{topSoldProducts[0]?.name || bestSeller || 'Sin ventas'}</strong>. Mantén atención sobre stock bajo, sin stock{businessConfig.usesExpiration ? ' y caducidades próximas' : ''}.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <SummaryBox label="Ventas" value={`$${totalSales.toFixed(2)}`} />
              <SummaryBox label="Productos" value={totalProducts} />
              <SummaryBox label="Alertas" value={alertCount} />
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">Ventas recientes</h3>
              <p className="text-sm text-slate-500">Últimos movimientos registrados.</p>
            </div>
            <button onClick={() => setActive('Ventas')} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">Ver todas</button>
          </div>
          <div className="space-y-3">
            {recentSales.length === 0 && <EmptyDashboardMessage text="Todavía no hay ventas registradas." />}
            {recentSales.map(sale => (
              <div key={sale.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">{sale.code}</p>
                  <p className="truncate text-sm text-slate-500">{sale.product} · {sale.date}</p>
                </div>
                <p className="shrink-0 font-extrabold text-emerald-700">${Number(sale.total || 0).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`grid grid-cols-1 gap-5 ${businessConfig.usesExpiration ? 'xl:grid-cols-3' : 'xl:grid-cols-2'}`}>
        <DashboardListCard
          title="Productos con stock bajo"
          subtitle="Requieren revisión o reposición"
          empty="No hay productos con stock bajo."
          items={lowStockProducts.map(product => ({
            title: product.name,
            subtitle: `Stock actual: ${product.stock} · mínimo: ${product.minStock}`,
            badge: `${product.stock} unidades`,
            tone: 'amber',
          }))}
        />
        {businessConfig.usesExpiration && <DashboardListCard
          title="Próximos a caducar"
          subtitle="Productos que vencen pronto"
          empty="No hay productos próximos a caducar."
          items={expiringProducts.map(product => {
            const exp = expirationText(product);
            return {
              title: product.name,
              subtitle: `Caduca: ${product.expirationDate || 'Sin fecha'} · ${exp.label}`,
              badge: exp.days !== null ? `${exp.days} días` : 'Revisar',
              tone: 'red',
            };
          })}
        />}
        <DashboardListCard
          title="Productos más vendidos"
          subtitle="Ranking por unidades vendidas"
          empty="Todavía no hay ventas suficientes."
          items={topSoldProducts.map(product => ({
            title: product.name,
            subtitle: `${product.quantity} unidades vendidas`,
            badge: `$${product.total.toFixed(2)}`,
            tone: 'emerald',
          }))}
        />
      </section>
    </div>
  );
}

export default HomePage;
