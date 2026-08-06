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


export function excelList(value) {
  return String(value || '')
    .split(/[;,|]/)
    .map(item => item.trim())
    .filter(Boolean);
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
        'NOMBRE DEL PRODUCTO': 'Hamburguesa clásica',
        CATEGORIA: 'Menú - Platos fuertes',
        'PRECIO DE VENTA': '6.50',
        COSTO: '2.80',
        'STOCK ACTUAL': '20',
        'STOCK MINIMO': '0',
        'UNIDAD DE STOCK': 'unidad',
        MARCA: '',
        TALLA: 'Porción individual',
        COLOR: 'A la parrilla',
        'ESTADO MENU': 'available',
        'ESTACION COCINA': 'parrilla',
        'TIEMPO PREPARACION MIN': '15',
        'HORARIOS DE SERVICIO': 'almuerzo;cena',
        'CANALES DE VENTA': 'local;takeaway;delivery',
        ETIQUETAS: 'favorito',
        ALERGENOS: 'Gluten y lácteos',
        DESCRIPCION: 'Carne, queso, vegetales y papas',
        'FOTO PRODUCTO': '',
        'CODIGO ALMACEN': 'MENU001',
        'CODIGO DE BARRAS': '',
        'FECHA DE CADUCIDAD': '',
        LOTE: '',
      },
      {
        'NOMBRE DEL PRODUCTO': 'Salsa de la casa',
        CATEGORIA: 'Preparaciones - Salsas',
        'PRECIO DE VENTA': '',
        COSTO: '1.20',
        'STOCK ACTUAL': '3',
        'STOCK MINIMO': '1',
        'UNIDAD DE STOCK': 'litro',
        MARCA: 'Cocina fría',
        TALLA: 'litro',
        COLOR: 'Uso en hamburguesas y entradas',
        'ESTADO MENU': '',
        'ESTACION COCINA': '',
        'TIEMPO PREPARACION MIN': '',
        'HORARIOS DE SERVICIO': '',
        'CANALES DE VENTA': '',
        ETIQUETAS: '',
        ALERGENOS: 'Huevo',
        DESCRIPCION: 'Preparación intermedia refrigerada',
        'FOTO PRODUCTO': '',
        'CODIGO ALMACEN': 'PREP001',
        'CODIGO DE BARRAS': '',
        'FECHA DE CADUCIDAD': '',
        LOTE: 'PREP-001',
      },
      {
        'NOMBRE DEL PRODUCTO': 'Carne molida',
        CATEGORIA: 'Insumos - Carnes',
        'PRECIO DE VENTA': '',
        COSTO: '5.20',
        'STOCK ACTUAL': '10',
        'STOCK MINIMO': '3',
        'UNIDAD DE STOCK': 'kg',
        MARCA: 'Proveedor local',
        TALLA: 'kg',
        COLOR: 'Parrilla',
        'ESTADO MENU': '',
        'ESTACION COCINA': '',
        'TIEMPO PREPARACION MIN': '',
        'HORARIOS DE SERVICIO': '',
        'CANALES DE VENTA': '',
        ETIQUETAS: '',
        ALERGENOS: '',
        DESCRIPCION: 'Materia prima para platos del menú',
        'FOTO PRODUCTO': '',
        'CODIGO ALMACEN': 'INS001',
        'CODIGO DE BARRAS': '',
        'FECHA DE CADUCIDAD': '',
        LOTE: 'LOTE-001',
      },
      {
        'NOMBRE DEL PRODUCTO': 'Envase para llevar',
        CATEGORIA: 'Empaques - Para llevar',
        'PRECIO DE VENTA': '',
        COSTO: '0.18',
        'STOCK ACTUAL': '100',
        'STOCK MINIMO': '25',
        'UNIDAD DE STOCK': 'unidad',
        MARCA: 'Proveedor de empaques',
        TALLA: 'unidad',
        COLOR: 'Para llevar',
        'ESTADO MENU': '',
        'ESTACION COCINA': '',
        'TIEMPO PREPARACION MIN': '',
        'HORARIOS DE SERVICIO': '',
        'CANALES DE VENTA': '',
        ETIQUETAS: '',
        ALERGENOS: '',
        DESCRIPCION: 'Empaque de uso interno',
        'FOTO PRODUCTO': '',
        'CODIGO ALMACEN': 'EMP001',
        'CODIGO DE BARRAS': '',
        'FECHA DE CADUCIDAD': '',
        LOTE: '',
      },
    ];
  }



  if (businessType === 'panaderia') {
    return [
      {
        'NOMBRE DEL PRODUCTO': 'Pan de sal',
        CATEGORIA: 'Producto terminado - Panes',
        'PRECIO DE VENTA': '0.25',
        COSTO: '0.12',
        'STOCK ACTUAL': '100',
        'STOCK MINIMO': '20',
        MARCA: 'Producción propia',
        TALLA: 'Unidad',
        COLOR: 'Tradicional',
        DESCRIPCION: 'Producto terminado listo para la venta',
        'FOTO PRODUCTO': '',
        'CODIGO ALMACEN': 'PAN001',
        'CODIGO DE BARRAS': '',
        'FECHA DE CADUCIDAD': '',
        LOTE: 'PROD-001',
      },
      {
        'NOMBRE DEL PRODUCTO': 'Harina de trigo',
        CATEGORIA: 'Materia prima - Harinas',
        'PRECIO DE VENTA': '',
        COSTO: '0.85',
        'STOCK ACTUAL': '50',
        'STOCK MINIMO': '10',
        MARCA: 'Proveedor local',
        TALLA: 'kg',
        COLOR: 'Masas de pan',
        DESCRIPCION: 'Materia prima para producción',
        'FOTO PRODUCTO': '',
        'CODIGO ALMACEN': 'MAT001',
        'CODIGO DE BARRAS': '',
        'FECHA DE CADUCIDAD': '',
        LOTE: 'MP-001',
      },
      {
        'NOMBRE DEL PRODUCTO': 'Funda para pan',
        CATEGORIA: 'Empaque - Fundas',
        'PRECIO DE VENTA': '',
        COSTO: '0.03',
        'STOCK ACTUAL': '500',
        'STOCK MINIMO': '100',
        MARCA: 'Proveedor de empaques',
        TALLA: 'Unidad',
        COLOR: 'Empaque de venta',
        DESCRIPCION: 'Empaque interno de operación',
        'FOTO PRODUCTO': '',
        'CODIGO ALMACEN': 'EMP001',
        'CODIGO DE BARRAS': '',
        'FECHA DE CADUCIDAD': '',
        LOTE: '',
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
