import { convertRecipeQuantityToStockUnit } from './recipeUnits';
import { getProductStockUnit } from './productionRecipes';

export function buildProductionPreview(recipe, productsById, producedQuantity) {
  const produced = Number(producedQuantity || 0);
  const recipeYield = Number(recipe?.yield_quantity || 0);
  const warnings = [];

  if (!recipe || recipeYield <= 0 || produced <= 0) {
    return {
      multiplier: 0,
      lines: [],
      ingredientCost: 0,
      additionalCost: 0,
      totalCost: 0,
      outputStockQuantity: 0,
      outputStockUnit: '',
      unitCost: 0,
      canProduce: false,
      warnings: ['Selecciona una receta y una cantidad válida.'],
    };
  }

  const multiplier = produced / recipeYield;
  const outputProduct = productsById.get(String(recipe.output_product_id));
  const outputStockUnit = getProductStockUnit(outputProduct) || recipe.yield_unit || '';
  const outputStockQuantity = convertRecipeQuantityToStockUnit(
    produced,
    recipe.yield_unit,
    outputStockUnit
  );

  if (outputStockQuantity === null) {
    warnings.push(`La unidad de rendimiento (${recipe.yield_unit}) no coincide con la unidad de stock del producto terminado (${outputStockUnit || 'sin unidad'}).`);
  }

  const lines = (recipe.items || []).map((item) => {
    const ingredient = productsById.get(String(item.ingredient_product_id));
    const baseQuantity = Number(item.quantity || 0) * multiplier;
    const wastePercent = Number(item.waste_percent || 0);
    const requiredQuantity = baseQuantity * (1 + wastePercent / 100);
    const stockUnit = getProductStockUnit(ingredient) || item.unit || '';
    const stockQuantity = convertRecipeQuantityToStockUnit(requiredQuantity, item.unit, stockUnit);
    const stock = Number(ingredient?.stock || 0);
    const unitCost = Number(ingredient?.cost || 0);
    const available = stockQuantity !== null && stock + 0.0000001 >= stockQuantity;
    const totalCost = stockQuantity === null ? 0 : stockQuantity * unitCost;

    if (!ingredient) {
      warnings.push('Uno de los ingredientes de la receta ya no existe.');
    } else if (stockQuantity === null) {
      warnings.push(`La unidad de ${ingredient.name} no es compatible con su unidad de stock.`);
    } else if (!available) {
      warnings.push(`Stock insuficiente de ${ingredient.name}.`);
    }

    return {
      id: item.id,
      ingredient,
      baseQuantity,
      requiredQuantity,
      recipeUnit: item.unit,
      wastePercent,
      stockQuantity,
      stockUnit,
      stock,
      unitCost,
      totalCost,
      available,
    };
  });

  const ingredientCost = lines.reduce((sum, line) => sum + Number(line.totalCost || 0), 0);
  const additionalCost = Number(recipe.additional_cost || 0) * multiplier;
  const totalCost = ingredientCost + additionalCost;
  const safeOutputStockQuantity = Number(outputStockQuantity || 0);
  const unitCost = safeOutputStockQuantity > 0 ? totalCost / safeOutputStockQuantity : 0;

  return {
    multiplier,
    lines,
    ingredientCost,
    additionalCost,
    totalCost,
    outputStockQuantity: safeOutputStockQuantity,
    outputStockUnit,
    unitCost,
    canProduce: warnings.length === 0 && lines.length > 0,
    warnings,
  };
}

export function formatProductionDate(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
