import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Edit,
  Mail,
  Package,
  Phone,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
} from 'lucide-react';

const REORDER_PAGE_SIZE = 6;
const PROVIDER_PAGE_SIZE = 12;

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function getStock(product) {
  return safeNumber(product?.stock);
}

function getMinStock(product) {
  return safeNumber(product?.minStock ?? product?.min_stock);
}

function getProductCategory(product) {
  return product?.category || product?.categoryName || 'Sin categoría';
}

function getProductName(product) {
  const variantParts = [product?.size, product?.color].filter(Boolean).join(' · ');
  return variantParts ? `${product?.name || 'Producto'} · ${variantParts}` : product?.name || 'Producto';
}

function findProviderForProduct(product, providers) {
  if (!product) return null;

  const providerId = product.providerId || product.provider_id;
  if (providerId) {
    const directProvider = providers.find(provider => String(provider.id) === String(providerId));
    if (directProvider) return directProvider;
  }

  const productCategory = normalizeText(getProductCategory(product));
  if (!productCategory) return null;

  return providers.find(provider => normalizeText(provider.category) === productCategory) || null;
}

function buildProviderMessage(provider, products) {
  const lines = [
    `Hola ${provider?.name || ''}. Necesito cotizar/reposición de los siguientes productos:`,
    '',
    ...products.map(product => `- ${getProductName(product)} | Stock: ${getStock(product)} | Mínimo: ${getMinStock(product)}`),
    '',
    'Quedo atento/a a disponibilidad y precios.',
  ];

  return lines.join('\n');
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('593')) return digits;
  if (digits.startsWith('0')) return `593${digits.slice(1)}`;
  if (digits.length === 9) return `593${digits}`;
  return digits;
}

function MetricCard({ icon: Icon, label, value, note, tone = 'emerald' }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tones[tone] || tones.emerald}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="text-2xl font-extrabold text-slate-900">{value}</p>
          {note && <p className="text-xs font-semibold text-slate-400">{note}</p>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder = '', children, required = false }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      {children || (
        <input
          type={type}
          value={value || ''}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
        />
      )}
    </label>
  );
}

