import React from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Boxes,
  CalendarDays,
  ClipboardList,
  ChefHat,
  Coffee,
  DollarSign,
  Grid2X2,
  Package,
  PackageCheck,
  Plus,
  ReceiptText,
  ShoppingCart,
  Sparkles,
  Store,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { getBusinessConfig } from '../config/businessTypes';
import { parseInventiqDate, startOfDay } from '../utils/dates';
import QuickAction from '../components/QuickAction';
import DashboardListCard from '../components/DashboardListCard';
import DashboardSalesChart from '../components/DashboardSalesChart';
import DashboardHealthCard from '../components/DashboardHealthCard';
import EmptyDashboardMessage from '../components/EmptyDashboardMessage';

const currency = value => `$${Number(value || 0).toFixed(2)}`;

function buildWeeklySales(sales = []) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return {
      date,
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString('es-EC', { weekday: 'short' }).replace('.', '').slice(0, 3),
      fullLabel: date.toLocaleDateString('es-EC', { weekday: 'long', day: '2-digit', month: 'short' }),
      value: 0,
    };
  });

  const dayMap = Object.fromEntries(days.map(day => [day.key, day]));

  sales.forEach(sale => {
    if (sale.status === 'Anulada') return;
    const parsed = parseInventiqDate(sale.date);
    if (!parsed) return;
    const key = startOfDay(parsed).toISOString().slice(0, 10);
    if (dayMap[key]) dayMap[key].value += Number(sale.total || 0);
  });

  return days;
}

function RecentSaleRow({ sale }) {
  const itemCount = sale.items?.length || Number(sale.quantity || 0) || 1;

  return (
    <div className="dashboard-list-row">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <ReceiptText className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-extrabold text-slate-900">{sale.code || 'Venta registrada'}</p>
          <p className="truncate text-sm text-slate-500">
            {sale.product || sale.items?.[0]?.product || `${itemCount} producto${itemCount === 1 ? '' : 's'}`} · {sale.date || 'Sin fecha'}
          </p>
        </div>
      </div>
      <p className="shrink-0 text-base font-black text-cyan-700">{currency(sale.total)}</p>
    </div>
  );
}

function SummaryMetric({ icon: Icon, label, value, helper, tone = 'cyan' }) {
  return (
    <article className={`dashboard-summary-card dashboard-summary-${tone}`}>
      <div className="dashboard-summary-icon">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="dashboard-summary-label">{label}</p>
        <p className="dashboard-summary-value">{value}</p>
        <p className="dashboard-summary-helper">{helper}</p>
      </div>
    </article>
  );
}

