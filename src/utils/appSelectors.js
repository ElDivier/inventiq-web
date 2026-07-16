import { looksLikeBarcodeSearch } from './productSearch';

export function getStoreItems(items = [], storeKey = 'demo') {
  return items.filter((item) => (item.storeId || 'demo') === storeKey);
}

export function getProductCategories(storeProducts = [], customProductCategories = []) {
  const productCategoryNames = storeProducts
    .map((product) => product.category)
    .filter(Boolean);

  return [
    'Todas',
    ...Array.from(new Set([...customProductCategories, ...productCategoryNames])),
  ];
}

export function getFilteredProducts(storeProducts = [], search = '', category = 'Todas') {
  const text = search.trim().toLowerCase();
  const searchLooksLikeCode = looksLikeBarcodeSearch(search);

  return storeProducts.filter((product) => {
    const matchCategory = category === 'Todas' || product.category === category;

    if (!text) {
      return matchCategory;
    }

    const matchSearch = searchLooksLikeCode
      ? (
          String(product.barcode || '').trim().toLowerCase() === text ||
          String(product.sku || '').trim().toLowerCase() === text
        )
      : [
          product.name,
          product.sku,
          product.barcode,
          product.brand,
          product.size,
          product.color,
          product.category,
        ].some((value) => String(value || '').toLowerCase().includes(text));

    return matchSearch && matchCategory;
  });
}

export function getInventoryStats(storeProducts = []) {
  const totalProducts = storeProducts.length;

  const lowStock = storeProducts.filter(
    (product) => Number(product.stock || 0) > 0 && Number(product.stock || 0) <= Number(product.minStock || 0)
  ).length;

  const noStock = storeProducts.filter(
    (product) => Number(product.stock || 0) === 0
  ).length;

  const inventoryValue = storeProducts.reduce(
    (sum, product) => sum + Number(product.cost || 0) * Number(product.stock || 0),
    0
  );

  const potentialProfit = storeProducts.reduce(
    (sum, product) =>
      sum +
      (Number(product.price || 0) - Number(product.cost || 0)) *
        Number(product.stock || 0),
    0
  );

  return {
    totalProducts,
    lowStock,
    noStock,
    inventoryValue,
    potentialProfit,
  };
}

export function getSalesStats(storeSales = []) {
  const completedSales = storeSales.filter((sale) => sale.status !== 'Anulada');

  const totalSales = completedSales.reduce(
    (sum, sale) => sum + Number(sale.total || 0),
    0
  );

  const totalProfit = completedSales.reduce(
    (sum, sale) => sum + Number(sale.profit || 0),
    0
  );

  const totalDiscount = completedSales.reduce(
    (sum, sale) => sum + Number(sale.discount || 0),
    0
  );

  const totalUnitsSold = completedSales.reduce(
    (sum, sale) => sum + Number(sale.quantity || 0),
    0
  );

  const topProduct = completedSales.reduce((acc, sale) => {
    acc[sale.product] = (acc[sale.product] || 0) + Number(sale.quantity || 0);
    return acc;
  }, {});

  const bestSeller =
    Object.entries(topProduct).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    'Sin ventas';

  return {
    totalSales,
    totalProfit,
    totalDiscount,
    totalUnitsSold,
    bestSeller,
  };
}
