import { convertRecipeQuantityToStockUnit, normalizeRecipeUnit } from './recipeUnits';
import { formatRecipeMoney, formatRecipeQuantity, getProductStockUnit, RECIPE_UNIT_OPTIONS } from './productionRecipes';
import { isCafeteriaMenuProduct, normalizeCafeteriaProductMetadata } from './cafeteriaMenu';
import { PRODUCT_TYPES, inferProductTypeFromCategory } from '../config/productTypes';

export const CAFETERIA_RECIPE_UNIT_OPTIONS = [
  { value: 'porción', label: 'Porción' },
  ...RECIPE_UNIT_OPTIONS,
];

export const CAFETERIA_COMPONENT_OPTIONS = [
  { value: 'standard', label: 'Componente estándar' },
  { value: 'coffee', label: 'Café / base de espresso' },
  { value: 'milk', label: 'Leche' },
  { value: 'packaging', label: 'Vaso / empaque' },
  { value: 'syrup', label: 'Jarabe / salsa' },
  { value: 'garnish', label: 'Topping / decoración' },
  { value: 'other', label: 'Otro componente' },
];

export { formatRecipeMoney, formatRecipeQuantity, getProductStockUnit };

export function getCafeteriaProductType(product = {}) {
  const inferred = inferProductTypeFromCategory(product?.category, 'cafeteria');
  const stored = product?.productType || product?.product_type || '';
  return inferred !== PRODUCT_TYPES.SALE_PRODUCT ? inferred : (stored || inferred);
}

export function isCafeteriaPreparation(product = {}) {
  const category = String(product?.category || '').trim().toLowerCase();
  return getCafeteriaProductType(product) === PRODUCT_TYPES.INTERMEDIATE
    || category.startsWith('preparaciones -')
    || category.startsWith('preparación -');
}

export function isCafeteriaSupply(product = {}) {
  const category = String(product?.category || '').trim().toLowerCase();
  const type = getCafeteriaProductType(product);
  return [PRODUCT_TYPES.RAW_MATERIAL, PRODUCT_TYPES.PACKAGING].includes(type)
    || category.startsWith('insumos -')
    || category.startsWith('empaques -')
    || category.startsWith('empaque -');
}

export function isCafeteriaRecipeOutput(product = {}) {
  return isCafeteriaPreparation(product) || (isCafeteriaMenuProduct(product) && !isCafeteriaSupply(product));
}

export function isCafeteriaRecipeInput(product = {}) {
  return isCafeteriaPreparation(product) || isCafeteriaSupply(product);
}

export function getCafeteriaRecipeKind(product = {}) {
  return isCafeteriaPreparation(product) ? 'preparation' : 'menu';
}

export function getSuggestedCafeteriaRecipeUnit(product = {}) {
  if (!isCafeteriaPreparation(product) && isCafeteriaMenuProduct(product)) return 'porción';
  const unit = normalizeRecipeUnit(getProductStockUnit(product));
  if (unit && CAFETERIA_RECIPE_UNIT_OPTIONS.some((option) => option.value === unit)) return unit;
  return unit || 'ml';
}

export function getCafeteriaVariantOptions(product = {}) {
  const metadata = normalizeCafeteriaProductMetadata(product.productMetadata || product.product_metadata || {});
  const rows = [];
  metadata.sizes.forEach((option) => rows.push({ optionKey: `size-${option.id}`, optionType: 'size', optionLabel: option.label }));
  metadata.milkOptions.forEach((option) => rows.push({ optionKey: `milk-${option.id}`, optionType: 'milk', optionLabel: option.label }));
  metadata.syrupOptions.forEach((option) => rows.push({ optionKey: `syrup-${option.id}`, optionType: 'syrup', optionLabel: option.label }));
  metadata.temperatures.forEach((value) => rows.push({
    optionKey: `temp-${value}`,
    optionType: 'temperature',
    optionLabel: value === 'frio' ? 'Frío' : value === 'ambiente' ? 'Ambiente' : 'Caliente',
  }));
  if (metadata.extraShotEnabled) rows.push({ optionKey: 'extra-shot', optionType: 'extra_shot', optionLabel: 'Shot extra' });
  return rows;
}

