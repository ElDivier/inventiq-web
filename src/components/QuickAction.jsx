import { ArrowUpRight } from 'lucide-react';

export default function QuickAction({ icon: Icon, label, onClick, tone = 'cyan', helper }) {
  const styles = {
    emerald: 'bg-cyan-50 text-cyan-700 group-hover:bg-cyan-100',
    cyan: 'bg-cyan-50 text-cyan-700 group-hover:bg-cyan-100',
    teal: 'bg-sky-50 text-sky-700 group-hover:bg-sky-100',
    blue: 'bg-blue-50 text-blue-700 group-hover:bg-blue-100',
    slate: 'bg-slate-100 text-slate-700 group-hover:bg-slate-200',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group dashboard-quick-action"
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition ${styles[tone] || styles.cyan}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-[#10233f]">{label}</p>
        <p className="truncate text-xs font-semibold text-slate-400">{helper || 'Acceso rápido'}</p>
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cyan-600" />
    </button>
  );
}
