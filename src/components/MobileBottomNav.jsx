import { LogOut, MoreHorizontal } from 'lucide-react';

export default function MobileBottomNav({ menu, active, setActive, mobileMoreOpen, setMobileMoreOpen, logout }) {
  const primaryLabels = ['Inicio', 'Ventas', 'Productos', 'Inventario'];
  const moreLabels = ['Compras', 'Caja', 'Reportes', 'Clientes', 'Proveedores', 'Configuración'];
  const primaryMenu = menu.filter(item => primaryLabels.includes(item.label));
  const moreMenu = menu.filter(item => moreLabels.includes(item.label));
  const isMoreActive = moreLabels.includes(active);

  function goTo(label) {
    setActive(label);
    setMobileMoreOpen(false);
  }

  return (
    <>
      {mobileMoreOpen && (
        <div className="fixed inset-x-3 bottom-24 z-40 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-2xl lg:hidden">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900">Más opciones</h3>
            <button
              onClick={() => setMobileMoreOpen(false)}
              className="rounded-xl px-3 py-1 text-sm font-bold text-slate-500 hover:bg-slate-50"
            >
              Cerrar
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {moreMenu.map(item => {
              const Icon = item.icon;
              const selected = active === item.label;

              return (
                <button
                  key={item.label}
                  onClick={() => goTo(item.label)}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left text-sm font-bold transition ${
                    selected
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-100 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.displayLabel || item.label}</span>
                </button>
              );
            })}

            <button
              onClick={logout}
              className="col-span-2 flex items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-sm font-extrabold text-red-600 hover:bg-red-100"
            >
              <LogOut className="h-5 w-5" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-2 py-2 shadow-[0_-8px_25px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {primaryMenu.map(item => {
            const Icon = item.icon;
            const isActive = active === item.label;

            return (
              <button
                key={item.label}
                onClick={() => goTo(item.label)}
                className={`flex flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${
                  isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Icon className="mb-1 h-5 w-5" />
                <span>{item.displayLabel || item.label}</span>
              </button>
            );
          })}

          <button
            onClick={() => setMobileMoreOpen(!mobileMoreOpen)}
            className={`flex flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${
              isMoreActive || mobileMoreOpen
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <MoreHorizontal className="mb-1 h-5 w-5" />
            <span>Más</span>
          </button>
        </div>
      </nav>
    </>
  );
}