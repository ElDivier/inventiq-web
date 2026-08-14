import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpenText,
  Calculator,
  CheckCircle2,
  Coffee,
  Edit3,
  Layers3,
  Loader2,
  Milk,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { cleanOperationalCategoryLabel } from '../config/productTypes';
import {
  CAFETERIA_COMPONENT_OPTIONS,
  CAFETERIA_RECIPE_UNIT_OPTIONS,
  buildCafeteriaCommercialSummary,
  buildCafeteriaRecipeCostSummary,
  formatRecipeMoney,
  formatRecipeQuantity,
  getCafeteriaRecipeKind,
  getCafeteriaVariantCostRows,
  getCafeteriaVariantOptions,
  getSuggestedCafeteriaRecipeUnit,
  isCafeteriaPreparation,
  isCafeteriaRecipeInput,
  isCafeteriaRecipeOutput,
  normalizeCafeteriaVariantRule,
} from '../utils/cafeteriaRecipes';
import { isCafeteriaMenuProduct } from '../utils/cafeteriaMenu';

const EMPTY_FORM = {
  outputProductId: '',
  name: '',
  yieldQuantity: '1',
  yieldUnit: 'porción',
  isActive: true,
  laborCost: '0',
  overheadCost: '0',
  targetFoodCostPercent: '30',
  notes: '',
  items: [],
  variantRules: [],
};

function makeId(prefix = 'row') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyItem() {
  return {
    localId: makeId('cafe-item'),
    ingredientProductId: '',
    quantity: '',
    unit: '',
    wastePercent: '0',
    notes: '',
    componentKey: 'standard',
    scaleWithSize: false,
  };
}

function defaultRule(option) {
  return {
    localId: makeId('cafe-rule'),
    optionKey: option.optionKey,
    optionType: option.optionType,
    optionLabel: option.optionLabel,
    scaleFactor: '1',
    replaceComponentKey: option.optionType === 'milk' ? 'milk' : '',
    replacementProductId: '',
    additionProductId: '',
    additionQuantity: '',
    additionUnit: '',
    additionWastePercent: '0',
  };
}

function normalizeRecipe(recipe, rulesByRecipe) {
  return {
    ...recipe,
    items: Array.isArray(recipe?.items) ? recipe.items : [],
    variantRules: (rulesByRecipe.get(String(recipe.id)) || []).map(normalizeCafeteriaVariantRule),
  };
}

function toneForCost(percent, target) {
  if (!percent) return 'slate';
  if (percent <= target) return 'emerald';
  if (percent <= target + 5) return 'amber';
  return 'rose';
}

