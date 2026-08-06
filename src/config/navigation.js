import {
  Home,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  Truck,
  BarChart3,
  Settings,
  DollarSign,
  ClipboardList,
  ReceiptText,
  UserPlus,
  BookOpenText,
  PackageCheck,
  ClipboardCheck,
  CalendarDays,
  Grid2X2,
} from 'lucide-react';

import { menu } from './menu';

function getProfileLabel(businessProfile = {}, key, fallback) {
  return businessProfile?.labels?.[key] || fallback;
}

function isRestaurantProfile(businessProfile = {}, businessConfig = {}) {
  return businessProfile?.businessType === 'restaurante' || businessConfig?.label === 'Restaurante';
}

function isBakeryProfile(businessProfile = {}, businessConfig = {}) {
  return businessProfile?.businessType === 'panaderia' || businessConfig?.label === 'Panadería';
}

export function getPageInfo(active, businessConfig = {}, businessProfile = {}) {
  const restaurant = isRestaurantProfile(businessProfile, businessConfig);
  const bakery = isBakeryProfile(businessProfile, businessConfig);

  const pages = {
    Inicio: {
      title: 'Inicio',
      subtitle: restaurant
        ? 'Resumen de ventas, órdenes e inventario de cocina.'
        : bakery
          ? 'Resumen de ventas, productos terminados y materias primas.'
          : 'Resumen general de tu negocio.',
      icon: Home,
      actionLabel: businessProfile?.labels?.addProduct || 'Agregar producto',
    },
    Ventas: {
      title: getProfileLabel(businessProfile, 'sales', businessConfig.salesSectionTitle || 'Ventas'),
      subtitle: restaurant
        ? 'Registra órdenes de restaurante, consumo en mesa, para llevar o delivery.'
        : bakery
          ? 'Registra ventas de pan, pasteles, bocaditos y otros productos terminados.'
          : businessConfig.salesMode === 'food'
            ? 'Registra órdenes, ventas y métodos de pago.'
            : 'Registra ventas y revisa el historial reciente.',
      icon: ShoppingCart,
      actionLabel: businessProfile?.labels?.addProduct || 'Agregar producto',
    },
    Mesas: {
      title: 'Mesas y salón',
      subtitle: 'Organiza áreas, controla ocupación, asigna meseros y abre pedidos por mesa.',
      icon: Grid2X2,
      actionLabel: 'Nueva mesa',
      showAction: false,
    },
    Caja: {
      title: getProfileLabel(
        businessProfile,
        'cash',
        businessConfig.cashMode === 'daily-cash' ? 'Caja diaria' : 'Caja'
      ),
      subtitle: restaurant
        ? 'Controla cobros, métodos de pago, turnos y cierre diario del restaurante.'
        : bakery
          ? 'Controla ingresos, métodos de pago, gastos y cierre diario de la panadería.'
          : 'Controla cierres, cortes y métodos de pago por periodo.',
      icon: DollarSign,
      actionLabel: businessProfile?.labels?.addProduct || 'Agregar producto',
    },
    'Gastos fijos': {
      title: 'Gastos fijos',
      subtitle: restaurant
        ? 'Registra arriendo, servicios, sueldos, insumos operativos y gastos recurrentes.'
        : 'Controla pagos mensuales como arriendo, servicios, sueldos y suscripciones.',
      icon: ReceiptText,
      actionLabel: businessProfile?.labels?.addProduct || 'Agregar producto',
    },
    Compras: {
      title: 'Compras',
      subtitle: restaurant
        ? 'Registra compras de cocina, bebidas, empaques e insumos del restaurante.'
        : bakery
          ? 'Registra compras de materias primas, empaques e insumos y aumenta su stock.'
          : businessConfig.productMode === 'menu-inventory'
            ? 'Registra compras de insumos y aumenta stock.'
          : 'Registra compras a proveedores y aumenta stock.',
      icon: ClipboardList,
      actionLabel: businessProfile?.labels?.addProduct || 'Agregar producto',
    },
    Productos: {
      title: getProfileLabel(businessProfile, 'products', businessConfig.productSectionTitle || 'Productos'),
      subtitle: restaurant
        ? 'Administra menú, disponibilidad, estaciones, preparaciones intermedias, insumos y costos.'
        : bakery
          ? 'Administra productos terminados, materias primas, intermedios y empaques.'
          : businessConfig.productMode === 'menu-inventory'
            ? 'Administra el menú, insumos y productos de venta.'
          : 'Administra los productos de tu tienda fácilmente.',
      icon: Package,
      actionLabel: businessProfile?.labels?.addProduct || 'Agregar producto',
    },
    Recetas: {
      title: restaurant ? 'Recetas y costos gastronómicos' : 'Recetas y costos',
      subtitle: restaurant
        ? 'Costea platos y preparaciones internas con ingredientes, mermas, mano de obra y margen real.'
        : 'Define fórmulas, rendimientos y costos actualizados para cada producto terminado.',
      icon: BookOpenText,
      actionLabel: 'Nueva receta',
      showAction: false,
    },
    Producción: {
      title: 'Producción por lotes',
      subtitle: 'Registra elaboración, consumo de materias primas y entrada de productos terminados.',
      icon: PackageCheck,
      actionLabel: 'Registrar producción',
      showAction: false,
    },
    Mermas: {
      title: 'Mermas y ajustes',
      subtitle: 'Registra pérdidas, conteos físicos y diferencias de inventario con trazabilidad.',
      icon: ClipboardCheck,
      actionLabel: 'Registrar merma',
      showAction: false,
    },
    Encargos: {
      title: 'Pedidos especiales',
      subtitle: 'Organiza encargos, personalizaciones, anticipos y fechas de entrega.',
      icon: CalendarDays,
      actionLabel: 'Nuevo pedido',
      showAction: false,
    },
    Inventario: {
      title: getProfileLabel(businessProfile, 'inventory', businessConfig.inventorySectionTitle || 'Inventario'),
      subtitle: restaurant
        ? 'Controla stock de cocina, alertas de insumos, caducidades y valor del inventario.'
        : bakery
          ? 'Controla existencias, lotes, caducidades y alertas de abastecimiento.'
          : businessConfig.productMode === 'menu-inventory'
            ? 'Controla insumos, stock y alertas de cocina.'
          : 'Controla stock, alertas y valor de inventario.',
      icon: Boxes,
      actionLabel: businessProfile?.labels?.addProduct || 'Agregar producto',
    },
    Clientes: {
      title: 'Clientes',
      subtitle: restaurant
        ? 'Administra clientes frecuentes, pedidos y cuentas por cobrar.'
        : bakery
          ? 'Administra clientes frecuentes y la información necesaria para sus compras.'
          : 'Administra clientes frecuentes del negocio.',
      icon: Users,
      actionLabel: businessProfile?.labels?.addProduct || 'Agregar producto',
    },
    Proveedores: {
      title: 'Proveedores',
      subtitle: restaurant
        ? 'Organiza proveedores de alimentos, bebidas, empaques y limpieza.'
        : bakery
          ? 'Organiza proveedores de materias primas, empaques, equipos y suministros.'
          : 'Organiza proveedores y entregas estimadas.',
      icon: Truck,
      actionLabel: businessProfile?.labels?.addProduct || 'Agregar producto',
    },
    Reportes: {
      title: getProfileLabel(businessProfile, 'reports', 'Reportes'),
      subtitle: restaurant
        ? 'Analiza platos más vendidos, utilidad, insumos críticos y ventas por tipo de consumo.'
        : bakery
          ? 'Analiza ventas, utilidad, productos destacados y materias primas críticas.'
          : businessConfig.salesMode === 'food'
            ? 'Analiza ventas, utilidad, platos e insumos.'
          : 'Analiza ventas, utilidad y decisiones de compra.',
      icon: BarChart3,
      actionLabel: businessProfile?.labels?.addProduct || 'Agregar producto',
    },
    Configuración: {
      title: 'Configuración',
      subtitle: restaurant
        ? 'Ajusta datos del restaurante, perfil, logo, acceso y preferencias.'
        : bakery
          ? 'Ajusta datos de la panadería, logo, acceso y preferencias.'
          : 'Ajusta datos generales del negocio.',
      icon: Settings,
      actionLabel: businessProfile?.labels?.addProduct || 'Agregar producto',
    },
    Admin: {
      title: 'Panel administrador',
      subtitle: 'Crea y controla cuentas de clientes de INVENTIQ.',
      icon: UserPlus,
      actionLabel: businessProfile?.labels?.addProduct || 'Agregar producto',
    },
  };

  return pages[active] || pages.Inicio;
}

