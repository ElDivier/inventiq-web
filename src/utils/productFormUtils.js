import { inferProductTypeFromCategory, isInternalStockCategory } from '../config/productTypes';

export function getFinalProductCategory(form) {
  return form.category === '__new__'
    ? form.customCategory.trim()
    : form.category.trim();
}

export function isFoodIngredientCategory(category, businessType) {
  return isInternalStockCategory(category, businessType);
}

export function getProductNumericValues(form, isFoodIngredient = false) {
  return {
    price: isFoodIngredient ? Number(form.price || 0) : Number(form.price),
    cost: Number(form.cost || 0),
    stock: Number(form.stock),
    minStock: Number(form.minStock || 0),
  };
}

export function validateProductForm({
  form,
  finalCategory,
  price,
  cost,
  stock,
  minStock,
  isFoodIngredient = false,
}) {
  if (!form.name.trim()) {
    return isFoodIngredient
      ? 'Ingresa el nombre del insumo.'
      : 'Ingresa el nombre del producto.';
  }

  if (!finalCategory.trim()) {
    return 'Selecciona o crea una categoría.';
  }

  if (isFoodIngredient) {
    if (Number.isNaN(price) || price < 0) {
      return 'El precio referencial no puede ser negativo.';
    }
  } else if (Number.isNaN(price) || price <= 0) {
    return 'El precio de venta debe ser mayor a 0.';
  }

  if (Number.isNaN(cost) || cost < 0) {
    return 'El costo no puede ser negativo. Si no lo conoces, déjalo vacío.';
  }

  if (Number.isNaN(stock) || stock < 0) {
    return 'El stock no puede ser negativo.';
  }

  if (Number.isNaN(minStock) || minStock < 0) {
    return 'El stock mínimo no puede ser negativo.';
  }

  if (!isFoodIngredient && cost > 0 && cost > price) {
    return 'El costo no debería ser mayor al precio de venta.';
  }

  return null;
}

export function buildProductData({
  form,
  storeKey,
  storeName,
  storeProductsCount,
  finalCategory,
  price,
  cost,
  stock,
  minStock,
  uploadedImageUrl,
  businessType = 'general',
}) {
  return {
    storeId: storeKey,
    storeName,
    sku: form.sku.trim() || `SKU${storeProductsCount + 1}`,
    barcode: form.barcode.trim(),
    brand: form.brand.trim(),
    size: form.size.trim(),
    color: form.color.trim(),
    name: form.name.trim(),
    category: finalCategory,
    price,
    cost,
    stock,
    minStock,
    status: stock === 0 ? 'Inactivo' : 'Activo',
    description: form.description.trim(),
    batchNumber: form.batchNumber.trim(),
    entryDate: form.entryDate || '',
    expirationDate: form.expirationDate || '',
    imageUrl: uploadedImageUrl,
    productType: inferProductTypeFromCategory(finalCategory, businessType),
    stockUnit: ['panaderia', 'restaurante', 'cafeteria'].includes(businessType)
      ? (form.stockUnit || form.size || '').trim()
      : (form.stockUnit || '').trim(),
    tracksLots: ['panaderia', 'restaurante', 'cafeteria'].includes(businessType)
      ? Boolean(form.batchNumber || form.entryDate)
      : undefined,
    tracksExpiration: ['panaderia', 'restaurante', 'cafeteria'].includes(businessType)
      ? Boolean(form.expirationDate)
      : undefined,
    productMetadata: form.productMetadata && typeof form.productMetadata === 'object'
      ? form.productMetadata
      : {},
  };
}
