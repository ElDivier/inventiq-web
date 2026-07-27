export default function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <p className="text-sm text-cyan-100">{label}</p>
      <p className="text-2xl font-extrabold text-white">{value}</p>
    </div>
  );
}