export const DATA_KEYS = {
  products: 'products',
  sales: 'sales',
  clients: 'clients',
  providers: 'providers',
  purchases: 'purchases',
  expenses: 'expenses',
};

export const SECTION_DATA_REQUIREMENTS = {
  Inicio: [DATA_KEYS.products, DATA_KEYS.sales],
  Ventas: [DATA_KEYS.products, DATA_KEYS.sales, DATA_KEYS.clients],
  Caja: [DATA_KEYS.products, DATA_KEYS.sales, DATA_KEYS.purchases],
  Compras: [DATA_KEYS.products, DATA_KEYS.providers, DATA_KEYS.purchases],
  Productos: [DATA_KEYS.products],
  Inventario: [DATA_KEYS.products, DATA_KEYS.sales, DATA_KEYS.purchases],
  Clientes: [DATA_KEYS.products, DATA_KEYS.sales, DATA_KEYS.clients],
  Proveedores: [DATA_KEYS.products, DATA_KEYS.providers],
  Reportes: [
    DATA_KEYS.products,
    DATA_KEYS.sales,
    DATA_KEYS.clients,
    DATA_KEYS.providers,
    DATA_KEYS.purchases,
  ],
  'Gastos fijos': [DATA_KEYS.expenses],
  Gastos: [DATA_KEYS.expenses],
};

export function getRequiredDataForSection(sectionName) {
  return new Set(SECTION_DATA_REQUIREMENTS[sectionName] || []);
}

export function sectionNeedsData(sectionName, dataKey) {
  return getRequiredDataForSection(sectionName).has(dataKey);
}