export default function CafeteriaRecipesPage({ currentUser, products, setProducts, setActive }) {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [tab, setTab] = useState('menu');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const cafeProducts = useMemo(
    () => (products || []).filter((product) => product?.status !== 'Eliminado'),
    [products]
  );
  const productsById = useMemo(
    () => new Map(cafeProducts.map((product) => [String(product.id), product])),
    [cafeProducts]
  );
  const outputProducts = useMemo(() => cafeProducts.filter(isCafeteriaRecipeOutput), [cafeProducts]);
  const menuProducts = useMemo(() => outputProducts.filter((product) => !isCafeteriaPreparation(product)), [outputProducts]);
  const preparationProducts = useMemo(() => outputProducts.filter(isCafeteriaPreparation), [outputProducts]);
  const inputProducts = useMemo(() => cafeProducts.filter(isCafeteriaRecipeInput), [cafeProducts]);

  const loadRecipes = useCallback(async (showLoader = true) => {
    if (!currentUser?.id) return;
    if (showLoader) setLoading(true);
    try {
      const [{ data: recipeData, error: recipeError }, { data: ruleData, error: ruleError }] = await Promise.all([
        supabase
          .from('production_recipes')
          .select('*, items:production_recipe_items(*)')
          .eq('user_id', currentUser.id)
          .eq('recipe_context', 'cafeteria')
          .order('updated_at', { ascending: false }),
        supabase
          .from('cafeteria_recipe_variant_rules')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: true }),
      ]);
      if (recipeError) throw recipeError;
      if (ruleError) throw ruleError;
      const rulesByRecipe = new Map();
      (ruleData || []).forEach((rule) => {
        const key = String(rule.recipe_id);
        rulesByRecipe.set(key, [...(rulesByRecipe.get(key) || []), rule]);
      });
      setRecipes((recipeData || []).map((recipe) => normalizeRecipe(recipe, rulesByRecipe)));
    } catch (error) {
      console.error('Error cargando recetas de cafetería:', error);
      setNotice({ type: 'error', message: `No se pudieron cargar las recetas: ${error.message}` });
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => { loadRecipes(); }, [loadRecipes]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;
    const refresh = () => loadRecipes(false);
    const channel = supabase
      .channel(`cafeteria-recipes-${currentUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_recipes', filter: `user_id=eq.${currentUser.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_recipe_items', filter: `user_id=eq.${currentUser.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cafeteria_recipe_variant_rules', filter: `user_id=eq.${currentUser.id}` }, refresh)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [currentUser?.id, loadRecipes]);

  const recipesByOutputId = useMemo(
    () => new Map(recipes.map((recipe) => [String(recipe.output_product_id), recipe])),
    [recipes]
  );
  const usedOutputIds = useMemo(() => new Set(recipesByOutputId.keys()), [recipesByOutputId]);

  const enrichedRecipes = useMemo(() => recipes.map((recipe) => {
    const outputProduct = productsById.get(String(recipe.output_product_id));
    const baseCost = buildCafeteriaRecipeCostSummary(recipe, productsById, recipe.variantRules, []);
    const commercial = buildCafeteriaCommercialSummary(recipe, outputProduct, baseCost);
    const variantRows = outputProduct && !isCafeteriaPreparation(outputProduct)
      ? getCafeteriaVariantCostRows(recipe, outputProduct, productsById, recipe.variantRules)
      : [];
    return {
      ...recipe,
      outputProduct,
      recipeKind: getCafeteriaRecipeKind(outputProduct),
      baseCost,
      commercial,
      variantRows,
    };
  }), [recipes, productsById]);

  const visibleRecipes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return enrichedRecipes.filter((recipe) => {
      if (recipe.recipeKind !== tab) return false;
      const hasAlerts = recipe.baseCost.warnings.length > 0
        || (recipe.recipeKind === 'menu' && recipe.commercial.foodCostPercent > recipe.commercial.targetPercent);
      const matchesFilter = filter === 'all'
        || (filter === 'active' && recipe.is_active)
        || (filter === 'inactive' && !recipe.is_active)
        || (filter === 'alerts' && hasAlerts);
      const matchesSearch = !term || [recipe.name, recipe.outputProduct?.name, recipe.outputProduct?.category]
        .some((value) => String(value || '').toLowerCase().includes(term));
      return matchesFilter && matchesSearch;
    });
  }, [enrichedRecipes, tab, filter, search]);

  const menuWithoutRecipe = menuProducts.filter((product) => !usedOutputIds.has(String(product.id))).length;
  const alertsCount = enrichedRecipes.filter((recipe) => recipe.baseCost.warnings.length > 0
    || (recipe.recipeKind === 'menu' && recipe.commercial.foodCostPercent > recipe.commercial.targetPercent)).length;

  function syncRulesForProduct(product, existingRules = []) {
    if (!product || isCafeteriaPreparation(product)) return [];
    const existingMap = new Map(existingRules.map((rule) => [rule.optionKey, rule]));
    return getCafeteriaVariantOptions(product).map((option) => ({
      ...defaultRule(option),
      ...(existingMap.get(option.optionKey) || {}),
      optionKey: option.optionKey,
      optionType: option.optionType,
      optionLabel: option.optionLabel,
    }));
  }

  function openNewRecipe(kind = tab, outputProductId = '') {
    const product = productsById.get(String(outputProductId));
    const effectiveKind = product ? getCafeteriaRecipeKind(product) : kind;
    setTab(effectiveKind);
    setEditingRecipe(null);
    setForm({
      ...EMPTY_FORM,
      outputProductId: outputProductId ? String(outputProductId) : '',
      name: product ? `Receta de ${product.name}` : '',
      yieldQuantity: '1',
      yieldUnit: product ? getSuggestedCafeteriaRecipeUnit(product) : (effectiveKind === 'menu' ? 'porción' : 'ml'),
      items: [createEmptyItem()],
      variantRules: syncRulesForProduct(product, []),
    });
    setNotice(null);
    setEditorOpen(true);
  }

  function openEditRecipe(recipe) {
    const product = productsById.get(String(recipe.output_product_id));
    setEditingRecipe(recipe);
    setTab(getCafeteriaRecipeKind(product));
    const existingRules = (recipe.variantRules || []).map((rule) => ({
      localId: rule.id || makeId('cafe-rule'),
      optionKey: rule.optionKey,
      optionType: rule.optionType,
      optionLabel: rule.optionLabel,
      scaleFactor: String(rule.scaleFactor || 1),
      replaceComponentKey: rule.replaceComponentKey || '',
      replacementProductId: rule.replacementProductId || '',
      additionProductId: rule.additionProductId || '',
      additionQuantity: rule.additionQuantity ? String(rule.additionQuantity) : '',
      additionUnit: rule.additionUnit || '',
      additionWastePercent: String(rule.additionWastePercent || 0),
    }));
    setForm({
      outputProductId: String(recipe.output_product_id || ''),
      name: recipe.name || '',
      yieldQuantity: String(recipe.yield_quantity || 1),
      yieldUnit: recipe.yield_unit || getSuggestedCafeteriaRecipeUnit(product),
      isActive: recipe.is_active !== false,
      laborCost: String(recipe.labor_cost || 0),
      overheadCost: String(recipe.overhead_cost || 0),
      targetFoodCostPercent: String(recipe.target_food_cost_percent || 30),
      notes: recipe.notes || '',
      items: (recipe.items || []).map((item) => ({
        localId: item.id || makeId('cafe-item'),
        ingredientProductId: String(item.ingredient_product_id || ''),
        quantity: String(item.quantity || ''),
        unit: item.unit || '',
        wastePercent: String(item.waste_percent || 0),
        notes: item.notes || '',
        componentKey: item.component_key || 'standard',
        scaleWithSize: Boolean(item.scale_with_size),
      })),
      variantRules: syncRulesForProduct(product, existingRules),
    });
    setNotice(null);
    setEditorOpen(true);
  }

  useEffect(() => {
    if (loading || outputProducts.length === 0) return;
    const preferredId = sessionStorage.getItem('inventiq_cafeteria_recipe_product_id');
    if (!preferredId) return;
    sessionStorage.removeItem('inventiq_cafeteria_recipe_product_id');
    const product = productsById.get(String(preferredId));
    if (!product || !isCafeteriaRecipeOutput(product)) return;
    const existing = recipesByOutputId.get(String(product.id));
    if (existing) openEditRecipe(existing);
    else openNewRecipe(getCafeteriaRecipeKind(product), product.id);
  }, [loading, outputProducts.length]);

  function closeEditor() {
    setEditorOpen(false);
    setEditingRecipe(null);
    setForm(EMPTY_FORM);
  }

  function selectOutputProduct(productId) {
    const product = productsById.get(String(productId));
    setForm((previous) => ({
      ...previous,
      outputProductId: String(productId),
      name: previous.name || (product ? `Receta de ${product.name}` : ''),
      yieldQuantity: '1',
      yieldUnit: getSuggestedCafeteriaRecipeUnit(product),
      variantRules: syncRulesForProduct(product, previous.variantRules),
    }));
  }

  function updateItem(localId, field, value) {
    setForm((previous) => ({
      ...previous,
      items: previous.items.map((item) => {
        if (item.localId !== localId) return item;
        if (field === 'ingredientProductId') {
          const product = productsById.get(String(value));
          return { ...item, ingredientProductId: String(value), unit: getSuggestedCafeteriaRecipeUnit(product) };
        }
        return { ...item, [field]: value };
      }),
    }));
  }

  function updateRule(optionKey, field, value) {
    setForm((previous) => ({
      ...previous,
      variantRules: previous.variantRules.map((rule) => {
        if (rule.optionKey !== optionKey) return rule;
        if (field === 'additionProductId') {
          const product = productsById.get(String(value));
          return { ...rule, additionProductId: String(value), additionUnit: getSuggestedCafeteriaRecipeUnit(product) };
        }
        return { ...rule, [field]: value };
      }),
    }));
  }

  const editorPreview = useMemo(() => ({
    id: editingRecipe?.id || `draft-${form.outputProductId}`,
    output_product_id: form.outputProductId,
    name: form.name,
    yield_quantity: Number(form.yieldQuantity || 0),
    yield_unit: form.yieldUnit,
    labor_cost: Number(form.laborCost || 0),
    overhead_cost: Number(form.overheadCost || 0),
    target_food_cost_percent: Number(form.targetFoodCostPercent || 30),
    items: form.items.map((item) => ({
      ingredient_product_id: item.ingredientProductId,
      quantity: Number(item.quantity || 0),
      unit: item.unit,
      waste_percent: Number(item.wastePercent || 0),
      component_key: item.componentKey,
      scale_with_size: Boolean(item.scaleWithSize),
    })),
  }), [editingRecipe?.id, form]);

  const normalizedEditorRules = useMemo(() => form.variantRules.map((rule) => normalizeCafeteriaVariantRule({
    ...rule,
    scale_factor: Number(rule.scaleFactor || 1),
    replace_component_key: rule.replaceComponentKey,
    replacement_product_id: rule.replacementProductId,
    addition_product_id: rule.additionProductId,
    addition_quantity: Number(rule.additionQuantity || 0),
    addition_unit: rule.additionUnit,
    addition_waste_percent: Number(rule.additionWastePercent || 0),
    option_key: rule.optionKey,
    option_type: rule.optionType,
    option_label: rule.optionLabel,
  })), [form.variantRules]);

  const selectedOutputProduct = productsById.get(String(form.outputProductId));
  const editorCost = useMemo(
    () => buildCafeteriaRecipeCostSummary(editorPreview, productsById, normalizedEditorRules, []),
    [editorPreview, productsById, normalizedEditorRules]
  );
  const editorCommercial = useMemo(
    () => buildCafeteriaCommercialSummary(editorPreview, selectedOutputProduct, editorCost),
    [editorPreview, selectedOutputProduct, editorCost]
  );
  const editorVariantCosts = useMemo(
    () => selectedOutputProduct ? getCafeteriaVariantCostRows(editorPreview, selectedOutputProduct, productsById, normalizedEditorRules) : [],
    [editorPreview, selectedOutputProduct, productsById, normalizedEditorRules]
  );

  function validateForm() {
    if (!form.outputProductId) return 'Selecciona el producto o preparación.';
    if (!form.name.trim()) return 'Ingresa un nombre para la receta.';
    if (Number(form.yieldQuantity || 0) <= 0) return 'El rendimiento debe ser mayor a cero.';
    if (!form.yieldUnit.trim()) return 'Selecciona la unidad del rendimiento.';
    if (form.items.length === 0) return 'Agrega al menos un componente a la receta.';
    const ids = form.items.map((item) => item.ingredientProductId).filter(Boolean);
    if (ids.length !== form.items.length) return 'Selecciona el artículo de cada componente.';
    if (ids.includes(String(form.outputProductId))) return 'Una receta no puede utilizarse a sí misma como componente.';
    for (const item of form.items) {
      if (Number(item.quantity || 0) <= 0) return 'Todas las cantidades deben ser mayores a cero.';
      if (!item.unit.trim()) return 'Selecciona una unidad para cada componente.';
    }
    const unitWarning = editorCost.warnings.find((message) => message.includes('no coincide'));
    if (unitWarning) return `Corrige las unidades antes de guardar: ${unitWarning}`;
    for (const rule of form.variantRules) {
      if (rule.replacementProductId && !rule.replaceComponentKey) return `${rule.optionLabel}: selecciona qué componente reemplaza.`;
      if (rule.additionProductId && Number(rule.additionQuantity || 0) <= 0) return `${rule.optionLabel}: ingresa la cantidad del insumo adicional.`;
      if (rule.additionProductId && !rule.additionUnit.trim()) return `${rule.optionLabel}: selecciona la unidad del insumo adicional.`;
    }
    return null;
  }

  async function saveRecipe(event) {
    event.preventDefault();
    const errorMessage = validateForm();
    if (errorMessage) {
      setNotice({ type: 'error', message: errorMessage });
      return;
    }
    try {
      setSaving(true);
      setNotice(null);
      const { data: recipeId, error } = await supabase.rpc('save_cafeteria_recipe', {
        p_recipe_id: editingRecipe?.id || null,
        p_output_product_id: form.outputProductId,
        p_name: form.name.trim(),
        p_yield_quantity: Number(form.yieldQuantity),
        p_yield_unit: form.yieldUnit,
        p_notes: form.notes.trim(),
        p_is_active: Boolean(form.isActive),
        p_labor_cost: Number(form.laborCost || 0),
        p_overhead_cost: Number(form.overheadCost || 0),
        p_target_food_cost_percent: Number(form.targetFoodCostPercent || 30),
        p_items: form.items.map((item) => ({
          ingredient_product_id: item.ingredientProductId,
          quantity: Number(item.quantity),
          unit: item.unit,
          waste_percent: Number(item.wastePercent || 0),
          notes: item.notes || '',
          component_key: item.componentKey || 'standard',
          scale_with_size: Boolean(item.scaleWithSize),
        })),
        p_variant_rules: form.variantRules.map((rule) => ({
          option_key: rule.optionKey,
          option_type: rule.optionType,
          option_label: rule.optionLabel,
          scale_factor: Number(rule.scaleFactor || 1),
          replace_component_key: rule.replaceComponentKey || '',
          replacement_product_id: rule.replacementProductId || '',
          addition_product_id: rule.additionProductId || '',
          addition_quantity: Number(rule.additionQuantity || 0),
          addition_unit: rule.additionUnit || '',
          addition_waste_percent: Number(rule.additionWastePercent || 0),
        })),
      });
      if (error) throw error;

      if (selectedOutputProduct && !isCafeteriaPreparation(selectedOutputProduct) && editorCost.unitCost >= 0) {
        const { error: costError } = await supabase
          .from('products')
          .update({ cost: Number(editorCost.unitCost.toFixed(6)) })
          .eq('id', selectedOutputProduct.id)
          .eq('user_id', currentUser.id);
        if (!costError && typeof setProducts === 'function') {
          setProducts((previous) => previous.map((product) => String(product.id) === String(selectedOutputProduct.id)
            ? { ...product, cost: Number(editorCost.unitCost.toFixed(6)) }
            : product));
        }
      }

      await loadRecipes(false);
      setNotice({ type: 'success', message: `Receta guardada correctamente${recipeId ? '' : '.'}` });
      closeEditor();
    } catch (error) {
      console.error('Error guardando receta de cafetería:', error);
      setNotice({ type: 'error', message: `No se pudo guardar la receta: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecipe(recipeId) {
    try {
      setSaving(true);
      const { error } = await supabase.rpc('delete_cafeteria_recipe', { p_recipe_id: recipeId });
      if (error) throw error;
      setPendingDeleteId(null);
      await loadRecipes(false);
      setNotice({ type: 'success', message: 'Receta eliminada.' });
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo eliminar la receta: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  const availableOutputs = (tab === 'preparation' ? preparationProducts : menuProducts)
    .filter((product) => String(product.id) === String(form.outputProductId) || !usedOutputIds.has(String(product.id)));

  return (
    <div className="space-y-6">
      {notice && (
        <div className={`rounded-2xl p-4 text-sm font-bold ${notice.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {notice.message}
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={BookOpenText} label="Recetas activas" value={enrichedRecipes.filter((recipe) => recipe.is_active).length} detail="menú y preparaciones" />
        <Metric icon={Coffee} label="Menú sin receta" value={menuWithoutRecipe} detail="pendientes de costear" />
        <Metric icon={Layers3} label="Preparaciones" value={preparationProducts.length} detail="bases internas" />
        <Metric icon={AlertTriangle} label="Alertas de costo" value={alertsCount} detail="requieren revisión" />
      </section>

      <section className="rounded-3xl border border-amber-100 bg-amber-50/60 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">Recetas de cafetería</p>
            <h3 className="mt-1 text-2xl font-black text-slate-900">Costo base + variantes reales</h3>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Define la receta estándar y luego cómo cambia con tamaño, leche, jarabes, temperatura y shot extra. El inventario se descuenta cuando Barra inicia la preparación.
            </p>
          </div>
          <button type="button" onClick={() => openNewRecipe(tab)} className="iq-primary-button">
            <Plus className="h-4 w-4" /> Nueva receta
          </button>
        </div>
      </section>

      <section className="iq-operation-card p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex gap-2">
            <TabButton active={tab === 'menu'} onClick={() => setTab('menu')} icon={Coffee} label="Productos del menú" />
            <TabButton active={tab === 'preparation'} onClick={() => setTab('preparation')} icon={Layers3} label="Preparaciones internas" />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_190px] xl:w-[540px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="iq-input pl-10" placeholder="Buscar receta o producto..." />
            </div>
            <select value={filter} onChange={(event) => setFilter(event.target.value)} className="iq-input">
              <option value="all">Todas</option>
              <option value="active">Activas</option>
              <option value="inactive">Inactivas</option>
              <option value="alerts">Con alertas</option>
            </select>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-slate-500"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />Cargando recetas...</div>
      ) : visibleRecipes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <BookOpenText className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-black text-slate-700">No hay recetas en esta sección.</p>
          <p className="mt-1 text-sm text-slate-500">Crea la primera para empezar a controlar costos y consumo real.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {visibleRecipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              pendingDeleteId={pendingDeleteId}
              setPendingDeleteId={setPendingDeleteId}
              onEdit={() => openEditRecipe(recipe)}
              onDelete={() => deleteRecipe(recipe.id)}
            />
          ))}
        </div>
      )}

      {editorOpen && (
        <RecipeEditor
          form={form}
          setForm={setForm}
          editingRecipe={editingRecipe}
          tab={tab}
          productsById={productsById}
          outputProducts={availableOutputs}
          inputProducts={inputProducts}
          selectedOutputProduct={selectedOutputProduct}
          editorCost={editorCost}
          editorCommercial={editorCommercial}
          editorVariantCosts={editorVariantCosts}
          saving={saving}
          onClose={closeEditor}
          onSave={saveRecipe}
          onSelectOutput={selectOutputProduct}
          updateItem={updateItem}
          updateRule={updateRule}
        />
      )}

      {tab === 'menu' && menuWithoutRecipe > 0 && (
        <button type="button" onClick={() => setActive?.('Productos')} className="w-full rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800 hover:bg-amber-100">
          Hay {menuWithoutRecipe} producto(s) del menú sin receta. Abrir Menú e insumos.
        </button>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</span><Icon className="h-5 w-5 text-amber-600" /></div>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black ${active ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}><Icon className="h-4 w-4" />{label}</button>;
}

function RecipeCard({ recipe, pendingDeleteId, setPendingDeleteId, onEdit, onDelete }) {
  const isPending = pendingDeleteId === recipe.id;
  const tone = toneForCost(recipe.commercial.foodCostPercent, recipe.commercial.targetPercent);
  const toneClasses = {
    slate: 'bg-slate-50 text-slate-600', emerald: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', rose: 'bg-rose-50 text-rose-700',
  };
  const highestVariant = recipe.variantRows.reduce((best, row) => row.cost > best.cost ? row : best, { cost: recipe.baseCost.unitCost, optionLabel: 'Base' });
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase text-amber-700">{recipe.recipeKind === 'preparation' ? 'Preparación' : 'Menú'}</span>
            {!recipe.is_active && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-500">Inactiva</span>}
          </div>
          <h4 className="mt-2 truncate text-lg font-black text-slate-900">{recipe.outputProduct?.name || recipe.name}</h4>
          <p className="text-xs font-bold text-slate-400">{cleanOperationalCategoryLabel(recipe.outputProduct?.category || '')}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onEdit} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><Edit3 className="h-4 w-4" /></button>
          <button type="button" onClick={() => setPendingDeleteId(isPending ? null : recipe.id)} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini label="Costo base" value={formatRecipeMoney(recipe.baseCost.unitCost)} />
        <Mini label="Precio" value={formatRecipeMoney(recipe.commercial.salePrice)} />
        <Mini label="Food cost" value={`${recipe.commercial.foodCostPercent.toFixed(1)}%`} className={toneClasses[tone]} />
        <Mini label="Margen" value={formatRecipeMoney(recipe.commercial.marginValue)} />
      </div>

      {recipe.recipeKind === 'menu' && recipe.variantRows.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/60 p-3 text-xs text-amber-900">
          <strong>Variantes configuradas:</strong> {recipe.variantRows.length} · costo más alto individual: {highestVariant.optionLabel} {formatRecipeMoney(highestVariant.cost)}
        </div>
      )}
      {recipe.baseCost.warnings.length > 0 && (
        <div className="mt-4 rounded-2xl bg-rose-50 p-3 text-xs font-bold text-rose-700"><AlertTriangle className="mr-1 inline h-4 w-4" />{recipe.baseCost.warnings[0]}</div>
      )}
      {isPending && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-red-50 p-3 text-xs font-bold text-red-700">
          <span>¿Eliminar esta receta?</span><button type="button" onClick={onDelete} className="rounded-xl bg-red-600 px-3 py-2 text-white">Confirmar</button>
        </div>
      )}
    </article>
  );
}

