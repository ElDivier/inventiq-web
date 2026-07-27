import { ArrowRight } from 'lucide-react';

function DashboardListItem({ item, index }) {
  const badgeStyles = {
    emerald: 'bg-cyan-50 text-cyan-800',
    cyan: 'bg-cyan-50 text-cyan-800',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  };

  return (
    <div className="dashboard-list-row">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-500">
          {index + 1}
        </span>
        <div className="min-w-0">
          <p className="truncate font-extrabold text-slate-900">{item.title}</p>
          <p className="mt-0.5 text-sm leading-5 text-slate-500">{item.subtitle}</p>
        </div>
      </div>
      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold ${badgeStyles[item.tone] || badgeStyles.emerald}`}>
        {item.badge}
      </span>
    </div>
  );
}

function EmptyDashboardMessage({ text }) {
  return <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5 text-center text-sm font-semibold text-slate-500">{text}</p>;
}

export default function DashboardListCard({ title, subtitle, items = [], empty, onViewAll }) {
  return (
    <article className="dashboard-panel">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black tracking-tight text-[#10233f]">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        {onViewAll && (
          <button type="button" onClick={onViewAll} className="dashboard-icon-button" aria-label={`Ver ${title}`}>
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="space-y-2.5">
        {items.length === 0 && <EmptyDashboardMessage text={empty} />}
        {items.map((item, index) => (
          <DashboardListItem key={`${item.title}-${index}`} item={item} index={index} />
        ))}
      </div>
    </article>
  );
}
