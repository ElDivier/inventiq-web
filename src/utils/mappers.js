export function mapProductFromDb(product) {
  return {
    id: product.id,
    storeId: product.user_id,
    storeName: '',
    sku: product.sku || '',
    barcode: product.barcode || '',
    brand: product.brand || '',
    size: product.size || '',
    color: product.color || '',
    name: product.name || '',
    category: product.category || '',
    price: Number(product.price || 0),
    cost: Number(product.cost || 0),
    stock: Number(product.stock || 0),
    minStock: Number(product.min_stock || 0),
    status: product.status || 'Activo',
    description: product.description || '',
    batchNumber: product.batch_number || '',
    entryDate: product.entry_date || '',
    expirationDate: product.expiration_date || '',
    imageUrl: product.image_url || '',
    productType: product.product_type || 'sale_product',
    stockUnit: product.stock_unit || '',
    productionEnabled: Boolean(product.production_enabled),
    tracksLots: Boolean(product.tracks_lots),
    tracksExpiration: Boolean(product.tracks_expiration),
    productMetadata: product.product_metadata || {},
  };
}

export function mapProductToDb(product, userId) {
  return {
    user_id: userId,
    sku: product.sku,
    barcode: product.barcode || '',
    brand: product.brand || '',
    size: product.size || '',
    color: product.color || '',
    name: product.name,
    category: product.category,
    price: product.price,
    cost: product.cost,
    stock: product.stock,
    min_stock: product.minStock,
    status: product.status,
    description: product.description,
    batch_number: product.batchNumber || '',
    entry_date: product.entryDate || null,
    expiration_date: product.expirationDate || null,
    image_url: product.imageUrl || '',
    ...(product.productType !== undefined ? { product_type: product.productType } : {}),
    ...(product.stockUnit !== undefined ? { stock_unit: product.stockUnit || null } : {}),
    ...(product.productionEnabled !== undefined ? { production_enabled: Boolean(product.productionEnabled) } : {}),
    ...(product.tracksLots !== undefined ? { tracks_lots: Boolean(product.tracksLots) } : {}),
    ...(product.tracksExpiration !== undefined ? { tracks_expiration: Boolean(product.tracksExpiration) } : {}),
    ...(product.productMetadata !== undefined ? { product_metadata: product.productMetadata || {} } : {}),
  };
}

export function mapSaleFromDb(sale) {
  return {
    id: sale.id,
    storeId: sale.user_id,
    productId: sale.product_id,
    code: sale.code || '',
    product: sale.product || '',
    customer: sale.customer || 'Consumidor final',
    paymentMethod: sale.payment_method || 'Efectivo',
    invoiceEnabled: Boolean(sale.invoice_enabled),
    invoiceName: sale.invoice_name || '',
    invoiceIdentification: sale.invoice_identification || '',
    invoiceAddress: sale.invoice_address || '',
    invoiceEmail: sale.invoice_email || '',
    quantity: Number(sale.quantity || 0),
    subtotal: Number(sale.subtotal || 0),
    discountPercent: Number(sale.discount_percent || 0),
    discount: Number(sale.discount || 0),
    total: Number(sale.total || 0),
    profit: Number(sale.profit || 0),
    status: sale.status || 'Completada',
    sourceType: sale.source_type || 'pos',
    sourceId: sale.source_id || null,
    cashAlreadyRecorded: Boolean(sale.cash_already_recorded),
    createdAt: sale.created_at || null,
    date: sale.created_at ? new Date(sale.created_at).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }) : 'Sin fecha',
  };
}

export function mapSaleToDb(sale, userId) {
  return {
    user_id: userId,
    product_id: sale.productId || null,
    code: sale.code,
    product: sale.product,
    customer: sale.customer,
    payment_method: sale.paymentMethod,
    invoice_enabled: sale.invoiceEnabled,
    invoice_name: sale.invoiceName,
    invoice_identification: sale.invoiceIdentification,
    invoice_address: sale.invoiceAddress,
    invoice_email: sale.invoiceEmail,
    quantity: sale.quantity,
    subtotal: sale.subtotal,
    discount_percent: sale.discountPercent,
    discount: sale.discount,
    total: sale.total,
    profit: sale.profit,
    status: sale.status,
    ...(sale.sourceType !== undefined ? { source_type: sale.sourceType || 'pos' } : {}),
    ...(sale.sourceId !== undefined ? { source_id: sale.sourceId || null } : {}),
    ...(sale.cashAlreadyRecorded !== undefined ? { cash_already_recorded: Boolean(sale.cashAlreadyRecorded) } : {}),
  };
}

