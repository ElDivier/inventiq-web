import { createBusinessProfile } from './profileFactory';

export const panaderiaProfile = createBusinessProfile({
  id: 'panaderia',
  name: 'Panadería',
  businessType: 'panaderia',
  description: 'Perfil para panaderías con productos terminados, materias primas, empaques y producción por lotes.',

  labels: {
    products: 'Productos y materias primas',
    inventory: 'Inventario de panadería',
    sales: 'Ventas de panadería',
    cash: 'Caja diaria',
    reports: 'Reportes de panadería',
    addProduct: 'Agregar producto o insumo',
  },

  modules: {
    recipes: true,
    ingredients: true,
    dailyCash: true,
    foodSales: false,
    tables: false,
    clothingVariants: false,
    production: true,
    productionBatches: true,
    wasteControl: true,
  },

  productFields: {
    brand: true,
    size: true,
    color: true,
    expirationDate: true,
    batchNumber: true,
    recipe: true,
    ingredients: true,
    productType: true,
    stockUnit: true,
  },

  configOverrides: {
    productSectionTitle: 'Productos y materias primas',
    inventorySectionTitle: 'Inventario de panadería',
    salesSectionTitle: 'Ventas de panadería',
  },
});
