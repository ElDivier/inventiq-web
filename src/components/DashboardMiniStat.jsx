export default function DashboardMiniStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-300/15">
        <Icon className="h-4 w-4 text-cyan-100" />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-cyan-100/85 sm:text-xs">{label}</p>
      <p className="mt-1 truncate text-lg font-black text-white sm:text-xl">{value}</p>
    </div>
  );
}
