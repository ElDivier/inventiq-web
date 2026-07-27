export const INVENTORY_ALERTS_PAGE_SIZE = 6;
export const INVENTORY_MOVEMENTS_PAGE_SIZE = 8;
export const INVENTORY_SUMMARY_PAGE_SIZE = 6;

export function getPaginatedData(items, page, pageSize) {
  const list = Array.isArray(items) ? items : [];
  const totalItems = list.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  return {
    totalItems,
    totalPages,
    safePage,
    startIndex,
    endIndex,
    items: list.slice(startIndex, endIndex),
  };
}

export function getInventoryCollections(products, businessConfig, expirationText) {
  const productList = Array.isArray(products) ? products : [];
  const usesExpiration = Boolean(businessConfig?.usesExpiration);

  const alerts = productList.filter(product =>
    Number(product.stock || 0) <= Number(product.minStock || 0)
  );
  const criticalProducts = productList.filter(product => Number(product.stock || 0) === 0);
  const expiredProducts = usesExpiration
    ? productList.filter(product => expirationText(product).label === 'Vencido')
    : [];
  const expiringProducts = usesExpiration
    ? productList.filter(product => ['Por vencer', 'Vence pronto'].includes(expirationText(product).label))
    : [];
  const expirationAlerts = [...expiredProducts, ...expiringProducts];
  const lowStockProducts = alerts.filter(product => Number(product.stock || 0) > 0);

  return {
    alerts,
    criticalProducts,
    expiredProducts,
    expiringProducts,
    expirationAlerts,
    lowStockProducts,
  };
}

export function buildInventoryMovements(purchases, sales) {
  const purchaseList = Array.isArray(purchases) ? purchases : [];
  const saleList = Array.isArray(sales) ? sales : [];

  const purchaseMovements = purchaseList.flatMap(purchase => {
    const items = purchase.items?.length > 0
      ? purchase.items
      : [{ productId: purchase.productId, product: purchase.product, quantity: purchase.quantity }];

    return items.map(item => ({
      id: `purchase-${purchase.id}-${item.productId || item.product}`,
      date: purchase.date,
      product: item.product,
      type: 'Compra',
      quantity: `+${item.quantity}`,
      detail: `${purchase.code} · ${purchase.provider}`,
      tone: 'cyan',
    }));
  });

  const saleMovements = saleList.flatMap(sale => {
    const items = sale.items?.length > 0
      ? sale.items
      : [{ productId: sale.productId, product: sale.product, quantity: sale.quantity }];

    return items.map(item => ({
      id: `sale-${sale.id}-${item.productId || item.product}`,
      date: sale.date,
      product: item.product,
      type: sale.status === 'Anulada' ? 'Anulación' : 'Venta',
      quantity: sale.status === 'Anulada' ? `+${item.quantity}` : `-${item.quantity}`,
      detail: `${sale.code} · ${sale.customer || 'Consumidor final'}`,
      tone: sale.status === 'Anulada' ? 'amber' : 'red',
    }));
  });

  return [...purchaseMovements, ...saleMovements];
}

export function buildInventoryExportRows(products, businessConfig, statusText, expirationText) {
  const productList = Array.isArray(products) ? products : [];
  const extraLabels = businessConfig?.extraLabels || {};

  return productList.map(product => {
    const baseRow = {
      SKU: product.sku,
      Codigo_barras: product.barcode || '',
      Producto: product.name,
      Categoria: product.category,
      Precio_unitario_venta: Number(product.price || 0).toFixed(2),
      Costo_unitario: Number(product.cost || 0).toFixed(2),
      Stock_actual: product.stock,
      Stock_minimo: product.minStock,
      Estado: statusText(product).label,
      Valor_inventario: (product.cost * product.stock).toFixed(2),
      Ganancia_potencial: ((product.price - product.cost) * product.stock).toFixed(2),
    };

    const extraRow = businessConfig?.productExtraFields ? {
      [extraLabels.brand?.label || 'Marca']: product.brand || '',
      [extraLabels.size?.label || 'Talla_medida']: product.size || '',
      [extraLabels.color?.label || 'Color_modelo']: product.color || '',
    } : {};

    const expirationRow = businessConfig?.usesExpiration ? {
      Lote: product.batchNumber || '',
      Fecha_ingreso: product.entryDate || '',
      Fecha_caducidad: product.expirationDate || '',
      Estado_caducidad: expirationText(product).label,
    } : {};

    return {
      ...baseRow,
      ...extraRow,
      ...expirationRow,
    };
  });
}
