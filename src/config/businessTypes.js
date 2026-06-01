export const businessTypes = [
  { value: 'general', label: 'Tienda general / minimarket' },
  { value: 'ropa', label: 'Tienda de ropa' },
  { value: 'cafeteria', label: 'Cafetería / restaurante pequeño' },
  { value: 'ferreteria', label: 'Ferretería / repuestos' },
  { value: 'taller', label: 'Taller / servicios' },
  { value: 'otro', label: 'Otro negocio' },
];

export function getBusinessConfig(type = 'general') {
  const configs = {
    general: {
      label: 'Tienda general',
      usesExpiration: true,
      productExtraFields: false,
      productNamePlaceholder: 'Ej: Arroz 1kg',
      categoryPlaceholder: 'Ej: Bebidas, snacks, limpieza',
      extraLabels: {},
    },
    ropa: {
      label: 'Tienda de ropa',
      usesExpiration: false,
      productExtraFields: true,
      productNamePlaceholder: 'Ej: Camiseta oversize',
      categoryPlaceholder: 'Ej: Camisetas, pantalones, zapatos',
      extraLabels: {
        brand: { label: 'Marca', placeholder: 'Ej: Nike, Adidas, Shein' },
        size: { label: 'Talla', placeholder: 'Ej: S, M, L, 32, 38' },
        color: { label: 'Color', placeholder: 'Ej: Negro, blanco, azul' },
      },
    },
    cafeteria: {
      label: 'Cafetería',
      usesExpiration: true,
      productExtraFields: true,
      productNamePlaceholder: 'Ej: Café molido 500g',
      categoryPlaceholder: 'Ej: Insumos, bebidas, postres',
      extraLabels: {
        brand: { label: 'Marca / proveedor', placeholder: 'Ej: Café Vélez, proveedor local' },
        size: { label: 'Unidad / presentación', placeholder: 'Ej: kg, litro, caja, unidad' },
        color: { label: 'Uso en cocina', placeholder: 'Ej: Bebida caliente, postre, insumo' },
      },
    },
    ferreteria: {
      label: 'Ferretería / repuestos',
      usesExpiration: false,
      productExtraFields: true,
      productNamePlaceholder: 'Ej: Tornillo 1/2',
      categoryPlaceholder: 'Ej: Herramientas, pinturas, repuestos',
      extraLabels: {
        brand: { label: 'Marca', placeholder: 'Ej: Stanley, Truper, Bosch' },
        size: { label: 'Medida / dimensión', placeholder: 'Ej: 1/2, 10 mm, 3 m' },
        color: { label: 'Modelo / especificación', placeholder: 'Ej: galvanizado, industrial, universal' },
      },
    },
    taller: {
      label: 'Taller / servicios',
      usesExpiration: false,
      productExtraFields: true,
      productNamePlaceholder: 'Ej: Filtro de aceite',
      categoryPlaceholder: 'Ej: Repuestos, lubricantes, accesorios',
      extraLabels: {
        brand: { label: 'Marca', placeholder: 'Ej: Toyota, Bosch, Genérico' },
        size: { label: 'Vehículo / modelo compatible', placeholder: 'Ej: Aveo, Hilux, universal' },
        color: { label: 'Código de pieza / especificación', placeholder: 'Ej: FIL-001, 10W-30, original' },
      },
    },
    otro: {
      label: 'Otro negocio',
      usesExpiration: true,
      productExtraFields: false,
      productNamePlaceholder: 'Ej: Producto principal',
      categoryPlaceholder: 'Ej: Categoría del producto',
      extraLabels: {},
    },
  };

  return configs[type] || configs.general;
}