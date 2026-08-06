import {
  convertRecipeQuantityToStockUnit,
  normalizeRecipeUnit,
} from './recipeUnits';
import {
  PRODUCT_TYPES,
  inferProductTypeFromCategory,
  isInternalStockCategory,
} from '../config/productTypes';

export const RECIPE_UNIT_OPTIONS = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'docena', label: 'Docena' },
  { value: 'g', label: 'Gramo (g)' },
  { value: 'kg', label: 'Kilogramo (kg)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'l', label: 'Litro (L)' },
  { value: 'paquete', label: 'Paquete' },
  { value: 'funda', label: 'Funda' },
  { value: 'caja', label: 'Caja' },
];

export function formatRecipeQuantity(value, maximumFractionDigits = 3) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0';
  return new Intl.NumberFormat('es-EC', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(number);
}

export function formatRecipeMoney(value) {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function getProductStockUnit(product) {
  return String(
    product?.stockUnit ||
    product?.stock_unit ||
    product?.unit ||
    product?.size ||
    ''
  ).trim();
}

export function getBakeryProductType(product) {
  const inferredType = inferProductTypeFromCategory(product?.category, 'panaderia');
  const storedType = product?.productType || product?.product_type || '';

  if (inferredType !== PRODUCT_TYPES.SALE_PRODUCT) return inferredType;
  return storedType || inferredType;
}

export function isBakeryIngredientProduct(product) {
  const productType = getBakeryProductType(product);
  return [
    PRODUCT_TYPES.RAW_MATERIAL,
    PRODUCT_TYPES.PACKAGING,
    PRODUCT_TYPES.INTERMEDIATE,
  ].includes(productType) || isInternalStockCategory(product?.category, 'panaderia');
}

export function isBakeryOutputProduct(product) {
  const productType = getBakeryProductType(product);
  return [
    PRODUCT_TYPES.FINISHED_PRODUCT,
    PRODUCT_TYPES.SALE_PRODUCT,
  ].includes(productType) && !isBakeryIngredientProduct(product);
}

export function buildRecipeCostSummary(recipe, productsById) {
  const items = Array.isArray(recipe?.items) ? recipe.items : [];
  const warnings = [];
  const lines = items.map((item) => {
    const ingredient = productsById.get(String(item.ingredient_product_id));
    const quantity = Number(item.quantity || 0);
    const wastePercent = Number(item.waste_percent || 0);
    const adjustedQuantity = quantity * (1 + wastePercent / 100);
    const recipeUnit = String(item.unit || '').trim();
    const stockUnit = getProductStockUnit(ingredient);
    const convertedQuantity = ingredient
      ? convertRecipeQuantityToStockUnit(adjustedQuantity, recipeUnit, stockUnit)
      : null;
    const unitCost = Number(ingredient?.cost || 0);
    const lineCost = convertedQuantity === null ? 0 : Number(convertedQuantity || 0) * unitCost;

    if (!ingredient) {
      warnings.push('Uno de los ingredientes ya no existe.');
    } else {
      if (!stockUnit) {
        warnings.push(`${ingredient.name}: define la unidad de stock en Productos.`);
      }
      if (convertedQuantity === null) {
        warnings.push(`${ingredient.name}: ${recipeUnit || 'sin unidad'} no coincide con ${stockUnit || 'la unidad de stock'}.`);
      }
      if (unitCost <= 0) {
        warnings.push(`${ingredient.name}: no tiene costo de compra registrado.`);
      }
    }

    return {
      ...item,
      ingredient,
      adjustedQuantity,
      convertedQuantity,
      unitCost,
      lineCost,
    };
  });

  const ingredientCost = lines.reduce((sum, line) => sum + Number(line.lineCost || 0), 0);
  const additionalCost = Math.max(Number(recipe?.additional_cost || recipe?.additionalCost || 0), 0);
  const totalCost = ingredientCost + additionalCost;
  const yieldQuantity = Number(recipe?.yield_quantity || recipe?.yieldQuantity || 0);
  const unitCost = yieldQuantity > 0 ? totalCost / yieldQuantity : 0;

  return {
    lines,
    ingredientCost,
    additionalCost,
    totalCost,
    unitCost,
    warnings: Array.from(new Set(warnings)),
    isComplete: items.length > 0 && warnings.length === 0 && yieldQuantity > 0,
  };
}

export function getRecipeMarginSummary(recipe, outputProduct, costSummary) {
  const salePrice = Number(outputProduct?.price || 0);
  const unitCost = Number(costSummary?.unitCost || 0);
  const marginValue = salePrice - unitCost;
  const marginPercent = salePrice > 0 ? (marginValue / salePrice) * 100 : 0;

  return {
    salePrice,
    unitCost,
    marginValue,
    marginPercent,
  };
}

export function getSuggestedRecipeUnit(product) {
  const normalized = normalizeRecipeUnit(getProductStockUnit(product));
  if (RECIPE_UNIT_OPTIONS.some(option => option.value === normalized)) return normalized;
  return normalized || 'unidad';
}
