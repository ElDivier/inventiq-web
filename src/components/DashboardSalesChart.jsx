import { BarChart3 } from 'lucide-react';

export default function DashboardSalesChart({ data = [], total = 0, onOpenReports }) {
  const maxValue = Math.max(...data.map(item => Number(item.value || 0)), 1);
  const hasSales = data.some(item => Number(item.value || 0) > 0);

  return (
    <article className="dashboard-panel dashboard-panel-chart">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="dashboard-section-kicker">
            <BarChart3 className="h-4 w-4" />
            Rendimiento semanal
          </div>
          <h3 className="mt-3 text-xl font-black tracking-tight text-[#10233f] sm:text-2xl">Ventas de los últimos 7 días</h3>
          <p className="mt-1 text-sm text-slate-500">Una lectura rápida del movimiento reciente de tu negocio.</p>
        </div>

        <button
          type="button"
          onClick={onOpenReports}
          className="dashboard-text-button"
        >
          Ver reportes
        </button>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Total del periodo</p>
          <p className="mt-1 text-3xl font-black tracking-tight text-[#071a33]">${Number(total || 0).toFixed(2)}</p>
        </div>
        <div className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${hasSales ? 'bg-cyan-50 text-cyan-700' : 'bg-slate-100 text-slate-500'}`}>
          {hasSales ? 'Actividad registrada' : 'Sin movimientos'}
        </div>
      </div>

      <div className="dashboard-chart-grid mt-6" aria-label="Gráfico de ventas de los últimos siete días">
        {data.map((item, index) => {
          const value = Number(item.value || 0);
          const height = value > 0 ? Math.max((value / maxValue) * 100, 8) : 3;

          return (
            <div key={`${item.label}-${index}`} className="dashboard-chart-column">
              <div className="dashboard-chart-value">${value.toFixed(0)}</div>
              <div className="dashboard-chart-track">
                <div
                  className="dashboard-chart-bar"
                  style={{ '--dashboard-bar-height': `${height}%` }}
                  title={`${item.fullLabel}: $${value.toFixed(2)}`}
                />
              </div>
              <span className="dashboard-chart-label">{item.label}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}
