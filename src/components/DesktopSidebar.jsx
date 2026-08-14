import { KeyRound, LogOut } from 'lucide-react';
import InventiQIcon from './InventiQIcon';
import StoreAvatar from './StoreAvatar';

export default function DesktopSidebar({
  menu,
  active,
  setActive,
  setMobileMoreOpen,
  currentUser,
  logout,
  onOpenOperatorSwitcher,
}) {
  return (
    <aside className="inventiq-sidebar fixed inset-y-0 left-0 z-40 hidden h-screen w-[250px] overflow-y-auto p-5 text-white lg:flex lg:flex-col">
      <div className="flex-1">
        <div className="mb-8 rounded-[1.75rem] border border-cyan-300/15 bg-white/[0.045] px-4 py-4 shadow-[0_18px_45px_rgba(0,0,0,0.2)] backdrop-blur">
          <div className="flex items-center gap-3">
            <InventiQIcon className="h-12 w-12 shrink-0 rounded-2xl object-cover shadow-[0_10px_28px_rgba(8,145,178,0.28)]" />
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-black leading-none tracking-[0.04em] text-white">INVENTIQ</h1>
              <p className="mt-1 text-[11px] font-medium leading-4 text-cyan-100/80 whitespace-normal break-words">
                Gestión inteligente
              </p>
            </div>
          </div>
        </div>

        <nav className="space-y-1.5">
          {menu.map((item, index) => {
            const Icon = item.icon;
            const isActive = active === item.label;
            const previousGroup = index > 0 ? menu[index - 1]?.group : '';
            const showGroup = Boolean(item.group) && item.group !== previousGroup;

            return (
              <div key={item.label}>
                {showGroup && (
                  <p className={`${index === 0 ? 'mb-2' : 'mb-2 mt-5'} px-3 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/45`}>
                    {item.group}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setActive(item.label);
                    setMobileMoreOpen(false);
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 text-white shadow-[0_12px_30px_rgba(14,165,233,0.28)]'
                      : 'text-slate-200 hover:bg-white/[0.08] hover:text-white'
                  }`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                    isActive ? 'bg-white/15' : 'bg-white/[0.035] text-cyan-100 group-hover:bg-white/[0.08]'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-semibold">{item.displayLabel || item.label}</span>
                </button>
              </div>
            );
          })}
        </nav>
      </div>

      <div className="sticky bottom-0 mt-6 space-y-3 border-t border-cyan-200/10 bg-[#071a33]/95 pt-5 backdrop-blur">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
          <StoreAvatar currentUser={currentUser} size="md" />
          <div className="min-w-0">
            <p className="truncate font-bold text-white">{currentUser.name}</p>
            <p className="truncate text-sm text-cyan-100/75">{currentUser.store}</p>
          </div>
        </div>

        {['restaurante', 'cafeteria'].includes(currentUser?.businessType) && onOpenOperatorSwitcher && (
          <button
            type="button"
            onClick={onOpenOperatorSwitcher}
            className="flex w-full items-center gap-3 rounded-2xl border border-cyan-200/10 bg-white/[0.045] px-3 py-3 text-left transition hover:bg-white/[0.08]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200"><KeyRound className="h-4 w-4" /></span>
            <span className="min-w-0"><span className="block text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100/50">Operador activo</span><span className="block truncate text-sm font-bold text-white">{currentUser.operatorName || 'Administrador'}</span></span>
          </button>
        )}

        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/25 hover:bg-white/[0.08]"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
