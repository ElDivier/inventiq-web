import { supabase } from '../supabaseClient';
import { convertRecipeQuantityToStockUnit } from './recipeUnits';
import { getProductStockUnit } from './productionRecipes';
import { isRestaurantPreparation, isRestaurantSupply } from './restaurantMenu';

export const RESTAURANT_WASTE_REASONS = [
  ['preparacion', 'Error de preparación'],
  ['caducidad', 'Producto caducado'],
  ['dano', 'Producto dañado'],
  ['derrame', 'Derrame o pérdida'],
  ['devolucion', 'Devolución no reutilizable'],
  ['cortesia', 'Cortesía o consumo interno'],
  ['otro', 'Otro motivo'],
];

export const RESTAURANT_COUNT_REASONS = [
  ['conteo_general', 'Conteo físico general'],
  ['cambio_turno', 'Verificación por cambio de turno'],
  ['recepcion', 'Diferencia detectada en recepción'],
  ['auditoria', 'Auditoría de inventario'],
  ['otro', 'Otro motivo'],
];

export function getLocalDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatInventoryMoney(value) {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatInventoryQuantity(value, maximumFractionDigits = 3) {
  return new Intl.NumberFormat('es-EC', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(Number(value || 0));
}

export function formatInventoryDate(value, includeTime = false) {
  if (!value) return 'Sin fecha';
  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T12:00:00` : value;
  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-EC', includeTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }
  ).format(date);
}

export function mapRestaurantConsumption(row = {}) {
  return {
    id: row.id,
    orderId: row.order_id,
    saleId: row.sale_id,
    orderItemId: row.order_item_id,
    menuProductId: row.menu_product_id,
    menuProductName: row.menu_product_name || 'Producto del menú',
    ingredientProductId: row.ingredient_product_id,
    ingredientName: row.ingredient_name || 'Componente',
    sourceKind: row.source_kind || 'ingredient',
    quantitySold: Number(row.quantity_sold || 0),
    recipeQuantity: Number(row.recipe_quantity || 0),
    recipeUnit: row.recipe_unit || '',
    requiredQuantity: Number(row.required_quantity || 0),
    stockQuantity: Number(row.stock_quantity || 0),
    appliedQuantity: Number(row.applied_quantity || 0),
    shortageQuantity: Number(row.shortage_quantity || 0),
    stockUnit: row.stock_unit || '',
    unitCost: Number(row.unit_cost || 0),
    theoreticalCost: Number(row.theoretical_cost || 0),
    appliedCost: Number(row.applied_cost || 0),
    stockBefore: Number(row.stock_before || 0),
    stockAfter: Number(row.stock_after || 0),
    orderType: row.order_type || 'local',
    consumedAt: row.consumed_at,
    reversedAt: row.reversed_at,
  };
}

export function mapRestaurantInventoryIssue(row = {}) {
  return {
    id: row.id,
    orderId: row.order_id,
    orderItemId: row.order_item_id,
    menuProductId: row.menu_product_id,
    menuProductName: row.menu_product_name || 'Producto del menú',
    issueType: row.issue_type || 'processing_error',
    details: row.details || '',
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolvedNotes: row.resolved_notes || '',
  };
}

export function mapRestaurantAdjustment(row = {}) {
  return {
    id: row.id,
    productId: row.product_id,
    batchId: row.production_batch_id,
    kind: row.adjustment_kind,
    reasonCode: row.reason_code,
    reasonLabel: row.reason_label,
    productName: row.product_name,
    productType: row.product_type,
    quantityReported: Number(row.quantity_reported || 0),
    quantityDelta: Number(row.quantity_delta || 0),
    stockBefore: Number(row.stock_before || 0),
    stockAfter: Number(row.stock_after || 0),
    unit: row.unit || '',
    unitCost: Number(row.unit_cost || 0),
    costImpact: Number(row.cost_impact || 0),
    eventDate: row.event_date,
    batchCode: row.batch_code || '',
    notes: row.notes || '',
    createdAt: row.created_at,
  };
}

export function mapRestaurantPreparationBatch(row = {}) {
  return {
    ...row,
    id: row.id,
    recipeId: row.recipe_id,
    outputProductId: row.output_product_id,
    batchCode: row.batch_code || '',
    productionDate: row.production_date,
    producedQuantity: Number(row.produced_quantity || 0),
    producedUnit: row.produced_unit || '',
    outputStockQuantity: Number(row.output_stock_quantity || 0),
    outputStockUnit: row.output_stock_unit || '',
    ingredientCost: Number(row.ingredient_cost || 0),
    additionalCost: Number(row.additional_cost || 0),
    totalCost: Number(row.total_cost || 0),
    unitCost: Number(row.unit_cost || 0),
    outputProductName: row.output_product_name || 'Preparación',
    recipeName: row.recipe_name || 'Receta',
    notes: row.notes || '',
    createdAt: row.created_at,
    items: Array.isArray(row.production_batch_items)
      ? row.production_batch_items.map(item => ({
          ...item,
          ingredientName: item.ingredient_name || 'Componente',
          stockQuantity: Number(item.stock_quantity || 0),
          stockUnit: item.stock_unit || '',
          totalCost: Number(item.total_cost || 0),
          stockBefore: Number(item.stock_before || 0),
          stockAfter: Number(item.stock_after || 0),
        }))
      : [],
  };
}

export function getRestaurantInternalProducts(products = []) {
  return products.filter(product => isRestaurantSupply(product) || isRestaurantPreparation(product));
}

export function buildRestaurantPreparationPreview(recipe, productsById, producedQuantity) {
  const produced = Number(producedQuantity || 0);
  const recipeYield = Number(recipe?.yield_quantity || 0);
  const warnings = [];

  if (!recipe || produced <= 0 || recipeYield <= 0) {
    return {
      canProduce: false,
      multiplier: 0,
      lines: [],
      outputStockQuantity: 0,
      outputStockUnit: '',
      ingredientCost: 0,
      operationalCost: 0,
      totalCost: 0,
      unitCost: 0,
      warnings: ['Selecciona una preparación y una cantidad válida.'],
    };
  }

  const outputProduct = productsById.get(String(recipe.output_product_id));
  const outputStockUnit = getProductStockUnit(outputProduct) || recipe.yield_unit || '';
  const outputStockQuantity = convertRecipeQuantityToStockUnit(produced, recipe.yield_unit, outputStockUnit);
  const multiplier = produced / recipeYield;

  if (!outputProduct || !isRestaurantPreparation(outputProduct)) {
    warnings.push('La receta seleccionada no produce una preparación interna.');
  }
  if (outputStockQuantity === null || Number(outputStockQuantity || 0) <= 0) {
    warnings.push(`La unidad de rendimiento (${recipe.yield_unit || 'sin unidad'}) no coincide con la unidad de stock (${outputStockUnit || 'sin unidad'}).`);
  }

  const lines = (recipe.items || []).map(item => {
    const ingredient = productsById.get(String(item.ingredient_product_id));
    const baseQuantity = Number(item.quantity || 0) * multiplier;
    const wastePercent = Number(item.waste_percent || 0);
    const requiredQuantity = baseQuantity * (1 + Math.max(wastePercent, 0) / 100);
    const stockUnit = getProductStockUnit(ingredient) || item.unit || '';
    const stockQuantity = ingredient
      ? convertRecipeQuantityToStockUnit(requiredQuantity, item.unit, stockUnit)
      : null;
    const stock = Number(ingredient?.stock || 0);
    const unitCost = Number(ingredient?.cost || 0);
    const available = stockQuantity !== null && stock + 0.0000001 >= Number(stockQuantity || 0);
    const totalCost = stockQuantity === null ? 0 : Number(stockQuantity || 0) * Math.max(unitCost, 0);

    if (!ingredient) warnings.push('Uno de los componentes de la receta ya no existe.');
    else if (stockQuantity === null) warnings.push(`${ingredient.name}: unidad incompatible con su stock.`);
    else if (!available) warnings.push(`${ingredient.name}: stock insuficiente.`);
    if (ingredient && unitCost <= 0) warnings.push(`${ingredient.name}: no tiene costo registrado.`);

    return {
      id: item.id,
      ingredient,
      baseQuantity,
      requiredQuantity,
      recipeUnit: item.unit,
      wastePercent,
      stockQuantity: Number(stockQuantity || 0),
      stockUnit,
      stock,
      unitCost,
      totalCost,
      available,
    };
  });

  const ingredientCost = lines.reduce((sum, line) => sum + Number(line.totalCost || 0), 0);
  const operationalCost = (
    Number(recipe.additional_cost || 0)
    + Number(recipe.labor_cost || 0)
    + Number(recipe.overhead_cost || 0)
  ) * multiplier;
  const totalCost = ingredientCost + operationalCost;
  const safeOutputQuantity = Number(outputStockQuantity || 0);

  return {
    canProduce: warnings.length === 0 && lines.length > 0,
    multiplier,
    lines,
    outputStockQuantity: safeOutputQuantity,
    outputStockUnit,
    ingredientCost,
    operationalCost,
    totalCost,
    unitCost: safeOutputQuantity > 0 ? totalCost / safeOutputQuantity : 0,
    warnings: Array.from(new Set(warnings)),
  };
}

export async function fetchRestaurantInventoryData(userId) {
  const [consumptionsResponse, issuesResponse, adjustmentsResponse, recipesResponse, batchesResponse] = await Promise.all([
    supabase
      .from('restaurant_inventory_consumptions')
      .select('*')
      .eq('user_id', userId)
      .order('consumed_at', { ascending: false })
      .limit(500),
    supabase
      .from('restaurant_inventory_issues')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(250),
    supabase
      .from('restaurant_stock_adjustments')
      .select('*')
      .eq('user_id', userId)
      .order('event_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('production_recipes')
      .select('*, items:production_recipe_items(*)')
      .eq('user_id', userId)
      .eq('recipe_context', 'restaurant')
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('production_batches')
      .select('*, production_batch_items(*)')
      .eq('user_id', userId)
      .eq('production_context', 'restaurant')
      .order('production_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const errors = [
    consumptionsResponse.error,
    issuesResponse.error,
    adjustmentsResponse.error,
    recipesResponse.error,
    batchesResponse.error,
  ].filter(Boolean);
  if (errors.length) throw errors[0];

  return {
    consumptions: (consumptionsResponse.data || []).map(mapRestaurantConsumption),
    issues: (issuesResponse.data || []).map(mapRestaurantInventoryIssue),
    adjustments: (adjustmentsResponse.data || []).map(mapRestaurantAdjustment),
    recipes: (recipesResponse.data || []).map(recipe => ({
      ...recipe,
      items: Array.isArray(recipe.items) ? recipe.items : [],
    })),
    batches: (batchesResponse.data || []).map(mapRestaurantPreparationBatch),
  };
}

export async function registerRestaurantPreparationBatch(payload) {
  const { data, error } = await supabase.rpc('register_restaurant_preparation_batch', {
    p_recipe_id: payload.recipeId,
    p_produced_quantity: Number(payload.producedQuantity),
    p_production_date: payload.productionDate,
    p_notes: payload.notes?.trim() || null,
    p_batch_code: payload.batchCode?.trim() || null,
  });
  if (error) throw error;
  return data;
}

export async function registerRestaurantStockAdjustment(payload) {
  const { data, error } = await supabase.rpc('register_restaurant_stock_adjustment', {
    p_product_id: payload.productId,
    p_adjustment_kind: payload.kind,
    p_quantity: Number(payload.quantity),
    p_event_date: payload.eventDate,
    p_reason_code: payload.reasonCode,
    p_reason_label: payload.reasonLabel,
    p_notes: payload.notes?.trim() || null,
    p_batch_id: payload.batchId || null,
  });
  if (error) throw error;
  return data;
}

export function subscribeRestaurantInventory(userId, onChange) {
  if (!userId) return () => {};
  const channel = supabase
    .channel(`restaurant-inventory-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_inventory_consumptions', filter: `user_id=eq.${userId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_inventory_issues', filter: `user_id=eq.${userId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_stock_adjustments', filter: `user_id=eq.${userId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'production_batches', filter: `user_id=eq.${userId}` }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
