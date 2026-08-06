export function normalizeRecipeUnit(unit) {
  const text = String(unit || '').trim().toLowerCase();

  if (!text) return '';

  const compact = text.replace(/\s+/g, '').replace(',', '.');

  if (text.includes('miligramo') || compact === 'mg' || /\d+(\.\d+)?mg$/.test(compact)) return 'mg';
  if (text.includes('mililitro') || compact === 'ml' || /\d+(\.\d+)?ml$/.test(compact)) return 'ml';
  if (text.includes('kilogramo') || compact === 'kg' || /\d+(\.\d+)?kg$/.test(compact)) return 'kg';
  if (text.includes('libra') || compact === 'lb' || compact === 'lbs') return 'lb';
  if (text.includes('onza') || compact === 'oz') return 'oz';
  if (text.includes('gramo') || compact === 'g' || compact === 'gr' || /\d+(\.\d+)?g(r)?$/.test(compact)) return 'g';
  if (text.includes('litro') || compact === 'l' || /\d+(\.\d+)?l$/.test(compact)) return 'l';
  if (text.includes('docena') || compact === 'doc') return 'docena';
  if (
    text.includes('unidad') ||
    text.includes('unid') ||
    compact === 'u' ||
    compact === 'und' ||
    text.includes('pieza') ||
    compact.includes('pz')
  ) return 'unidad';
  if (text.includes('paquete')) return 'paquete';
  if (text.includes('funda')) return 'funda';
  if (text.includes('caja')) return 'caja';

  return text;
}

export function getUnitFamily(unit) {
  if (['ml', 'l'].includes(unit)) return 'volume';
  if (['mg', 'g', 'kg', 'lb', 'oz'].includes(unit)) return 'mass';
  if (['unidad', 'docena'].includes(unit)) return 'unit';
  return 'custom';
}

export function getUnitFactor(unit) {
  const factors = {
    ml: 1,
    l: 1000,
    mg: 1,
    g: 1000,
    kg: 1000000,
    lb: 453592.37,
    oz: 28349.523125,
    unidad: 1,
    docena: 12,
  };

  return factors[unit] || 1;
}

export function convertRecipeQuantityToStockUnit(quantity, recipeUnit, stockUnit) {
  const normalizedRecipeUnit = normalizeRecipeUnit(recipeUnit);
  const normalizedStockUnit = normalizeRecipeUnit(stockUnit);

  if (!normalizedRecipeUnit || !normalizedStockUnit) return Number(quantity || 0);
  if (normalizedRecipeUnit === normalizedStockUnit) return Number(quantity || 0);

  const recipeFamily = getUnitFamily(normalizedRecipeUnit);
  const stockFamily = getUnitFamily(normalizedStockUnit);

  if (recipeFamily === 'custom' || stockFamily === 'custom') return null;
  if (recipeFamily !== stockFamily) return null;

  return (Number(quantity || 0) * getUnitFactor(normalizedRecipeUnit)) / getUnitFactor(normalizedStockUnit);
}
