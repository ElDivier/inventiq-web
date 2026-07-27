import { LogOut } from 'lucide-react';
import InventiQIcon from './InventiQIcon';
import StoreAvatar from './StoreAvatar';

export default function DesktopSidebar({
  menu,
  active,
  setActive,
  setMobileMoreOpen,
  currentUser,
  logout,
}) {
  return (
    <aside className="inventiq-sidebar fixed inset-y-0 left-0 z-40 hidden h-screen w-[280px] overflow-y-auto p-5 text-white lg:flex lg:flex-col">
      <div className="flex-1">
        <div className="mb-8 rounded-[1.75rem] border border-cyan-300/15 bg-white/[0.045] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.2)] backdrop-blur">
          <div className="flex items-center gap-3">
            <InventiQIcon className="h-14 w-14 rounded-2xl object-cover shadow-[0_10px_28px_rgba(8,145,178,0.28)]" />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-black tracking-[0.08em]">INVENTIQ</h1>
              <p className="truncate text-xs font-medium text-cyan-100/80">Gestión inteligente</p>
            </div>
          </div>
        </div>

        <nav className="space-y-2">
          {menu.map(item => {
            const Icon = item.icon;
            const isActive = active === item.label;

            return (
              <button
                type="button"
                key={item.label}
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
