export default function AbcBadge({ value }) {
  const styles = {
    A: 'bg-cyan-50 text-cyan-800',
    B: 'bg-blue-50 text-blue-700',
    C: 'bg-amber-50 text-amber-700',
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${styles[value] || styles.C}`}>
      Tipo {value}
    </span>
  );
}