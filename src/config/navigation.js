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
} from 'lucide-react';

import { menu } from './menu';

function getProfileLabel(businessProfile = {}, key, fallback) {
  return businessProfile?.labels?.[key] || fallback;
}

function isRestaurantProfile(businessProfile = {}, businessConfig = {}) {
  return businessProfile?.businessType === 'restaurante' || businessConfig?.label === 'Restaurante';
}

export function getPageInfo(active, businessConfig = {}, businessProfile = {}) {
  const restaurant = isRestaurantProfile(businessProfile, businessConfig);

  const pages = {
    Inicio: {
      title: 'Inicio',
      subtitle: restaurant
        ? 'Resumen de ventas, órdenes e inventario de cocina.'
        : 'Resumen general de tu negocio.',
      icon: Home,
      actionLabel: businessProfile?.labels?.addProduct || 'Agregar producto',
    },
    Ventas: {
      title: getProfileLabel(businessProfile, 'sales', businessConfig.salesSectionTitle || 'Ventas'),
      subtitle: restaurant
        ? 'Registra órdenes de restaurante, consumo en mesa, para llevar o delivery.'
        : businessConfig.salesMode === 'food'
          ? 'Registra órdenes, ventas y métodos de pago.'
          : 'Registra ventas y revisa el historial reciente.',
      icon: ShoppingCart,
      actionLabel: businessProfile?.labels?.addProduct || 'Agregar producto',
    },
    Caja: {
      title: getProfileLabel(
        businessProfile,
        'cash',
        businessConfig.cashMode === 'daily-cash' ? 'Caja diaria' : 'Caja'
      ),
      subtitle: restaurant
        ? 'Controla cobros, métodos de pago, turnos y cierre diario del restaurante.'
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
        : businessConfig.productMode === 'menu-inventory'
          ? 'Registra compras de insumos y aumenta stock.'
          : 'Registra compras a proveedores y aumenta stock.',
      icon: ClipboardList,
      actionLabel: businessProfile?.labels?.addProduct || 'Agregar producto',
    },
    Productos: {
      title: getProfileLabel(businessProfile, 'products', businessConfig.productSectionTitle || 'Productos'),
      subtitle: restaurant
        ? 'Administra platos, bebidas, combos, insumos, recetas y costos por preparación.'
        : businessConfig.productMode === 'menu-inventory'
          ? 'Administra el menú, insumos y productos de venta.'
          : 'Administra los productos de tu tienda fácilmente.',
      icon: Package,
      actionLabel: businessProfile?.labels?.addProduct || 'Agregar producto',
    },
    Inventario: {
      title: getProfileLabel(businessProfile, 'inventory', businessConfig.inventorySectionTitle || 'Inventario'),
      subtitle: restaurant
        ? 'Controla stock de cocina, alertas de insumos, caducidades y valor del inventario.'
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
        : 'Administra clientes frecuentes del negocio.',
      icon: Users,
      actionLabel: businessProfile?.labels?.addProduct || 'Agregar producto',
    },
    Proveedores: {
      title: 'Proveedores',
      subtitle: restaurant
        ? 'Organiza proveedores de alimentos, bebidas, empaques y limpieza.'
        : 'Organiza proveedores y entregas estimadas.',
      icon: Truck,
      actionLabel: businessProfile?.labels?.addProduct || 'Agregar producto',
    },
    Reportes: {
      title: getProfileLabel(businessProfile, 'reports', 'Reportes'),
      subtitle: restaurant
        ? 'Analiza platos más vendidos, utilidad, insumos críticos y ventas por tipo de consumo.'
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

  const visibleMenu = menuWithExpenses.map((item) => ({
    ...item,
    displayLabel: displayLabels[item.label] || item.label,
  }));

  return isAdmin
    ? [...visibleMenu, { label: 'Admin', displayLabel: 'Admin', icon: UserPlus }]
    : visibleMenu;
}