export function getVisibleMenu(isAdmin = false, businessProfile = {}) {
  const labels = businessProfile?.labels || {};
  const isBakery = businessProfile?.businessType === 'panaderia';
  const isRestaurant = businessProfile?.businessType === 'restaurante';

  const displayLabels = {
    Ventas: labels.sales,
    Caja: labels.cash,
    Productos: labels.products,
    Inventario: labels.inventory,
    Reportes: labels.reports,
  };

  const menuWithExpenses = menu.some((item) => item.label === 'Gastos fijos')
    ? menu
    : menu.flatMap((item) =>
        item.label === 'Caja'
          ? [item, { label: 'Gastos fijos', icon: ReceiptText }]
          : [item]
      );

  const bakeryModules = [
    { label: 'Recetas', icon: BookOpenText },
    { label: 'Producción', icon: PackageCheck },
    { label: 'Mermas', displayLabel: 'Mermas y ajustes', icon: ClipboardCheck },
    { label: 'Encargos', displayLabel: 'Pedidos especiales', icon: CalendarDays },
  ];

  const menuWithBakeryModules = isBakery
    ? menuWithExpenses.flatMap((item) =>
        item.label === 'Inventario'
          ? [item, ...bakeryModules]
          : [item]
      )
    : menuWithExpenses;

  const restaurantOperationModules = [
    { label: 'Mesas', displayLabel: 'Mesas y salón', icon: Grid2X2 },
  ];

  const menuWithRestaurantOperation = isRestaurant
    ? menuWithBakeryModules.flatMap((item) =>
        item.label === 'Ventas'
          ? [item, ...restaurantOperationModules]
          : [item]
      )
    : menuWithBakeryModules;

  const menuWithProfileModules = isRestaurant
    ? menuWithRestaurantOperation.flatMap((item) =>
        item.label === 'Productos'
          ? [item, { label: 'Recetas', displayLabel: 'Recetas y costos', icon: BookOpenText }]
          : [item]
      )
    : menuWithRestaurantOperation;

  function getBakeryGroup(label) {
    if (['Inicio', 'Ventas', 'Caja', 'Gastos fijos', 'Compras'].includes(label)) return 'Operación';
    if (['Productos', 'Inventario'].includes(label)) return 'Catálogo e inventario';
    if (['Recetas', 'Producción', 'Mermas', 'Encargos'].includes(label)) return 'Producción';
    if (['Clientes', 'Proveedores'].includes(label)) return 'Relaciones';
    if (['Reportes', 'Configuración', 'Admin'].includes(label)) return 'Análisis y ajustes';
    return '';
  }

  function getRestaurantGroup(label) {
    if (['Inicio', 'Ventas', 'Mesas', 'Caja', 'Gastos fijos'].includes(label)) return 'Operación';
    if (['Productos', 'Recetas', 'Compras', 'Inventario'].includes(label)) return 'Menú e inventario';
    if (['Clientes', 'Proveedores'].includes(label)) return 'Relaciones';
    if (['Reportes', 'Configuración', 'Admin'].includes(label)) return 'Análisis y ajustes';
    return '';
  }

  const visibleMenu = menuWithProfileModules.map((item) => ({
    ...item,
    displayLabel: displayLabels[item.label] || item.displayLabel || item.label,
    group: isBakery
      ? getBakeryGroup(item.label)
      : isRestaurant
        ? getRestaurantGroup(item.label)
        : '',
  }));

  const finalMenu = isAdmin
    ? [...visibleMenu, {
        label: 'Admin',
        displayLabel: 'Admin',
        icon: UserPlus,
        group: (isBakery || isRestaurant) ? 'Análisis y ajustes' : '',
      }]
    : visibleMenu;

  return finalMenu;
}
