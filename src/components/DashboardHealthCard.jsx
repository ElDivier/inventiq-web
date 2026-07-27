import { AlertTriangle, Boxes, CheckCircle2, PackageX } from 'lucide-react';

function HealthRow({ icon: Icon, label, value, tone }) {
  const tones = {
    cyan: 'bg-cyan-50 text-cyan-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/80 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tones[tone] || tones.cyan}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="truncate text-sm font-bold text-slate-600">{label}</span>
      </div>
      <span className="text-lg font-black text-[#10233f]">{value}</span>
    </div>
  );
}

export default function DashboardHealthCard({ percentage = 0, healthy = 0, lowStock = 0, noStock = 0, onOpenInventory }) {
  const safePercentage = Math.max(0, Math.min(100, Number(percentage || 0)));

  return (
    <article className="dashboard-panel dashboard-health-panel">
      <div className="dashboard-section-kicker">
        <Boxes className="h-4 w-4" />
        Estado del inventario
      </div>

      <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row xl:flex-col 2xl:flex-row">
        <div
          className="dashboard-health-ring"
          style={{ '--dashboard-health-value': `${safePercentage * 3.6}deg` }}
          aria-label={`Salud del inventario: ${safePercentage}%`}
        >
          <div className="dashboard-health-ring-inner">
            <span className="text-3xl font-black text-[#071a33]">{safePercentage}%</span>
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">salud</span>
          </div>
        </div>

        <div className="w-full flex-1 space-y-2.5">
          <HealthRow icon={CheckCircle2} label="Stock saludable" value={healthy} tone="cyan" />
          <HealthRow icon={AlertTriangle} label="Stock bajo" value={lowStock} tone="amber" />
          <HealthRow icon={PackageX} label="Sin stock" value={noStock} tone="red" />
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenInventory}
        className="mt-5 w-full rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm font-extrabold text-cyan-800 transition hover:border-cyan-200 hover:bg-cyan-100"
      >
        Revisar inventario
      </button>
    </article>
  );
}
