export function calculateCartItemTotals(item) {
  const quantity = Number(item?.quantity || 0);
  const price = Number(item?.price || 0);
  const cost = Number(item?.cost || 0);
  const originalSubtotal = price * quantity;
  const discountType = item?.discountType === 'fixed' ? 'fixed' : 'percent';
  const discountValue = Number(item?.discountValue || 0);
  let discountAmount = 0;
  let discountPercent = 0;

  if (discountType === 'fixed') {
    discountAmount = Math.min(Math.max(discountValue, 0), originalSubtotal);
    discountPercent = originalSubtotal > 0 ? (discountAmount / originalSubtotal) * 100 : 0;
  } else {
    discountPercent = Math.min(Math.max(discountValue, 0), 100);
    discountAmount = originalSubtotal * (discountPercent / 100);
  }

  const subtotal = Math.max(originalSubtotal - discountAmount, 0);
  const profit = subtotal - cost * quantity;

  return {
    originalSubtotal,
    discountType,
    discountValue,
    discountPercent,
    discount: discountAmount,
    subtotal,
    profit,
  };
}

export function normalizeSaleCartItem(item) {
  return {
    ...item,
    ...calculateCartItemTotals(item),
  };
}

export function calculateSalePreview({ businessConfig, storeProducts = [], saleForm = {}, saleCart = [] }) {
  const selectedProduct = storeProducts.find(product => String(product.id) === String(saleForm.productId));
  const quantity = Number(saleForm.quantity || 0);

  if (businessConfig?.salesMode === 'food') {
    const discountValue = Number(saleForm.discount || 0);
    const discountType = saleForm.discountType || 'percent';
    const subtotal = saleCart.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    let discountAmount = 0;
    let safeDiscountPercent = 0;

    if (discountType === 'fixed') {
      discountAmount = Math.min(Math.max(discountValue, 0), subtotal);
      safeDiscountPercent = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;
    } else {
      safeDiscountPercent = Math.min(Math.max(discountValue, 0), 100);
      discountAmount = subtotal * (safeDiscountPercent / 100);
    }

    const total = subtotal - discountAmount;
    const cartCost = saleCart.reduce((sum, item) => sum + Number(item.cost || 0) * Number(item.quantity || 0), 0);
    const profit = total - cartCost;

    let error = null;
    if (discountValue < 0) error = 'El descuento no puede ser negativo.';
    if (discountType === 'percent' && discountValue > 100) error = 'El descuento porcentual no puede ser mayor al 100%.';
    if (discountType === 'fixed' && discountValue > subtotal) error = 'El descuento en dólares no puede ser mayor al subtotal.';

    return {
      product: selectedProduct || null,
      quantity,
      subtotal,
      discountType,
      discountPercent: safeDiscountPercent,
      discount: discountAmount,
      total,
      profit,
      error,
    };
  }

  const normalizedCart = saleCart.map(normalizeSaleCartItem);
  const subtotal = normalizedCart.reduce((sum, item) => sum + item.originalSubtotal, 0);
  const discountAmount = normalizedCart.reduce((sum, item) => sum + item.discount, 0);
  const total = normalizedCart.reduce((sum, item) => sum + item.subtotal, 0);
  const profit = normalizedCart.reduce((sum, item) => sum + item.profit, 0);
  const safeDiscountPercent = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;

  let error = null;
  const invalidItem = normalizedCart.find(item => {
    const discountValue = Number(item.discountValue || 0);
    if (Number.isNaN(discountValue) || discountValue < 0) return true;
    if (item.discountType === 'percent' && discountValue > 100) return true;
    if (item.discountType === 'fixed' && discountValue > item.originalSubtotal) return true;
    return false;
  });

  if (invalidItem) {
    const discountValue = Number(invalidItem.discountValue || 0);
    if (Number.isNaN(discountValue) || discountValue < 0) {
      error = `El descuento de ${invalidItem.product} no puede ser negativo.`;
    } else if (invalidItem.discountType === 'percent' && discountValue > 100) {
      error = `El descuento porcentual de ${invalidItem.product} no puede ser mayor al 100%.`;
    } else if (invalidItem.discountType === 'fixed' && discountValue > invalidItem.originalSubtotal) {
      error = `El descuento en dólares de ${invalidItem.product} no puede ser mayor al subtotal del producto.`;
    }
  }

  return {
    product: selectedProduct || null,
    quantity,
    subtotal,
    discountType: 'item',
    discountPercent: safeDiscountPercent,
    discount: discountAmount,
    total,
    profit,
    error,
  };
}
