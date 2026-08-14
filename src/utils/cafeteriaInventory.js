import { supabase } from '../supabaseClient';
import { convertRecipeQuantityToStockUnit } from './recipeUnits';
import { getProductStockUnit } from './productionRecipes';
import { isCafeteriaPreparation, isCafeteriaSupply } from './cafeteriaRecipes';

export const CAFETERIA_WASTE_REASONS = [
  ['bebida_rehecha', 'Bebida rehecha / error de preparación'],
  ['leche_sobrante', 'Leche sobrante o vaporizada sin usar'],
  ['calibracion', 'Calibración de molino / espresso'],
  ['derrame', 'Derrame o pérdida accidental'],
  ['caducidad', 'Caducidad o deterioro'],
  ['preparacion', 'Pérdida en preparación interna'],
  ['dano', 'Producto o empaque dañado'],
  ['cortesia', 'Cortesía o consumo interno'],
  ['otro', 'Otro motivo'],
];

export const CAFETERIA_COUNT_REASONS = [
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

export function formatCafeInventoryMoney(value) {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatCafeInventoryQuantity(value, maximumFractionDigits = 3) {
  return new Intl.NumberFormat('es-EC', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(Number(value || 0));
}

export function formatCafeInventoryDate(value, includeTime = false) {
  if (!value) return 'Sin fecha';
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T12:00:00` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-EC', includeTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }
  ).format(date);
}

export function mapCafeteriaConsumption(row = {}) {
  return {
    id: row.id,
    orderId: row.order_id,
    orderItemId: row.order_item_id,
    saleId: row.sale_id,
    menuProductId: row.menu_product_id,
    menuProductName: row.menu_product_name || 'Producto',
    sourceKey: row.source_key || '',
    sourceLabel: row.source_label || 'Componente',
    ingredientProductId: row.ingredient_product_id,
    ingredientName: row.ingredient_name || 'Ingrediente',
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
    consumedAt: row.consumed_at,
  };
}

export function mapCafeteriaIssue(row = {}) {
  return {
    id: row.id,
    orderId: row.order_id,
    orderItemId: row.order_item_id,
    menuProductId: row.menu_product_id,
    menuProductName: row.menu_product_name || 'Producto',
    issueType: row.issue_type || 'processing_error',
    details: row.details || '',
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolvedNotes: row.resolved_notes || '',
  };
}

export function mapCafeteriaAdjustment(row = {}) {
  return {
    id: row.id,
    productId: row.product_id,
    batchId: row.production_batch_id,
    kind: row.adjustment_kind,
    reasonCode: row.reason_code,
    reasonLabel: row.reason_label || row.reason_code,
    productName: row.product_name || 'Producto',
    productType: row.product_type || '',
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

export function mapCafeteriaBatch(row = {}) {
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
    totalCost: Number(row.total_cost || 0),
    unitCost: Number(row.unit_cost || 0),
    outputProductName: row.output_product_name || 'Preparación',
    recipeName: row.recipe_name || 'Receta',
    notes: row.notes || '',
    createdAt: row.created_at,
    items: Array.isArray(row.production_batch_items)
      ? row.production_batch_items.map((item) => ({
          ...item,
          ingredientName: item.ingredient_name || 'Ingrediente',
          stockQuantity: Number(item.stock_quantity || 0),
          stockUnit: item.stock_unit || '',
          totalCost: Number(item.total_cost || 0),
          stockBefore: Number(item.stock_before || 0),
          stockAfter: Number(item.stock_after || 0),
        }))
      : [],
  };
}

export function getCafeteriaInventoryProducts(products = [], recipeOutputIds = new Set()) {
  return (products || []).filter((product) => {
    if (!product || product.status === 'Eliminado') return false;
    if (isCafeteriaSupply(product) || isCafeteriaPreparation(product)) return true;
    // Productos de venta directa (agua, botella, snack comprado) también necesitan conteo físico.
    return !recipeOutputIds.has(String(product.id));
  });
}

export function buildCafeteriaPreparationPreview(recipe, productsById, producedQuantity) {
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

  if (!outputProduct || !isCafeteriaPreparation(outputProduct)) {
    warnings.push('La receta seleccionada no produce una preparación interna.');
  }
  if (outputStockQuantity === null || Number(outputStockQuantity || 0) <= 0) {
    warnings.push(`La unidad de rendimiento (${recipe.yield_unit || 'sin unidad'}) no coincide con la unidad de stock (${outputStockUnit || 'sin unidad'}).`);
  }

  const lines = (recipe.items || []).map((item) => {
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
    warnings: [...new Set(warnings)],
  };
}

export function buildCafeteriaReplenishment(products = [], consumptions = [], daysWindow = 14) {
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - Math.max(daysWindow - 1, 1));
  since.setHours(0, 0, 0, 0);

  const demandByProduct = new Map();
  (consumptions || []).forEach((item) => {
    const date = item?.consumedAt ? new Date(item.consumedAt) : null;
    if (!date || Number.isNaN(date.getTime()) || date < since) return;
    const key = String(item.ingredientProductId || '');
    if (!key) return;
    const demand = Math.max(Number(item.stockQuantity || item.requiredQuantity || 0), 0);
    demandByProduct.set(key, (demandByProduct.get(key) || 0) + demand);
  });

  return (products || []).map((product) => {
    const key = String(product.id);
    const stock = Math.max(Number(product.stock || 0), 0);
    const minStock = Math.max(Number(product.minStock || 0), 0);
    const windowDemand = demandByProduct.get(key) || 0;
    const dailyDemand = windowDemand / Math.max(daysWindow, 1);
    const coverageDays = dailyDemand > 0 ? stock / dailyDemand : null;
    const targetByConsumption = dailyDemand * 7;
    const targetByMinimum = minStock > 0 ? minStock * 2 : 0;
    const targetStock = Math.max(targetByConsumption, targetByMinimum, minStock);
    const suggestedQuantity = Math.max(targetStock - stock, 0);
    const urgent = stock <= 0 || (minStock > 0 && stock <= minStock) || (coverageDays !== null && coverageDays < 2);
    const warning = !urgent && coverageDays !== null && coverageDays < 4;
    return {
      product,
      stock,
      minStock,
      windowDemand,
      dailyDemand,
      coverageDays,
      targetStock,
      suggestedQuantity,
      priority: urgent ? 'urgent' : warning ? 'warning' : suggestedQuantity > 0 ? 'plan' : 'ok',
    };
  }).sort((a, b) => {
    const rank = { urgent: 0, warning: 1, plan: 2, ok: 3 };
    return rank[a.priority] - rank[b.priority]
      || (a.coverageDays ?? 9999) - (b.coverageDays ?? 9999)
      || String(a.product?.name || '').localeCompare(String(b.product?.name || ''), 'es');
  });
}

export async function fetchCafeteriaInventoryData(userId) {
  const [consumptionsRes, issuesRes, adjustmentsRes, recipesRes, batchesRes] = await Promise.all([
    supabase
      .from('cafeteria_inventory_consumptions')
      .select('*')
      .eq('user_id', userId)
      .order('consumed_at', { ascending: false })
      .limit(800),
    supabase
      .from('cafeteria_inventory_issues')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('cafeteria_stock_adjustments')
      .select('*')
      .eq('user_id', userId)
      .order('event_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('production_recipes')
      .select('*, items:production_recipe_items(*)')
      .eq('user_id', userId)
      .eq('recipe_context', 'cafeteria')
      .order('updated_at', { ascending: false }),
    supabase
      .from('production_batches')
      .select('*, production_batch_items(*)')
      .eq('user_id', userId)
      .eq('production_context', 'cafeteria')
      .order('production_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(250),
  ]);

  const responses = [consumptionsRes, issuesRes, adjustmentsRes, recipesRes, batchesRes];
  const firstError = responses.find((response) => response.error)?.error;
  if (firstError) throw firstError;

  return {
    consumptions: (consumptionsRes.data || []).map(mapCafeteriaConsumption),
    issues: (issuesRes.data || []).map(mapCafeteriaIssue),
    adjustments: (adjustmentsRes.data || []).map(mapCafeteriaAdjustment),
    recipes: recipesRes.data || [],
    batches: (batchesRes.data || []).map(mapCafeteriaBatch),
  };
}

export async function registerCafeteriaPreparationBatch(form = {}) {
  const { data, error } = await supabase.rpc('register_cafeteria_preparation_batch', {
    p_recipe_id: form.recipeId || null,
    p_produced_quantity: Number(form.producedQuantity || 0),
    p_production_date: form.productionDate || getLocalDateValue(),
    p_notes: form.notes || '',
    p_batch_code: form.batchCode || null,
  });
  if (error) throw error;
  return data;
}

export async function registerCafeteriaStockAdjustment(form = {}) {
  const { data, error } = await supabase.rpc('register_cafeteria_stock_adjustment', {
    p_product_id: form.productId || null,
    p_adjustment_kind: form.kind || 'waste',
    p_quantity: Number(form.quantity || 0),
    p_event_date: form.eventDate || getLocalDateValue(),
    p_reason_code: form.reasonCode || '',
    p_reason_label: form.reasonLabel || '',
    p_notes: form.notes || '',
    p_batch_id: form.batchId || null,
  });
  if (error) throw error;
  return data;
}

export async function resolveCafeteriaInventoryIssue(issueId, notes = '') {
  const { error } = await supabase.rpc('resolve_cafeteria_inventory_issue', {
    p_issue_id: issueId,
    p_notes: notes || '',
  });
  if (error) throw error;
}

export function subscribeCafeteriaInventory(userId, onChange) {
  if (!userId) return () => {};

  let refreshTimer = null;
  const queueRefresh = () => {
    if (refreshTimer) window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => onChange?.(), 120);
  };

  const channel = supabase
    .channel(`cafeteria-inventory-${userId}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cafeteria_inventory_consumptions', filter: `user_id=eq.${userId}` }, queueRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cafeteria_inventory_issues', filter: `user_id=eq.${userId}` }, queueRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cafeteria_stock_adjustments', filter: `user_id=eq.${userId}` }, queueRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'production_batches', filter: `user_id=eq.${userId}` }, queueRefresh)
    .subscribe();

  return () => {
    if (refreshTimer) window.clearTimeout(refreshTimer);
    supabase.removeChannel(channel);
  };
}
