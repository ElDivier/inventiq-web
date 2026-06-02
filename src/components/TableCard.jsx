export default function TableCard({ title, icon: Icon, children }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5">
        <h3 className="flex items-center gap-2 text-xl font-bold">
          <Icon className="h-5 w-5 text-emerald-600" />
          {title}
        </h3>
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </section>
  );
}