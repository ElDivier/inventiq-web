import { isInternalStockCategory } from '../config/productTypes';

export const CAFETERIA_MENU_STATUS = [
  { value: 'available', label: 'Disponible' },
  { value: 'paused', label: 'Pausado' },
  { value: 'seasonal', label: 'Temporal' },
];

export const CAFETERIA_STATIONS = [
  { value: 'barra', label: 'Barra' },
  { value: 'cocina', label: 'Cocina' },
  { value: 'reposteria', label: 'Repostería' },
  { value: 'entrega', label: 'Entrega' },
];

export const CAFETERIA_TEMPERATURES = [
  { value: 'caliente', label: 'Caliente' },
  { value: 'frio', label: 'Frío' },
  { value: 'ambiente', label: 'Ambiente' },
];

export const CAFETERIA_ORDER_CHANNELS = [
  { value: 'local', label: 'En local' },
  { value: 'takeaway', label: 'Para llevar' },
  { value: 'delivery', label: 'Delivery' },
];

function normalizeOptionList(value = []) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (typeof item === 'string') {
        return { id: `${index}-${item.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, label: item, priceDelta: 0 };
      }
      const label = String(item?.label || item?.name || '').trim();
      if (!label) return null;
      return {
        id: String(item?.id || `${index}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`),
        label,
        priceDelta: Math.max(0, Number(item?.priceDelta ?? item?.price ?? 0) || 0),
      };
    })
    .filter(Boolean);
}

export function normalizeCafeteriaProductMetadata(metadata = {}) {
  const safe = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
  return {
    menuStatus: safe.menuStatus || 'available',
    station: safe.station || safe.kitchenStation || 'barra',
    preparationMinutes: Math.max(0, Number(safe.preparationMinutes || 0)),
    orderChannels: Array.isArray(safe.orderChannels) && safe.orderChannels.length > 0
      ? safe.orderChannels
      : ['local', 'takeaway', 'delivery'],
    temperatures: Array.isArray(safe.temperatures) ? safe.temperatures : [],
    sizes: normalizeOptionList(safe.sizes),
    milkOptions: normalizeOptionList(safe.milkOptions),
    syrupOptions: normalizeOptionList(safe.syrupOptions),
    extraShotEnabled: Boolean(safe.extraShotEnabled),
    extraShotPrice: Math.max(0, Number(safe.extraShotPrice || 0)),
    preparationNotes: String(safe.preparationNotes || ''),
  };
}

export function isCafeteriaMenuProduct(product = {}) {
  return !isInternalStockCategory(product?.category, 'cafeteria');
}

export function isCafeteriaMenuProductAvailable(product = {}, orderType = 'local') {
  if (!isCafeteriaMenuProduct(product)) return false;
  const metadata = normalizeCafeteriaProductMetadata(product.productMetadata || product.product_metadata);
  if (metadata.menuStatus === 'paused') return false;
  return metadata.orderChannels.length === 0 || metadata.orderChannels.includes(orderType);
}

export function getCafeteriaStationLabel(value) {
  return CAFETERIA_STATIONS.find((item) => item.value === value)?.label || 'Barra';
}

export function getCafeteriaMenuStatusLabel(value) {
  return CAFETERIA_MENU_STATUS.find((item) => item.value === value)?.label || 'Disponible';
}

export function buildCafeteriaVariantSummary({ size, milk, temperature, syrup, extraShot } = {}) {
  const temperatureLabel = CAFETERIA_TEMPERATURES.find((item) => item.value === temperature)?.label || '';
  return [size?.label, milk?.label, temperatureLabel, syrup?.label, extraShot ? 'Shot extra' : '']
    .filter(Boolean)
    .join(' · ');
}
