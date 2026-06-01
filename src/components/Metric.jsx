export default function Metric({ icon: Icon, label, value, note, color }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-500',
    red: 'bg-red-50 text-red-500',
    blue: 'bg-blue-50 text-blue-500',
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full sm:h-16 sm:w-16 ${colors[color]}`}>
          <Icon className="h-6 w-6 sm:h-8 sm:w-8" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-slate-500 sm:text-sm">{label}</p>
          <p className="truncate text-xl font-extrabold text-slate-900 sm:text-3xl">{value}</p>
          <p className="truncate text-xs text-emerald-600 sm:text-sm">{note}</p>
        </div>
      </div>
    </div>
  );
}