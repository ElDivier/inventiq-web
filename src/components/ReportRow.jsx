export default function ReportRow({ title, subtitle, right, badge }) {
  return (
    <div className="flex items-center justify-between gap-4 p-5">
      <div>
        <p className="font-bold text-slate-900">{title}</p>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="text-right">
        <p className="font-bold text-slate-900">{right}</p>
        <span className="mt-1 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          {badge}
        </span>
      </div>
    </div>
  );
}