export function normalizeCafeteriaVariantRule(rule = {}) {
  return {
    id: rule.id || '',
    optionKey: rule.option_key || rule.optionKey || '',
    optionType: rule.option_type || rule.optionType || '',
    optionLabel: rule.option_label || rule.optionLabel || '',
    scaleFactor: Math.max(Number(rule.scale_factor ?? rule.scaleFactor ?? 1) || 1, 0.0001),
    replaceComponentKey: rule.replace_component_key || rule.replaceComponentKey || '',
    replacementProductId: String(rule.replacement_product_id || rule.replacementProductId || ''),
    additionProductId: String(rule.addition_product_id || rule.additionProductId || ''),
    additionQuantity: Math.max(Number(rule.addition_quantity ?? rule.additionQuantity ?? 0) || 0, 0),
    additionUnit: rule.addition_unit || rule.additionUnit || '',
    additionWastePercent: Math.min(100, Math.max(Number(rule.addition_waste_percent ?? rule.additionWastePercent ?? 0) || 0, 0)),
    isActive: rule.is_active !== false && rule.isActive !== false,
  };
}

function getField(recipe, snake, camel, fallback = 0) {
  if (recipe?.[snake] !== undefined && recipe?.[snake] !== null) return recipe[snake];
  if (recipe?.[camel] !== undefined && recipe?.[camel] !== null) return recipe[camel];
  return fallback;
}

function getItemField(item, snake, camel, fallback = '') {
  if (item?.[snake] !== undefined && item?.[snake] !== null) return item[snake];
  if (item?.[camel] !== undefined && item?.[camel] !== null) return item[camel];
  return fallback;
}

function lineCostForProduct({ product, quantity, unit, wastePercent = 0, warnings, label }) {
  if (!product) {
    warnings.push(`${label || 'Componente'}: producto no encontrado.`);
    return { convertedQuantity: null, cost: 0 };
  }
  const stockUnit = getProductStockUnit(product);
  const adjusted = Number(quantity || 0) * (1 + Number(wastePercent || 0) / 100);
  const convertedQuantity = convertRecipeQuantityToStockUnit(adjusted, unit, stockUnit);
  if (!stockUnit) warnings.push(`${product.name}: define una unidad de stock.`);
  if (convertedQuantity === null) warnings.push(`${product.name}: ${unit || 'sin unidad'} no coincide con ${stockUnit || 'su unidad de stock'}.`);
  const unitCost = Math.max(Number(product.cost || 0), 0);
  if (unitCost <= 0) warnings.push(`${product.name}: no tiene costo de compra registrado.`);
  return {
    convertedQuantity,
    cost: convertedQuantity === null ? 0 : Number(convertedQuantity || 0) * unitCost,
  };
}

/**
 * Calcula el costo de una porción/lote de cafetería con las variantes elegidas.
 * selectedOptionKeys usa las mismas claves que Caja rápida: size-*, milk-*, syrup-*, temp-* y extra-shot.
 */