function Mini({ label, value, className = 'bg-slate-50 text-slate-700' }) {
  return <div className={`rounded-2xl p-3 ${className}`}><p className="text-[10px] font-black uppercase tracking-wide opacity-70">{label}</p><p className="mt-1 text-sm font-black">{value}</p></div>;
}

function RecipeEditor({
  form, setForm, editingRecipe, tab, productsById, outputProducts, inputProducts, selectedOutputProduct,
  editorCost, editorCommercial, editorVariantCosts, saving, onClose, onSave, onSelectOutput, updateItem, updateRule,
}) {
  return (
    <div className="iq-modal-overlay">
      <form onSubmit={onSave} className="iq-modal-card max-h-[94vh] w-full max-w-6xl overflow-hidden">
        <div className="flex items-start justify-between border-b border-slate-100 p-5">
          <div><p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">{editingRecipe ? 'Editar receta' : 'Nueva receta'} · Cafetería</p><h3 className="mt-1 text-2xl font-black text-slate-900">{selectedOutputProduct?.name || 'Configurar receta y variantes'}</h3></div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-500"><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[calc(94vh-88px)] overflow-y-auto p-5">
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <h4 className="font-black text-slate-900">1. Producto y rendimiento</h4>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="block"><span className="mb-1 block text-xs font-black uppercase text-slate-500">Producto / preparación</span><select value={form.outputProductId} onChange={(e) => onSelectOutput(e.target.value)} disabled={Boolean(editingRecipe)} className="iq-input"><option value="">Seleccionar...</option>{outputProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
                  <TextInput label="Nombre de receta" value={form.name} onChange={(value) => setForm((p) => ({ ...p, name: value }))} />
                  <TextInput label="Rendimiento" type="number" step="0.001" value={form.yieldQuantity} onChange={(value) => setForm((p) => ({ ...p, yieldQuantity: value }))} />
                  <SelectInput label="Unidad de rendimiento" value={form.yieldUnit} onChange={(value) => setForm((p) => ({ ...p, yieldUnit: value }))} options={CAFETERIA_RECIPE_UNIT_OPTIONS} />
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between"><div><h4 className="font-black text-slate-900">2. Receta base</h4><p className="text-xs text-slate-500">Los componentes marcados “Escala con tamaño” usan el multiplicador del tamaño elegido.</p></div><button type="button" onClick={() => setForm((p) => ({ ...p, items: [...p.items, createEmptyItem()] }))} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white"><Plus className="mr-1 inline h-3 w-3" />Componente</button></div>
                <div className="mt-4 space-y-3">
                  {form.items.map((item) => (
                    <div key={item.localId} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1.35fr_0.55fr_0.6fr_0.8fr_auto]">
                        <select value={item.ingredientProductId} onChange={(e) => updateItem(item.localId, 'ingredientProductId', e.target.value)} className="iq-input"><option value="">Insumo / preparación...</option>{inputProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select>
                        <input type="number" min="0" step="0.001" value={item.quantity} onChange={(e) => updateItem(item.localId, 'quantity', e.target.value)} className="iq-input" placeholder="Cantidad" />
                        <select value={item.unit} onChange={(e) => updateItem(item.localId, 'unit', e.target.value)} className="iq-input">{CAFETERIA_RECIPE_UNIT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                        <select value={item.componentKey} onChange={(e) => updateItem(item.localId, 'componentKey', e.target.value)} className="iq-input">{CAFETERIA_COMPONENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                        <button type="button" onClick={() => setForm((p) => ({ ...p, items: p.items.filter((row) => row.localId !== item.localId) }))} className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={item.scaleWithSize} onChange={(e) => updateItem(item.localId, 'scaleWithSize', e.target.checked)} /> Escala con tamaño</label>
                        <label className="flex items-center gap-2 text-xs text-slate-500">Merma prevista <input type="number" min="0" max="100" step="0.1" value={item.wastePercent} onChange={(e) => updateItem(item.localId, 'wastePercent', e.target.value)} className="w-20 rounded-lg border border-slate-200 px-2 py-1" />%</label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {tab === 'menu' && selectedOutputProduct && (
                <div className="rounded-3xl border border-amber-100 bg-amber-50/50 p-4">
                  <div><h4 className="font-black text-amber-950">3. Reglas por variante</h4><p className="text-xs text-amber-800">Estas opciones vienen de la configuración del producto en Menú e insumos.</p></div>
                  {form.variantRules.length === 0 ? <p className="mt-3 rounded-2xl bg-white p-4 text-sm text-slate-500">Este producto no tiene tamaños, leches, jarabes, temperaturas o shot extra configurados.</p> : (
                    <div className="mt-4 space-y-3">{form.variantRules.map((rule) => <VariantRuleEditor key={rule.optionKey} rule={rule} inputProducts={inputProducts} productsById={productsById} updateRule={updateRule} />)}</div>
                  )}
                </div>
              )}

              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <h4 className="font-black text-slate-900">4. Costos operativos</h4>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <TextInput label="Mano de obra" type="number" step="0.01" value={form.laborCost} onChange={(value) => setForm((p) => ({ ...p, laborCost: value }))} />
                  <TextInput label="Energía / indirectos" type="number" step="0.01" value={form.overheadCost} onChange={(value) => setForm((p) => ({ ...p, overheadCost: value }))} />
                  <TextInput label="Food cost objetivo (%)" type="number" step="0.1" value={form.targetFoodCostPercent} onChange={(value) => setForm((p) => ({ ...p, targetFoodCostPercent: value }))} />
                </div>
                <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="iq-input mt-3 min-h-20" placeholder="Notas internas de preparación, rendimiento o costeo..." />
              </div>
            </div>

            <aside className="space-y-4">
              <div className="sticky top-0 rounded-3xl bg-slate-950 p-5 text-white">
                <div className="flex items-center gap-2"><Calculator className="h-5 w-5 text-amber-300" /><h4 className="font-black">Vista de costo</h4></div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <DarkMetric label="Ingredientes" value={formatRecipeMoney(editorCost.ingredientCost)} />
                  <DarkMetric label="Costo por unidad" value={formatRecipeMoney(editorCost.unitCost)} />
                  <DarkMetric label="Precio actual" value={formatRecipeMoney(editorCommercial.salePrice)} />
                  <DarkMetric label="Food cost" value={`${editorCommercial.foodCostPercent.toFixed(1)}%`} />
                  <DarkMetric label="Margen" value={formatRecipeMoney(editorCommercial.marginValue)} />
                  <DarkMetric label="Precio sugerido" value={formatRecipeMoney(editorCommercial.suggestedPrice)} />
                </div>
                {editorCost.warnings.length > 0 ? <div className="mt-4 rounded-2xl bg-rose-500/15 p-3 text-xs font-bold text-rose-100"><AlertTriangle className="mr-1 inline h-4 w-4" />{editorCost.warnings[0]}</div> : <div className="mt-4 rounded-2xl bg-emerald-500/15 p-3 text-xs font-bold text-emerald-100"><CheckCircle2 className="mr-1 inline h-4 w-4" />Costo base consistente.</div>}

                {editorVariantCosts.length > 0 && (
                  <div className="mt-4 border-t border-white/10 pt-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Costo por opción</p><div className="mt-2 max-h-52 space-y-2 overflow-y-auto pr-1">{editorVariantCosts.map((row) => <div key={row.optionKey} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2 text-xs"><span className="truncate">{row.optionLabel}</span><strong>{formatRecipeMoney(row.cost)}</strong></div>)}</div></div>
                )}
              </div>
            </aside>
          </section>

          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="iq-secondary-button">Cancelar</button>
            <button type="submit" disabled={saving} className="iq-primary-button disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpenText className="h-4 w-4" />}{editingRecipe ? 'Guardar cambios' : 'Crear receta'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

function VariantRuleEditor({ rule, inputProducts, productsById, updateRule }) {
  const isSize = rule.optionType === 'size';
  const isMilk = rule.optionType === 'milk';
  const additionProduct = productsById.get(String(rule.additionProductId));
  return (
    <div className="rounded-2xl border border-amber-100 bg-white p-3">
      <div className="flex items-center gap-2"><span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase text-amber-800">{rule.optionType === 'extra_shot' ? 'Shot extra' : rule.optionType}</span><strong className="text-sm text-slate-800">{rule.optionLabel}</strong></div>
      <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
        {isSize && <TextInput label="Factor de tamaño" type="number" step="0.01" value={rule.scaleFactor} onChange={(value) => updateRule(rule.optionKey, 'scaleFactor', value)} />}
        <SelectInput label="Componente a reemplazar" value={rule.replaceComponentKey} onChange={(value) => updateRule(rule.optionKey, 'replaceComponentKey', value)} options={[{ value: '', label: 'No reemplazar' }, ...CAFETERIA_COMPONENT_OPTIONS]} />
        <label className="block"><span className="mb-1 block text-xs font-black uppercase text-slate-500">Producto de reemplazo</span><select value={rule.replacementProductId} onChange={(e) => updateRule(rule.optionKey, 'replacementProductId', e.target.value)} className="iq-input"><option value="">Sin reemplazo</option>{inputProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
        <label className="block"><span className="mb-1 block text-xs font-black uppercase text-slate-500">Insumo adicional</span><select value={rule.additionProductId} onChange={(e) => updateRule(rule.optionKey, 'additionProductId', e.target.value)} className="iq-input"><option value="">Sin adicional</option>{inputProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
        {rule.additionProductId && <><TextInput label={`Cantidad adicional${additionProduct ? ` · ${additionProduct.name}` : ''}`} type="number" step="0.001" value={rule.additionQuantity} onChange={(value) => updateRule(rule.optionKey, 'additionQuantity', value)} /><SelectInput label="Unidad del adicional" value={rule.additionUnit} onChange={(value) => updateRule(rule.optionKey, 'additionUnit', value)} options={CAFETERIA_RECIPE_UNIT_OPTIONS} /></>}
      </div>
      {isMilk && !rule.replacementProductId && <p className="mt-2 text-xs font-bold text-amber-700"><Milk className="mr-1 inline h-3.5 w-3.5" />Para esta leche, selecciona el insumo que reemplaza al componente “Leche” de la receta base.</p>}
    </div>
  );
}

function TextInput({ label, value, onChange, type = 'text', step }) {
  return <label className="block"><span className="mb-1 block text-xs font-black uppercase text-slate-500">{label}</span><input type={type} min={type === 'number' ? '0' : undefined} step={step} value={value} onChange={(e) => onChange(e.target.value)} className="iq-input" /></label>;
}

function SelectInput({ label, value, onChange, options }) {
  return <label className="block"><span className="mb-1 block text-xs font-black uppercase text-slate-500">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="iq-input">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function DarkMetric({ label, value }) {
  return <div className="rounded-2xl bg-white/5 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-black text-white">{value}</p></div>;
}
