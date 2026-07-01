import { PRODUCT_SEARCH_LIMIT } from '../config/constants';
import { getProductDisplayName, searchProductsForPicker } from './products';

export function normalizeProductSearchValue(value) {
  return String(value || '').trim().toLowerCase();
}

export function looksLikeBarcodeSearch(value) {
  const text = String(value || '').trim();
  if (text.length < 4) return false;
  if (text.includes(' ')) return false;
  return /\d/.test(text) && /^[a-zA-Z0-9._-]+$/.test(text);
}

export function getProductCodeValues(product = {}) {
  return [product.barcode, product.sku, product.code]
    .filter(Boolean)
    .map(item => String(item).trim().toLowerCase());
}

export function productMatchesExactCode(product, search) {
  const normalized = normalizeProductSearchValue(search);
  if (!normalized) return false;
  return getProductCodeValues(product).includes(normalized);
}

export function findProductByCodeOrName(products = [], search, options = {}) {
  const normalized = normalizeProductSearchValue(search);
  const onlyWithStock = Boolean(options.onlyWithStock);

  if (!normalized) return null;

  const availableProducts = products.filter(product => {
    if (onlyWithStock && Number(product.stock || 0) <= 0) return false;
    return true;
  });

  const exactMatch = availableProducts.find(product => productMatchesExactCode(product, normalized));
  if (exactMatch) return exactMatch;

  return availableProducts.find(product =>
    getProductDisplayName(product).toLowerCase().includes(normalized)
  ) || null;
}

export function filterProductsForBarcodeSearch(products = [], search, options = {}) {
  const normalized = normalizeProductSearchValue(search);
  const limit = options.limit || PRODUCT_SEARCH_LIMIT;
  const onlyWithStock = Boolean(options.onlyWithStock);

  if (!looksLikeBarcodeSearch(search)) {
    return searchProductsForPicker(products, search, options);
  }

  if (!normalized) return [];

  return products
    .filter(product => {
      if (onlyWithStock && Number(product.stock || 0) <= 0) return false;
      return productMatchesExactCode(product, normalized);
    })
    .slice(0, limit);
}
