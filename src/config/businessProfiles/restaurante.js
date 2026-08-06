import { createBusinessProfile } from './profileFactory';

export const restauranteProfile = createBusinessProfile({
  id: 'restaurante',
  name: 'Restaurante',
  businessType: 'restaurante',
  description: 'Perfil gastronómico para restaurantes con menú, preparaciones, insumos, órdenes, mesas y control de cocina.',

  labels: {
    products: 'Menú e insumos',
    inventory: 'Inventario de cocina',
    sales: 'Órdenes / ventas',
    cash: 'Caja restaurante',
    reports: 'Reportes del restaurante',
    addProduct: 'Agregar plato / insumo',
  },

  modules: {
    recipes: true,
    ingredients: true,
    intermediatePreparations: true,
    menuAvailability: true,
    kitchenStations: true,
    dailyCash: true,
    foodSales: true,
    tables: true,
    clothingVariants: false,
  },

  productFields: {
    brand: true,
    size: true,
    color: true,
    expirationDate: true,
    batchNumber: true,
    recipe: true,
    ingredients: true,
  },

  defaultCategories: [
    'Menú - Platos fuertes',
    'Menú - Almuerzos',
    'Menú - Desayunos',
    'Menú - Entradas',
    'Menú - Sopas',
    'Menú - Ensaladas',
    'Menú - Guarniciones',
    'Menú - Bebidas',
    'Menú - Postres',
    'Menú - Infantil',
    'Menú - Combos',
    'Menú - Temporada',
    'Preparaciones - Salsas',
    'Preparaciones - Fondos y caldos',
    'Preparaciones - Guarniciones',
    'Preparaciones - Aderezos',
    'Preparaciones - Bases y marinados',
    'Insumos - Carnes',
    'Insumos - Pollo',
    'Insumos - Mariscos',
    'Insumos - Verduras',
    'Insumos - Frutas',
    'Insumos - Lácteos',
    'Insumos - Granos y secos',
    'Insumos - Salsas y condimentos',
    'Insumos - Bebidas',
    'Empaques - Para llevar',
    'Empaques - Delivery',
    'Insumos - Limpieza',
  ],


  configOverrides: {
    productSectionTitle: 'Menú e insumos',
    inventorySectionTitle: 'Inventario de cocina',
    salesSectionTitle: 'Órdenes / ventas',
  },
});
