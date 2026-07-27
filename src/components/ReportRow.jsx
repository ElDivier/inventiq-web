export default function ReportRow({ title, subtitle, right, badge }) {
  return (
    <div className="iq-list-row gap-4">
      <div className="min-w-0">
        <p className="truncate font-extrabold text-slate-900">{title}</p>
        <p className="truncate text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-black text-slate-900">{right}</p>
        <span className="iq-soft-badge mt-1">{badge}</span>
      </div>
    </div>
  );
}