export function buildCafeteriaRecipeCostSummary(recipe, productsById, variantRules = [], selectedOptionKeys = []) {
  const warnings = [];
  const items = Array.isArray(recipe?.items) ? recipe.items : [];
  const yieldQuantity = Math.max(Number(getField(recipe, 'yield_quantity', 'yieldQuantity', 0)) || 0, 0);
  const selectedSet = new Set((selectedOptionKeys || []).filter(Boolean));
  const activeRules = (variantRules || []).map(normalizeCafeteriaVariantRule).filter((rule) => rule.isActive && selectedSet.has(rule.optionKey));
  const sizeRule = activeRules.find((rule) => rule.optionType === 'size');
  const sizeScale = sizeRule?.scaleFactor || 1;
  const replacements = new Map(
    activeRules
      .filter((rule) => rule.replaceComponentKey && rule.replacementProductId)
      .map((rule) => [rule.replaceComponentKey, rule])
  );

  const lines = items.map((item) => {
    const componentKey = String(getItemField(item, 'component_key', 'componentKey', 'standard') || 'standard');
    const scaleWithSize = Boolean(getItemField(item, 'scale_with_size', 'scaleWithSize', false));
    const replacementRule = replacements.get(componentKey);
    const ingredientId = replacementRule?.replacementProductId || String(getItemField(item, 'ingredient_product_id', 'ingredientProductId', ''));
    const ingredient = productsById.get(String(ingredientId));
    const quantity = Math.max(Number(getItemField(item, 'quantity', 'quantity', 0)) || 0, 0) * (scaleWithSize ? sizeScale : 1);
    const unit = String(getItemField(item, 'unit', 'unit', '') || '');
    const wastePercent = Math.max(Number(getItemField(item, 'waste_percent', 'wastePercent', 0)) || 0, 0);
    const result = lineCostForProduct({ product: ingredient, quantity, unit, wastePercent, warnings, label: componentKey });
    return {
      ...item,
      ingredient,
      effectiveIngredientId: ingredientId,
      componentKey,
      scaleWithSize,
      effectiveQuantity: quantity,
      convertedQuantity: result.convertedQuantity,
      lineCost: result.cost,
      replacementRule,
    };
  });

  const variantLines = activeRules
    .filter((rule) => rule.additionProductId && rule.additionQuantity > 0)
    .map((rule) => {
      const ingredient = productsById.get(String(rule.additionProductId));
      const result = lineCostForProduct({
        product: ingredient,
        quantity: rule.additionQuantity,
        unit: rule.additionUnit,
        wastePercent: rule.additionWastePercent,
        warnings,
        label: rule.optionLabel,
      });
      return {
        ...rule,
        ingredient,
        convertedQuantity: result.convertedQuantity,
        lineCost: result.cost,
      };
    });

  const ingredientCost = lines.reduce((sum, line) => sum + Number(line.lineCost || 0), 0)
    + variantLines.reduce((sum, line) => sum + Number(line.lineCost || 0), 0);
  const laborCost = Math.max(Number(getField(recipe, 'labor_cost', 'laborCost', 0)) || 0, 0);
  const overheadCost = Math.max(Number(getField(recipe, 'overhead_cost', 'overheadCost', 0)) || 0, 0);
  const totalCost = ingredientCost + laborCost + overheadCost;
  const unitCost = yieldQuantity > 0 ? totalCost / yieldQuantity : 0;
  if (yieldQuantity <= 0) warnings.push('El rendimiento debe ser mayor a cero.');

  return {
    lines,
    variantLines,
    sizeScale,
    ingredientCost,
    laborCost,
    overheadCost,
    totalCost,
    unitCost,
    yieldQuantity,
    warnings: [...new Set(warnings)],
    isComplete: items.length > 0 && warnings.length === 0 && yieldQuantity > 0,
  };
}

export function buildCafeteriaCommercialSummary(recipe, outputProduct, costSummary) {
  const salePrice = Math.max(Number(outputProduct?.price || 0), 0);
  const unitCost = Math.max(Number(costSummary?.unitCost || 0), 0);
  const targetPercent = Math.max(Number(getField(recipe, 'target_food_cost_percent', 'targetFoodCostPercent', 30)) || 30, 1);
  const foodCostPercent = salePrice > 0 ? (unitCost / salePrice) * 100 : 0;
  const marginValue = salePrice - unitCost;
  const marginPercent = salePrice > 0 ? (marginValue / salePrice) * 100 : 0;
  const suggestedPrice = unitCost > 0 ? unitCost / (targetPercent / 100) : 0;
  return { salePrice, unitCost, targetPercent, foodCostPercent, marginValue, marginPercent, suggestedPrice };
}

export function getCafeteriaVariantCostRows(recipe, outputProduct, productsById, rules = []) {
  const base = buildCafeteriaRecipeCostSummary(recipe, productsById, rules, []);
  const metadataOptions = getCafeteriaVariantOptions(outputProduct);
  return metadataOptions.map((option) => {
    const summary = buildCafeteriaRecipeCostSummary(recipe, productsById, rules, [option.optionKey]);
    return {
      ...option,
      cost: summary.unitCost,
      delta: summary.unitCost - base.unitCost,
      warnings: summary.warnings,
    };
  });
}
