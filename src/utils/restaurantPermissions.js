export const RESTAURANT_ROLE_PRESETS = {
  administrador: {
    label: 'Administrador',
    description: 'Control total del negocio gastronómico, configuración, costos, reportes y equipo.',
    permissions: [
      'dashboard.view', 'sales.manage', 'tables.manage', 'orders.manage', 'kitchen.manage',
      'checkout.manage', 'cafe.queue.manage', 'cash.view', 'purchases.manage', 'menu.manage', 'recipes.manage',
      'inventory.manage', 'clients.manage', 'providers.manage', 'reports.view',
      'settings.manage', 'team.manage', 'discounts.apply', 'cancellations.manage',
      'payments.void', 'inventory.adjust', 'costs.view',
    ],
  },
  supervisor: {
    label: 'Supervisor',
    description: 'Supervisa operación, cocina, caja, inventario y reportes sin administrar accesos.',
    permissions: [
      'dashboard.view', 'sales.manage', 'tables.manage', 'orders.manage', 'kitchen.manage',
      'checkout.manage', 'cafe.queue.manage', 'cash.view', 'purchases.manage', 'menu.manage', 'recipes.manage',
      'inventory.manage', 'clients.manage', 'providers.manage', 'reports.view',
      'discounts.apply', 'cancellations.manage', 'payments.void', 'inventory.adjust', 'costs.view',
    ],
  },
  cajero: {
    label: 'Cajero',
    description: 'Registra ventas, revisa caja y atiende clientes sin acceder a costos o configuración.',
    permissions: [
      'sales.manage', 'tables.manage', 'orders.view', 'checkout.manage',
      'cash.view', 'clients.manage', 'discounts.apply',
    ],
  },
  mesero: {
    label: 'Mesero',
    description: 'Abre mesas, toma pedidos, envía comandas y solicita cuentas.',
    permissions: [
      'sales.manage', 'tables.manage', 'orders.manage', 'clients.view',
    ],
  },
  cocina: {
    label: 'Cocina',
    description: 'Trabaja únicamente con comandas y pantalla de cocina.',
    permissions: ['orders.view', 'kitchen.manage'],
  },
  barista: {
    label: 'Barista',
    description: 'Prepara y entrega pedidos de cafetería desde la barra sin acceder a caja, costos o configuración.',
    permissions: ['cafe.queue.manage'],
  },
};

export const RESTAURANT_PERMISSION_GROUPS = [
  {
    label: 'Operación',
    items: [
      ['dashboard.view', 'Ver Inicio'],
      ['sales.manage', 'Registrar pedidos / ventas'],
      ['tables.manage', 'Gestionar mesas'],
      ['orders.manage', 'Gestionar comandas'],
      ['kitchen.manage', 'Gestionar cocina'],
      ['cafe.queue.manage', 'Gestionar barra de cafetería'],
      ['checkout.manage', 'Cobrar cuentas'],
      ['cash.view', 'Ver caja'],
    ],
  },
  {
    label: 'Menú e inventario',
    items: [
      ['purchases.manage', 'Registrar compras'],
      ['menu.manage', 'Editar menú y productos'],
      ['recipes.manage', 'Editar recetas'],
      ['inventory.manage', 'Ver inventario gastronómico'],
      ['inventory.adjust', 'Registrar mermas y conteos'],
      ['costs.view', 'Ver costos y rentabilidad'],
    ],
  },
  {
    label: 'Relaciones y análisis',
    items: [
      ['clients.manage', 'Gestionar clientes'],
      ['providers.manage', 'Gestionar proveedores'],
      ['reports.view', 'Ver reportes'],
      ['settings.manage', 'Modificar configuración'],
      ['team.manage', 'Gestionar equipo y permisos'],
    ],
  },
  {
    label: 'Acciones sensibles',
    items: [
      ['discounts.apply', 'Aplicar descuentos / cargos'],
      ['cancellations.manage', 'Cancelar productos o ventas'],
      ['payments.void', 'Anular cobros'],
    ],
  },
];

const SECTION_PERMISSIONS = {
  Inicio: 'dashboard.view',
  Ventas: 'sales.manage',
  Mesas: ['tables.manage', 'tables.view'],
  Comandas: ['orders.manage', 'orders.view'],
  Cocina: 'kitchen.manage',
  Barra: 'cafe.queue.manage',
  Entrega: 'cafe.queue.manage',
  Cobros: 'checkout.manage',
  Caja: 'cash.view',
  'Gastos fijos': 'cash.view',
  Compras: 'purchases.manage',
  Productos: 'menu.manage',
  Recetas: 'recipes.manage',
  'Control gastronómico': 'inventory.manage',
  Inventario: 'inventory.manage',
  Clientes: ['clients.manage', 'clients.view'],
  Proveedores: 'providers.manage',
  Reportes: 'reports.view',
  Configuración: 'settings.manage',
  Equipo: 'team.manage',
};


export function isGastronomyEmployeeBusiness(businessType = '') {
  return ['restaurante', 'cafeteria'].includes(String(businessType || '').toLowerCase());
}

export function getRestaurantRolePreset(role = 'mesero') {
  return RESTAURANT_ROLE_PRESETS[role] || RESTAURANT_ROLE_PRESETS.mesero;
}

export function normalizeRestaurantPermissions(value, role = 'mesero') {
  if (Array.isArray(value)) return [...new Set(value.filter(Boolean))];
  if (value && typeof value === 'object') {
    return Object.entries(value).filter(([, enabled]) => Boolean(enabled)).map(([key]) => key);
  }
  return [...getRestaurantRolePreset(role).permissions];
}

export function hasRestaurantPermission(currentUser, permission) {
  if (!currentUser || !isGastronomyEmployeeBusiness(currentUser.businessType)) return true;
  if (!currentUser.restaurantOperator) return true;
  const permissions = normalizeRestaurantPermissions(currentUser.restaurantPermissions, currentUser.restaurantOperator?.role);
  return permissions.includes(permission);
}

export function canAccessRestaurantSection(currentUser, section) {
  if (!currentUser || !isGastronomyEmployeeBusiness(currentUser.businessType)) return true;
  if (!currentUser.restaurantOperator) return true;
  const required = SECTION_PERMISSIONS[section];
  if (!required) return true;
  if (Array.isArray(required)) return required.some((permission) => hasRestaurantPermission(currentUser, permission));
  return hasRestaurantPermission(currentUser, required);
}

export function getRestaurantOperatorLabel(currentUser) {
  if (!currentUser?.restaurantOperator) return 'Administrador';
  const role = getRestaurantRolePreset(currentUser.restaurantOperator.role);
  return `${currentUser.restaurantOperator.name} · ${role.label}`;
}
