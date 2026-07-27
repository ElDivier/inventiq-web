import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, DollarSign, Truck, RotateCcw, Search, Camera, Trash2 } from 'lucide-react';
import Field from '../components/Field';
import Metric from '../components/Metric';
import EmptyState from '../components/EmptyState';
import BarcodeScanner from '../components/BarcodeScanner';
import { filterProductsForBarcodeSearch, productMatchesExactCode } from '../utils/productSearch';
import { PRODUCT_SEARCH_LIMIT } from '../config/constants';
import { getProductDisplayName } from '../utils/products';
import { normalizeEcuadorPhone, buildProviderOrder } from '../utils/providers';

function PurchasesPage({ purchases, products, providers, purchaseForm, setPurchaseForm, purchaseCart, addPurchaseItem, removePurchaseItem, clearPurchaseCart, registerPurchase, resetPurchaseForm, purchaseNotice, purchasesLoading }) {
  const [productSearch, setProductSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [purchasePage, setPurchasePage] = useState(1);
  const selectedProduct = products.find(product => String(product.id) === String(purchaseForm.productId));
  const filteredProducts = useMemo(
    () => filterProductsForBarcodeSearch(products, productSearch, { limit: PRODUCT_SEARCH_LIMIT }),
    [products, productSearch]
  );
  const suggestedProvider = selectedProduct ? providers.find(provider => String(provider.category || '').toLowerCase() === String(selectedProduct.category || '').toLowerCase()) : null;
  const quantity = Number(purchaseForm.quantity || 0);
  const unitCost = Number(purchaseForm.unitCost || selectedProduct?.cost || 0);
  const lineTotal = quantity > 0 && unitCost >= 0 ? quantity * unitCost : 0;
  const total = purchaseCart.reduce((sum, item) => sum + item.total, 0);
  const purchasesPerPage = 20;
  const purchaseTotalPages = Math.max(Math.ceil(purchases.length / purchasesPerPage), 1);
  const safePurchasePage = Math.min(purchasePage, purchaseTotalPages);
  const purchaseStartIndex = (safePurchasePage - 1) * purchasesPerPage;
  const paginatedPurchases = purchases.slice(purchaseStartIndex, purchaseStartIndex + purchasesPerPage);

  useEffect(() => {
    setPurchasePage(1);
  }, [purchases.length]);

  function handleProductSearch(value) {
    setProductSearch(value);
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return;

    const exactProduct = products.find(product => productMatchesExactCode(product, normalized));

    if (exactProduct) {
      selectProduct(exactProduct.id);
    }
  }

  function selectProduct(productId) {
    const product = products.find(item => String(item.id) === String(productId));
    const provider = product ? providers.find(item => String(item.category || '').toLowerCase() === String(product.category || '').toLowerCase()) : null;

    setPurchaseForm(prev => ({
      ...prev,
      productId,
      providerId: provider?.id || '',
      unitCost: product?.cost || '',
    }));
  }

  async function copyProviderOrder(provider) {
    const { message } = buildProviderOrder(provider, products);
    try {
      await navigator.clipboard.writeText(message);
      alert('Pedido sugerido copiado correctamente.');
    } catch {
      alert(message);
    }
  }

  function openProviderWhatsApp(provider) {
    const phone = normalizeEcuadorPhone(provider.contact);
    const { message } = buildProviderOrder(provider, products);

    if (!phone) {
      alert('Este proveedor no tiene un número válido para WhatsApp.');
      return;
    }

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  }

  function openProviderEmail(provider) {
    const email = String(provider.email || '').trim();
    const { message } = buildProviderOrder(provider, products);

    if (!email.includes('@')) {
      alert('Este proveedor no tiene un correo válido.');
      return;
    }

    window.location.href = `mailto:${email}?subject=${encodeURIComponent('Pedido de reposición')}&body=${encodeURIComponent(message)}`;
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3">
        <Metric icon={ClipboardList} label="Compras registradas" value={purchases.length} note="historial" color="emerald" />
        <Metric icon={DollarSign} label="Total comprado" value={`$${purchases.reduce((sum, item) => sum + item.total, 0).toFixed(2)}`} note="inversión" color="blue" />
        <Metric icon={Truck} label="Proveedores" value={providers.length} note="registrados" color="amber" />
      </section>

      {purchasesLoading && <div className="rounded-2xl bg-cyan-50 p-4 text-sm font-semibold text-cyan-800">Cargando compras desde Supabase...</div>}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_430px]">
        <section className="order-2 iq-operation-card xl:order-1">
          <div className="border-b border-slate-100 p-5">
            <h3 className="flex items-center gap-2 text-xl font-bold"><ClipboardList className="h-5 w-5 text-cyan-700" /> Historial de compras</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {purchases.length === 0 && <div className="p-5"><EmptyState icon={ClipboardList} title="Aún no tienes compras" text="Registra tu primera compra para aumentar stock y controlar mejor tus proveedores." /></div>}
            {paginatedPurchases.map(purchase => (
              <div key={purchase.id} className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-bold text-slate-900">{purchase.code}</p>
                  <p className="text-sm text-slate-500">{purchase.product} · {purchase.quantity} unidades · {purchase.date}</p>
                  <p className="text-xs text-slate-400">Proveedor: {purchase.provider} {purchase.note ? `· ${purchase.note}` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">${purchase.total.toFixed(2)}</p>
                  <p className="text-xs text-slate-500">Costo unitario: ${purchase.unitCost.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
          {purchases.length > purchasesPerPage && (
            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>Mostrando {purchaseStartIndex + 1}-{Math.min(purchaseStartIndex + purchasesPerPage, purchases.length)} de {purchases.length} compras</span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={safePurchasePage <= 1} onClick={() => setPurchasePage(page => Math.max(page - 1, 1))} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
                <span className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">Página {safePurchasePage} de {purchaseTotalPages}</span>
                <button type="button" disabled={safePurchasePage >= purchaseTotalPages} onClick={() => setPurchasePage(page => Math.min(page + 1, purchaseTotalPages))} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button>
              </div>
            </div>
          )}
        </section>

        <form onSubmit={registerPurchase} className="order-1 iq-operation-card iq-operation-card-accent iq-sticky-workspace p-6 xl:order-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Registrar compra</h3>
              <p className="text-sm text-slate-500">Agrega varios productos y registra una sola compra.</p>
            </div>
            <button type="button" onClick={resetPurchaseForm} className="rounded-xl p-2 text-slate-500 hover:bg-slate-50"><RotateCcw className="h-5 w-5" /></button>
          </div>

          {purchaseNotice && (
            <div className={`mb-4 rounded-2xl p-4 text-sm font-semibold ${purchaseNotice.type === 'success' ? 'bg-cyan-50 text-cyan-800' : 'bg-red-50 text-red-700'}`}>
              {purchaseNotice.message}
            </div>
          )}

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Buscar producto comprado</span>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <input value={productSearch} onChange={e => handleProductSearch(e.target.value)} onFocus={event => event.target.select()} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-cyan-200" placeholder="Buscar o escanear código de barras..." />
              </div>
              <button type="button" onClick={() => setScannerOpen(true)} className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-200 px-4 py-3 text-sm font-bold text-cyan-800 hover:bg-cyan-50">
                <Camera className="h-4 w-4" /> Escanear con cámara
              </button>
              {scannerOpen && <BarcodeScanner onScan={handleProductSearch} onClose={() => setScannerOpen(false)} />}
              {productSearch && filteredProducts.length > 0 && (
                <div className="mb-3 max-h-56 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-2 shadow-sm">
                  {filteredProducts.slice(0, 8).map(product => (
                    <button
                      type="button"
                      key={product.id}
                      onClick={() => {
                        selectProduct(product.id);
                        setProductSearch(getProductDisplayName(product));
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm hover:bg-cyan-50"
                    >
                      <span>
                        <strong className="text-slate-900">{getProductDisplayName(product)}</strong>
                        <span className="block text-xs text-slate-500">{product.sku || 'Sin SKU'} · {product.category}</span>
                      </span>
                      <span className="text-xs font-bold text-cyan-800">Stock {product.stock}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedProduct ? (
                <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-cyan-800">Producto seleccionado</p>
                      <p className="mt-1 font-bold text-cyan-950">{getProductDisplayName(selectedProduct)}</p>
                      <p className="text-sm text-cyan-900">{selectedProduct.sku || 'Sin SKU'} · {selectedProduct.category} · Stock actual {selectedProduct.stock}</p>
                    </div>
                    <button type="button" onClick={() => { setPurchaseForm({ ...purchaseForm, productId: '', unitCost: '' }); setProductSearch(''); }} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-cyan-800 hover:bg-cyan-100">Cambiar</button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Busca y selecciona un producto para agregarlo a la compra.</div>
              )}
              {productSearch && <p className="mt-2 text-xs text-slate-500">Mostrando máximo {PRODUCT_SEARCH_LIMIT} resultado(s). Escribe al menos 2 letras o escanea el código.</p>}
            </label>

            {selectedProduct && (
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-bold">{getProductDisplayName(selectedProduct)}</p>
                <p className="text-sm text-slate-500">Categoría: {selectedProduct.category} · Stock actual: {selectedProduct.stock}</p>
                {suggestedProvider && <p className="mt-2 text-sm font-semibold text-cyan-800">Proveedor sugerido: {suggestedProvider.name}</p>}
              </div>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Proveedor</span>
              <select value={purchaseForm.providerId} onChange={e => setPurchaseForm({ ...purchaseForm, providerId: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-200">
                <option value="">Sin proveedor / compra directa</option>
                {providers.map(provider => <option key={provider.id} value={provider.id}>{provider.name} · {provider.category}</option>)}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Cantidad" type="number" min="1" value={purchaseForm.quantity} onChange={v => setPurchaseForm({ ...purchaseForm, quantity: v })} placeholder="1" />
              <Field label="Costo unitario" type="number" min="0" step="0.01" value={purchaseForm.unitCost} onChange={v => setPurchaseForm({ ...purchaseForm, unitCost: v })} placeholder="0.00" />
            </div>

            <button type="button" onClick={addPurchaseItem} className="iq-primary-button w-full">Agregar a la compra</button>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-bold text-slate-800">Carrito de compra</h4>
                {purchaseCart.length > 0 && <button type="button" onClick={clearPurchaseCart} className="text-xs font-bold text-red-500 hover:underline">Vaciar</button>}
              </div>
              {purchaseCart.length === 0 && <p className="text-sm text-slate-500">Todavía no agregas productos.</p>}
              <div className="space-y-2">
                {purchaseCart.map(item => (
                  <div key={item.productId} className="flex items-center justify-between rounded-2xl bg-white p-3 text-sm shadow-sm">
                    <div>
                      <p className="font-bold text-slate-900">{item.product}</p>
                      <p className="text-xs text-slate-500">{item.quantity} x ${item.unitCost.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-cyan-800">${item.total.toFixed(2)}</p>
                      <button type="button" onClick={() => removePurchaseItem(item.productId)} className="rounded-xl border border-red-100 p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Nota</span>
              <textarea value={purchaseForm.note} onChange={e => setPurchaseForm({ ...purchaseForm, note: e.target.value })} className="min-h-20 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-200" placeholder="Factura, pedido, observaciones..." />
            </label>

            <div className="iq-total-highlight">
              <p className="text-sm text-cyan-800">Total de compra</p>
              <p className="text-3xl font-extrabold text-cyan-950">${total.toFixed(2)}</p>
            </div>

            <button type="submit" className="iq-primary-button w-full">Registrar compra</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default PurchasesPage;
