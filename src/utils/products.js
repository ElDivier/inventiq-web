import { PRODUCT_SEARCH_LIMIT } from '../config/constants';

export function getProductDisplayName(product) {
  if (!product) return 'Producto';

  const name = String(product.name || 'Producto').trim();
  const details = [product.brand, product.size, product.color]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .join(' · ');

  return details ? `${name} - ${details}` : name;
}

export function getProductVariantText(product) {
  if (!product) return '';

  return [product.brand, product.size, product.color]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .join(' · ');
}

export function productMatchesSearch(product, text, onlyWithStock = false) {
  if (onlyWithStock && Number(product.stock || 0) <= 0) return false;

  const normalized = String(text || '').trim().toLowerCase();

  if (!normalized) return false;

  return [
    product.name,
    product.sku,
    product.barcode,
    product.brand,
    product.size,
    product.color,
    product.category,
  ].some(value => String(value || '').toLowerCase().includes(normalized));
}

export function searchProductsForPicker(products, text, options = {}) {
  const normalized = String(text || '').trim().toLowerCase();
  const limit = options.limit || PRODUCT_SEARCH_LIMIT;
  const onlyWithStock = Boolean(options.onlyWithStock);

  if (!normalized) return [];

  const exactMatches = products.filter(product => {
    if (onlyWithStock && Number(product.stock || 0) <= 0) return false;

    return (
      String(product.barcode || '').trim().toLowerCase() === normalized ||
      String(product.sku || '').trim().toLowerCase() === normalized
    );
  });

  if (exactMatches.length > 0) return exactMatches.slice(0, limit);

  if (normalized.length < 2) return [];

  return products
    .filter(product => productMatchesSearch(product, normalized, onlyWithStock))
    .sort((a, b) => {
      const aName = String(a.name || '').toLowerCase();
      const bName = String(b.name || '').toLowerCase();

      const aStarts = aName.startsWith(normalized) ? 0 : 1;
      const bStarts = bName.startsWith(normalized) ? 0 : 1;

      return aStarts - bStarts || aName.localeCompare(bName);
    })
    .slice(0, limit);
}

export function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export function validateExcelFile(file) {
  const name = String(file?.name || '').toLowerCase();

  const validExtension = ['.xlsx', '.xls', '.csv'].some(extension => name.endsWith(extension));

  if (!validExtension) return 'Selecciona un archivo Excel o CSV válido.';

  if (file.size > 10 * 1024 * 1024) {
    return 'El archivo es demasiado grande. Divide el inventario en archivos menores a 10MB.';
  }

  return null;
}