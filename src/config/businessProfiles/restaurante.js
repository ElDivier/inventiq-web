import { createBusinessProfile } from './profileFactory';

export const restauranteProfile = createBusinessProfile({
  id: 'restaurante',
  name: 'Restaurante',
  businessType: 'restaurante',
  description: 'Perfil para restaurantes con menú, insumos, recetas, órdenes, mesas y caja diaria.',

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

  configOverrides: {
    productSectionTitle: 'Menú e insumos',
    inventorySectionTitle: 'Inventario de cocina',
    salesSectionTitle: 'Órdenes / ventas',
  },
});
