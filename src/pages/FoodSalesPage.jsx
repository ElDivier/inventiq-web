import { useEffect, useMemo, useState } from 'react';
import {
  Clock,
  Coffee,
  Grid2X2,
  ListChecks,
  Minus,
  Package,
  Plus,
  ReceiptText,
  Search,
  Save,
  Send,
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
  buildCafeteriaVariantSummary,
  isCafeteriaMenuProductAvailable,
  normalizeCafeteriaProductMetadata,
} from '../utils/cafeteriaMenu';
import {
  RESTAURANT_TABLE_STATUSES,
  fetchRestaurantFloor,
  getOpenDurationLabel,
  getRestaurantTableStatusMeta as getTableStatusMeta,
  subscribeRestaurantFloor,
  updateRestaurantTableService,
} from '../utils/restaurantTables';
import {
  RESTAURANT_COURSES,
  buildRestaurantDraftItem,
  fetchActiveRestaurantOrderByTable,
  fetchRestaurantOrder,
  getRestaurantItemStatusMeta,
  getRestaurantOrderStatusMeta,
  saveRestaurantOrder,
  sendRestaurantOrder,
} from '../utils/restaurantOrders';
import { hasRestaurantPermission } from '../utils/restaurantPermissions';

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

function isMenuProductAvailable(product, orderType = 'local', businessType = 'cafeteria') {
  if (businessType === 'restaurante') {
    if (!isRestaurantMenuProduct(product)) return false;
    const metadata = normalizeRestaurantProductMetadata(product?.productMetadata || product?.product_metadata);
    if (metadata.menuStatus === 'paused') return false;
    if (metadata.orderChannels.length > 0 && !metadata.orderChannels.includes(orderType)) return false;
  }

  if (businessType === 'cafeteria' && !isCafeteriaMenuProductAvailable(product, orderType)) return false;

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
    description: 'Toma pedidos en segundos, personaliza bebidas y envíalos automáticamente a la barra con un número de pedido.',
    metrics: {
      sales: 'Ventas',
      profit: 'Utilidad',
      units: 'Unidades',
      discounts: 'Descuentos',
    },
    menuTitle: 'Menú',
    menuSubtitle: 'Selecciona productos para agregarlos al pedido.',
    menuSearchPlaceholder: 'Buscar en el menú...',
    emptyMenu: 'No hay productos disponibles para este tipo de pedido.',
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
      return 'Nombre / referencia (opcional)';
    },
    getReferencePlaceholder(orderType) {
      if (orderType === 'delivery') return 'Ej: Diego / dirección';
      if (orderType === 'takeaway') return 'Ej: Juan';
      return 'Ej: Ana / mesa 2';
    },
    notesLabel: 'Nota rápida',
    notesPlaceholder: 'Ej: sin azúcar, sin hielo, calentar',
    modifiersTitle: 'Extras rápidos',
    quickModifiersTitle: 'Extras generales',
    modifierPlaceholder: 'Ej: Leche de almendra',
    submitLabel: 'Cobrar y enviar a barra',
    totalSummaryLabel: 'Pedido',
    recentTitle: 'Ventas recientes',
    recentSubtitle: 'Últimos pedidos cobrados.',
    emptyRecent: 'Sin pedidos cobrados recientemente.',
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
  const [activeRestaurantOrder, setActiveRestaurantOrder] = useState(null);
  const [restaurantOrderLoading, setRestaurantOrderLoading] = useState(false);
  const [restaurantOrderSaving, setRestaurantOrderSaving] = useState(false);
  const [restaurantOrderNotice, setRestaurantOrderNotice] = useState(null);
  const [cafeCustomizer, setCafeCustomizer] = useState(null);

  const isRestaurant = currentUser?.businessType === 'restaurante';
  const isCafeteria = currentUser?.businessType === 'cafeteria';
  const canApplyDiscounts = hasRestaurantPermission(currentUser, 'discounts.apply');
  const canCancelSales = hasRestaurantPermission(currentUser, 'cancellations.manage');
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

  useEffect(() => {
    if (!isRestaurant || !currentUser?.id) return;
    let active = true;

    async function loadOrder() {
      try {
        setRestaurantOrderLoading(true);
        const order = saleForm.restaurantOrderId
          ? await fetchRestaurantOrder(saleForm.restaurantOrderId, currentUser.id)
          : saleForm.restaurantTableId
            ? await fetchActiveRestaurantOrderByTable(saleForm.restaurantTableId, currentUser.id)
            : null;
        if (!active) return;
        setActiveRestaurantOrder(order);
        if (order && String(saleForm.restaurantOrderId || '') !== String(order.id)) {
          setSaleForm((current) => ({ ...current, restaurantOrderId: order.id }));
        }
      } catch (error) {
        if (active) setRestaurantOrderNotice({ type: 'error', message: `No se pudo cargar la comanda: ${error.message}` });
      } finally {
        if (active) setRestaurantOrderLoading(false);
      }
    }

    loadOrder();
    return () => { active = false; };
  }, [currentUser?.id, isRestaurant, saleForm.restaurantOrderId, saleForm.restaurantTableId, setSaleForm]);

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

  function changeOrderType(nextType) {
    if (nextType === activeOrderType) return;
    if (saleCart.length > 0) {
      const confirmed = window.confirm('La ronda actual todavía no está guardada. ¿Deseas descartarla y cambiar el tipo de pedido?');
      if (!confirmed) return;
      clearSaleCart?.();
    }
    setActiveRestaurantOrder(null);
    setRestaurantOrderNotice(null);
    setSaleForm((current) => ({
      ...current,
      orderType: nextType,
      orderReference: '',
      restaurantOrderId: '',
      restaurantTableId: '',
      restaurantAreaId: '',
      restaurantWaiterName: '',
      restaurantGuestCount: 1,
    }));
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

    const changingTable = saleForm.restaurantTableId && String(saleForm.restaurantTableId) !== String(serviceTable.id);
    if (changingTable && saleCart.length > 0) {
      const confirmed = window.confirm('La ronda actual todavía no está guardada. ¿Deseas descartarla y cambiar de mesa?');
      if (!confirmed) return;
      clearSaleCart?.();
    }

    setRestaurantTableNotice({ type: 'success', message: `${serviceTable.name} fue seleccionada. Su estado no cambia hasta guardar o abrir el servicio.` });
    setRestaurantOrderNotice(null);
    updateSaleField('orderType', 'local');
    updateSaleField('orderReference', serviceTable.name);
    updateSaleField('restaurantTableId', serviceTable.id);
    updateSaleField('restaurantAreaId', serviceTable.areaId);
    updateSaleField('restaurantOrderId', '');
    updateSaleField('restaurantWaiterName', serviceTable.waiterName || '');
    updateSaleField('restaurantGuestCount', serviceTable.guestCount || 1);
    setActiveRestaurantOrder(null);
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

  function updateCartItemCommand(item, field, value) {
    if (typeof setSaleCart !== 'function') return;
    setSaleCart((current) => current.map((cartItem) =>
      String(cartItem.productId) === String(item.productId)
        ? { ...cartItem, [field]: value }
        : cartItem
    ));
  }

  function buildCurrentDraftItems() {
    return saleCart.map((item) => {
      const product = products.find((candidate) => String(candidate.id) === String(item.productId));
      return buildRestaurantDraftItem(item, product);
    });
  }

  async function reloadCurrentRestaurantOrder(orderId) {
    if (!orderId || !currentUser?.id) {
      setActiveRestaurantOrder(null);
      return null;
    }
    const order = await fetchRestaurantOrder(orderId, currentUser.id);
    setActiveRestaurantOrder(order);
    return order;
  }

  async function saveCurrentRestaurantOrder({ send = false } = {}) {
    if (!isRestaurant) return;
    if (activeOrderType === 'local' && !saleForm.restaurantTableId) {
      setRestaurantOrderNotice({ type: 'error', message: 'Selecciona una mesa antes de guardar la comanda.' });
      return;
    }
    if (saleCart.length === 0 && !activeRestaurantOrder) {
      setRestaurantOrderNotice({ type: 'error', message: 'Agrega al menos un producto al pedido.' });
      return;
    }

    try {
      setRestaurantOrderSaving(true);
      setRestaurantOrderNotice(null);
      const orderId = await saveRestaurantOrder({
        orderId: activeRestaurantOrder?.id || saleForm.restaurantOrderId || null,
        tableId: activeOrderType === 'local' ? saleForm.restaurantTableId || null : null,
        areaId: activeOrderType === 'local' ? saleForm.restaurantAreaId || null : null,
        orderType: activeOrderType,
        orderReference: saleForm.orderReference || '',
        waiterName: saleForm.restaurantWaiterName || selectedRestaurantTable?.waiterName || '',
        guestCount: saleForm.restaurantGuestCount || selectedRestaurantTable?.guestCount || 1,
        customerName: saleForm.customer || '',
        notes: saleForm.orderNotes || '',
        items: buildCurrentDraftItems(),
      });

      updateSaleField('restaurantOrderId', orderId);
      if (send) await sendRestaurantOrder(orderId);
      const order = await reloadCurrentRestaurantOrder(orderId);
      clearSaleCart?.();
      await refreshRestaurantTables();
      setRestaurantOrderNotice({
        type: 'success',
        message: send ? 'La nueva ronda fue enviada a cocina.' : `Comanda ${order?.code || ''} guardada como borrador.`,
      });
    } catch (error) {
      setRestaurantOrderNotice({ type: 'error', message: error.message });
    } finally {
      setRestaurantOrderSaving(false);
    }
  }

  function getCartLineKey(item) {
    return item?.lineId || String(item?.productId || '');
  }

  function addConfiguredCafeteriaProduct() {
    const draft = cafeCustomizer;
    if (!draft?.product || typeof setSaleCart !== 'function') return;
    const product = draft.product;
    const metadata = normalizeCafeteriaProductMetadata(product.productMetadata || product.product_metadata);
    const size = metadata.sizes.find((item) => item.id === draft.sizeId) || null;
    const milk = metadata.milkOptions.find((item) => item.id === draft.milkId) || null;
    const syrup = metadata.syrupOptions.find((item) => item.id === draft.syrupId) || null;
    const temperature = draft.temperature || metadata.temperatures[0] || '';
    const extraShot = Boolean(draft.extraShot && metadata.extraShotEnabled);
    const options = [
      size ? { id: `size-${size.id}`, name: size.label, price: Number(size.priceDelta || 0), cafeConfigured: true } : null,
      milk ? { id: `milk-${milk.id}`, name: milk.label, price: Number(milk.priceDelta || 0), cafeConfigured: true } : null,
      temperature ? { id: `temp-${temperature}`, name: temperature === 'frio' ? 'Frío' : temperature === 'ambiente' ? 'Ambiente' : 'Caliente', price: 0, cafeConfigured: true } : null,
      syrup ? { id: `syrup-${syrup.id}`, name: syrup.label, price: Number(syrup.priceDelta || 0), cafeConfigured: true } : null,
      extraShot ? { id: 'extra-shot', name: 'Shot extra', price: Number(metadata.extraShotPrice || 0), cafeConfigured: true } : null,
    ].filter(Boolean);
    const variantSummary = buildCafeteriaVariantSummary({ size, milk, temperature, syrup, extraShot });
    const price = Number(product.price || 0) + options.reduce((sum, item) => sum + Number(item.price || 0), 0);
    const currentQuantity = saleCart.filter((item) => String(item.productId) === String(product.id)).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    if (!hasActiveRecipe(product) && currentQuantity + 1 > Number(product.stock || 0)) return;
    const signature = JSON.stringify({ productId: product.id, variantSummary, notes: draft.notes || '' });
    const existing = saleCart.find((item) => item.cafeSignature === signature);
    if (existing) {
      setSaleCart((prev) => prev.map((item) => getCartLineKey(item) === getCartLineKey(existing)
        ? { ...item, quantity: Number(item.quantity || 0) + 1, subtotal: price * (Number(item.quantity || 0) + 1), profit: (price - Number(item.cost || 0)) * (Number(item.quantity || 0) + 1) }
        : item));
    } else {
      setSaleCart((prev) => [...prev, {
        lineId: `cafe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        cafeSignature: signature,
        productId: product.id,
        baseProduct: product.name,
        product: variantSummary ? `${product.name} (${variantSummary})` : product.name,
        quantity: 1,
        basePrice: Number(product.price || 0),
        price,
        cost: Number(product.cost || 0),
        subtotal: price,
        profit: price - Number(product.cost || 0),
        modifiers: options,
        variantSummary,
        station: metadata.station,
        notes: String(draft.notes || '').trim(),
        discountType: 'percent',
        discountValue: '',
      }]);
    }
    setCafeCustomizer(null);
  }

  function addProductToOrder(product) {
    if (!isMenuProductAvailable(product, activeOrderType, currentUser?.businessType)) return;
    if (isCafeteria) {
      const metadata = normalizeCafeteriaProductMetadata(product.productMetadata || product.product_metadata);
      setCafeCustomizer({
        product,
        sizeId: metadata.sizes[0]?.id || '',
        milkId: '',
        syrupId: '',
        temperature: metadata.temperatures[0] || '',
        extraShot: false,
        notes: '',
      });
      return;
    }
    addSaleItem(product.id, 1);
  }

  function decreaseCartItem(item) {
    if (typeof setSaleCart !== 'function') {
      removeSaleItem(item.productId);
      return;
    }

    setSaleCart(prevCart => {
      const currentItem = prevCart.find(current => isCafeteria ? getCartLineKey(current) === getCartLineKey(item) : String(current.productId) === String(item.productId));

      if (!currentItem) return prevCart;

      const nextQuantity = Number(currentItem.quantity || 0) - 1;

      if (nextQuantity <= 0) {
        return prevCart.filter(current => isCafeteria ? getCartLineKey(current) !== getCartLineKey(item) : String(current.productId) !== String(item.productId));
      }

      return prevCart.map(current => {
        if (isCafeteria ? getCartLineKey(current) !== getCartLineKey(item) : String(current.productId) !== String(item.productId)) return current;

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
      if (isCafeteria ? getCartLineKey(current) !== getCartLineKey(item) : String(current.productId) !== String(item.productId)) return current;

      const currentModifiers = Array.isArray(current.modifiers) ? current.modifiers : [];
      const nextModifiers = [...currentModifiers, modifier];
      return rebuildCartItemWithModifiers(current, nextModifiers);
    }));
  }

  function removeModifierFromItem(item, modifierIndex) {
    if (typeof setSaleCart !== 'function') return;

    setSaleCart(prevCart => prevCart.map(current => {
      if (isCafeteria ? getCartLineKey(current) !== getCartLineKey(item) : String(current.productId) !== String(item.productId)) return current;

      const currentModifiers = Array.isArray(current.modifiers) ? current.modifiers : [];
      const nextModifiers = currentModifiers.filter((_, index) => index !== modifierIndex);
      return rebuildCartItemWithModifiers(current, nextModifiers);
    }));
  }

  return (
    <div className="space-y-6">
      {isCafeteria && cafeCustomizer && (
        <CafeteriaCustomizerModal
          draft={cafeCustomizer}
          setDraft={setCafeCustomizer}
          onClose={() => setCafeCustomizer(null)}
          onConfirm={addConfiguredCafeteriaProduct}
        />
      )}
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

      {isRestaurant && (restaurantOrderNotice || activeRestaurantOrder || restaurantOrderLoading) && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          {restaurantOrderNotice && (
            <div className={`mb-4 rounded-2xl p-3 text-sm font-bold ${restaurantOrderNotice.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
              {restaurantOrderNotice.message}
            </div>
          )}
          {restaurantOrderLoading ? (
            <p className="text-sm font-bold text-slate-400">Cargando comanda activa...</p>
          ) : activeRestaurantOrder ? (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">Comanda activa</p>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${getRestaurantOrderStatusMeta(activeRestaurantOrder.status).badgeClass}`}>
                    {getRestaurantOrderStatusMeta(activeRestaurantOrder.status).label}
                  </span>
                </div>
                <h4 className="mt-2 text-xl font-black text-slate-900">{activeRestaurantOrder.code} · {activeRestaurantOrder.orderReference || 'Pedido'}</h4>
                <p className="mt-1 text-sm text-slate-500">
                  {activeRestaurantOrder.items.filter((item) => item.status !== 'cancelado').length} producto(s) guardados · {formatMoney(activeRestaurantOrder.total)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeRestaurantOrder.items.filter((item) => item.status !== 'cancelado').slice(0, 8).map((item) => (
                    <span key={item.id} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      {item.quantity}× {item.product}
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black ${getRestaurantItemStatusMeta(item.status).badgeClass}`}>
                        {getRestaurantItemStatusMeta(item.status).label}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => setActive?.('Comandas')} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800">
                <ListChecks className="h-4 w-4" /> Ver comandas
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm font-black text-slate-900">Sin comanda abierta</p><p className="mt-1 text-sm text-slate-500">Selecciona una mesa y guarda la primera ronda para abrir la cuenta.</p></div>
              <button type="button" onClick={() => setActive?.('Comandas')} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-50">Ver todas las comandas</button>
            </div>
          )}
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
                const disabled = !isMenuProductAvailable(product, activeOrderType, currentUser?.businessType);
                const restaurantMetadata = isRestaurant
                  ? normalizeRestaurantProductMetadata(product.productMetadata || product.product_metadata)
                  : null;
                const restaurantStatus = isRestaurant ? getRestaurantStatusMeta(product) : null;
                const cafeMetadata = isCafeteria ? normalizeCafeteriaProductMetadata(product.productMetadata || product.product_metadata) : null;

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
                        {isCafeteria && cafeMetadata && (
                          <p className="mt-1 text-[11px] font-bold text-slate-400">
                            {cafeMetadata.station === 'barra' ? 'Barra' : cafeMetadata.station === 'reposteria' ? 'Repostería' : cafeMetadata.station === 'entrega' ? 'Entrega' : 'Cocina'} · {cafeMetadata.preparationMinutes > 0 ? `${cafeMetadata.preparationMinutes} min` : 'rápido'}
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
          <form onSubmit={isRestaurant ? (event) => { event.preventDefault(); saveCurrentRestaurantOrder({ send: true }); } : registerSale} className="iq-operation-card iq-operation-card-accent iq-sticky-workspace p-5">
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
                      onClick={() => isRestaurant ? changeOrderType(option.value) : updateSaleField('orderType', option.value)}
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
                          onClick={() => selectRestaurantTable(table)}
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

              {isRestaurant && activeOrderType === 'local' && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_130px]">
                  <label className="block">
                    <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">Mesero responsable</span>
                    <input value={saleForm.restaurantWaiterName || selectedRestaurantTable?.waiterName || ''} onChange={(event) => updateSaleField('restaurantWaiterName', event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-cyan-100" placeholder="Nombre del mesero" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">Comensales</span>
                    <input type="number" min="1" max="100" value={saleForm.restaurantGuestCount || selectedRestaurantTable?.guestCount || 1} onChange={(event) => updateSaleField('restaurantGuestCount', event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-cyan-100" />
                  </label>
                </div>
              )}
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
                  <div key={getCartLineKey(item)} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
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
                          onClick={() => {
                            if (isCafeteria && typeof setSaleCart === 'function') {
                              const product = products.find((candidate) => String(candidate.id) === String(item.productId));
                              const totalInCart = saleCart.filter((candidate) => String(candidate.productId) === String(item.productId)).reduce((sum, candidate) => sum + Number(candidate.quantity || 0), 0);
                              if (product && (hasActiveRecipe(product) || totalInCart < Number(product.stock || 0))) {
                                setSaleCart((prev) => prev.map((candidate) => getCartLineKey(candidate) === getCartLineKey(item) ? { ...candidate, quantity: Number(candidate.quantity || 0) + 1, subtotal: Number(candidate.price || 0) * (Number(candidate.quantity || 0) + 1), profit: (Number(candidate.price || 0) - Number(candidate.cost || 0)) * (Number(candidate.quantity || 0) + 1) } : candidate));
                              }
                            } else { addSaleItem(item.productId, 1); }
                          }}
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                            if (isCafeteria && typeof setSaleCart === 'function') setSaleCart((prev) => prev.filter((candidate) => getCartLineKey(candidate) !== getCartLineKey(item)));
                            else removeSaleItem(item.productId);
                          }}
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
                              {!modifier.cafeConfigured && (
                                <button
                                  type="button"
                                  onClick={() => removeModifierFromItem(item, modifierIndex)}
                                  className="font-black text-red-500 hover:text-red-600"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {isRestaurant && (
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_90px]">
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-400">Curso</span>
                          <select
                            value={item.course || 'principal'}
                            onChange={(event) => updateCartItemCommand(item, 'course', event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-cyan-100"
                          >
                            {RESTAURANT_COURSES.map((course) => <option key={course.value} value={course.value}>{course.label}</option>)}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-400">Asiento</span>
                          <input type="number" min="1" max="100" value={item.seatNumber || ''} onChange={(event) => updateCartItemCommand(item, 'seatNumber', event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-cyan-100" placeholder="Opc." />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-400">Observación para cocina</span>
                          <input value={item.notes || ''} onChange={(event) => updateCartItemCommand(item, 'notes', event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-cyan-100" placeholder="Ej: sin cebolla, término medio..." />
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {(!isRestaurant || activeOrderType !== 'local') && (
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
                    disabled={!canApplyDiscounts}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-cyan-100"
                    placeholder="0"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">Tipo</span>
                  <select
                    value={saleForm.discountType || 'percent'}
                    onChange={event => updateSaleField('discountType', event.target.value)}
                    disabled={!canApplyDiscounts}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-cyan-100"
                  >
                    <option value="percent">%</option>
                    <option value="fixed">$</option>
                  </select>
                </label>
              </div>
            </div>
            )}

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
              <p className="mt-2 text-xs text-slate-400">
                {isRestaurant && activeOrderType === 'local'
                  ? `Nueva ronda · Cuenta acumulada ${formatMoney(Number(activeRestaurantOrder?.total || 0) + Number(salePreview.total || 0))}`
                  : `${copy.totalSummaryLabel}: ${copy.orderTypeLabels[activeOrderType] || getOrderTypeLabel(activeOrderType)} · Pago: ${getPaymentLabel(saleForm.paymentMethod)}`}
              </p>
            </div>

            {isRestaurant ? (
              <div className="mt-5 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => saveCurrentRestaurantOrder({ send: false })} disabled={restaurantOrderSaving || saleCart.length === 0} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                    <Save className="h-4 w-4" /> Guardar borrador
                  </button>
                  <button type="submit" disabled={restaurantOrderSaving || saleCart.length === 0} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-black text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">
                    <Send className="h-4 w-4" /> {restaurantOrderSaving ? 'Guardando...' : 'Enviar a cocina'}
                  </button>
                </div>
                {activeOrderType !== 'local' && (
                  <button type="button" onClick={(event) => registerSale(event)} disabled={saleCart.length === 0 || salesLoading} className="w-full rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-800 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50">
                    Cobrar ahora sin dejar cuenta abierta
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button type="button" onClick={resetSaleForm} className="iq-secondary-button">Reiniciar</button>
                <button type="submit" disabled={saleCart.length === 0 || salesLoading} className="iq-primary-button disabled:cursor-not-allowed disabled:opacity-50">{copy.submitLabel}</button>
              </div>
            )}
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
                      {canCancelSales && <button
                        type="button"
                        onClick={() => cancelSale(sale.id)}
                        className="iq-action-danger"
                      >
                        Anular
                      </button>}
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



function CafeteriaCustomizerModal({ draft, setDraft, onClose, onConfirm }) {
  const product = draft.product;
  const metadata = normalizeCafeteriaProductMetadata(product?.productMetadata || product?.product_metadata);
  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const optionButton = (active) => `rounded-xl border px-3 py-2 text-xs font-black transition ${active ? 'border-cyan-300 bg-cyan-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[30px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[0.2em] text-amber-600">Personalizar pedido</p><h3 className="mt-1 text-2xl font-black text-slate-900">{product?.name}</h3><p className="mt-1 text-sm text-slate-500">Elige únicamente las opciones que aplican a esta bebida o producto.</p></div>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-3 py-2 font-black text-slate-500">×</button>
        </div>

        {metadata.sizes.length > 0 && <CafeOptionGroup title="Tamaño" values={metadata.sizes} selected={draft.sizeId} onSelect={(id) => update('sizeId', id)} optionButton={optionButton} />}
        {metadata.temperatures.length > 0 && <div className="mt-5"><p className="mb-2 text-sm font-black text-slate-800">Temperatura</p><div className="flex flex-wrap gap-2">{metadata.temperatures.map((value) => <button key={value} type="button" onClick={() => update('temperature', value)} className={optionButton(draft.temperature === value)}>{value === 'frio' ? 'Frío' : value === 'ambiente' ? 'Ambiente' : 'Caliente'}</button>)}</div></div>}
        {metadata.milkOptions.length > 0 && <CafeOptionGroup title="Leche" values={[{ id: '', label: 'Sin cambio', priceDelta: 0 }, ...metadata.milkOptions]} selected={draft.milkId} onSelect={(id) => update('milkId', id)} optionButton={optionButton} />}
        {metadata.syrupOptions.length > 0 && <CafeOptionGroup title="Jarabe / sabor" values={[{ id: '', label: 'Sin jarabe', priceDelta: 0 }, ...metadata.syrupOptions]} selected={draft.syrupId} onSelect={(id) => update('syrupId', id)} optionButton={optionButton} />}
        {metadata.extraShotEnabled && <div className="mt-5"><button type="button" onClick={() => update('extraShot', !draft.extraShot)} className={optionButton(draft.extraShot)}>Shot extra {metadata.extraShotPrice > 0 ? `+$${metadata.extraShotPrice.toFixed(2)}` : ''}</button></div>}

        <label className="mt-5 block"><span className="mb-2 block text-sm font-black text-slate-800">Nota para barra</span><input value={draft.notes || ''} onChange={(event) => update('notes', event.target.value)} className="iq-input" placeholder="Ej: poco hielo, sin azúcar, extra caliente" /></label>

        <div className="mt-6 grid grid-cols-2 gap-3"><button type="button" onClick={onClose} className="iq-secondary-button">Cancelar</button><button type="button" onClick={onConfirm} className="iq-primary-button">Agregar al pedido</button></div>
      </div>
    </div>
  );
}

function CafeOptionGroup({ title, values, selected, onSelect, optionButton }) {
  return <div className="mt-5"><p className="mb-2 text-sm font-black text-slate-800">{title}</p><div className="flex flex-wrap gap-2">{values.map((item) => <button key={item.id || 'none'} type="button" onClick={() => onSelect(item.id)} className={optionButton(selected === item.id)}>{item.label}{Number(item.priceDelta || 0) > 0 ? ` +$${Number(item.priceDelta).toFixed(2)}` : ''}</button>)}</div></div>;
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