function HomePage({ currentUser, totalSales, totalProducts, lowStock, noStock, inventoryValue, sales, products, bestSeller, totalProfit, setActive, expirationText }) {
  const businessConfig = getBusinessConfig(currentUser?.businessType);
  const isBakery = currentUser?.businessType === 'panaderia';
  const isRestaurant = currentUser?.businessType === 'restaurante';
  const isCafeteria = currentUser?.businessType === 'cafeteria';
  const completedSales = sales.filter(sale => sale.status !== 'Anulada');
  const recentSales = [...completedSales]
    .sort((a, b) => {
      const dateA = parseInventiqDate(a.date)?.getTime() || 0;
      const dateB = parseInventiqDate(b.date)?.getTime() || 0;
      return dateB - dateA;
    })
    .slice(0, 5);

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
  const healthyStock = products.filter(product => Number(product.stock || 0) > Number(product.minStock || 0)).length;
  const inventoryHealth = totalProducts > 0 ? Math.round((healthyStock / totalProducts) * 100) : 0;
  const weeklySales = buildWeeklySales(completedSales);
  const weeklyTotal = weeklySales.reduce((sum, day) => sum + day.value, 0);
  const todayLabel = new Date().toLocaleDateString('es-EC', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const todayKey = startOfDay(new Date()).toISOString().slice(0, 10);
  const todaySales = completedSales.reduce((sum, sale) => {
    const parsed = parseInventiqDate(sale.date);
    if (!parsed) return sum;
    const saleKey = startOfDay(parsed).toISOString().slice(0, 10);
    return saleKey === todayKey ? sum + Number(sale.total || 0) : sum;
  }, 0);
  const todayTransactions = completedSales.filter(sale => {
    const parsed = parseInventiqDate(sale.date);
    if (!parsed) return false;
    return startOfDay(parsed).toISOString().slice(0, 10) === todayKey;
  }).length;

  return (
    <div className="dashboard-redesign space-y-7 lg:space-y-8">
      <section className="dashboard-welcome-banner">
        <div className="dashboard-welcome-grid" aria-hidden="true" />
        <div className="dashboard-welcome-layout">
          <div className="dashboard-welcome-copy">
            <div className="dashboard-welcome-topline">
              <span className="dashboard-glass-badge">
                <Sparkles className="h-4 w-4" />
                Resumen general
              </span>
              <span className="dashboard-glass-badge dashboard-glass-badge-muted">
                <CalendarDays className="h-4 w-4" />
                <span className="capitalize">{todayLabel}</span>
              </span>
            </div>

            <p className="dashboard-welcome-eyebrow">Bienvenido a InventIQ</p>
            <h1 className="dashboard-welcome-title">Tu negocio, en orden.</h1>
            <p className="dashboard-welcome-description">
              Consulta ventas, inventario y alertas de <strong>{currentUser?.store || 'tu negocio'}</strong> desde una vista clara y lista para tomar decisiones.
            </p>
          </div>

          <aside className="dashboard-hero-overview" aria-label="Información clave del negocio">
            <div className="dashboard-hero-overview-header">
              <div>
                <p className="dashboard-hero-overview-kicker">Resumen de hoy</p>
                <h2>Información clave</h2>
              </div>
              <span className="dashboard-live-status">
                <span aria-hidden="true" />
                Actualizado
              </span>
            </div>

            <div className="dashboard-hero-overview-grid">
              <article className="dashboard-hero-metric">
                <div className="dashboard-hero-metric-icon">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="dashboard-hero-metric-label">Ventas hoy</p>
                  <p className="dashboard-hero-metric-value">{currency(todaySales)}</p>
                  <p className="dashboard-hero-metric-helper">
                    {todayTransactions} movimiento{todayTransactions === 1 ? '' : 's'}
                  </p>
                </div>
              </article>

              <article className="dashboard-hero-metric dashboard-hero-metric-blue">
                <div className="dashboard-hero-metric-icon">
                  <Store className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="dashboard-hero-metric-label">Tipo de negocio</p>
                  <p className="dashboard-hero-metric-value dashboard-hero-metric-value-text">{businessConfig.label}</p>
                  <p className="dashboard-hero-metric-helper">Perfil activo</p>
                </div>
              </article>

              <article className="dashboard-hero-metric dashboard-hero-metric-teal">
                <div className="dashboard-hero-metric-icon">
                  <Boxes className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="dashboard-hero-metric-label">Valor del inventario</p>
                  <p className="dashboard-hero-metric-value">{currency(inventoryValue)}</p>
                  <p className="dashboard-hero-metric-helper">
                    {totalProducts} producto{totalProducts === 1 ? '' : 's'}
                  </p>
                </div>
              </article>

              <article className="dashboard-hero-metric dashboard-hero-metric-amber">
                <div className="dashboard-hero-metric-icon">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="dashboard-hero-metric-label">Alertas pendientes</p>
                  <p className="dashboard-hero-metric-value">{alertCount}</p>
                  <p className="dashboard-hero-metric-helper">
                    {alertCount === 0 ? 'Sin novedades' : 'Requieren revisión'}
                  </p>
                </div>
              </article>
            </div>
          </aside>
        </div>
      </section>

      <section className="dashboard-summary-grid">
        <SummaryMetric icon={DollarSign} label="Ventas acumuladas" value={currency(totalSales)} helper="Total registrado" tone="cyan" />
        <SummaryMetric icon={TrendingUp} label="Utilidad estimada" value={currency(totalProfit)} helper="Según costos registrados" tone="blue" />
        <SummaryMetric icon={Package} label="Productos activos" value={totalProducts} helper="En tu catálogo" tone="indigo" />
        <SummaryMetric icon={AlertTriangle} label="Atención requerida" value={alertCount} helper="Stock y caducidades" tone={alertCount > 0 ? 'amber' : 'cyan'} />
      </section>

      <section className="dashboard-primary-grid">
        <article className="dashboard-panel dashboard-actions-redesign">
          <div className="dashboard-section-heading">
            <div>
              <div className="dashboard-section-kicker">
                <Activity className="h-4 w-4" />
                Acciones rápidas
              </div>
              <h2>¿Qué deseas hacer?</h2>
              <p>Accede a las tareas principales sin llenar la pantalla de botones.</p>
            </div>
          </div>

          <div className="dashboard-actions-grid">
            <QuickAction icon={ShoppingCart} label="Nueva venta" helper="Registrar una operación" onClick={() => setActive('Ventas')} tone="cyan" />
            {isBakery ? (
              <>
                <QuickAction icon={PackageCheck} label="Registrar producción" helper="Crear un nuevo lote" onClick={() => setActive('Producción')} tone="blue" />
                <QuickAction icon={CalendarDays} label="Nuevo pedido" helper="Programar un encargo" onClick={() => setActive('Encargos')} tone="blue" />
                <QuickAction icon={ClipboardList} label="Registrar compra" helper="Reponer materias primas" onClick={() => setActive('Compras')} tone="slate" />
              </>
            ) : isRestaurant ? (
              <>
                <QuickAction icon={Grid2X2} label="Mesas y salón" helper="Controlar ocupación y servicio" onClick={() => setActive('Mesas')} tone="blue" />
                <QuickAction icon={ChefHat} label="Pantalla de cocina" helper="Revisar tickets y tiempos" onClick={() => setActive('Cocina')} tone="blue" />
                <QuickAction icon={ClipboardList} label="Pedidos y comandas" helper="Gestionar cuentas abiertas" onClick={() => setActive('Comandas')} tone="slate" />
                <QuickAction icon={WalletCards} label="Cobro y cuentas" helper="Dividir y registrar pagos" onClick={() => setActive('Cobros')} tone="cyan" />
              </>
            ) : isCafeteria ? (
              <>
                <QuickAction icon={Coffee} label="Barra y pedidos" helper="Preparar pedidos por estación" onClick={() => setActive('Barra')} tone="blue" />
                <QuickAction icon={PackageCheck} label="Entrega de pedidos" helper="Llamar y confirmar entregas" onClick={() => setActive('Entrega')} tone="cyan" />
                <QuickAction icon={Package} label="Menú y variantes" helper="Configurar bebidas y tamaños" onClick={() => setActive('Productos')} tone="blue" />
                <QuickAction icon={ClipboardList} label="Registrar compra" helper="Reponer café, leche e insumos" onClick={() => setActive('Compras')} tone="slate" />
              </>
            ) : (
              <>
                <QuickAction icon={ClipboardList} label="Registrar compra" helper="Actualizar costos y stock" onClick={() => setActive('Compras')} tone="blue" />
                <QuickAction icon={Plus} label="Agregar producto" helper="Ampliar el catálogo" onClick={() => setActive('Productos')} tone="blue" />
                <QuickAction icon={BarChart3} label="Ver reportes" helper="Analizar resultados" onClick={() => setActive('Reportes')} tone="slate" />
              </>
            )}
          </div>
        </article>

        <DashboardHealthCard
          percentage={inventoryHealth}
          healthy={healthyStock}
          lowStock={lowStock}
          noStock={noStock}
          onOpenInventory={() => setActive('Inventario')}
        />
      </section>

      <section>
        <DashboardSalesChart data={weeklySales} total={weeklyTotal} onOpenReports={() => setActive('Reportes')} />
      </section>

      <section className="dashboard-secondary-grid">
        <article className="dashboard-panel">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <div className="dashboard-section-kicker">
                <ReceiptText className="h-4 w-4" />
                Actividad reciente
              </div>
              <h3 className="mt-3 text-xl font-black tracking-tight text-[#10233f]">Últimas ventas</h3>
              <p className="mt-1 text-sm text-slate-500">Movimientos registrados recientemente.</p>
            </div>
            <button type="button" onClick={() => setActive('Ventas')} className="dashboard-text-button">Ver todas</button>
          </div>
          <div className="space-y-2.5">
            {recentSales.length === 0 && <EmptyDashboardMessage text="Todavía no hay ventas registradas." />}
            {recentSales.map(sale => <RecentSaleRow key={sale.id || sale.code} sale={sale} />)}
          </div>
        </article>

        <DashboardListCard
          title="Productos más vendidos"
          subtitle={`Producto destacado: ${topSoldProducts[0]?.name || bestSeller || 'Sin ventas registradas'}`}
          empty="Todavía no hay ventas suficientes para generar el ranking."
          onViewAll={() => setActive('Reportes')}
          items={topSoldProducts.map(product => ({
            title: product.name,
            subtitle: `${product.quantity} unidades vendidas`,
            badge: currency(product.total),
            tone: 'cyan',
          }))}
        />
      </section>

      <section className={`dashboard-alert-grid ${businessConfig.usesExpiration ? 'dashboard-alert-grid-two' : ''}`}>
        <DashboardListCard
          title={isBakery ? 'Existencias con stock bajo' : 'Productos con stock bajo'}
          subtitle={isBakery ? 'Requieren producción o reposición' : 'Requieren revisión o reposición'}
          empty="No hay productos con stock bajo."
          onViewAll={() => setActive('Inventario')}
          items={lowStockProducts.map(product => ({
            title: product.name,
            subtitle: `Stock actual: ${product.stock} · mínimo: ${product.minStock}`,
            badge: `${product.stock} unidades`,
            tone: 'amber',
          }))}
        />

        {businessConfig.usesExpiration && (
          <DashboardListCard
            title="Próximos a caducar"
            subtitle="Productos que requieren seguimiento"
            empty="No hay productos próximos a caducar."
            onViewAll={() => setActive('Inventario')}
            items={expiringProducts.map(product => {
              const exp = expirationText(product);
              return {
                title: product.name,
                subtitle: `Caduca: ${product.expirationDate || 'Sin fecha'} · ${exp.label}`,
                badge: exp.days !== null ? `${exp.days} días` : 'Revisar',
                tone: 'red',
              };
            })}
          />
        )}
      </section>
    </div>
  );
}

export default HomePage;
