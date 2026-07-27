export default function ListRow({ title, subtitle, right }) {
  return (
    <div className="iq-list-row">
      <div className="min-w-0">
        <p className="truncate font-extrabold text-slate-900">{title}</p>
        <p className="truncate text-sm text-slate-500">{subtitle}</p>
      </div>
      <span className="iq-soft-badge">{right}</span>
    </div>
  );
}
