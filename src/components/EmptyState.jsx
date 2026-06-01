import { Package } from 'lucide-react';

export default function EmptyState({ icon: Icon = Package, title, text, actionLabel, onAction }) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{text}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}