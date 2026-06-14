import { useMemo, useState } from 'react';
import {
  Coffee,
  CreditCard,
  DollarSign,
  Minus,
  Package,
  Plus,
  ReceiptText,
  RefreshCcw,
  Search,
  ShoppingCart,
  Trash2,
} from 'lucide-react';

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getCategoryLabel(category) {
  return String(category || 'Sin categoría').replace(/^Menú -\s*/i, '').replace(/^Insumos -\s*/i, '');
}

function getPaymentLabel(value) {
  const labels = {
    Efectivo: 'Efectivo',
    Transferencia: 'Transferencia',
    Tarjeta: 'Tarjeta',
    Crédito: 'Crédito',
  };

  return labels[value] || value || 'Efectivo';
}

export default function FoodSalesPage({
  sales,
  products,
  saleForm,
  setSaleForm,
  saleCart,
  setSaleCart,
  addSaleItem,
  removeSaleItem,
  clearSaleCart,
  registerSale,
  resetSaleForm,
  cancelSale,
  totalSales,
  totalProfit,
  totalDiscount,
  totalUnitsSold,
  saleNotice,
  salePreview,
  salesLoading,
  setReceiptSale,
}) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  const completedSales = useMemo(
    () => sales.filter(sale => sale.status !== 'Anulada'),
    [sales]
  );

  const recentSales = useMemo(
    () => completedSales.slice(0, 6),
    [completedSales]
  );

  const menuProducts = useMemo(() => {
    return products.filter(product => {
      const category = String(product.category || '').toLowerCase();
      const name = String(product.name || '').toLowerCase();
      const isIngredient = category.includes('insumos') || name.includes('insumo');
      return !isIngredient;
    });
  }, [products]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(
      menuProducts
        .map(product => product.category)
        .filter(Boolean)
    ));

    return ['Todos', ...unique];
  }, [menuProducts]);

  const filteredProducts = useMemo(() => {
    const text = search.trim().toLowerCase();

    return menuProducts.filter(product => {
      const matchCategory = selectedCategory === 'Todos' || product.category === selectedCategory;
      const matchSearch = !text || [
        product.name,
        product.category,
        product.sku,
        product.barcode,
        product.brand,
        product.size,
        product.color,
      ].some(value => String(value || '').toLowerCase().includes(text));

      return matchCategory && matchSearch;
    });
  }, [menuProducts, selectedCategory, search]);

  function updateSaleField(field, value) {
    setSaleForm(prev => ({ ...prev, [field]: value }));
  }

  function addProductToOrder(product) {
    if (Number(product.stock || 0) <= 0) return;
    addSaleItem(product.id, 1);
  }

  function decreaseCartItem(item) {
    if (typeof setSaleCart !== 'function') {
      removeSaleItem(item.productId);
      return;
    }

    setSaleCart(prevCart => {
      const currentItem = prevCart.find(current => String(current.productId) === String(item.productId));

      if (!currentItem) return prevCart;

      const nextQuantity = Number(currentItem.quantity || 0) - 1;

      if (nextQuantity <= 0) {
        return prevCart.filter(current => String(current.productId) !== String(item.productId));
      }

      return prevCart.map(current => {
        if (String(current.productId) !== String(item.productId)) return current;

        return {
          ...current,
          quantity: nextQuantity,
          subtotal: Number(current.price || 0) * nextQuantity,
          profit: (Number(current.price || 0) - Number(current.cost || 0)) * nextQuantity,
        };
      });
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-600">Cafetería / restaurante</p>
            <h3 className="mt-2 flex items-center gap-3 text-3xl font-black text-slate-900">
              <Coffee className="h-8 w-8 text-emerald-600" /> Caja rápida
            </h3>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Registra pedidos de forma rápida con botones de menú, carrito y métodos de pago.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
            <FoodMetric title="Ventas" value={formatMoney(totalSales)} />
            <FoodMetric title="Utilidad" value={formatMoney(totalProfit)} />
            <FoodMetric title="Unidades" value={totalUnitsSold} />
            <FoodMetric title="Descuentos" value={formatMoney(totalDiscount)} />
          </div>
        </div>
      </section>

      {saleNotice && (
        <div className={`rounded-3xl p-4 text-sm font-bold ${saleNotice.type === 'success' ? 'border border-emerald-100 bg-emerald-50 text-emerald-700' : 'border border-red-100 bg-red-50 text-red-700'}`}>
          {saleNotice.message}
        </div>
      )}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h4 className="text-xl font-black text-slate-900">Menú</h4>
                <p className="text-sm text-slate-500">Selecciona productos para agregarlos al pedido.</p>
              </div>

              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Buscar en el menú..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
              {categories.map(category => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-black transition ${
                    selectedCategory === category
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-100'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {category === 'Todos' ? 'Todos' : getCategoryLabel(category)}
                </button>
              ))}
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
              <Package className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              No hay productos del menú para mostrar.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredProducts.map(product => {
                const disabled = Number(product.stock || 0) <= 0;

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProductToOrder(product)}
                    disabled={disabled}
                    className="group rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-slate-200 disabled:hover:shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="h-16 w-16 rounded-2xl object-cover ring-1 ring-slate-100"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                          <Coffee className="h-7 w-7" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-black text-slate-900">{product.name}</p>
                        <p className="mt-1 text-xs font-bold text-slate-400">{getCategoryLabel(product.category)}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xl font-black text-emerald-700">{formatMoney(product.price)}</p>
                        <p className="text-xs text-slate-400">Stock: {product.stock}</p>
                      </div>
                      <span className="rounded-2xl bg-emerald-600 p-3 text-white transition group-hover:bg-emerald-700">
                        <Plus className="h-5 w-5" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <form onSubmit={registerSale} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h4 className="flex items-center gap-2 text-xl font-black text-slate-900">
                  <ShoppingCart className="h-5 w-5 text-emerald-600" /> Pedido
                </h4>
                <p className="text-sm text-slate-500">Productos seleccionados para cobrar.</p>
              </div>
              {saleCart.length > 0 && (
                <button
                  type="button"
                  onClick={clearSaleCart}
                  className="rounded-xl border border-red-100 p-2 text-red-500 hover:bg-red-50"
                  title="Vaciar pedido"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {saleCart.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                Agrega productos del menú para iniciar un pedido.
              </div>
            ) : (
              <div className="space-y-3">
                {saleCart.map(item => (
                  <div key={item.productId} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">{item.product}</p>
                        <p className="text-xs text-slate-500">{item.quantity} x {formatMoney(item.price)}</p>
                      </div>
                      <p className="text-sm font-black text-emerald-700">{formatMoney(item.subtotal)}</p>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => decreaseCartItem(item)}
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-8 text-center text-sm font-black text-slate-700">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => addSaleItem(item.productId, 1)}
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeSaleItem(item.productId)}
                        className="rounded-xl border border-red-100 bg-white px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 space-y-3 rounded-3xl border border-slate-100 bg-slate-50 p-4">
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">Método de pago</span>
                <select
                  value={saleForm.paymentMethod || 'Efectivo'}
                  onChange={event => updateSaleField('paymentMethod', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Crédito">Crédito</option>
                </select>
              </label>

              <div className="grid grid-cols-[1fr_130px] gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">Descuento</span>
                  <input
                    type="number"
                    min="0"
                    value={saleForm.discount || ''}
                    onChange={event => updateSaleField('discount', event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="0"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">Tipo</span>
                  <select
                    value={saleForm.discountType || 'percent'}
                    onChange={event => updateSaleField('discountType', event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="percent">%</option>
                    <option value="fixed">$</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-5 rounded-3xl bg-slate-900 p-5 text-white">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Subtotal</span>
                <span>{formatMoney(salePreview.subtotal)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-slate-300">
                <span>Descuento</span>
                <span>-{formatMoney(salePreview.discount)}</span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                <span className="text-lg font-black">Total</span>
                <span className="text-3xl font-black text-emerald-300">{formatMoney(salePreview.total)}</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">Pago: {getPaymentLabel(saleForm.paymentMethod)}</p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={resetSaleForm}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-50"
              >
                Reiniciar
              </button>
              <button
                type="submit"
                disabled={saleCart.length === 0 || salesLoading}
                className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cobrar pedido
              </button>
            </div>
          </form>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h4 className="flex items-center gap-2 text-lg font-black text-slate-900">
                  <ReceiptText className="h-5 w-5 text-emerald-600" /> Ventas recientes
                </h4>
                <p className="text-sm text-slate-500">Últimos pedidos cobrados.</p>
              </div>
            </div>

            {recentSales.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
                Sin ventas recientes.
              </div>
            ) : (
              <div className="space-y-3">
                {recentSales.map(sale => (
                  <div key={sale.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">{sale.code || 'Venta'}</p>
                        <p className="text-xs text-slate-500">{sale.product || 'Pedido'} · {sale.paymentMethod}</p>
                      </div>
                      <p className="text-sm font-black text-emerald-700">{formatMoney(sale.total)}</p>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setReceiptSale(sale)}
                        className="rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                      >
                        Recibo
                      </button>
                      <button
                        type="button"
                        onClick={() => cancelSale(sale.id)}
                        className="rounded-xl border border-red-100 bg-white px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50"
                      >
                        Anular
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

function FoodMetric({ title, value }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-1 text-xl font-black text-slate-900">{value}</p>
    </div>
  );
}
