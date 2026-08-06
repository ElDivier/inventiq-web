import { convertRecipeQuantityToStockUnit, normalizeRecipeUnit } from './recipeUnits';
import {
  formatRecipeMoney,
  formatRecipeQuantity,
  getProductStockUnit,
  RECIPE_UNIT_OPTIONS,
} from './productionRecipes';
import {
  getRestaurantProductRole,
  isRestaurantMenuProduct,
  isRestaurantPreparation,
  isRestaurantSupply,
} from './restaurantMenu';

export const RESTAURANT_RECIPE_UNIT_OPTIONS = [
  { value: 'porción', label: 'Porción' },
  ...RECIPE_UNIT_OPTIONS,
];

export { formatRecipeMoney, formatRecipeQuantity, getProductStockUnit };

export function isRestaurantRecipeOutput(product) {
  return isRestaurantMenuProduct(product) || isRestaurantPreparation(product);
}

export function isRestaurantRecipeInput(product) {
  return isRestaurantPreparation(product) || isRestaurantSupply(product);
}

export function getRestaurantRecipeKind(product) {
  return isRestaurantPreparation(product) ? 'preparation' : 'menu';
}

export function getRestaurantRecipeKindLabel(product) {
  return isRestaurantPreparation(product) ? 'Preparación interna' : 'Plato del menú';
}

export function getSuggestedRestaurantRecipeUnit(product) {
  const stockUnit = normalizeRecipeUnit(getProductStockUnit(product));
  if (stockUnit && RESTAURANT_RECIPE_UNIT_OPTIONS.some(option => option.value === stockUnit)) return stockUnit;
  return isRestaurantMenuProduct(product) ? 'porción' : (stockUnit || 'kg');
}

function getRecipeField(recipe, snake, camel, fallback = 0) {
  if (recipe?.[snake] !== undefined && recipe?.[snake] !== null) return recipe[snake];
  if (recipe?.[camel] !== undefined && recipe?.[camel] !== null) return recipe[camel];
  return fallback;
}

function resolveRecipeOutputQuantity(recipe, outputProduct, warnings) {
  const quantity = Number(getRecipeField(recipe, 'yield_quantity', 'yieldQuantity', 0));
  const yieldUnit = String(getRecipeField(recipe, 'yield_unit', 'yieldUnit', '') || '').trim();
  const stockUnit = getProductStockUnit(outputProduct);

  if (quantity <= 0) {
    warnings.push('El rendimiento debe ser mayor a cero.');
    return 0;
  }

  if (!outputProduct || !isRestaurantPreparation(outputProduct)) {
    return quantity;
  }

  if (!stockUnit) {
    warnings.push(`${outputProduct.name}: define la unidad de stock de la preparación en Productos.`);
  }

  const converted = convertRecipeQuantityToStockUnit(quantity, yieldUnit, stockUnit);
  if (converted === null) {
    warnings.push(`${outputProduct.name}: el rendimiento en ${yieldUnit || 'sin unidad'} no coincide con su unidad de stock (${stockUnit || 'sin unidad'}).`);
    return 0;
  }

  return Number(converted || 0);
}

function makeEmptySummary(recipe, warning = '') {
  return {
    recipe,
    lines: [],
    directIngredientCost: 0,
    preparationCost: 0,
    packagingCost: 0,
    laborCost: 0,
    overheadCost: 0,
    additionalCost: 0,
    totalCost: 0,
    unitCost: 0,
    yieldInOutputUnit: 0,
    warnings: warning ? [warning] : [],
    isComplete: false,
  };
}

/**
 * Calcula costos de forma recursiva. Cuando una preparación interna tiene su
 * propia receta, se utiliza ese costo actualizado en lugar del costo manual.
 */
