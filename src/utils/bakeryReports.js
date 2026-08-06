import { PRODUCT_TYPES, PRODUCT_TYPE_LABELS } from '../config/productTypes';
import {
  getBakeryProductType,
  getProductStockUnit,
  isBakeryIngredientProduct,
  isBakeryOutputProduct,
} from './productionRecipes';

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('es-EC')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isActiveProduct(product) {
  return normalizeText(product?.status || 'Activo') !== 'inactivo';
}

function buildProductLookup(products) {
  const byId = new Map();
  const byName = new Map();

  products.forEach((product) => {
    if (product?.id) byId.set(String(product.id), product);
    const normalizedName = normalizeText(product?.name);
    if (normalizedName && !byName.has(normalizedName)) byName.set(normalizedName, product);
  });

  return { byId, byName };
}

function getSaleLines(sale, productLookup) {
  if (Array.isArray(sale?.items) && sale.items.length > 0) return sale.items;

  const directProduct = sale?.productId
    ? productLookup.byId.get(String(sale.productId))
    : productLookup.byName.get(normalizeText(sale?.product));

  if (!directProduct) return [];

  return [{
    productId: directProduct.id,
    product: directProduct.name,
    quantity: Number(sale?.quantity || 0),
    subtotal: Number(sale?.total || sale?.subtotal || 0),
    profit: Number(sale?.profit || 0),
  }];
}

function buildSalesByProduct(products, sales) {
  const productLookup = buildProductLookup(products);
  const statsById = new Map();

  sales
    .filter((sale) => sale?.status !== 'Anulada')
    .forEach((sale) => {
      const saleDate = sale?.createdAt || sale?.date || '';
      getSaleLines(sale, productLookup).forEach((line) => {
        const product = line?.productId
          ? productLookup.byId.get(String(line.productId))
          : productLookup.byName.get(normalizeText(line?.product));

        if (!product?.id) return;

        const key = String(product.id);
        const current = statsById.get(key) || {
          productId: product.id,
          quantity: 0,
          revenue: 0,
          profit: 0,
          transactions: 0,
          lastSaleAt: '',
        };

        const quantity = Number(line?.quantity || 0);
        current.quantity += Number.isFinite(quantity) ? quantity : 0;
        current.revenue += Number(line?.subtotal || 0);
        current.profit += Number(line?.profit || 0);
        current.transactions += 1;

        if (saleDate && (!current.lastSaleAt || new Date(saleDate) > new Date(current.lastSaleAt))) {
          current.lastSaleAt = saleDate;
        }

        statsById.set(key, current);
      });
    });

  return statsById;
}

function buildConsumptionByProduct(batchItems, completedBatchIds) {
  const statsById = new Map();

  batchItems
    .filter((item) => completedBatchIds.has(String(item?.batch_id)))
    .forEach((item) => {
      const productId = String(item?.ingredient_product_id || '');
      if (!productId) return;

      const current = statsById.get(productId) || {
        productId,
        productName: item?.ingredient_name || '',
        quantity: 0,
        unit: item?.stock_unit || '',
        totalCost: 0,
        batchIds: new Set(),
        lastConsumedAt: '',
      };

      current.quantity += Number(item?.stock_quantity || 0);
      current.totalCost += Number(item?.total_cost || 0);
      if (item?.batch_id) current.batchIds.add(String(item.batch_id));

      const eventDate = item?.created_at || '';
      if (eventDate && (!current.lastConsumedAt || new Date(eventDate) > new Date(current.lastConsumedAt))) {
        current.lastConsumedAt = eventDate;
      }

      statsById.set(productId, current);
    });

  return statsById;
}

function makeInventorySection(products, productType, label) {
  const filtered = products.filter((product) => getBakeryProductType(product) === productType);
  return {
    productType,
    label,
    products: filtered,
    productCount: filtered.length,
    inventoryValue: filtered.reduce(
      (sum, product) => sum + Number(product?.stock || 0) * Number(product?.cost || 0),
      0,
    ),
  };
}

export function getBakeryReportProductTypeLabel(product) {
  const productType = getBakeryProductType(product);
  return PRODUCT_TYPE_LABELS[productType] || 'Producto';
}

