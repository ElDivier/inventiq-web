export default function SummaryBox({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
      <p className="text-xs text-cyan-50/85 sm:text-sm">{label}</p>
      <p className="truncate text-xl font-black text-white sm:text-2xl">{value}</p>
    </div>
  );
}
