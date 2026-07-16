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
  const rows = getTemplateRows(businessType);
  exportToCSV(`inventiq_formato_productos_${businessType || 'general'}.csv`, rows);
}

function getTemplateRows(businessType) {
  if (businessType === 'ropa') {
    return [
      {
        'NOMBRE DEL PRODUCTO': 'CAMISA',
        CATEGORIA: 'Camisas',
        'PRECIO DE VENTA': '57.00',
        'COSTO (OPCIONAL)': '',
        'STOCK ACTUAL': '1',
        'STOCK MINIMO': '1',
        MARCA: 'PAUL FREDRICK',
        TALLA: '15 1/2-36',
        COLOR: 'ROSADA/AZUL',
        DESCRIPCION: 'RAYAS-MANGA LARGA',
        'FOTO PRODUCTO': '',
        'CODIGO ALMACEN': 'SK1348',
        'CODIGO DE BARRAS': '',
      },
    ];
  }

  if (businessType === 'restaurante') {
    return [
      {
        'NOMBRE DEL PRODUCTO': 'Almuerzo ejecutivo',
        CATEGORIA: 'Menú - Almuerzos',
        'PRECIO DE VENTA': '3.50',
        COSTO: '1.75',
        'STOCK ACTUAL': '20',
        'STOCK MINIMO': '0',
        MARCA: 'Cocina',
        TALLA: 'Porción individual',
        COLOR: 'Incluye sopa, plato fuerte y bebida',
        DESCRIPCION: 'Producto de venta del restaurante',
        'FOTO PRODUCTO': '',
        'CODIGO ALMACEN': 'MENU001',
        'CODIGO DE BARRAS': '',
        'FECHA DE CADUCIDAD': '',
        LOTE: '',
      },
      {
        'NOMBRE DEL PRODUCTO': 'Pollo',
        CATEGORIA: 'Insumos - Pollo',
        'PRECIO DE VENTA': '',
        COSTO: '2.10',
        'STOCK ACTUAL': '10',
        'STOCK MINIMO': '3',
        MARCA: 'Proveedor local',
        TALLA: 'kg',
        COLOR: 'Cocina / platos fuertes',
        DESCRIPCION: 'Insumo interno para recetas',
        'FOTO PRODUCTO': '',
        'CODIGO ALMACEN': 'INS001',
        'CODIGO DE BARRAS': '',
        'FECHA DE CADUCIDAD': '',
        LOTE: 'LOTE-001',
      },
    ];
  }

  if (businessType === 'cafeteria') {
    return [
      {
        'NOMBRE DEL PRODUCTO': 'Capuchino',
        CATEGORIA: 'Menú - Café caliente',
        'PRECIO DE VENTA': '2.50',
        COSTO: '0.90',
        'STOCK ACTUAL': '20',
        'STOCK MINIMO': '0',
        MARCA: 'Casa',
        TALLA: '12oz',
        COLOR: 'Bebida caliente',
        DESCRIPCION: 'Producto de venta de cafetería',
        'FOTO PRODUCTO': '',
        'CODIGO ALMACEN': 'MENU001',
        'CODIGO DE BARRAS': '',
        'FECHA DE CADUCIDAD': '',
        LOTE: '',
      },
      {
        'NOMBRE DEL PRODUCTO': 'Leche entera',
        CATEGORIA: 'Insumos - Lácteos',
        'PRECIO DE VENTA': '',
        COSTO: '1.10',
        'STOCK ACTUAL': '12',
        'STOCK MINIMO': '3',
        MARCA: 'Proveedor local',
        TALLA: '1L',
        COLOR: 'Bebidas calientes',
        DESCRIPCION: 'Insumo interno para recetas',
        'FOTO PRODUCTO': '',
        'CODIGO ALMACEN': 'INS001',
        'CODIGO DE BARRAS': '',
        'FECHA DE CADUCIDAD': '',
        LOTE: 'LOTE-001',
      },
    ];
  }

  return [
    {
      'NOMBRE DEL PRODUCTO': 'Arroz 1kg',
      CATEGORIA: 'Víveres',
      'PRECIO DE VENTA': '1.25',
      COSTO: '0.90',
      'STOCK ACTUAL': '10',
      'STOCK MINIMO': '3',
      MARCA: '',
      TALLA: '',
      COLOR: '',
      DESCRIPCION: 'Producto de ejemplo',
      'FOTO PRODUCTO': '',
      'CODIGO ALMACEN': 'PROD001',
      'CODIGO DE BARRAS': '',
      'FECHA DE CADUCIDAD': '',
      LOTE: '',
    },
  ];
}
