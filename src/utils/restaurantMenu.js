import { PRODUCT_TYPES, inferProductTypeFromCategory } from '../config/productTypes';

export const RESTAURANT_MENU_STATUS = [
  { value: 'available', label: 'Disponible' },
  { value: 'paused', label: 'Pausado' },
  { value: 'seasonal', label: 'Temporal' },
];

export const RESTAURANT_STATIONS = [
  { value: 'cocina', label: 'Cocina' },
  { value: 'parrilla', label: 'Parrilla' },
  { value: 'cocina_fria', label: 'Cocina fría' },
  { value: 'bar', label: 'Bar / bebidas' },
  { value: 'postres', label: 'Postres' },
  { value: 'despacho', label: 'Despacho' },
];

export const RESTAURANT_SERVICE_PERIODS = [
  { value: 'desayuno', label: 'Desayuno' },
  { value: 'almuerzo', label: 'Almuerzo' },
  { value: 'cena', label: 'Cena' },
  { value: 'todo_dia', label: 'Todo el día' },
];

export const RESTAURANT_ORDER_CHANNELS = [
  { value: 'local', label: 'En local' },
  { value: 'takeaway', label: 'Para llevar' },
  { value: 'delivery', label: 'Delivery' },
];

export const RESTAURANT_DIETARY_TAGS = [
  { value: 'vegetariano', label: 'Vegetariano' },
  { value: 'vegano', label: 'Vegano' },
  { value: 'sin_gluten', label: 'Sin gluten' },
  { value: 'picante', label: 'Picante' },
  { value: 'favorito', label: 'Destacado' },
];

export function normalizeRestaurantProductMetadata(metadata = {}) {
  const safeMetadata = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata
    : {};

  return {
    menuStatus: safeMetadata.menuStatus || 'available',
    kitchenStation: safeMetadata.kitchenStation || 'cocina',
    preparationMinutes: Number(safeMetadata.preparationMinutes || 0),
    servicePeriods: Array.isArray(safeMetadata.servicePeriods) && safeMetadata.servicePeriods.length > 0
      ? safeMetadata.servicePeriods
      : ['todo_dia'],
    orderChannels: Array.isArray(safeMetadata.orderChannels) && safeMetadata.orderChannels.length > 0
      ? safeMetadata.orderChannels
      : ['local', 'takeaway', 'delivery'],
    dietaryTags: Array.isArray(safeMetadata.dietaryTags) ? safeMetadata.dietaryTags : [],
    allergens: safeMetadata.allergens || '',
    preparationNotes: safeMetadata.preparationNotes || '',
  };
}

export function getRestaurantProductRole(product = {}) {
  const inferredType = inferProductTypeFromCategory(product.category, 'restaurante');
  const storedType = product.productType || product.product_type;
  const normalizedCategory = String(product.category || '').trim().toLowerCase();
  const hasExplicitOperationalPrefix = [
    'insumos -',
    'preparaciones -',
    'preparación -',
    'empaques -',
    'empaque -',
    'menú -',
    'menu -',
  ].some(prefix => normalizedCategory.startsWith(prefix));
  const productType = hasExplicitOperationalPrefix ? inferredType : (storedType || inferredType);

  if (productType === PRODUCT_TYPES.INTERMEDIATE) return 'preparation';
  if ([PRODUCT_TYPES.RAW_MATERIAL, PRODUCT_TYPES.PACKAGING].includes(productType)) return 'supply';
  return 'menu';
}

export function isRestaurantMenuProduct(product = {}) {
  return getRestaurantProductRole(product) === 'menu';
}

export function isRestaurantPreparation(product = {}) {
  return getRestaurantProductRole(product) === 'preparation';
}

export function isRestaurantSupply(product = {}) {
  return getRestaurantProductRole(product) === 'supply';
}

export function isRestaurantMenuProductAvailable(product = {}) {
  if (!isRestaurantMenuProduct(product)) return false;
  const metadata = normalizeRestaurantProductMetadata(product.productMetadata || product.product_metadata);
  return metadata.menuStatus !== 'paused';
}

export function getRestaurantStatusMeta(product = {}) {
  const metadata = normalizeRestaurantProductMetadata(product.productMetadata || product.product_metadata);
  return RESTAURANT_MENU_STATUS.find(item => item.value === metadata.menuStatus) || RESTAURANT_MENU_STATUS[0];
}

export function getRestaurantStationLabel(value) {
  return RESTAURANT_STATIONS.find(item => item.value === value)?.label || 'Cocina';
}

export function getRestaurantServiceLabels(values = []) {
  const list = Array.isArray(values) ? values : [];
  return list
    .map(value => RESTAURANT_SERVICE_PERIODS.find(item => item.value === value)?.label)
    .filter(Boolean);
}

export function getRestaurantChannelLabels(values = []) {
  const list = Array.isArray(values) ? values : [];
  return list
    .map(value => RESTAURANT_ORDER_CHANNELS.find(item => item.value === value)?.label)
    .filter(Boolean);
}