export default function ProvidersPage({
  providers = [],
  providerForm,
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
  const [reorderFilter, setReorderFilter] = useState('all');
  const [reorderPage, setReorderPage] = useState(1);
  const [providerSearch, setProviderSearch] = useState('');
  const [providerPage, setProviderPage] = useState(1);

  const productsForReorder = useMemo(() => {
    return products
      .filter(product => {
        const minStock = getMinStock(product);
        const stock = getStock(product);
        return minStock > 0 && stock <= minStock;
      })
      .sort((a, b) => {
        const aMissing = getMinStock(a) - getStock(a);
        const bMissing = getMinStock(b) - getStock(b);
        if (bMissing !== aMissing) return bMissing - aMissing;
        return getStock(a) - getStock(b);
      });
  }, [products]);

  const reorderWithProviderInfo = useMemo(() => {
    return productsForReorder.map(product => ({
      product,
      provider: findProviderForProduct(product, providers),
    }));
  }, [productsForReorder, providers]);

  const filteredReorderProducts = useMemo(() => {
    if (reorderFilter === 'without-provider') {
      return reorderWithProviderInfo.filter(item => !item.provider);
    }

    if (reorderFilter === 'with-provider') {
      return reorderWithProviderInfo.filter(item => item.provider);
    }

    return reorderWithProviderInfo;
  }, [reorderWithProviderInfo, reorderFilter]);

  const reorderTotalPages = Math.max(Math.ceil(filteredReorderProducts.length / REORDER_PAGE_SIZE), 1);
  const safeReorderPage = Math.min(reorderPage, reorderTotalPages);
  const reorderStart = (safeReorderPage - 1) * REORDER_PAGE_SIZE;
  const paginatedReorderProducts = filteredReorderProducts.slice(reorderStart, reorderStart + REORDER_PAGE_SIZE);

  const filteredProviders = useMemo(() => {
    const term = normalizeText(providerSearch);
    if (!term) return providers;

    return providers.filter(provider => [
      provider.name,
      provider.category,
      provider.contact,
      provider.email,
      provider.delivery,
      provider.notes,
    ].some(value => normalizeText(value).includes(term)));
  }, [providers, providerSearch]);

  const providerTotalPages = Math.max(Math.ceil(filteredProviders.length / PROVIDER_PAGE_SIZE), 1);
  const safeProviderPage = Math.min(providerPage, providerTotalPages);
  const providerStart = (safeProviderPage - 1) * PROVIDER_PAGE_SIZE;
  const paginatedProviders = filteredProviders.slice(providerStart, providerStart + PROVIDER_PAGE_SIZE);

  const providersWithCategory = providers.filter(provider => provider.category).length;
  const withoutProviderCount = reorderWithProviderInfo.filter(item => !item.provider).length;
  const withProviderCount = reorderWithProviderInfo.filter(item => item.provider).length;

  useEffect(() => {
    setReorderPage(1);
  }, [reorderFilter, productsForReorder.length, providers.length]);

  useEffect(() => {
    setProviderPage(1);
  }, [providerSearch, providers.length]);

  function updateForm(field, value) {
    setProviderForm(prev => ({ ...prev, [field]: value }));
  }

  function startPurchaseFromSuggestion(product, provider) {
    if (!provider) {
      alert('Primero asigna un proveedor a la categoría de este producto.');
      return;
    }

    setPurchaseForm?.(prev => ({
      ...prev,
      productId: product.id,
      providerId: provider.id,
      quantity: Math.max(getMinStock(product) - getStock(product), 1),
      unitCost: product.cost || '',
      note: `Reposición sugerida para ${getProductName(product)}`,
    }));

    setActive?.('Compras');
  }

  async function copyOrderForProvider(provider) {
    const providerProducts = productsForReorder.filter(product => findProviderForProduct(product, providers)?.id === provider.id);
    const message = buildProviderMessage(provider, providerProducts.length > 0 ? providerProducts : []);

    try {
      await navigator.clipboard.writeText(message);
      alert('Pedido sugerido copiado correctamente.');
    } catch {
      alert(message);
    }
  }

  function openWhatsApp(provider) {
    const phone = normalizePhone(provider.contact);
    if (!phone) {
      alert('Este proveedor no tiene un número válido para WhatsApp.');
      return;
    }

    const providerProducts = productsForReorder.filter(product => findProviderForProduct(product, providers)?.id === provider.id);
    const message = buildProviderMessage(provider, providerProducts.length > 0 ? providerProducts : []);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  }

  function openEmail(provider) {
    const email = String(provider.email || '').trim();
    if (!email || !email.includes('@')) {
      alert('Este proveedor no tiene un correo válido.');
      return;
    }

    const providerProducts = productsForReorder.filter(product => findProviderForProduct(product, providers)?.id === provider.id);
    const message = buildProviderMessage(provider, providerProducts.length > 0 ? providerProducts : []);
    window.location.href = `mailto:${email}?subject=${encodeURIComponent('Pedido de reposición')}&body=${encodeURIComponent(message)}`;
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard icon={Truck} label="Proveedores" value={providers.length} note="registrados" tone="emerald" />
        <MetricCard icon={Package} label="Reposición" value={productsForReorder.length} note="con mínimo configurado" tone="amber" />
        <MetricCard icon={AlertTriangle} label="Sin proveedor" value={withoutProviderCount} note="por asignar" tone="red" />
        <MetricCard icon={ClipboardList} label="Categorías cubiertas" value={providersWithCategory} note="proveedores con categoría" tone="blue" />
      </section>

      {providersLoading && (
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          Cargando proveedores desde Supabase...
        </div>
      )}

      <section className="rounded-3xl border border-amber-100 bg-amber-50/60 p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-xl font-extrabold text-amber-900">
              <AlertTriangle className="h-5 w-5" /> Proveedores sugeridos para reposición
            </h3>
            <p className="text-sm text-amber-800">
              Solo se muestran productos con stock menor o igual al mínimo y con mínimo mayor a 0.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setReorderFilter('all')}
              className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${reorderFilter === 'all' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white text-amber-800 hover:bg-amber-100'}`}
            >
              Todos ({reorderWithProviderInfo.length})
            </button>
            <button
              type="button"
              onClick={() => setReorderFilter('without-provider')}
              className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${reorderFilter === 'without-provider' ? 'bg-red-600 text-white shadow-sm' : 'bg-white text-red-700 hover:bg-red-50'}`}
            >
              Sin proveedor ({withoutProviderCount})
            </button>
            <button
              type="button"
              onClick={() => setReorderFilter('with-provider')}
              className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${reorderFilter === 'with-provider' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-emerald-700 hover:bg-emerald-50'}`}
            >
              Con proveedor ({withProviderCount})
            </button>
          </div>
        </div>

        {filteredReorderProducts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-amber-200 bg-white p-8 text-center">
            <Package className="mx-auto h-10 w-10 text-amber-500" />
            <h4 className="mt-3 text-lg font-extrabold text-slate-900">No hay productos para reposición</h4>
            <p className="mt-1 text-sm text-slate-500">Configura un stock mínimo mayor a 0 para que aparezcan alertas útiles.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {paginatedReorderProducts.map(({ product, provider }) => {
                const stock = getStock(product);
                const minStock = getMinStock(product);
                const suggestedQuantity = Math.max(minStock - stock, 1);

                return (
                  <article key={product.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-extrabold text-slate-900">{getProductName(product)}</p>
                        <p className="mt-1 text-sm text-slate-500">{getProductCategory(product)}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${stock <= 0 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                        Stock {stock}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Mínimo</p>
                        <p className="font-extrabold text-slate-900">{minStock}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Sugerido</p>
                        <p className="font-extrabold text-slate-900">{suggestedQuantity}</p>
                      </div>
                    </div>

                    <div className={`mt-3 rounded-2xl p-3 text-sm font-bold ${provider ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      Proveedor: {provider ? provider.name : 'Sin proveedor asignado'}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startPurchaseFromSuggestion(product, provider)}
                        disabled={!provider}
                        className="rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                      >
                        Crear compra
                      </button>
                      {!provider && (
                        <button
                          type="button"
                          onClick={() => {
                            updateForm('category', getProductCategory(product));
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="rounded-2xl border border-red-200 bg-white px-3 py-2 text-xs font-extrabold text-red-700 hover:bg-red-50"
                        >
                          Asignar categoría
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-3xl bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="font-semibold text-slate-500">
                Mostrando {reorderStart + 1}-{Math.min(reorderStart + REORDER_PAGE_SIZE, filteredReorderProducts.length)} de {filteredReorderProducts.length} productos
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safeReorderPage <= 1}
                  onClick={() => setReorderPage(page => Math.max(page - 1, 1))}
                  className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" /> Anterior
                </button>
                <span className="rounded-2xl bg-amber-100 px-3 py-2 text-xs font-extrabold text-amber-800">
                  Página {safeReorderPage} de {reorderTotalPages}
                </span>
                <button
                  type="button"
                  disabled={safeReorderPage >= reorderTotalPages}
                  onClick={() => setReorderPage(page => Math.min(page + 1, reorderTotalPages))}
                  className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Siguiente <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[430px_1fr]">
        <form onSubmit={saveProvider} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">{editingProviderId ? 'Editar proveedor' : 'Registrar proveedor'}</h3>
              <p className="text-sm text-slate-500">Asigna una categoría para que InventiQ sugiera reposiciones.</p>
            </div>
            <button type="button" onClick={resetProviderForm} className="rounded-2xl p-2 text-slate-500 hover:bg-slate-50">
              <RotateCcw className="h-5 w-5" />
            </button>
          </div>

          {providerNotice && (
            <div className={`mb-4 rounded-2xl p-4 text-sm font-bold ${providerNotice.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {providerNotice.message}
            </div>
          )}

          <div className="space-y-4">
            <Field label="Nombre del proveedor" value={providerForm.name} onChange={value => updateForm('name', value)} placeholder="Ej. Distribuidora López" required />

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Categoría que abastece</span>
              <input
                list="provider-categories"
                value={providerForm.category || ''}
                onChange={event => updateForm('category', event.target.value)}
                placeholder="Ej. Bebidas, limpieza, ropa..."
                required
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              />
              <datalist id="provider-categories">
                {productCategories.map(category => <option key={category} value={category} />)}
              </datalist>
              <p className="mt-2 text-xs text-slate-400">Debe coincidir con la categoría de los productos para que aparezca como proveedor sugerido.</p>
            </label>

            <Field label="Teléfono / WhatsApp" value={providerForm.contact} onChange={value => updateForm('contact', value)} placeholder="0999999999" />
            <Field label="Correo" type="email" value={providerForm.email} onChange={value => updateForm('email', value)} placeholder="correo@proveedor.com" />
            <Field label="Tiempo de entrega" value={providerForm.delivery} onChange={value => updateForm('delivery', value)} placeholder="Ej. 2 días" />

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Notas</span>
              <textarea
                value={providerForm.notes || ''}
                onChange={event => updateForm('notes', event.target.value)}
                placeholder="Productos, condiciones, horarios de atención..."
                className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>

          <button type="submit" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700">
            {editingProviderId ? <Save className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            {editingProviderId ? 'Guardar cambios' : 'Guardar proveedor'}
          </button>
        </form>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">Proveedores registrados</h3>
                <p className="text-sm text-slate-500">Busca, edita o contacta proveedores.</p>
              </div>
              <div className="relative w-full lg:w-80">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  value={providerSearch}
                  onChange={event => setProviderSearch(event.target.value)}
                  placeholder="Buscar proveedor..."
                  className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>
          </div>

          {filteredProviders.length === 0 ? (
            <div className="p-8 text-center">
              <Truck className="mx-auto h-10 w-10 text-slate-300" />
              <h4 className="mt-3 text-lg font-extrabold text-slate-900">No hay proveedores para mostrar</h4>
              <p className="text-sm text-slate-500">Registra proveedores y asígnalos a categorías para mejorar reposición.</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-100">
                {paginatedProviders.map(provider => {
                  const categoryProducts = productsForReorder.filter(product => findProviderForProduct(product, providers)?.id === provider.id);
                  const isDeleting = pendingDeleteProviderId === provider.id;

                  return (
                    <article key={provider.id} className="p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-lg font-extrabold text-slate-900">{provider.name}</h4>
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">{provider.category || 'Sin categoría'}</span>
                            {categoryProducts.length > 0 && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700">{categoryProducts.length} por reponer</span>}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                            <span className="inline-flex items-center gap-1"><Phone className="h-4 w-4" /> {provider.contact || 'Sin teléfono'}</span>
                            <span className="inline-flex items-center gap-1"><Mail className="h-4 w-4" /> {provider.email || 'Sin correo'}</span>
                            <span className="inline-flex items-center gap-1"><Truck className="h-4 w-4" /> {provider.delivery || 'Entrega no definida'}</span>
                          </div>
                          {provider.notes && <p className="mt-2 text-sm text-slate-400">{provider.notes}</p>}
                        </div>

                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          <button type="button" onClick={() => copyOrderForProvider(provider)} className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-50">Copiar pedido</button>
                          <button type="button" onClick={() => openWhatsApp(provider)} className="rounded-2xl border border-emerald-200 px-3 py-2 text-xs font-extrabold text-emerald-700 hover:bg-emerald-50">WhatsApp</button>
                          <button type="button" onClick={() => openEmail(provider)} className="rounded-2xl border border-blue-200 px-3 py-2 text-xs font-extrabold text-blue-700 hover:bg-blue-50">Correo</button>
                          <button type="button" onClick={() => editProvider(provider)} className="rounded-2xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><Edit className="h-4 w-4" /></button>
                          {isDeleting ? (
                            <div className="flex gap-2">
                              <button type="button" onClick={() => deleteProvider(provider.id)} className="rounded-2xl bg-red-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-red-700">Confirmar</button>
                              <button type="button" onClick={() => setPendingDeleteProviderId(null)} className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-50">Cancelar</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setPendingDeleteProviderId(provider.id)} className="rounded-2xl border border-red-200 p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {filteredProviders.length > PROVIDER_PAGE_SIZE && (
                <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-semibold text-slate-500">Mostrando {providerStart + 1}-{Math.min(providerStart + PROVIDER_PAGE_SIZE, filteredProviders.length)} de {filteredProviders.length} proveedores</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={safeProviderPage <= 1}
                      onClick={() => setProviderPage(page => Math.max(page - 1, 1))}
                      className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" /> Anterior
                    </button>
                    <span className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-extrabold text-slate-700">Página {safeProviderPage} de {providerTotalPages}</span>
                    <button
                      type="button"
                      disabled={safeProviderPage >= providerTotalPages}
                      onClick={() => setProviderPage(page => Math.min(page + 1, providerTotalPages))}
                      className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Siguiente <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </section>
    </div>
  );
}
