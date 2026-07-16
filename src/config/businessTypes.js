export const businessTypes = [
  { value: 'general', label: 'Tienda general / minimarket' },
  { value: 'ropa', label: 'Tienda de ropa' },
  { value: 'cafeteria', label: 'Cafetería' },
  { value: 'restaurante', label: 'Restaurante' },
  { value: 'ferreteria', label: 'Ferretería / repuestos' },
  { value: 'taller', label: 'Taller / servicios' },
  { value: 'otro', label: 'Otro negocio' },
];

const standardFeatures = {
  salesMode: 'standard',
  productMode: 'standard',
  cashMode: 'standard',
  usesRecipes: false,
  usesModifiers: false,
  usesTables: false,
  usesDailyCash: false,
};

export function getBusinessConfig(type = 'general') {
  const configs = {
    general: {
      ...standardFeatures,
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
      ...standardFeatures,
      cashMode: 'daily-cash',
      usesDailyCash: true,
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
      label: 'Cafetería',
      salesMode: 'food',
      productMode: 'menu-inventory',
      cashMode: 'daily-cash',
      usesRecipes: true,
      usesModifiers: true,
      usesTables: false,
      usesDailyCash: true,
      usesExpiration: true,
      productExtraFields: true,

      productNamePlaceholder: 'Ej: Capuchino, cheesecake, leche 1L, vaso 12oz',
      categoryPlaceholder: 'Ej: Menú - Café caliente, Insumos - Lácteos',

      productSectionTitle: 'Menú e insumos',
      inventorySectionTitle: 'Insumos y stock',
      salesSectionTitle: 'Ventas de cafetería',

      foodLabels: {
        menuTitle: 'Menú',
        ingredientsTitle: 'Insumos',
        quickSaleTitle: 'Caja rápida',
        orderTitle: 'Pedido',
        recipeTitle: 'Receta',
        modifiersTitle: 'Extras y variantes',
      },

      extraLabels: {
        brand: {
          label: 'Marca / proveedor',
          placeholder: 'Ej: Café Vélez, proveedor local',
        },
        size: {
          label: 'Presentación / tamaño',
          placeholder: 'Ej: 250g, 1L, 12oz, grande, mediano',
        },
        color: {
          label: 'Variante / uso',
          placeholder: 'Ej: Bebida caliente, postre, insumo',
        },
      },

      defaultCategories: [
        'Menú - Café caliente',
        'Menú - Café frío',
        'Menú - Bebidas frías',
        'Menú - Postres',
        'Menú - Sanduches',
        'Menú - Desayunos',
        'Menú - Combos',
        'Insumos - Café',
        'Insumos - Lácteos',
        'Insumos - Azúcar y endulzantes',
        'Insumos - Panadería',
        'Insumos - Frutas',
        'Insumos - Desechables',
        'Insumos - Limpieza',
      ],
    },

    restaurante: {
      label: 'Restaurante',
      salesMode: 'food',
      productMode: 'menu-inventory',
      cashMode: 'daily-cash',
      usesRecipes: true,
      usesModifiers: true,
      usesTables: true,
      usesDailyCash: true,
      usesExpiration: true,
      productExtraFields: true,

      productNamePlaceholder: 'Ej: Almuerzo ejecutivo, hamburguesa, arroz, pollo, bebida',
      categoryPlaceholder: 'Ej: Menú - Platos fuertes, Insumos - Carnes',

      productSectionTitle: 'Menú e insumos',
      inventorySectionTitle: 'Inventario de cocina',
      salesSectionTitle: 'Órdenes / ventas',

      foodLabels: {
        menuTitle: 'Menú del restaurante',
        ingredientsTitle: 'Insumos de cocina',
        quickSaleTitle: 'Caja restaurante',
        orderTitle: 'Orden',
        recipeTitle: 'Receta',
        modifiersTitle: 'Extras y acompañantes',
      },

      extraLabels: {
        brand: {
          label: 'Marca / proveedor',
          placeholder: 'Ej: proveedor local, distribuidor, mercado',
        },
        size: {
          label: 'Presentación / porción',
          placeholder: 'Ej: 1kg, libra, porción, bandeja',
        },
        color: {
          label: 'Uso / preparación',
          placeholder: 'Ej: cocina, bebida, acompañante, empaque',
        },
      },

      defaultCategories: [
        'Menú - Platos fuertes',
        'Menú - Almuerzos',
        'Menú - Desayunos',
        'Menú - Bebidas',
        'Menú - Entradas',
        'Menú - Postres',
        'Menú - Combos',
        'Insumos - Carnes',
        'Insumos - Pollo',
        'Insumos - Mariscos',
        'Insumos - Verduras',
        'Insumos - Frutas',
        'Insumos - Granos y secos',
        'Insumos - Salsas y condimentos',
        'Insumos - Bebidas',
        'Insumos - Desechables',
        'Insumos - Limpieza',
      ],
    },

    ferreteria: {
      ...standardFeatures,
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
      ...standardFeatures,
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
      ...standardFeatures,
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