export function mapSaleItemFromDb(item) {
  return {
    id: item.id,
    saleId: item.sale_id,
    productId: item.product_id,
    product: item.product || '',
    quantity: Number(item.quantity || 0),
    price: Number(item.price || 0),
    cost: Number(item.cost || 0),
    subtotal: Number(item.subtotal || 0),
    profit: Number(item.profit || 0),
  };
}

export function mapSaleItemToDb(item, saleId, userId) {
  return {
    user_id: userId,
    sale_id: saleId,
    product_id: item.productId,
    product: item.product,
    quantity: item.quantity,
    price: item.price,
    cost: item.cost,
    subtotal: item.subtotal,
    profit: item.profit,
  };
}

export function mapClientFromDb(client) {
  return {
    id: client.id,
    storeId: client.user_id,
    name: client.name || '',
    phone: client.phone || 'Sin teléfono',
    type: client.type || 'Nuevo',
    email: client.email || '',
    identification: client.identification || '',
    address: client.address || '',
    invoiceName: client.invoice_name || '',
    wantsInvoice: Boolean(client.wants_invoice),
    notes: client.notes || '',
    purchases: Number(client.purchases || 0),
  };
}

export function mapClientToDb(client, userId) {
  return {
    user_id: userId,
    name: client.name,
    phone: client.phone,
    type: client.type,
    email: client.email,
    identification: client.identification,
    address: client.address,
    invoice_name: client.invoiceName,
    wants_invoice: client.wantsInvoice,
    notes: client.notes,
    purchases: client.purchases,
  };
}

export function mapProviderFromDb(provider) {
  return {
    id: provider.id,
    storeId: provider.user_id,
    name: provider.name || '',
    category: provider.category || '',
    contact: provider.contact || 'Sin teléfono',
    email: provider.email || '',
    delivery: provider.delivery || 'No definido',
    notes: provider.notes || '',
  };
}

export function mapProviderToDb(provider, userId) {
  return {
    user_id: userId,
    name: provider.name,
    category: provider.category,
    contact: provider.contact,
    email: provider.email,
    delivery: provider.delivery,
    notes: provider.notes,
  };
}

export function mapPurchaseFromDb(purchase) {
  return {
    id: purchase.id,
    storeId: purchase.user_id,
    productId: purchase.product_id,
    providerId: purchase.provider_id,
    code: purchase.code || '',
    product: purchase.product || '',
    provider: purchase.provider || 'Sin proveedor',
    quantity: Number(purchase.quantity || 0),
    unitCost: Number(purchase.unit_cost || 0),
    total: Number(purchase.total || 0),
    note: purchase.note || '',
    date: purchase.created_at ? new Date(purchase.created_at).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }) : 'Sin fecha',
  };
}

export function mapPurchaseToDb(purchase, userId) {
  return {
    user_id: userId,
    product_id: purchase.productId,
    provider_id: purchase.providerId || null,
    code: purchase.code,
    product: purchase.product,
    provider: purchase.provider,
    quantity: purchase.quantity,
    unit_cost: purchase.unitCost,
    total: purchase.total,
    note: purchase.note,
  };
}

export function mapPurchaseItemFromDb(item) {
  return {
    id: item.id,
    purchaseId: item.purchase_id,
    productId: item.product_id,
    product: item.product || '',
    quantity: Number(item.quantity || 0),
    unitCost: Number(item.unit_cost || 0),
    total: Number(item.total || 0),
  };
}

export function mapPurchaseItemToDb(item, purchaseId, userId) {
  return {
    user_id: userId,
    purchase_id: purchaseId,
    product_id: item.productId,
    product: item.product,
    quantity: item.quantity,
    unit_cost: item.unitCost,
    total: item.total,
  };
}