import { useEffect, useMemo, useState } from 'react';
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
import { supabase } from '../supabaseClient';

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

function getOrderTypeLabel(value) {
  const labels = {
    local: 'En local',
    takeaway: 'Para llevar',
    delivery: 'Delivery',
  };

  return labels[value || 'local'] || 'En local';
}

function getBaseCartName(item) {
  return item.baseProduct || item.product || 'Producto';
}

function rebuildCartItemWithModifiers(item, nextModifiers) {
  const basePrice = Number(item.basePrice ?? item.price ?? 0);
  const modifierTotal = nextModifiers.reduce((sum, modifier) => sum + Number(modifier.price || 0), 0);
  const nextPrice = basePrice + modifierTotal;
  const quantity = Number(item.quantity || 0);
  const baseName = getBaseCartName(item);
  const modifierText = nextModifiers.map(modifier => modifier.name).join(', ');

  return {
    ...item,
    baseProduct: baseName,
    basePrice,
    modifiers: nextModifiers,
    product: modifierText ? `${baseName} (${modifierText})` : baseName,
    price: nextPrice,
    subtotal: nextPrice * quantity,
    profit: (nextPrice - Number(item.cost || 0)) * quantity,
  };
}

export default function FoodSalesPage({
  currentUser,
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
  const [modifiers, setModifiers] = useState([]);
  const [modifierForm, setModifierForm] = useState({ name: '', price: '' });
  const [modifierNotice, setModifierNotice] = useState(null);
  const [modifiersLoading, setModifiersLoading] = useState(false);
  const [extrasManagerOpen, setExtrasManagerOpen] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) return;
    loadModifiers();
  }, [currentUser?.id]);

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

  async function loadModifiers() {
    try {
      setModifiersLoading(true);
      setModifierNotice(null);

      const { data, error } = await supabase
        .from('food_modifiers')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setModifiers(data || []);
    } catch (error) {
      console.error('Error cargando extras:', error);
      setModifierNotice({ type: 'error', message: `No se pudieron cargar los extras: ${error.message}` });
    } finally {
      setModifiersLoading(false);
    }
  }

  async function saveModifier() {
    const name = modifierForm.name.trim();
    const price = Number(modifierForm.price || 0);

    if (!name) {
      setModifierNotice({ type: 'error', message: 'Escribe el nombre del extra.' });
      return;
    }

    if (Number.isNaN(price) || price < 0) {
      setModifierNotice({ type: 'error', message: 'El precio del extra no puede ser negativo.' });
      return;
    }

    try {
      setModifierNotice(null);

      const { data, error } = await supabase
        .from('food_modifiers')
        .insert({
          user_id: currentUser.id,
          name,
          price,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setModifiers(prev => [...prev, data]);
      setModifierForm({ name: '', price: '' });
      setModifierNotice({ type: 'success', message: 'Extra agregado correctamente.' });
    } catch (error) {
      console.error('Error guardando extra:', error);
      setModifierNotice({ type: 'error', message: `No se pudo guardar el extra: ${error.message}` });
    }
  }

  async function deleteModifier(modifierId) {
    try {
      setModifierNotice(null);

      const { error } = await supabase
        .from('food_modifiers')
        .update({ is_active: false })
        .eq('id', modifierId)
        .eq('user_id', currentUser.id);

      if (error) throw error;

      setModifiers(prev => prev.filter(modifier => modifier.id !== modifierId));
      setModifierNotice({ type: 'success', message: 'Extra eliminado.' });
    } catch (error) {
      console.error('Error eliminando extra:', error);
      setModifierNotice({ type: 'error', message: `No se pudo eliminar el extra: ${error.message}` });
    }
  }

  function addModifierToItem(item, modifier) {
    if (typeof setSaleCart !== 'function') return;

    setSaleCart(prevCart => prevCart.map(current => {
      if (String(current.productId) !== String(item.productId)) return current;

      const currentModifiers = Array.isArray(current.modifiers) ? current.modifiers : [];
      const nextModifiers = [...currentModifiers, modifier];
      return rebuildCartItemWithModifiers(current, nextModifiers);
    }));
  }

  function removeModifierFromItem(item, modifierIndex) {
    if (typeof setSaleCart !== 'function') return;

    setSaleCart(prevCart => prevCart.map(current => {
      if (String(current.productId) !== String(item.productId)) return current;

      const currentModifiers = Array.isArray(current.modifiers) ? current.modifiers : [];
      const nextModifiers = currentModifiers.filter((_, index) => index !== modifierIndex);
      return rebuildCartItemWithModifiers(current, nextModifiers);
    }));
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

            <div className="mb-4 rounded-3xl border border-amber-100 bg-amber-50 p-4">
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-amber-700">Tipo de pedido</span>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'local', label: 'En local' },
                  { value: 'takeaway', label: 'Para llevar' },
                  { value: 'delivery', label: 'Delivery' },
                ].map(option => {
                  const active = (saleForm.orderType || 'local') === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateSaleField('orderType', option.value)}
                      className={`rounded-2xl px-3 py-2 text-xs font-black transition ${active ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">
                    {(saleForm.orderType || 'local') === 'local' ? 'Mesa / número' : (saleForm.orderType || 'local') === 'delivery' ? 'Cliente / entrega' : 'Nombre del pedido'}
                  </span>
                  <input
                    value={saleForm.orderReference || ''}
                    onChange={event => updateSaleField('orderReference', event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder={(saleForm.orderType || 'local') === 'local' ? 'Ej: Mesa 3' : (saleForm.orderType || 'local') === 'delivery' ? 'Ej: Diego / dirección' : 'Ej: Juan'}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">Nota rápida</span>
                  <input
                    value={saleForm.orderNotes || ''}
                    onChange={event => updateSaleField('orderNotes', event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="Ej: sin azúcar, sin hielo, calentar"
                  />
                </label>
              </div>
            </div>

            <div className="mb-4 rounded-3xl border border-emerald-100 bg-emerald-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Extras del cliente</p>
                  <p className="truncate text-xs text-emerald-700/80">
                    {modifiersLoading ? 'Cargando extras...' : `${modifiers.length} extra(s) creados`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setExtrasManagerOpen(open => !open)}
                  className="shrink-0 rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700"
                >
                  {extrasManagerOpen ? 'Cerrar' : '+ Extra'}
                </button>
              </div>

              {extrasManagerOpen && (
                <div className="mt-3 rounded-2xl bg-white p-3">
                  {modifierNotice && (
                    <div className={`mb-3 rounded-2xl p-3 text-xs font-bold ${modifierNotice.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {modifierNotice.message}
                    </div>
                  )}

                  <div className="grid grid-cols-[1fr_88px_42px] gap-2">
                    <input
                      value={modifierForm.name}
                      onChange={event => setModifierForm(prev => ({ ...prev, name: event.target.value }))}
                      className="min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-100"
                      placeholder="Ej: Leche de almendra"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={modifierForm.price}
                      onChange={event => setModifierForm(prev => ({ ...prev, price: event.target.value }))}
                      className="min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-100"
                      placeholder="0.00"
                    />
                    <button
                      type="button"
                      onClick={saveModifier}
                      className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-lg font-black text-white hover:bg-emerald-700"
                      title="Guardar extra"
                    >
                      +
                    </button>
                  </div>

                  {modifiers.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {modifiers.map(modifier => (
                        <span key={modifier.id} className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-1 text-xs font-black text-slate-600">
                          {modifier.name} · {formatMoney(modifier.price)}
                          <button
                            type="button"
                            onClick={() => deleteModifier(modifier.id)}
                            className="text-red-500 hover:text-red-600"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
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

                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">Extras rápidos</p>
                      {modifiers.length === 0 ? (
                        <p className="text-xs text-slate-400">Aún no hay extras creados para este negocio.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {modifiers.map(modifier => (
                          <button
                            key={modifier.id}
                            type="button"
                            onClick={() => addModifierToItem(item, modifier)}
                            className="rounded-xl border border-emerald-100 bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700 hover:bg-emerald-100"
                          >
                            + {modifier.name} {modifier.price > 0 ? formatMoney(modifier.price) : ''}
                          </button>
                          ))}
                        </div>
                      )}

                      {Array.isArray(item.modifiers) && item.modifiers.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {item.modifiers.map((modifier, modifierIndex) => (
                            <div key={`${modifier.id}-${modifierIndex}`} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-2 py-1 text-xs text-slate-600">
                              <span>{modifier.name} · {formatMoney(modifier.price)}</span>
                              <button
                                type="button"
                                onClick={() => removeModifierFromItem(item, modifierIndex)}
                                className="font-black text-red-500 hover:text-red-600"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
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
              <p className="mt-2 text-xs text-slate-400">Pedido: {getOrderTypeLabel(saleForm.orderType)} · Pago: {getPaymentLabel(saleForm.paymentMethod)}</p>
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
                        <p className="text-xs text-slate-500">{sale.customer || sale.product || 'Pedido'} · {sale.paymentMethod}</p>
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
