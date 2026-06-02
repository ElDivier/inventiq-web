export default function SummaryBox({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/15 p-4 backdrop-blur">
      <p className="text-xs text-emerald-50 sm:text-sm">{label}</p>
      <p className="truncate text-xl font-extrabold text-white sm:text-2xl">{value}</p>
    </div>
  );
}