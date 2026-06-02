export default function DashboardKpi({ icon: Icon, title, value, subtitle, tone = 'emerald' }) {
  const styles = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${styles[tone]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-500 sm:text-sm">{title}</p>
          <p className="truncate text-2xl font-extrabold text-slate-900">{value}</p>
          <p className="truncate text-xs text-emerald-600">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}