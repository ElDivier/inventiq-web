export default function Field({ label, value, onChange, placeholder, type = 'text', min, step }) {
  return (
    <label className="iq-field">
      <span className="iq-field-label">{label}</span>
      <input
        type={type}
        min={min}
        step={step}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="iq-input"
      />
    </label>
  );
}
