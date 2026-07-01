import { Plus } from 'lucide-react';

export default function PageHeader({ pageInfo, currentUser, onAddProduct }) {
  const HeaderIcon = pageInfo.icon;

  return (
    <header className="mb-5 flex flex-col gap-4 rounded-[1.5rem] bg-white/70 p-3 shadow-sm backdrop-blur sm:mb-8 sm:bg-transparent sm:p-0 sm:shadow-none lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-4">
        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
          <HeaderIcon className="h-8 w-8" />
        </div>

        <div>
          <h2 className="text-2xl font-extrabold sm:text-3xl lg:text-4xl">{pageInfo.title}</h2>
          <p className="text-sm text-slate-500 sm:text-base">{pageInfo.subtitle}</p>
          <p className="mt-1 text-sm font-semibold text-emerald-700">
            {currentUser.store} · {currentUser.city}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onAddProduct}
          className="hidden rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700 sm:inline-flex sm:items-center"
        >
          <Plus className="mr-2 h-5 w-5" />
          Agregar producto
        </button>
      </div>
    </header>
  );
}
