import { exportToCSV } from './csv';

export function normalizeExcelHeader(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function normalizeExcelRow(row) {
  return Object.entries(row || {}).reduce((acc, [key, value]) => {
    acc[normalizeExcelHeader(key)] = value;
    return acc;
  }, {});
}

export function getExcelValue(row, aliases, fallback = '') {
  for (const alias of aliases) {
    const key = normalizeExcelHeader(alias);

    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return row[key];
    }
  }

  return fallback;
}

export function excelText(value) {
  return String(value ?? '').trim();
}

export function excelNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;

  const cleaned = String(value)
    .replace(/\$/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.-]/g, '');

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : fallback;
}

export function excelDate(value) {
  if (!value) return '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  const direct = new Date(text);

  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString().slice(0, 10);
  }

  return '';
}

export function downloadProductExcelTemplate(businessType = 'general') {
  const isClothing = businessType === 'ropa';

  const rows = isClothing ? [
    {
      'NOMBRE DEL PRODUCTO': 'CAMISA',
      'CATEGORIA': 'Camisas',
      'PRECIO DE VENTA': '57.00',
      'COSTO (OPCIONAL)': '',
      'STOCK ACTUAL': '1',
      'STOCK MINIMO': '1',
      'MARCA': 'PAUL FREDRICK',
      'TALLA': '15 1/2-36',
      'COLOR': 'ROSADA/AZUL',
      'DESCRIPCION': 'RAYAS-MANGA LARGA',
      'FOTO PRODUCTO': '',
      'CODIGO ALMACEN': 'SK1348',
      'CODIGO DE BARRAS': '',
    },
  ] : [
    {
      'NOMBRE DEL PRODUCTO': 'Arroz 1kg',
      'CATEGORIA': 'Víveres',
      'PRECIO DE VENTA': '1.25',
      'COSTO': '0.90',
      'STOCK ACTUAL': '10',
      'STOCK MINIMO': '3',
      'MARCA': '',
      'TALLA': '',
      'COLOR': '',
      'DESCRIPCION': 'Producto de ejemplo',
      'FOTO PRODUCTO': '',
      'CODIGO ALMACEN': 'PROD001',
      'CODIGO DE BARRAS': '',
      'FECHA DE CADUCIDAD': '',
      'LOTE': '',
    },
  ];

  exportToCSV(`inventiq_formato_productos_${businessType || 'general'}.csv`, rows);
}