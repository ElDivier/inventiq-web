import {
  AlertTriangle,
  DollarSign,
  Edit,
  Package,
  Trash2,
  Truck,
} from 'lucide-react';

import Field from '../components/Field';
import Metric from '../components/Metric';
import EmptyState from '../components/EmptyState';

import {
  normalizeEcuadorPhone,
  buildProviderOrder,
  getProviderEmail,
} from '../utils/providers';

export default function ProvidersPage({
  providers = [],
  providerForm = {},
  setProviderForm,
  saveProvider,
  resetProviderForm,
  editProvider,
  deleteProvider,
  editingProviderId,
  pendingDeleteProviderId,
  setPendingDeleteProviderId,
  providerNotice,
  productCategories = [],
  products = [],
  providersLoading,
  setActive,
  setPurchaseForm,
}) {
  const safeProviders = Array.isArray(providers) ? providers : [];
  const safeProducts = Array.isArray(products) ? products : [];
  const safeCategories = Array.isArray(productCategories) ? productCategories : [];

  const lowStockProducts = safeProducts.filter(product => {
    const stock = Number(product.stock || 0);
    const minStock = Number(product.minStock || 0);

    return stock <= minStock;
  });

  const providersWithStats = safeProviders.map(provider => {
    const { pendingProducts } = buildProviderOrder(provider, safeProducts);

    const suppliedProducts = safeProducts.filter(product => {
      const providerCategory = String(provider.category || '').toLowerCase();
      const productCategory = String(product.category || '').toLowerCase();

      return providerCategory === 'general' || providerCategory === productCategory;
    });

    const estimatedRestock = pendingProducts.reduce((sum, product) => {
      const cost = Number(product.cost || 0);
      const suggested = Number(product.suggested || 0);

      return sum + cost * suggested;
    }, 0);

    return {
      ...provider,
      pendingProducts,
      suppliedProducts,
      estimatedRestock,
    };
  });

  const pendingProviders = providersWithStats.filter(provider => provider.pendingProducts.length > 0);

  function updateProviderForm(values) {
    if (!setProviderForm) return;
    setProviderForm(values);
  }

  function purchaseFromProvider(provider) {
    if (setPurchaseForm) {
      setPurchaseForm(prev => ({
        ...prev,
        providerId: provider.id,
      }));
    }

    if (setActive) {
      setActive('Compras');
    }
  }

  async function copyProviderOrder(provider) {
    const { message } = buildProviderOrder(provider, safeProducts);

    try {
      await navigator.clipboard.writeText(message);
      alert('Pedido sugerido copiado correctamente.');
    } catch {
      alert(message);
    }
  }

  function openProviderWhatsApp(provider) {
    const phone = normalizeEcuadorPhone(provider.contact);
    const { message } = buildProviderOrder(provider, safeProducts);

    if (!phone) {
      alert('Este proveedor no tiene un número válido para WhatsApp.');
      return;
    }

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  }

  function openProviderEmail(provider) {
    const email = getProviderEmail(provider);
    const { message } = buildProviderOrder(provider, safeProducts);

    if (!email) {
      alert('Este proveedor no tiene un correo válido.');
      return;
    }

    window.location.href = `mailto:${email}?subject=${encodeURIComponent('Pedido de reposición')}&body=${encodeURIComponent(message)}`;
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric
          icon={Truck}
          label="Proveedores"
          value={safeProviders.length}
          note="registrados"
          color="emerald"
        />

        <Metric
          icon={AlertTriangle}
          label="Con reposición"
          value={pendingProviders.length}
          note="proveedores"
          color="amber"
        />

        <Metric
          icon={Package}
          label="Productos bajos"
          value={lowStockProducts.length}
          note="pendientes"
          color="red"
        />

        <Metric
          icon={DollarSign}
          label="Reposición estimada"
          value={`$${pendingProviders.reduce((sum, provider) => sum + Number(provider.estimatedRestock || 0), 0).toFixed(2)}`}
          note="aprox."
          color="blue"
        />
      </section>

      <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
        <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-amber-900">
          <AlertTriangle className="h-5 w-5" />
          Proveedores sugeridos para reposición
        </h3>

        {lowStockProducts.length === 0 && (
          <p className="text-sm text-amber-800">
            No existen productos con necesidad de reposición.
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lowStockProducts.map(product => {
            const provider = safeProviders.find(item => {
              const providerCategory = String(item.category || '').toLowerCase();
              const productCategory = String(product.category || '').toLowerCase();

              return providerCategory === productCategory;
            });

            return (
              <div key={product.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="font-bold text-slate-900">{product.name}</p>

                <p className="text-sm text-slate-500">
                  Stock {product.stock} · mínimo {product.minStock}
                </p>

                <p className="mt-2 text-sm font-semibold text-amber-700">
                  Proveedor: {provider ? provider.name : 'Sin proveedor asignado'}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
        <section className="order-2 rounded-3xl border border-slate-200 bg-white shadow-sm xl:order-1">
          {providersLoading && (
            <div className="border-b border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
              Cargando proveedores desde Supabase...
            </div>
          )}

          <div className="border-b border-slate-100 p-5">
            <h3 className="flex items-center gap-2 text-xl font-bold">
              <Truck className="h-5 w-5 text-emerald-600" />
              Proveedores registrados
            </h3>
          </div>

          <div className="divide-y divide-slate-100">
            {safeProviders.length === 0 && (
              <div className="p-5">
                <EmptyState
                  icon={Truck}
                  title="Aún no tienes proveedores"
                  text="Registra proveedores para asociarlos con categorías y facilitar reposiciones."
                />
              </div>
            )}

            {providersWithStats.map(provider => {
              const isDeleting = pendingDeleteProviderId === provider.id;
              const pendingProducts = Array.isArray(provider.pendingProducts) ? provider.pendingProducts : [];
              const hasEmail = Boolean(getProviderEmail(provider));
              const hasPhone = Boolean(normalizeEcuadorPhone(provider.contact));

              return (
                <div key={provider.id} className="flex flex-col gap-4 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{provider.name}</p>

                      <p className="text-sm text-slate-500">
                        {provider.category || 'Sin categoría'} · Tel: {provider.contact || 'Sin teléfono'}
                      </p>

                      <p className="text-xs text-slate-400">
                        Correo: {provider.email || 'Sin correo'} · Entrega estimada: {provider.delivery || 'No definida'}
                      </p>

                      <p className="text-xs text-slate-400">
                        Productos asociados: {provider.suppliedProducts.length}
                      </p>

                      <p className={`mt-2 text-xs font-bold ${pendingProducts.length > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {pendingProducts.length > 0
                          ? `Pedido sugerido: ${pendingProducts.length} producto(s) · $${Number(provider.estimatedRestock || 0).toFixed(2)} aprox.`
                          : 'Sin productos pendientes de reposición'}
                      </p>
                    </div>

                    {isDeleting ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => deleteProvider(provider.id)}
                          className="rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-white hover:bg-red-600"
                        >
                          Confirmar
                        </button>

                        <button
                          type="button"
                          onClick={() => setPendingDeleteProviderId(null)}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => editProvider(provider)}
                          className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50"
                          title="Editar proveedor"
                        >
                          <Edit className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setPendingDeleteProviderId(provider.id)}
                          className="rounded-xl border border-red-100 p-2 text-red-500 hover:bg-red-50"
                          title="Eliminar proveedor"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {hasPhone && (
                      <button
                        type="button"
                        onClick={() => openProviderWhatsApp(provider)}
                        className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700"
                      >
                        WhatsApp
                      </button>
                    )}

                    {hasEmail && (
                      <button
                        type="button"
                        onClick={() => openProviderEmail(provider)}
                        className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
                      >
                        Correo
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => copyProviderOrder(provider)}
                      className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Copiar pedido
                    </button>

                    <button
                      type="button"
                      onClick={() => purchaseFromProvider(provider)}
                      className="rounded-2xl border border-emerald-200 px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
                    >
                      Registrar compra
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <form
          onSubmit={saveProvider}
          className="order-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:order-2"
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">
                {editingProviderId ? 'Editar proveedor' : 'Registrar proveedor'}
              </h3>

              <p className="text-sm text-slate-500">
                Asocia proveedores con categorías de productos.
              </p>
            </div>

            <button
              type="button"
              onClick={resetProviderForm}
              className="rounded-xl p-2 hover:bg-slate-50"
            >
              ×
            </button>
          </div>

          {providerNotice && (
            <div className={`mb-4 rounded-2xl p-4 text-sm font-semibold ${providerNotice.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {providerNotice.message}
            </div>
          )}

          <div className="space-y-4">
            <Field
              label="Nombre del proveedor"
              value={providerForm.name || ''}
              onChange={value => updateProviderForm({ ...providerForm, name: value })}
              placeholder="Ej: Distribuidora Norte"
            />

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Categoría que abastece
              </span>

              <select
                value={providerForm.category || ''}
                onChange={event => updateProviderForm({ ...providerForm, category: event.target.value })}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200"
              >
                <option value="">Seleccionar categoría</option>

                {safeCategories.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}

                <option value="General">General</option>
              </select>
            </label>

            <Field
              label="Teléfono / WhatsApp"
              value={providerForm.contact || ''}
              onChange={value => updateProviderForm({ ...providerForm, contact: value })}
              placeholder="Ej: 0991234567"
            />

            <Field
              label="Correo electrónico"
              type="email"
              value={providerForm.email || ''}
              onChange={value => updateProviderForm({ ...providerForm, email: value })}
              placeholder="Ej: ventas@proveedor.com"
            />

            <Field
              label="Entrega estimada"
              value={providerForm.delivery || ''}
              onChange={value => updateProviderForm({ ...providerForm, delivery: value })}
              placeholder="Ej: 2 días"
            />

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Observaciones
              </span>

              <textarea
                value={providerForm.notes || ''}
                onChange={event => updateProviderForm({ ...providerForm, notes: event.target.value })}
                className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200"
                placeholder="Condiciones, horarios, productos principales..."
              />
            </label>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={resetProviderForm}
                className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="rounded-2xl bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700"
              >
                {editingProviderId ? 'Actualizar proveedor' : 'Guardar proveedor'}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}