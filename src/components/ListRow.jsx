export default function ListRow({ title, subtitle, right }) {
  return (
    <div className="flex items-center justify-between p-5">
      <div>
        <p className="font-bold">{title}</p>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
        {right}
      </span>
    </div>
  );
}