import { Package } from 'lucide-react';

export default function EmptyState({ icon: Icon = Package, title, text, actionLabel, onAction }) {
  return (
    <div className="iq-empty-state">
      <div className="iq-empty-state-icon">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="iq-empty-state-title">{title}</h3>
      <p className="iq-empty-state-text">{text}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="iq-primary-button mt-4"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