export function buildBakeryReportModel({ products = [], sales = [], batches = [], batchItems = [] }) {
  const activeProducts = products.filter(isActiveProduct);
  const inventoryProducts = products.filter((product) => getBakeryProductType(product) !== PRODUCT_TYPES.SERVICE);
  const finishedProducts = activeProducts.filter(isBakeryOutputProduct);
  const ingredientProducts = activeProducts.filter(isBakeryIngredientProduct);
  const salesByProduct = buildSalesByProduct(activeProducts, sales);
  const completedBatchIds = new Set(
    batches
      .filter((batch) => batch?.status !== 'cancelled')
      .map((batch) => String(batch.id)),
  );
  const consumptionByProduct = buildConsumptionByProduct(batchItems, completedBatchIds);

  const finishedWithoutSales = finishedProducts
    .filter((product) => !salesByProduct.has(String(product.id)))
    .sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0));

  const productionSuggestions = finishedProducts
    .filter((product) => Number(product.minStock || 0) > 0 && Number(product.stock || 0) <= Number(product.minStock || 0))
    .sort((a, b) => {
      const aGap = Number(a.minStock || 0) * 2 - Number(a.stock || 0);
      const bGap = Number(b.minStock || 0) * 2 - Number(b.stock || 0);
      return bGap - aGap;
    });

  const inputRestockSuggestions = ingredientProducts
    .filter((product) => Number(product.minStock || 0) > 0 && Number(product.stock || 0) <= Number(product.minStock || 0))
    .sort((a, b) => {
      const aGap = Number(a.minStock || 0) * 2 - Number(a.stock || 0);
      const bGap = Number(b.minStock || 0) * 2 - Number(b.stock || 0);
      return bGap - aGap;
    });

  const inputsWithoutConsumption = ingredientProducts
    .filter((product) => !consumptionByProduct.has(String(product.id)))
    .sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0));

  const topConsumedInputs = ingredientProducts
    .map((product) => ({
      product,
      consumption: consumptionByProduct.get(String(product.id)),
    }))
    .filter((entry) => entry.consumption)
    .sort((a, b) => Number(b.consumption.totalCost || 0) - Number(a.consumption.totalCost || 0));

  const allFinishedProducts = inventoryProducts.filter(isBakeryOutputProduct);
  const finishedInventorySection = {
    productType: PRODUCT_TYPES.FINISHED_PRODUCT,
    label: 'Productos terminados',
    products: allFinishedProducts,
    productCount: allFinishedProducts.length,
    inventoryValue: allFinishedProducts.reduce(
      (sum, product) => sum + Number(product?.stock || 0) * Number(product?.cost || 0),
      0,
    ),
  };

  const inventorySections = [
    makeInventorySection(inventoryProducts, PRODUCT_TYPES.RAW_MATERIAL, 'Materias primas'),
    makeInventorySection(inventoryProducts, PRODUCT_TYPES.PACKAGING, 'Empaques'),
    makeInventorySection(inventoryProducts, PRODUCT_TYPES.INTERMEDIATE, 'Productos intermedios'),
    finishedInventorySection,
  ];

  const inventoryValue = inventorySections.reduce((sum, section) => sum + section.inventoryValue, 0);
  const ingredientInventoryValue = inventorySections
    .filter((section) => section.productType !== PRODUCT_TYPES.FINISHED_PRODUCT)
    .reduce((sum, section) => sum + section.inventoryValue, 0);
  const finishedInventoryValue = finishedInventorySection.inventoryValue;

  return {
    finishedProducts,
    ingredientProducts,
    finishedWithoutSales,
    productionSuggestions,
    inputRestockSuggestions,
    inputsWithoutConsumption,
    topConsumedInputs,
    inventorySections,
    inventoryValue,
    ingredientInventoryValue,
    finishedInventoryValue,
    salesByProduct,
    consumptionByProduct,
  };
}

export function getBakerySuggestedQuantity(product) {
  return Math.max(
    Number(product?.minStock || 0) * 2 - Number(product?.stock || 0),
    1,
  );
}

export function formatBakeryReportQuantity(value, unit = '') {
  const number = Number(value || 0);
  const formatted = new Intl.NumberFormat('es-EC', {
    maximumFractionDigits: 3,
  }).format(number);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function getBakeryProductStockUnit(product) {
  return getProductStockUnit(product) || 'unidad';
}
