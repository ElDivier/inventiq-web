export function normalizeRecipeUnit(unit) {
  const text = String(unit || '').trim().toLowerCase();

  if (!text) return '';

  const compact = text.replace(/\s+/g, '');

  if (
    text.includes('miligramo') ||
    compact === 'mg' ||
    /\d+([.,]\d+)?mg$/.test(compact)
  ) {
    return 'mg';
  }

  if (
    text.includes('mililitro') ||
    compact === 'ml' ||
    /\d+([.,]\d+)?ml$/.test(compact)
  ) {
    return 'ml';
  }

  if (
    text.includes('kilogramo') ||
    compact === 'kg' ||
    /\d+([.,]\d+)?kg$/.test(compact)
  ) {
    return 'kg';
  }

  if (
    text.includes('gramo') ||
    compact === 'g' ||
    compact === 'gr' ||
    /\d+([.,]\d+)?g(r)?$/.test(compact)
  ) {
    return 'g';
  }

  if (
    text.includes('litro') ||
    compact === 'l' ||
    /\d+([.,]\d+)?l$/.test(compact)
  ) {
    return 'l';
  }

  if (
    text.includes('unidad') ||
    text.includes('unid') ||
    compact === 'u' ||
    compact === 'und' ||
    text.includes('pieza') ||
    compact.includes('pz')
  ) {
    return 'unidad';
  }

  return text;
}

export function getUnitFamily(unit) {
  if (['ml', 'l'].includes(unit)) return 'volume';
  if (['mg', 'g', 'kg'].includes(unit)) return 'mass';
  if (unit === 'unidad') return 'unit';

  return 'custom';
}

export function getUnitFactor(unit) {
  const factors = {
    ml: 1,
    l: 1000,
    mg: 1,
    g: 1000,
    kg: 1000000,
    unidad: 1,
  };

  return factors[unit] || 1;
}

export function convertRecipeQuantityToStockUnit(quantity, recipeUnit, stockUnit) {
  const normalizedRecipeUnit = normalizeRecipeUnit(recipeUnit);
  const normalizedStockUnit = normalizeRecipeUnit(stockUnit);

  if (!normalizedRecipeUnit || !normalizedStockUnit) {
    return Number(quantity || 0);
  }

  if (normalizedRecipeUnit === normalizedStockUnit) {
    return Number(quantity || 0);
  }

  const recipeFamily = getUnitFamily(normalizedRecipeUnit);
  const stockFamily = getUnitFamily(normalizedStockUnit);

  if (recipeFamily === 'custom' || stockFamily === 'custom') {
    return null;
  }

  if (recipeFamily !== stockFamily) {
    return null;
  }

  return (Number(quantity || 0) * getUnitFactor(normalizedRecipeUnit)) / getUnitFactor(normalizedStockUnit);
}
