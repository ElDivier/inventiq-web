export default function Metric({ icon: Icon, label, value, note, color = 'blue' }) {
  const tone = color === 'emerald' ? 'cyan' : color;

  return (
    <article className={`iq-metric-card iq-metric-${tone}`}>
      <div className="iq-metric-accent" />
      <div className="iq-metric-icon">
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </div>
      <div className="min-w-0">
        <p className="iq-metric-label">{label}</p>
        <p className="iq-metric-value">{value}</p>
        <p className="iq-metric-note">{note}</p>
      </div>
    </article>
  );
}
