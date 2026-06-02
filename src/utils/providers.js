export function normalizeEcuadorPhone(contact) {
  const digits = String(contact || '').replace(/[^0-9]/g, '');

  if (!digits) return '';
  if (digits.startsWith('593')) return digits;
  if (digits.startsWith('0')) return `593${digits.slice(1)}`;
  if (digits.length === 9) return `593${digits}`;

  return digits;
}

export function buildProviderOrder(provider, products) {
  const lineBreak = String.fromCharCode(10);
  const providerCategory = String(provider.category || '').toLowerCase();

  const pendingProducts = products
    .filter(product => {
      const stock = Number(product.stock || 0);
      const minStock = Number(product.minStock || 0);
      const productCategory = String(product.category || '').toLowerCase();
      const matchesCategory = providerCategory === 'general' || productCategory === providerCategory;

      return matchesCategory && stock <= minStock;
    })
    .map(product => {
      const stock = Number(product.stock || 0);
      const minStock = Number(product.minStock || 0);
      const suggested = Math.max((minStock * 2) - stock, minStock || 1);

      return {
        ...product,
        suggested,
      };
    });

  const lines = pendingProducts.map(product =>
    `- ${product.name}: ${product.suggested} unidades sugeridas (stock actual: ${product.stock}, mínimo: ${product.minStock})`
  );

  const message = lines.length > 0
    ? [
      'Hola, buen día. Necesito cotizar los siguientes productos para reposición:',
      '',
      ...lines,
      '',
      'Quedo atento a su confirmación. Gracias.',
    ].join(lineBreak)
    : `Hola, buen día. Me gustaría consultar disponibilidad y precios para reposición de productos de la categoría ${provider.category || 'general'}. Quedo atento. Gracias.`;

  return {
    pendingProducts,
    message,
  };
}

export function getProviderEmail(provider) {
  return String(provider?.email || '').trim();
}