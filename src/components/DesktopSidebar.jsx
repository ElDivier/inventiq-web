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
    <aside className="sticky top-0 hidden h-screen overflow-y-auto lg:flex flex-col bg-gradient-to-b from-emerald-950 to-teal-950 text-white p-6">
      <div className="flex-1">
        <div className="mb-10 flex items-center gap-3">
          <InventiQIcon className="h-14 w-14 rounded-2xl object-cover shadow-md" />
          <div>
            <h1 className="text-2xl font-bold">InventiQ</h1>
            <p className="text-sm text-emerald-100">Controla tu inventario</p>
          </div>
        </div>

        <nav className="space-y-2">
          {menu.map(item => {
            const Icon = item.icon;
            const isActive = active === item.label;

            return (
              <button
                key={item.label}
                onClick={() => {
                  setActive(item.label);
                  setMobileMoreOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${isActive ? 'bg-emerald-500/80 shadow-lg' : 'text-emerald-50 hover:bg-white/10'}`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.displayLabel || item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="sticky bottom-0 mt-6 space-y-5 border-t border-white/10 bg-teal-950/95 pt-5 backdrop-blur">
        <div className="flex items-center gap-3">
          <StoreAvatar currentUser={currentUser} size="md" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{currentUser.name}</p>
            <p className="truncate text-sm text-emerald-100">{currentUser.store}</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-emerald-50 hover:bg-white/10"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
