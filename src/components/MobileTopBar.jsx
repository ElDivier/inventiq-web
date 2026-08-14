import { KeyRound } from 'lucide-react';
import InventiQIcon from './InventiQIcon';

export default function MobileTopBar({ currentUser, active, onOpenOperatorSwitcher }) {
  return (
    <div className="fixed left-0 right-0 top-0 z-40 border-b border-cyan-300/15 bg-[#071a33]/95 px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.65rem)] text-white shadow-[0_12px_30px_rgba(7,26,51,0.2)] backdrop-blur lg:hidden">
      <div className="flex items-center gap-3">
        <InventiQIcon className="h-10 w-10 shrink-0 rounded-2xl object-cover shadow-[0_8px_22px_rgba(8,145,178,0.3)]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-black leading-5 tracking-[0.08em]">INVENTIQ</p>
          <p className="max-w-[240px] truncate text-xs font-semibold text-cyan-100/80">
            {currentUser.store} · {active}
          </p>
        </div>
        {['restaurante', 'cafeteria'].includes(currentUser?.businessType) && onOpenOperatorSwitcher && (
          <button type="button" onClick={onOpenOperatorSwitcher} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-cyan-100" aria-label={`Cambiar operador. Actual: ${currentUser.operatorName || 'Administrador'}`}>
            <KeyRound className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
