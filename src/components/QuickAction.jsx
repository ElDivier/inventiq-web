export default function QuickAction({ icon: Icon, label, onClick, tone = 'emerald' }) {
  const styles = {
    emerald: 'bg-emerald-50 text-emerald-700',
    teal: 'bg-teal-50 text-teal-700',
    blue: 'bg-blue-50 text-blue-700',
    slate: 'bg-slate-50 text-slate-700',
  };

  return (
    <button onClick={onClick} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${styles[tone]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-xs font-semibold text-slate-500">Acción rápida</p>
      <p className="mt-1 text-base font-extrabold text-slate-900 sm:text-lg">{label}</p>
    </button>
  );
}