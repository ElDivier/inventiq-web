import { getBusinessConfig } from '../businessTypes';

export function createBusinessProfile({
  id,
  name,
  businessType = 'general',
  description = '',
  labels = {},
  modules = {},
  productFields = {},
  defaultCategories = [],
  configOverrides = {},
}) {
  const baseConfig = getBusinessConfig(businessType);

  return {
    id,
    name,
    businessType,
    description,

    labels: {
      products: baseConfig.productSectionTitle || 'Productos',
      inventory: baseConfig.inventorySectionTitle || 'Inventario',
      sales: baseConfig.salesSectionTitle || 'Ventas',
      cash: 'Caja',
      reports: 'Reportes',
      ...labels,
    },

    modules: {
      products: true,
      inventory: true,
      sales: true,
      purchases: true,
      cash: true,
      reports: true,
      clients: true,
      providers: true,
      recipes: Boolean(baseConfig.usesRecipes),
      ingredients: baseConfig.productMode === 'menu-inventory',
      dailyCash: Boolean(baseConfig.usesDailyCash),
      foodSales: baseConfig.salesMode === 'food',
      tables: Boolean(baseConfig.usesTables),
      clothingVariants: businessType === 'ropa',
      ...modules,
    },

    productFields: {
      sku: true,
      barcode: true,
      brand: Boolean(baseConfig.productExtraFields),
      size: Boolean(baseConfig.productExtraFields),
      color: Boolean(baseConfig.productExtraFields),
      expirationDate: Boolean(baseConfig.usesExpiration),
      batchNumber: Boolean(baseConfig.usesExpiration),
      description: true,
      recipe: Boolean(baseConfig.usesRecipes),
      ingredients: baseConfig.productMode === 'menu-inventory',
      ...productFields,
    },

    defaultCategories:
      defaultCategories.length > 0
        ? defaultCategories
        : baseConfig.defaultCategories || [],

    config: {
      ...baseConfig,
      defaultCategories:
        defaultCategories.length > 0
          ? defaultCategories
          : baseConfig.defaultCategories || [],
      ...configOverrides,
    },
  };
}
