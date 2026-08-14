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
  ListChecks,
  ChefHat,
  Coffee,
  WalletCards,
  PackageSearch,
  UsersRound,
  BellRing,
} from 'lucide-react';

import { menu } from './menu';
import { canAccessRestaurantSection } from '../utils/restaurantPermissions';

function getProfileLabel(businessProfile = {}, key, fallback) {
  return businessProfile?.labels?.[key] || fallback;
}

function isRestaurantProfile(businessProfile = {}, businessConfig = {}) {
  return businessProfile?.businessType === 'restaurante' || businessConfig?.label === 'Restaurante';
}

function isCafeteriaProfile(businessProfile = {}, businessConfig = {}) {
  return businessProfile?.businessType === 'cafeteria' || businessConfig?.label === 'Cafetería';
}

function isBakeryProfile(businessProfile = {}, businessConfig = {}) {
  return businessProfile?.businessType === 'panaderia' || businessConfig?.label === 'Panadería';
}

export function getPageInfo(active, businessConfig = {}, businessProfile = {}) {
  const restaurant = isRestaurantProfile(businessProfile, businessConfig);
  const cafeteria = isCafeteriaProfile(businessProfile, businessConfig);
  const bakery = isBakeryProfile(businessProfile, businessConfig);

  const pages = {
    Inicio: {
      title: 'Inicio',
      subtitle: restaurant
        ? 'Resumen de ventas, órdenes e inventario de cocina.'
        : cafeteria
          ? 'Resumen de caja rápida, pedidos en barra e inventario de cafetería.'
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
        : cafeteria
          ? 'Toma pedidos rápidos de mostrador, personaliza bebidas y envíalos automáticamente a barra.'
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
    Comandas: {
      title: 'Pedidos y comandas',
      subtitle: 'Controla cuentas abiertas, rondas enviadas a cocina y solicitudes de cuenta.',
      icon: ListChecks,
      actionLabel: 'Nueva orden',
      showAction: false,
    },
    Cocina: {
      title: 'Pantalla de cocina',
      subtitle: 'Controla tickets por estación, tiempos de preparación y productos listos para entregar.',
      icon: ChefHat,
      actionLabel: 'Ver comandas',
      showAction: false,
    },
    Barra: {
      title: 'Barra y pedidos',
      subtitle: 'Prepara pedidos cobrados, controla tiempos y marca bebidas o alimentos como listos y entregados.',
      icon: Coffee,
      actionLabel: 'Ver pedidos',
      showAction: false,
    },
    Entrega: {
      title: 'Entrega de pedidos',
      subtitle: 'Llama pedidos listos por número o nombre y confirma la entrega al cliente.',
      icon: BellRing,
      actionLabel: 'Actualizar entrega',
      showAction: false,
    },
    Cobros: {
      title: 'Cobro y división de cuentas',
      subtitle: 'Registra cobros completos o parciales por personas, asientos, productos y métodos de pago.',
      icon: WalletCards,
      actionLabel: 'Cobrar cuenta',
      showAction: false,
    },
    'Control gastronómico': {
      title: 'Inventario gastronómico',
      subtitle: 'Controla consumo de recetas, preparaciones internas, faltantes, mermas y conteos físicos.',
      icon: PackageSearch,
      actionLabel: 'Registrar movimiento',
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
      title: restaurant ? 'Recetas y costos gastronómicos' : cafeteria ? 'Recetas y costos de cafetería' : 'Recetas y costos',
      subtitle: restaurant
        ? 'Costea platos y preparaciones internas con ingredientes, mermas, mano de obra y margen real.'
        : cafeteria
          ? 'Define receta base, tamaños, tipos de leche, jarabes, shots y costo real por variante.'
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
        : cafeteria
          ? 'Controla café, leche, jarabes, empaques, preparaciones internas, mermas y reposición sugerida.'
          : bakery
            ? 'Controla existencias, lotes, caducidades y alertas de abastecimiento.'
            : businessConfig.productMode === 'menu-inventory'
              ? 'Controla insumos, stock y alertas de cocina.'
              : 'Controla stock, alertas y valor de inventario.',
      icon: Boxes,
      actionLabel: businessProfile?.labels?.addProduct || 'Agregar producto',
      showAction: !cafeteria,
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
        : cafeteria
          ? 'Analiza pedidos, tiempos de barra, variantes, consumo de insumos, mermas y reposición.'
          : bakery
            ? 'Analiza ventas, utilidad, productos destacados y materias primas críticas.'
            : businessConfig.salesMode === 'food'
              ? 'Analiza ventas, utilidad, platos e insumos.'
              : 'Analiza ventas, utilidad y decisiones de compra.',
      icon: BarChart3,
      actionLabel: businessProfile?.labels?.addProduct || 'Agregar producto',
    },

    Equipo: {
      title: 'Equipo y permisos',
      subtitle: restaurant
        ? 'Configura perfiles operativos, PIN, permisos por rol y revisa la auditoría del restaurante.'
        : businessProfile?.businessType === 'cafeteria'
          ? 'Configura perfiles operativos, PIN, permisos por rol y el acceso del equipo de la cafetería.'
          : 'Configura perfiles operativos, PIN y permisos por rol.',
      icon: UsersRound,
      actionLabel: 'Nuevo integrante',
      showAction: false,
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

export function getVisibleMenu(isAdmin = false, businessProfile = {}, currentUser = null) {
  const labels = businessProfile?.labels || {};
  const isBakery = businessProfile?.businessType === 'panaderia';
  const isRestaurant = businessProfile?.businessType === 'restaurante';
  const isCafe = businessProfile?.businessType === 'cafeteria';
  const usesEmployeeTeam = isRestaurant || isCafe;

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

  const cafeteriaOperationModules = [
    { label: 'Barra', displayLabel: 'Barra y pedidos', icon: Coffee },
    { label: 'Entrega', displayLabel: 'Entrega de pedidos', icon: BellRing },
  ];

  const restaurantOperationModules = [
    { label: 'Mesas', displayLabel: 'Mesas y salón', icon: Grid2X2 },
    { label: 'Comandas', displayLabel: 'Pedidos y comandas', icon: ListChecks },
    { label: 'Cocina', displayLabel: 'Pantalla de cocina', icon: ChefHat },
    { label: 'Cobros', displayLabel: 'Cobro y cuentas', icon: WalletCards },
  ];

  const menuWithRestaurantOperation = isRestaurant
    ? menuWithBakeryModules.flatMap((item) =>
        item.label === 'Ventas'
          ? [item, ...restaurantOperationModules]
          : [item]
      )
    : isCafe
      ? menuWithBakeryModules.flatMap((item) =>
          item.label === 'Ventas'
            ? [item, ...cafeteriaOperationModules]
            : [item]
        )
      : menuWithBakeryModules;

  const menuWithProfileModules = menuWithRestaurantOperation.flatMap((item) => {
    if (isRestaurant && item.label === 'Productos') {
      return [
        item,
        { label: 'Recetas', displayLabel: 'Recetas y costos', icon: BookOpenText },
        { label: 'Control gastronómico', displayLabel: 'Consumo y mermas', icon: PackageSearch },
      ];
    }
    if (isCafe && item.label === 'Productos') {
      return [
        item,
        { label: 'Recetas', displayLabel: 'Recetas y costos', icon: BookOpenText },
      ];
    }
    if (usesEmployeeTeam && item.label === 'Configuración') {
      return [
        { label: 'Equipo', displayLabel: 'Equipo y permisos', icon: UsersRound },
        item,
      ];
    }
    return [item];
  });

  function getBakeryGroup(label) {
    if (['Inicio', 'Ventas', 'Caja', 'Gastos fijos', 'Compras'].includes(label)) return 'Operación';
    if (['Productos', 'Inventario'].includes(label)) return 'Catálogo e inventario';
    if (['Recetas', 'Producción', 'Mermas', 'Encargos'].includes(label)) return 'Producción';
    if (['Clientes', 'Proveedores'].includes(label)) return 'Relaciones';
    if (['Reportes', 'Configuración', 'Admin'].includes(label)) return 'Análisis y ajustes';
    return '';
  }


  function getCafeteriaGroup(label) {
    if (['Inicio', 'Ventas', 'Barra', 'Entrega', 'Caja', 'Gastos fijos'].includes(label)) return 'Operación';
    if (['Productos', 'Recetas', 'Compras', 'Inventario'].includes(label)) return 'Menú e inventario';
    if (['Clientes', 'Proveedores'].includes(label)) return 'Relaciones';
    if (['Reportes', 'Equipo', 'Configuración', 'Admin'].includes(label)) return 'Análisis y ajustes';
    return '';
  }

  function getRestaurantGroup(label) {
    if (['Inicio', 'Ventas', 'Mesas', 'Comandas', 'Cocina', 'Cobros', 'Caja', 'Gastos fijos'].includes(label)) return 'Operación';
    if (['Productos', 'Recetas', 'Control gastronómico', 'Compras', 'Inventario'].includes(label)) return 'Menú e inventario';
    if (['Clientes', 'Proveedores'].includes(label)) return 'Relaciones';
    if (['Reportes', 'Equipo', 'Configuración', 'Admin'].includes(label)) return 'Análisis y ajustes';
    return '';
  }

  const visibleMenu = menuWithProfileModules.map((item) => ({
    ...item,
    displayLabel: displayLabels[item.label] || item.displayLabel || item.label,
    group: isBakery
      ? getBakeryGroup(item.label)
      : isRestaurant
        ? getRestaurantGroup(item.label)
        : isCafe
          ? getCafeteriaGroup(item.label)
          : '',
  }));

  const permissionFilteredMenu = usesEmployeeTeam && currentUser
    ? visibleMenu.filter((item) => canAccessRestaurantSection(currentUser, item.label))
    : visibleMenu;

  const finalMenu = isAdmin
    ? [...permissionFilteredMenu, {
        label: 'Admin',
        displayLabel: 'Admin',
        icon: UserPlus,
        group: (isBakery || usesEmployeeTeam) ? 'Análisis y ajustes' : '',
      }]
    : permissionFilteredMenu;

  return finalMenu;
}
