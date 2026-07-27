export default function DashboardKpi({ icon: Icon, title, value, subtitle, tone = 'cyan', detail }) {
  const styles = {
    emerald: {
      icon: 'bg-cyan-50 text-cyan-700',
      glow: 'from-cyan-400/30 to-cyan-200/0',
      label: 'text-cyan-700',
    },
    cyan: {
      icon: 'bg-cyan-50 text-cyan-700',
      glow: 'from-cyan-400/30 to-cyan-200/0',
      label: 'text-cyan-700',
    },
    blue: {
      icon: 'bg-blue-50 text-blue-700',
      glow: 'from-blue-500/25 to-blue-200/0',
      label: 'text-blue-700',
    },
    amber: {
      icon: 'bg-amber-50 text-amber-600',
      glow: 'from-amber-400/25 to-amber-200/0',
      label: 'text-amber-700',
    },
    red: {
      icon: 'bg-red-50 text-red-600',
      glow: 'from-red-400/20 to-red-200/0',
      label: 'text-red-700',
    },
  };

  const style = styles[tone] || styles.cyan;

  return (
    <article className="dashboard-kpi-card">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${style.glow}`} />
      <div className="relative flex items-start justify-between gap-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${style.icon}`}>
          <Icon className="h-6 w-6" />
        </div>
        {detail && (
          <span className="rounded-full border border-slate-100 bg-white/80 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
            {detail}
          </span>
        )}
      </div>

      <div className="relative mt-5 min-w-0">
        <p className="truncate text-sm font-bold text-slate-500">{title}</p>
        <p className="mt-1 truncate text-2xl font-black tracking-tight text-[#10233f] sm:text-3xl">{value}</p>
        <p className={`mt-1 truncate text-xs font-extrabold ${style.label}`}>{subtitle}</p>
      </div>
    </article>
  );
}
