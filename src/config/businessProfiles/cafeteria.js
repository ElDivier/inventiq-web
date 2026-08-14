import { createBusinessProfile } from './profileFactory';

export const cafeteriaProfile = createBusinessProfile({
  id: 'cafeteria',
  name: 'Cafetería',
  businessType: 'cafeteria',
  description: 'Perfil gastronómico ágil para cafeterías con caja rápida, barra, variantes, recetas, insumos y acceso de empleados.',

  labels: {
    products: 'Menú e insumos',
    inventory: 'Inventario de cafetería',
    sales: 'Caja rápida',
    cash: 'Caja diaria',
    reports: 'Reportes de cafetería',
    addProduct: 'Agregar bebida / producto',
  },

  modules: {
    recipes: true,
    ingredients: true,
    menuAvailability: true,
    kitchenStations: true,
    dailyCash: true,
    foodSales: true,
    cafeQueue: true,
    employeeTeam: true,
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
    'Menú - Café caliente',
    'Menú - Café frío',
    'Menú - Bebidas frías',
    'Menú - Té e infusiones',
    'Menú - Chocolate',
    'Menú - Repostería',
    'Menú - Sanduches',
    'Menú - Desayunos',
    'Menú - Combos',
    'Menú - Temporada',
    'Preparaciones - Bases de café',
    'Preparaciones - Cremas y salsas',
    'Preparaciones - Repostería',
    'Insumos - Café',
    'Insumos - Lácteos',
    'Insumos - Leches vegetales',
    'Insumos - Jarabes y salsas',
    'Insumos - Azúcar y endulzantes',
    'Insumos - Té e infusiones',
    'Insumos - Frutas',
    'Insumos - Repostería',
    'Empaques - Vasos y tapas',
    'Empaques - Para llevar',
    'Insumos - Desechables',
    'Insumos - Limpieza',
  ],

  configOverrides: {
    productSectionTitle: 'Menú e insumos',
    inventorySectionTitle: 'Inventario de cafetería',
    salesSectionTitle: 'Caja rápida',
  },
});
