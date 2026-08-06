import { useEffect, useMemo, useState } from 'react';
import {
  Clock,
  Coffee,
  Grid2X2,
  Minus,
  Package,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  Trash2,
  Users,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { isInternalStockCategory } from '../config/productTypes';
import {
  getRestaurantStatusMeta,
  isRestaurantMenuProduct,
  normalizeRestaurantProductMetadata,
} from '../utils/restaurantMenu';
import {
  RESTAURANT_TABLE_STATUSES,
  fetchRestaurantFloor,
  getOpenDurationLabel,
  getRestaurantTableStatusMeta as getTableStatusMeta,
  openRestaurantTable,
  subscribeRestaurantFloor,
  updateRestaurantTableService,
} from '../utils/restaurantTables';

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


function hasActiveRecipe(product) {
  return Boolean(product?.recipeEnabled || product?.recipe_enabled);
}

function isMenuProductAvailable(product, orderType = 'local', isRestaurant = false) {
  if (isRestaurant) {
    if (!isRestaurantMenuProduct(product)) return false;
    const metadata = normalizeRestaurantProductMetadata(product?.productMetadata || product?.product_metadata);
    if (metadata.menuStatus === 'paused') return false;
    if (metadata.orderChannels.length > 0 && !metadata.orderChannels.includes(orderType)) return false;
  }

  return hasActiveRecipe(product) || Number(product?.stock || 0) > 0;
}


function getRestaurantStockLabel(product) {
  if (hasActiveRecipe(product)) {
    return 'Stock por receta';
  }

  return `Stock: ${product.stock}`;
}




function getFoodSalesCopy(isRestaurant) {
  if (isRestaurant) {
    return {
      eyebrow: 'Restaurante',
      title: 'Nueva orden',
      description: 'Gestiona mesas, órdenes para llevar y delivery con menú, carrito, acompañantes y cobro en una sola pantalla.',
      metrics: {
        sales: 'Órdenes',
        profit: 'Utilidad',
        units: 'Platos',
        discounts: 'Descuentos',
      },
      menuTitle: 'Menú del restaurante',
      menuSubtitle: 'Selecciona platos, bebidas o combos para agregarlos a la orden.',
      menuSearchPlaceholder: 'Buscar plato, bebida o combo...',
      emptyMenu: 'No hay platos del menú para mostrar.',
      orderTitle: 'Orden actual',
      orderSubtitle: 'Define mesa, tipo de consumo, platos y forma de pago.',
      orderTypeTitle: 'Tipo de orden',
      orderTypes: [
        { value: 'local', label: 'Mesa' },
        { value: 'takeaway', label: 'Para llevar' },
        { value: 'delivery', label: 'Delivery' },
      ],
      orderTypeLabels: {
        local: 'Mesa',
        takeaway: 'Para llevar',
        delivery: 'Delivery',
      },
      getReferenceLabel(orderType) {
        if (orderType === 'delivery') return 'Cliente / entrega';
        if (orderType === 'takeaway') return 'Nombre del pedido';
        return 'Mesa / número';
      },
      getReferencePlaceholder(orderType) {
        if (orderType === 'delivery') return 'Ej: Diego / dirección';
        if (orderType === 'takeaway') return 'Ej: Pedido Juan';
        return 'Ej: Mesa 3';
      },
      notesLabel: 'Indicaciones de cocina',
      notesPlaceholder: 'Ej: sin cebolla, término medio, servir primero bebidas',
      modifiersTitle: 'Extras y acompañantes',
      quickModifiersTitle: 'Acompañantes rápidos',
      modifierPlaceholder: 'Ej: Porción de arroz',
      submitLabel: 'Cobrar orden',
      totalSummaryLabel: 'Orden',
      recentTitle: 'Órdenes cobradas',
      recentSubtitle: 'Últimas órdenes cerradas.',
      emptyRecent: 'Sin órdenes recientes.',
    };
  }

  return {
    eyebrow: 'Cafetería',
    title: 'Caja rápida',
    description: '{copy.description}',
    metrics: {
      sales: 'Ventas',
      profit: 'Utilidad',
      units: 'Unidades',
      discounts: 'Descuentos',
    },
    menuTitle: 'Menú',
    menuSubtitle: 'Selecciona productos para agregarlos al pedido.',
    menuSearchPlaceholder: 'Buscar en el menú...',
    emptyMenu: '{copy.emptyMenu}',
    orderTitle: 'Pedido',
    orderSubtitle: 'Productos seleccionados para cobrar.',
    orderTypeTitle: 'Tipo de pedido',
    orderTypes: [
      { value: 'local', label: 'En local' },
      { value: 'takeaway', label: 'Para llevar' },
      { value: 'delivery', label: 'Delivery' },
    ],
    orderTypeLabels: {
      local: 'En local',
      takeaway: 'Para llevar',
      delivery: 'Delivery',
    },
    getReferenceLabel(orderType) {
      if (orderType === 'delivery') return 'Cliente / entrega';
      if (orderType === 'takeaway') return 'Nombre del pedido';
      return 'Mesa / número';
    },
    getReferencePlaceholder(orderType) {
      if (orderType === 'delivery') return 'Ej: Diego / dirección';
      if (orderType === 'takeaway') return 'Ej: Juan';
      return 'Ej: Mesa 3';
    },
    notesLabel: 'Nota rápida',
    notesPlaceholder: 'Ej: sin azúcar, sin hielo, calentar',
    modifiersTitle: '{copy.modifiersTitle}',
    quickModifiersTitle: '{copy.quickModifiersTitle}',
    modifierPlaceholder: 'Ej: Leche de almendra',
    submitLabel: '{copy.submitLabel}',
    totalSummaryLabel: 'Pedido',
    recentTitle: 'Ventas recientes',
    recentSubtitle: 'Últimos pedidos cobrados.',
    emptyRecent: '{copy.emptyRecent}',
  };
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
  setActive,
}) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [modifiers, setModifiers] = useState([]);
  const [modifierForm, setModifierForm] = useState({ name: '', price: '' });
  const [modifierNotice, setModifierNotice] = useState(null);
  const [modifiersLoading, setModifiersLoading] = useState(false);
  const [extrasManagerOpen, setExtrasManagerOpen] = useState(false);
  const [restaurantAreas, setRestaurantAreas] = useState([]);
  const [restaurantTables, setRestaurantTables] = useState([]);
  const [restaurantTablesLoading, setRestaurantTablesLoading] = useState(false);
  const [restaurantTableNotice, setRestaurantTableNotice] = useState(null);

  const isRestaurant = currentUser?.businessType === 'restaurante';
  const copy = getFoodSalesCopy(isRestaurant);
  const activeOrderType = saleForm.orderType || 'local';
  const selectedRestaurantTable = restaurantTables.find(table => String(table.id) === String(saleForm.restaurantTableId || ''))
    || restaurantTables.find(table => table.name === saleForm.orderReference);

  useEffect(() => {
    if (!currentUser?.id) return;
    loadModifiers();
  }, [currentUser?.id]);

  useEffect(() => {
    if (!isRestaurant || !currentUser?.id) return undefined;

    let active = true;

    async function loadRestaurantTables() {
      try {
        setRestaurantTablesLoading(true);
        const floor = await fetchRestaurantFloor(currentUser.id);
        if (!active) return;
        setRestaurantAreas(floor.areas);
        setRestaurantTables(floor.tables);
      } catch (error) {
        console.error('Error cargando mesas del restaurante:', error);
        if (active) setRestaurantTableNotice({ type: 'error', message: `No se pudieron cargar las mesas: ${error.message}` });
      } finally {
        if (active) setRestaurantTablesLoading(false);
      }
    }

    loadRestaurantTables();
    const unsubscribe = subscribeRestaurantFloor(currentUser.id, loadRestaurantTables);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [currentUser?.id, isRestaurant]);

  const completedSales = useMemo(
    () => sales.filter(sale => sale.status !== 'Anulada'),
    [sales]
  );

  const recentSales = useMemo(
    () => completedSales.slice(0, 6),
    [completedSales]
  );

  const restaurantOrderStats = useMemo(() => {
    if (!isRestaurant) return null;

    const countByText = (text) => completedSales.filter((sale) =>
      String(sale.customer || '').toLowerCase().includes(text)
    ).length;

    return {
      local: countByText('en local') + countByText('mesa'),
      takeaway: countByText('para llevar'),
      delivery: countByText('delivery'),
      activeItems: saleCart.length,
    };
  }, [completedSales, isRestaurant, saleCart.length]);

  const tableStatusSummary = useMemo(() => {
    if (!isRestaurant) return [];

    return RESTAURANT_TABLE_STATUSES.map(option => ({
      ...option,
      count: restaurantTables.filter(table => table.status === option.value).length,
    }));
  }, [isRestaurant, restaurantTables]);

  const menuProducts = useMemo(() => {
    return products.filter(product => {
      if (isRestaurant) return isRestaurantMenuProduct(product);
      return !isInternalStockCategory(product?.category, currentUser?.businessType || 'cafeteria');
    });
  }, [currentUser?.businessType, isRestaurant, products]);

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

  async function refreshRestaurantTables() {
    if (!isRestaurant || !currentUser?.id) return;
    const floor = await fetchRestaurantFloor(currentUser.id);
    setRestaurantAreas(floor.areas);
    setRestaurantTables(floor.tables);
  }

  function getRestaurantAreaName(areaId) {
    return restaurantAreas.find(area => area.id === areaId)?.name || 'Salón';
  }

  async function selectRestaurantTable(table) {
    const serviceTable = table.joinedTo
      ? restaurantTables.find(item => item.id === table.joinedTo) || table
      : table;

    if (serviceTable.status === 'limpieza') {
      setRestaurantTableNotice({
        type: 'error',
        message: `${serviceTable.name} está pendiente de limpieza y todavía no puede recibir una orden.`,
      });
      return;
    }

    setRestaurantTableNotice(null);
    updateSaleField('orderType', 'local');
    updateSaleField('orderReference', serviceTable.name);
    updateSaleField('restaurantTableId', serviceTable.id);
    updateSaleField('restaurantAreaId', serviceTable.areaId);

    if (['libre', 'reservada'].includes(serviceTable.status)) {
      try {
        await openRestaurantTable({
          tableId: serviceTable.id,
          guestCount: Math.max(1, Number(serviceTable.guestCount || 1)),
          waiterName: serviceTable.waiterName || '',
          notes: serviceTable.notes || 'Orden abierta desde Ventas',
        });
        await refreshRestaurantTables();
      } catch (error) {
        setRestaurantTableNotice({ type: 'error', message: `No se pudo abrir ${serviceTable.name}: ${error.message}` });
      }
    }
  }

  async function markSelectedTable(status) {
    if (!selectedRestaurantTable) return;
    try {
      await updateRestaurantTableService({
        tableId: selectedRestaurantTable.id,
        status,
        guestCount: selectedRestaurantTable.guestCount || 1,
        waiterName: selectedRestaurantTable.waiterName || '',
        notes: selectedRestaurantTable.notes || '',
        reservationName: selectedRestaurantTable.reservationName || '',
        reservedFor: selectedRestaurantTable.reservedFor || null,
      });
      await refreshRestaurantTables();
    } catch (error) {
      setRestaurantTableNotice({ type: 'error', message: `No se pudo actualizar la mesa: ${error.message}` });
    }
  }

  function addProductToOrder(product) {
    if (!isMenuProductAvailable(product, activeOrderType, isRestaurant)) return;
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
      <section className="iq-module-hero iq-module-hero-food">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-600">{copy.eyebrow}</p>
            <h3 className="mt-2 flex items-center gap-3 text-3xl font-black text-slate-900">
              <Coffee className="h-8 w-8 text-cyan-700" /> {copy.title}
            </h3>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              {copy.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
            <FoodMetric title={copy.metrics.sales} value={formatMoney(totalSales)} />
            <FoodMetric title={copy.metrics.profit} value={formatMoney(totalProfit)} />
            <FoodMetric title={copy.metrics.units} value={totalUnitsSold} />
            <FoodMetric title={copy.metrics.discounts} value={formatMoney(totalDiscount)} />
          </div>
        </div>
      </section>

      {isRestaurant && restaurantOrderStats && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <RestaurantOrderCard title="Mesas cerradas" value={restaurantOrderStats.local} detail="Órdenes en local" />
          <RestaurantOrderCard title="Para llevar" value={restaurantOrderStats.takeaway} detail="Órdenes retiradas" />
          <RestaurantOrderCard title="Delivery" value={restaurantOrderStats.delivery} detail="Órdenes a domicilio" />
          <RestaurantOrderCard title="Orden actual" value={restaurantOrderStats.activeItems} detail="Ítems en preparación" />
        </section>
      )}

      {isRestaurant && (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="iq-operation-card p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-700">Mesas y salón</p>
                <h4 className="mt-1 text-xl font-black text-slate-900">Selección rápida</h4>
                <p className="text-sm text-slate-500">Elige una mesa para abrir la orden o entra al plano completo para administrar el salón.</p>
              </div>
              <button
                type="button"
                onClick={() => setActive?.('Mesas')}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-black text-cyan-800 hover:bg-cyan-100"
              >
                <Grid2X2 className="h-4 w-4" />
                Abrir plano de mesas
              </button>
            </div>

            {restaurantTableNotice && (
              <div className={`mt-4 rounded-2xl p-3 text-xs font-bold ${restaurantTableNotice.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-cyan-50 text-cyan-800'}`}>
                {restaurantTableNotice.message}
              </div>
            )}

            {restaurantTablesLoading ? (
              <div className="mt-4 rounded-3xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Cargando mesas...</div>
            ) : restaurantTables.length === 0 ? (
              <div className="mt-4 rounded-3xl border border-dashed border-slate-200 p-6 text-center">
                <p className="text-sm font-bold text-slate-600">Aún no has configurado áreas y mesas.</p>
                <button type="button" onClick={() => setActive?.('Mesas')} className="mt-3 rounded-2xl bg-cyan-700 px-4 py-2 text-sm font-black text-white hover:bg-cyan-800">Configurar salón</button>
              </div>
            ) : (
              <>
                <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                  {tableStatusSummary.map(status => (
                    <span key={status.value} className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-black ${status.badgeClass}`}>
                      {status.label}: {status.count}
                    </span>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {restaurantTables.slice(0, 12).map(table => {
                    const status = getTableStatusMeta(table.status);
                    const selected = String(saleForm.restaurantTableId || '') === String(table.id)
                      || (saleForm.orderReference === table.name && activeOrderType === 'local');
                    return (
                      <button
                        key={table.id}
                        type="button"
                        onClick={() => selectRestaurantTable(table)}
                        className={`rounded-2xl border p-3 text-left transition ${selected ? 'border-cyan-400 bg-cyan-50 ring-2 ring-cyan-100' : 'border-slate-200 bg-white hover:border-cyan-200 hover:bg-slate-50'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-black text-slate-900">{table.name}</p>
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${status.dotClass}`} />
                        </div>
                        <p className="mt-1 truncate text-[11px] font-bold text-slate-400">{getRestaurantAreaName(table.areaId)}</p>
                        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {table.guestCount || table.capacity}</span>
                          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {table.openedAt ? getOpenDurationLabel(table.openedAt) : status.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="iq-operation-card p-5">
            <div className="mb-4">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">Orden seleccionada</p>
              <h4 className="mt-1 text-xl font-black text-slate-900">{selectedRestaurantTable?.name || 'Sin mesa seleccionada'}</h4>
              <p className="text-sm text-slate-500">
                {selectedRestaurantTable
                  ? `${getRestaurantAreaName(selectedRestaurantTable.areaId)} · ${getTableStatusMeta(selectedRestaurantTable.status).label}`
                  : 'Selecciona una mesa para vincular la orden actual.'}
              </p>
            </div>

            {selectedRestaurantTable ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 rounded-3xl bg-slate-50 p-4 text-center">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Capacidad</p>
                    <p className="mt-1 font-black text-slate-900">{selectedRestaurantTable.capacity}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Comensales</p>
                    <p className="mt-1 font-black text-slate-900">{selectedRestaurantTable.guestCount || 1}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Tiempo</p>
                    <p className="mt-1 font-black text-slate-900">{selectedRestaurantTable.openedAt ? getOpenDurationLabel(selectedRestaurantTable.openedAt) : '0 min'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {['ocupada', 'preparacion', 'servida', 'cobrar'].map(statusValue => {
                    const status = getTableStatusMeta(statusValue);
                    return (
                      <button
                        key={statusValue}
                        type="button"
                        onClick={() => markSelectedTable(statusValue)}
                        className={`rounded-2xl border px-3 py-2 text-xs font-black ${selectedRestaurantTable.status === statusValue ? status.badgeClass : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                      >
                        {status.label}
                      </button>
                    );
                  })}
                </div>

                <button type="button" onClick={() => setActive?.('Mesas')} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800">
                  Administrar mesa y servicio
                </button>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                Selecciona una mesa del panel para comenzar.
              </div>
            )}
          </div>
        </section>
      )}

      {saleNotice && (
        <div className={`rounded-3xl p-4 text-sm font-bold ${saleNotice.type === 'success' ? 'border border-cyan-100 bg-cyan-50 text-cyan-800' : 'border border-red-100 bg-red-50 text-red-700'}`}>
          {saleNotice.message}
        </div>
      )}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-5">
          <div className="iq-operation-card p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h4 className="text-xl font-black text-slate-900">{copy.menuTitle}</h4>
                <p className="text-sm text-slate-500">{copy.menuSubtitle}</p>
              </div>

              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder={copy.menuSearchPlaceholder}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-cyan-300 focus:bg-white focus:ring-2 focus:ring-cyan-100"
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
                      ? 'bg-cyan-700 text-white shadow-sm shadow-cyan-100'
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
              {copy.emptyMenu}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredProducts.map(product => {
                const disabled = !isMenuProductAvailable(product, activeOrderType, isRestaurant);
                const restaurantMetadata = isRestaurant
                  ? normalizeRestaurantProductMetadata(product.productMetadata || product.product_metadata)
                  : null;
                const restaurantStatus = isRestaurant ? getRestaurantStatusMeta(product) : null;

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProductToOrder(product)}
                    disabled={disabled}
                    className="group iq-menu-product-card p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
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
                        {isRestaurant && (
                          <p className={`mt-1 text-[11px] font-bold ${restaurantStatus.value === 'paused' ? 'text-red-500' : 'text-slate-400'}`}>
                            {restaurantStatus.label} · {restaurantMetadata.preparationMinutes > 0 ? `${restaurantMetadata.preparationMinutes} min` : 'tiempo no definido'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xl font-black text-cyan-800">{formatMoney(product.price)}</p>
                        <p className="text-xs text-slate-400">{getRestaurantStockLabel(product)}</p>
                        {hasActiveRecipe(product) && (
                          <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-700">
                            Receta activa
                          </span>
                        )}
                      </div>
                      <span className="rounded-2xl bg-cyan-700 p-3 text-white transition group-hover:bg-cyan-800">
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
          <form onSubmit={registerSale} className="iq-operation-card iq-operation-card-accent iq-sticky-workspace p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h4 className="flex items-center gap-2 text-xl font-black text-slate-900">
                  <ShoppingCart className="h-5 w-5 text-cyan-700" /> {copy.orderTitle}
                </h4>
                <p className="text-sm text-slate-500">{copy.orderSubtitle}</p>
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
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-amber-700">{copy.orderTypeTitle}</span>

              <div className="grid grid-cols-3 gap-2">
                {copy.orderTypes.map(option => {
                  const active = activeOrderType === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateSaleField('orderType', option.value)}
                      className={`rounded-2xl px-3 py-2 text-xs font-black transition ${active ? 'bg-cyan-700 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">
                    {copy.getReferenceLabel(activeOrderType)}
                  </span>
                  <input
                    value={saleForm.orderReference || ''}
                    onChange={event => updateSaleField('orderReference', event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-cyan-100"
                    placeholder={copy.getReferencePlaceholder(activeOrderType)}
                  />

                  {isRestaurant && activeOrderType === 'local' && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {restaurantTables.slice(0, 6).map(table => (
                        <button
                          key={table.name}
                          type="button"
                          onClick={() => selectRestaurantTable(table.name)}
                          className={`rounded-xl px-2 py-1 text-[11px] font-black transition ${saleForm.orderReference === table.name ? 'bg-cyan-700 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'}`}
                        >
                          {table.name}
                        </button>
                      ))}
                    </div>
                  )}
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">{copy.notesLabel}</span>
                  <input
                    value={saleForm.orderNotes || ''}
                    onChange={event => updateSaleField('orderNotes', event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-cyan-100"
                    placeholder={copy.notesPlaceholder}
                  />
                </label>
              </div>
            </div>

            <div className="mb-4 rounded-3xl border border-cyan-100 bg-cyan-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-wide text-cyan-800">{copy.modifiersTitle}</p>
                  <p className="truncate text-xs text-cyan-800/80">
                    {modifiersLoading ? 'Cargando extras...' : `${modifiers.length} extra(s) creados`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setExtrasManagerOpen(open => !open)}
                  className="shrink-0 rounded-2xl bg-cyan-700 px-3 py-2 text-xs font-black text-white hover:bg-cyan-800"
                >
                  {extrasManagerOpen ? 'Cerrar' : '+ Extra'}
                </button>
              </div>

              {extrasManagerOpen && (
                <div className="mt-3 rounded-2xl bg-white p-3">
                  {modifierNotice && (
                    <div className={`mb-3 rounded-2xl p-3 text-xs font-bold ${modifierNotice.type === 'success' ? 'bg-cyan-50 text-cyan-800' : 'bg-red-50 text-red-700'}`}>
                      {modifierNotice.message}
                    </div>
                  )}

                  <div className="grid grid-cols-[1fr_88px_42px] gap-2">
                    <input
                      value={modifierForm.name}
                      onChange={event => setModifierForm(prev => ({ ...prev, name: event.target.value }))}
                      className="min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-cyan-100"
                      placeholder={copy.modifierPlaceholder}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={modifierForm.price}
                      onChange={event => setModifierForm(prev => ({ ...prev, price: event.target.value }))}
                      className="min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-cyan-100"
                      placeholder="0.00"
                    />
                    <button
                      type="button"
                      onClick={saveModifier}
                      className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-700 text-lg font-black text-white hover:bg-cyan-800"
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
                      <p className="text-sm font-black text-cyan-800">{formatMoney(item.subtotal)}</p>
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
                      <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">{copy.quickModifiersTitle}</p>
                      {modifiers.length === 0 ? (
                        <p className="text-xs text-slate-400">Aún no hay extras creados para este negocio.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {modifiers.map(modifier => (
                          <button
                            key={modifier.id}
                            type="button"
                            onClick={() => addModifierToItem(item, modifier)}
                            className="rounded-xl border border-cyan-100 bg-cyan-50 px-2 py-1 text-[11px] font-black text-cyan-800 hover:bg-cyan-100"
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
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-cyan-100"
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
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-cyan-100"
                    placeholder="0"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">Tipo</span>
                  <select
                    value={saleForm.discountType || 'percent'}
                    onChange={event => updateSaleField('discountType', event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-cyan-100"
                  >
                    <option value="percent">%</option>
                    <option value="fixed">$</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-5 iq-total-highlight iq-total-highlight-dark">
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
                <span className="text-3xl font-black text-cyan-300">{formatMoney(salePreview.total)}</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">{copy.totalSummaryLabel}: {copy.orderTypeLabels[activeOrderType] || getOrderTypeLabel(activeOrderType)} · Pago: {getPaymentLabel(saleForm.paymentMethod)}</p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={resetSaleForm}
                className="iq-secondary-button"
              >
                Reiniciar
              </button>
              <button
                type="submit"
                disabled={saleCart.length === 0 || salesLoading}
                className="iq-primary-button disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copy.submitLabel}
              </button>
            </div>
          </form>

          <div className="iq-operation-card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h4 className="flex items-center gap-2 text-lg font-black text-slate-900">
                  <ReceiptText className="h-5 w-5 text-cyan-700" /> {copy.recentTitle}
                </h4>
                <p className="text-sm text-slate-500">{copy.recentSubtitle}</p>
              </div>
            </div>

            {recentSales.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
                {copy.emptyRecent}
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
                      <p className="text-sm font-black text-cyan-800">{formatMoney(sale.total)}</p>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setReceiptSale(sale)}
                        className="iq-action-secondary"
                      >
                        Recibo
                      </button>
                      <button
                        type="button"
                        onClick={() => cancelSale(sale.id)}
                        className="iq-action-danger"
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


function RestaurantOrderCard({ title, value, detail }) {
  return (
    <div className="rounded-3xl border border-cyan-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-cyan-700">{title}</p>
      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-400">{detail}</p>
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