export function buildRestaurantRecipeCostSummary(
  recipe,
  productsById,
  recipesByOutputId,
  options = {}
) {
  const cache = options.cache || new Map();
  const stack = options.stack || [];
  const outputId = String(recipe?.output_product_id || recipe?.outputProductId || '');
  const cacheKey = String(recipe?.id || `draft-${outputId}`);

  if (!options.ignoreCache && cache.has(cacheKey)) return cache.get(cacheKey);
  if (outputId && stack.includes(outputId)) {
    return makeEmptySummary(recipe, 'Existe una dependencia circular entre preparaciones.');
  }

  const outputProduct = productsById.get(outputId);
  const nextStack = outputId ? [...stack, outputId] : stack;
  const warnings = [];
  const items = Array.isArray(recipe?.items) ? recipe.items : [];

  const lines = items.map(item => {
    const ingredientId = String(item.ingredient_product_id || item.ingredientProductId || '');
    const ingredient = productsById.get(ingredientId);
    const quantity = Number(item.quantity || 0);
    const wastePercent = Number(item.waste_percent ?? item.wastePercent ?? 0);
    const adjustedQuantity = quantity * (1 + Math.max(wastePercent, 0) / 100);
    const recipeUnit = String(item.unit || '').trim();
    const stockUnit = getProductStockUnit(ingredient);
    const convertedQuantity = ingredient
      ? convertRecipeQuantityToStockUnit(adjustedQuantity, recipeUnit, stockUnit)
      : null;

    let unitCost = Number(ingredient?.cost || 0);
    let costSource = 'product';
    let nestedSummary = null;

    if (!ingredient) {
      warnings.push('Uno de los ingredientes ya no existe.');
    } else if (isRestaurantMenuProduct(ingredient)) {
      warnings.push(`${ingredient.name}: un plato del menú no puede utilizarse como ingrediente.`);
    } else if (isRestaurantPreparation(ingredient)) {
      const nestedRecipe = recipesByOutputId.get(ingredientId);
      if (nestedRecipe) {
        nestedSummary = buildRestaurantRecipeCostSummary(
          nestedRecipe,
          productsById,
          recipesByOutputId,
          { cache, stack: nextStack }
        );
        unitCost = Number(nestedSummary.unitCost || 0);
        costSource = 'recipe';
        nestedSummary.warnings.forEach(message => warnings.push(`${ingredient.name}: ${message}`));
      } else {
        warnings.push(`${ingredient.name}: registra su receta para calcular el costo real de la preparación.`);
      }
    }

    if (ingredient) {
      if (!stockUnit) warnings.push(`${ingredient.name}: define la unidad de stock en Productos.`);
      if (convertedQuantity === null) {
        warnings.push(`${ingredient.name}: ${recipeUnit || 'sin unidad'} no coincide con ${stockUnit || 'la unidad de stock'}.`);
      }
      if (unitCost <= 0) warnings.push(`${ingredient.name}: no tiene un costo válido registrado o calculado.`);
    }

    const lineCost = convertedQuantity === null
      ? 0
      : Number(convertedQuantity || 0) * Math.max(unitCost, 0);
    const role = ingredient ? getRestaurantProductRole(ingredient) : 'unknown';

    return {
      ...item,
      ingredient,
      role,
      adjustedQuantity,
      convertedQuantity,
      stockUnit,
      unitCost,
      lineCost,
      costSource,
      nestedSummary,
    };
  });

  const directIngredientCost = lines
    .filter(line => line.role === 'supply' && !String(line.ingredient?.category || '').toLowerCase().startsWith('empaque'))
    .reduce((sum, line) => sum + Number(line.lineCost || 0), 0);
  const packagingCost = lines
    .filter(line => line.role === 'supply' && String(line.ingredient?.category || '').toLowerCase().startsWith('empaque'))
    .reduce((sum, line) => sum + Number(line.lineCost || 0), 0);
  const preparationCost = lines
    .filter(line => line.role === 'preparation')
    .reduce((sum, line) => sum + Number(line.lineCost || 0), 0);

  const laborCost = Math.max(Number(getRecipeField(recipe, 'labor_cost', 'laborCost', 0)), 0);
  const overheadCost = Math.max(Number(getRecipeField(recipe, 'overhead_cost', 'overheadCost', 0)), 0);
  const additionalCost = Math.max(Number(getRecipeField(recipe, 'additional_cost', 'additionalCost', 0)), 0);
  const totalCost = directIngredientCost + preparationCost + packagingCost + laborCost + overheadCost + additionalCost;
  const yieldInOutputUnit = resolveRecipeOutputQuantity(recipe, outputProduct, warnings);
  const unitCost = yieldInOutputUnit > 0 ? totalCost / yieldInOutputUnit : 0;

  if (!outputProduct) warnings.push('El producto de salida ya no existe.');
  if (items.length === 0) warnings.push('La receta no tiene ingredientes.');

  const summary = {
    recipe,
    outputProduct,
    lines,
    directIngredientCost,
    preparationCost,
    packagingCost,
    laborCost,
    overheadCost,
    additionalCost,
    totalCost,
    unitCost,
    yieldInOutputUnit,
    warnings: Array.from(new Set(warnings)),
    isComplete: items.length > 0 && warnings.length === 0 && yieldInOutputUnit > 0,
  };

  if (!options.ignoreCache) cache.set(cacheKey, summary);
  return summary;
}

export function buildRestaurantRecipeCollection(recipes, productsById) {
  const recipesByOutputId = new Map();
  (recipes || []).forEach(recipe => {
    if (recipe?.is_active !== false) {
      recipesByOutputId.set(String(recipe.output_product_id), recipe);
    }
  });

  const cache = new Map();
  return (recipes || []).map(recipe => {
    const outputProduct = productsById.get(String(recipe.output_product_id));
    const costSummary = buildRestaurantRecipeCostSummary(
      recipe,
      productsById,
      recipesByOutputId,
      { cache }
    );
    const salePrice = isRestaurantMenuProduct(outputProduct) ? Number(outputProduct?.price || 0) : 0;
    const unitCost = Number(costSummary.unitCost || 0);
    const grossMargin = salePrice - unitCost;
    const grossMarginPercent = salePrice > 0 ? (grossMargin / salePrice) * 100 : 0;
    const foodCostPercent = salePrice > 0 ? (unitCost / salePrice) * 100 : 0;
    const targetFoodCostPercent = Math.max(Number(recipe?.target_food_cost_percent || 30), 1);
    const suggestedPrice = unitCost > 0 ? unitCost / (targetFoodCostPercent / 100) : 0;

    return {
      ...recipe,
      outputProduct,
      recipeKind: getRestaurantRecipeKind(outputProduct),
      costSummary,
      commercialSummary: {
        salePrice,
        grossMargin,
        grossMarginPercent,
        foodCostPercent,
        targetFoodCostPercent,
        suggestedPrice,
      },
    };
  });
}
