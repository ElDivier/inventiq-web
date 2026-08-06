export const PRODUCT_TYPES = {
  SALE_PRODUCT: 'sale_product',
  RAW_MATERIAL: 'raw_material',
  PACKAGING: 'packaging',
  INTERMEDIATE: 'intermediate',
  FINISHED_PRODUCT: 'finished_product',
  SERVICE: 'service',
};

export const PRODUCT_TYPE_LABELS = {
  [PRODUCT_TYPES.SALE_PRODUCT]: 'Producto de venta',
  [PRODUCT_TYPES.RAW_MATERIAL]: 'Materia prima',
  [PRODUCT_TYPES.PACKAGING]: 'Empaque',
  [PRODUCT_TYPES.INTERMEDIATE]: 'Producto intermedio',
  [PRODUCT_TYPES.FINISHED_PRODUCT]: 'Producto terminado',
  [PRODUCT_TYPES.SERVICE]: 'Servicio',
};

const bakeryInternalPrefixes = [
  'materia prima -',
  'producto intermedio -',
  'empaque -',
  'insumos -',
];

const restaurantInternalPrefixes = [
  'insumos -',
  'preparaciones -',
  'preparación -',
  'empaques -',
  'empaque -',
];

export function isInternalStockCategory(category, businessType = 'general') {
  const normalizedCategory = String(category || '').trim().toLowerCase();

  if (businessType === 'restaurante') {
    return restaurantInternalPrefixes.some(prefix => normalizedCategory.startsWith(prefix));
  }

  if (businessType === 'cafeteria') {
    return normalizedCategory.startsWith('insumos -') || normalizedCategory.includes('insumos');
  }

  if (businessType === 'panaderia') {
    return bakeryInternalPrefixes.some(prefix => normalizedCategory.startsWith(prefix));
  }

  return false;
}

export function inferProductTypeFromCategory(category, businessType = 'general') {
  const normalizedCategory = String(category || '').trim().toLowerCase();

  if (businessType === 'restaurante') {
    if (normalizedCategory.startsWith('preparaciones -') || normalizedCategory.startsWith('preparación -')) return PRODUCT_TYPES.INTERMEDIATE;
    if (normalizedCategory.startsWith('empaques -') || normalizedCategory.startsWith('empaque -')) return PRODUCT_TYPES.PACKAGING;
    if (normalizedCategory.startsWith('insumos -')) return PRODUCT_TYPES.RAW_MATERIAL;
    if (normalizedCategory.startsWith('menú -') || normalizedCategory.startsWith('menu -')) return PRODUCT_TYPES.SALE_PRODUCT;
  }

  if (businessType === 'panaderia') {
    if (normalizedCategory.startsWith('materia prima -')) return PRODUCT_TYPES.RAW_MATERIAL;
    if (normalizedCategory.startsWith('empaque -')) return PRODUCT_TYPES.PACKAGING;
    if (normalizedCategory.startsWith('producto intermedio -')) return PRODUCT_TYPES.INTERMEDIATE;
    if (normalizedCategory.startsWith('producto terminado -')) return PRODUCT_TYPES.FINISHED_PRODUCT;
    if (normalizedCategory.startsWith('insumos -')) return PRODUCT_TYPES.RAW_MATERIAL;
  }

  if (isInternalStockCategory(category, businessType)) {
    return PRODUCT_TYPES.RAW_MATERIAL;
  }

  return PRODUCT_TYPES.SALE_PRODUCT;
}

export function cleanOperationalCategoryLabel(category) {
  return String(category || 'Sin categoría')
    .replace(/^Menú -\s*/i, '')
    .replace(/^Insumos -\s*/i, '')
    .replace(/^Producto terminado -\s*/i, '')
    .replace(/^Materia prima -\s*/i, '')
    .replace(/^Producto intermedio -\s*/i, '')
    .replace(/^Empaque -\s*/i, '')
    .replace(/^Empaques -\s*/i, '')
    .replace(/^Preparación -\s*/i, '')
    .replace(/^Preparaciones -\s*/i, '');
}
