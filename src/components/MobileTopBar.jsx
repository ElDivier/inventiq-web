import InventiQIcon from './InventiQIcon';

export default function MobileTopBar({ currentUser, active }) {
  return (
    <div className="fixed left-0 right-0 top-0 z-40 border-b border-slate-200 bg-white/95 px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.65rem)] shadow-sm backdrop-blur lg:hidden">
      <div className="flex items-center gap-3">
        <InventiQIcon className="h-10 w-10 shrink-0 rounded-2xl object-cover shadow-sm" />
        <div className="min-w-0">
          <p className="truncate text-base font-extrabold leading-5">InventiQ</p>
          <p className="max-w-[240px] truncate text-xs font-semibold text-emerald-700">
            {currentUser.store} · {active}
          </p>
        </div>
      </div>
    </div>
  );
}