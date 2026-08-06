import { LogOut, MoreHorizontal, X } from 'lucide-react';

export default function MobileBottomNav({ menu, active, setActive, mobileMoreOpen, setMobileMoreOpen, logout }) {
  const primaryLabels = ['Inicio', 'Ventas', 'Productos', 'Inventario'];
  const primaryMenu = menu.filter(item => primaryLabels.includes(item.label));
  const moreMenu = menu.filter(item => !primaryLabels.includes(item.label));
  const isMoreActive = moreMenu.some(item => item.label === active);

  const moreGroups = moreMenu.reduce((groups, item) => {
    const groupName = item.group || 'Más opciones';
    const existing = groups.find(group => group.name === groupName);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.push({ name: groupName, items: [item] });
    }
    return groups;
  }, []);

  const showGroupTitles = moreGroups.length > 1 || moreGroups.some(group => group.name !== 'Más opciones');

  function goTo(label) {
    setActive(label);
    setMobileMoreOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <>
      {mobileMoreOpen && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú de opciones"
            className="fixed inset-0 z-30 bg-[#031225]/35 backdrop-blur-[2px] lg:hidden"
            onClick={() => setMobileMoreOpen(false)}
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-label="Más opciones de navegación"
            className="fixed inset-x-3 bottom-[calc(5.8rem+env(safe-area-inset-bottom))] z-40 max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-[1.75rem] border border-cyan-100 bg-white p-4 shadow-[0_24px_60px_rgba(7,26,51,0.24)] lg:hidden"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-cyan-700">Navegación</p>
                <h3 className="truncate font-black text-[#10233f]">Más opciones</h3>
              </div>
              <button
                type="button"
                onClick={() => setMobileMoreOpen(false)}
                className="iq-action-icon"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5">
              {moreGroups.map(group => (
                <div key={group.name}>
                  {showGroupTitles && (
                    <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                      {group.name}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {group.items.map(item => {
                      const Icon = item.icon;
                      const selected = active === item.label;

                      return (
                        <button
                          type="button"
                          key={item.label}
                          onClick={() => goTo(item.label)}
                          aria-current={selected ? 'page' : undefined}
                          className={`flex min-h-[4.25rem] min-w-0 items-center gap-3 rounded-2xl border px-3 py-3 text-left text-sm font-extrabold transition ${
                            selected
                              ? 'border-cyan-200 bg-cyan-50 text-cyan-800 shadow-sm'
                              : 'border-slate-100 bg-slate-50 text-slate-700 hover:border-cyan-100 hover:bg-cyan-50/60'
                          }`}
                        >
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-white text-cyan-700' : 'bg-white text-slate-500'}`}>
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 break-words leading-tight">{item.displayLabel || item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={logout}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-extrabold text-red-600 transition hover:bg-red-100"
              >
                <LogOut className="h-5 w-5" />
                Cerrar sesión
              </button>
            </div>
          </section>
        </>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-cyan-100 bg-white/95 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-10px_32px_rgba(7,26,51,0.09)] backdrop-blur lg:hidden" aria-label="Navegación principal móvil">
        <div className="grid grid-cols-5 gap-1">
          {primaryMenu.map(item => {
            const Icon = item.icon;
            const isActive = active === item.label;

            return (
              <button
                type="button"
                key={item.label}
                onClick={() => goTo(item.label)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-w-0 flex-col items-center justify-center rounded-2xl px-1.5 py-2 text-[11px] font-bold transition ${
                  isActive
                    ? 'bg-gradient-to-b from-blue-50 to-cyan-50 text-cyan-800'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Icon className="mb-1 h-5 w-5 shrink-0" />
                <span className="w-full truncate text-center">{item.displayLabel || item.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setMobileMoreOpen(!mobileMoreOpen)}
            aria-expanded={mobileMoreOpen}
            aria-label="Mostrar más opciones"
            className={`flex min-w-0 flex-col items-center justify-center rounded-2xl px-1.5 py-2 text-[11px] font-bold transition ${
              isMoreActive || mobileMoreOpen
                ? 'bg-gradient-to-b from-blue-50 to-cyan-50 text-cyan-800'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <MoreHorizontal className="mb-1 h-5 w-5 shrink-0" />
            <span className="w-full truncate text-center">Más</span>
          </button>
        </div>
      </nav>
    </>
  );
}
