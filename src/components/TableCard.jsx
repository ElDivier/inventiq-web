export default function TableCard({ title, icon: Icon, children }) {
  return (
    <section className="iq-data-card">
      <div className="iq-data-card-header">
        <div className="iq-data-card-icon">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="iq-data-card-title">{title}</h3>
      </div>
      <div className="iq-data-card-body">{children}</div>
    </section>
  );
}
