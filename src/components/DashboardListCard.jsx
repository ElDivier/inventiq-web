function DashboardListItem({ item }) {
  const badgeStyles = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  };

  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 p-4">
      <div className="min-w-0">
        <p className="truncate font-bold text-slate-900">{item.title}</p>
        <p className="text-sm text-slate-500">{item.subtitle}</p>
      </div>
      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${badgeStyles[item.tone] || badgeStyles.emerald}`}>
        {item.badge}
      </span>
    </div>
  );
}

function EmptyDashboardMessage({ text }) {
  return <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">{text}</p>;
}

export default function DashboardListCard({ title, subtitle, items = [], empty }) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-extrabold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-3">
        {items.length === 0 && <EmptyDashboardMessage text={empty} />}
        {items.map((item, index) => (
          <DashboardListItem key={`${item.title}-${index}`} item={item} />
        ))}
      </div>
    </div>
  );
}