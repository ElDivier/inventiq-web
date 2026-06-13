export const businessTypes = [
  { value: 'general', label: 'Tienda general / minimarket' },
  { value: 'ropa', label: 'Tienda de ropa' },
  { value: 'cafeteria', label: 'Cafetería / restaurante pequeño' },
  { value: 'ferreteria', label: 'Ferretería / repuestos' },
  { value: 'taller', label: 'Taller / servicios' },
  { value: 'otro', label: 'Otro negocio' },
];

export function getBusinessConfig(type = 'general') {
  const configs = {
    general: {
      label: 'Tienda general',
      usesExpiration: true,
      productExtraFields: false,
      productNamePlaceholder: 'Ej: Arroz 1kg',
      categoryPlaceholder: 'Ej: Bebidas, snacks, limpieza',
      productSectionTitle: 'Productos',
      inventorySectionTitle: 'Inventario',
      salesSectionTitle: 'Ventas',
      extraLabels: {},
      defaultCategories: [
        'Bebidas',
        'Snacks',
        'Limpieza',
        'Abarrotes',
        'Cuidado personal',
      ],
    },

    ropa: {
      label: 'Tienda de ropa',
      usesExpiration: false,
      productExtraFields: true,
      productNamePlaceholder: 'Ej: Camiseta oversize',
      categoryPlaceholder: 'Ej: Mujer - Blusas, Hombre - Camisas',
      productSectionTitle: 'Productos',
      inventorySectionTitle: 'Inventario',
      salesSectionTitle: 'Ventas',
      extraLabels: {
        brand: {
          label: 'Marca',
          placeholder: 'Ej: Nike, Adidas, Shein',
        },
        size: {
          label: 'Talla',
          placeholder: 'Ej: S, M, L, 32, 38',
        },
        color: {
          label: 'Color',
          placeholder: 'Ej: Negro, blanco, azul',
        },
      },
      defaultCategories: [
        'Mujer - Blusas',
        'Mujer - Vestidos',
        'Mujer - Pantalones',
        'Mujer - Zapatos',
        'Mujer - Accesorios',
        'Hombre - Camisas',
        'Hombre - Camisetas',
        'Hombre - Pantalones',
        'Hombre - Zapatos',
        'Niña - Vestidos',
        'Niño - Conjuntos',
      ],
    },

    cafeteria: {
      label: 'Cafetería / restaurante',
      usesExpiration: true,
      productExtraFields: true,

      productNamePlaceholder: 'Ej: Capuchino, Cheesecake, Leche 1L, Vaso 12oz',
      categoryPlaceholder: 'Ej: Menú - Café caliente, Insumos - Lácteos',

      productSectionTitle: 'Menú e insumos',
      inventorySectionTitle: 'Insumos y stock',
      salesSectionTitle: 'Pedidos / ventas',

      extraLabels: {
        brand: {
          label: 'Marca / proveedor',
          placeholder: 'Ej: Café Vélez, proveedor local, Supermaxi',
        },
        size: {
          label: 'Presentación / tamaño',
          placeholder: 'Ej: 250g, 1L, 12oz, grande, mediano',
        },
        color: {
          label: 'Variante / uso',
          placeholder: 'Ej: Bebida caliente, postre, insumo, desechable',
        },
      },

      defaultCategories: [
        'Menú - Café caliente',
        'Menú - Café frío',
        'Menú - Bebidas frías',
        'Menú - Postres',
        'Menú - Sanduches',
        'Menú - Desayunos',
        'Menú - Almuerzos',
        'Menú - Combos',
        'Insumos - Café',
        'Insumos - Lácteos',
        'Insumos - Azúcar y endulzantes',
        'Insumos - Panadería',
        'Insumos - Frutas',
        'Insumos - Salsas',
        'Insumos - Desechables',
        'Insumos - Limpieza',
      ],
    },

    ferreteria: {
      label: 'Ferretería / repuestos',
      usesExpiration: false,
      productExtraFields: true,
      productNamePlaceholder: 'Ej: Tornillo 1/2',
      categoryPlaceholder: 'Ej: Herramientas, pinturas, repuestos',
      productSectionTitle: 'Productos',
      inventorySectionTitle: 'Inventario',
      salesSectionTitle: 'Ventas',
      extraLabels: {
        brand: {
          label: 'Marca',
          placeholder: 'Ej: Stanley, Truper, Bosch',
        },
        size: {
          label: 'Medida / dimensión',
          placeholder: 'Ej: 1/2, 10 mm, 3 m',
        },
        color: {
          label: 'Modelo / especificación',
          placeholder: 'Ej: galvanizado, industrial, universal',
        },
      },
      defaultCategories: [
        'Herramientas',
        'Tornillos',
        'Pinturas',
        'Repuestos',
        'Electricidad',
        'Plomería',
        'Construcción',
      ],
    },

    taller: {
      label: 'Taller / servicios',
      usesExpiration: false,
      productExtraFields: true,
      productNamePlaceholder: 'Ej: Filtro de aceite',
      categoryPlaceholder: 'Ej: Repuestos, lubricantes, accesorios',
      productSectionTitle: 'Repuestos',
      inventorySectionTitle: 'Inventario',
      salesSectionTitle: 'Servicios / ventas',
      extraLabels: {
        brand: {
          label: 'Marca',
          placeholder: 'Ej: Toyota, Bosch, Genérico',
        },
        size: {
          label: 'Vehículo / modelo compatible',
          placeholder: 'Ej: Aveo, Hilux, universal',
        },
        color: {
          label: 'Código de pieza / especificación',
          placeholder: 'Ej: FIL-001, 10W-30, original',
        },
      },
      defaultCategories: [
        'Repuestos',
        'Lubricantes',
        'Filtros',
        'Accesorios',
        'Herramientas',
        'Servicios',
      ],
    },

    otro: {
      label: 'Otro negocio',
      usesExpiration: true,
      productExtraFields: false,
      productNamePlaceholder: 'Ej: Producto principal',
      categoryPlaceholder: 'Ej: Categoría del producto',
      productSectionTitle: 'Productos',
      inventorySectionTitle: 'Inventario',
      salesSectionTitle: 'Ventas',
      extraLabels: {},
      defaultCategories: [
        'General',
        'Productos principales',
        'Insumos',
        'Servicios',
      ],
    },
  };

  return configs[type] || configs.general;
}