import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpenText,
  Calculator,
  CheckCircle2,
  ChefHat,
  CircleDollarSign,
  Edit3,
  Eye,
  EyeOff,
  Layers3,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { cleanOperationalCategoryLabel } from '../config/productTypes';
import {
  RESTAURANT_RECIPE_UNIT_OPTIONS,
  buildRestaurantRecipeCollection,
  buildRestaurantRecipeCostSummary,
  formatRecipeMoney,
  formatRecipeQuantity,
  getRestaurantRecipeKind,
  getSuggestedRestaurantRecipeUnit,
  isRestaurantRecipeInput,
  isRestaurantRecipeOutput,
} from '../utils/restaurantRecipes';
import {
  getRestaurantProductRole,
  isRestaurantMenuProduct,
  isRestaurantPreparation,
} from '../utils/restaurantMenu';

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
};

function createEmptyItem() {
  return {
    localId: `restaurant-recipe-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ingredientProductId: '',
    quantity: '',
    unit: '',
    wastePercent: '0',
    notes: '',
  };
}

function normalizeRecipe(recipe) {
  return {
    ...recipe,
    items: Array.isArray(recipe?.items) ? recipe.items : [],
  };
}

function costTone(foodCostPercent, targetPercent) {
  if (!foodCostPercent) return 'slate';
  if (foodCostPercent <= targetPercent) return 'emerald';
  if (foodCostPercent <= targetPercent + 5) return 'amber';
  return 'rose';
}

export default function RestaurantRecipesPage({ currentUser, products, setActive }) {
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

  const restaurantProducts = useMemo(
    () => (products || []).filter(product => product?.status !== 'Eliminado'),
    [products]
  );

  const productsById = useMemo(
    () => new Map(restaurantProducts.map(product => [String(product.id), product])),
    [restaurantProducts]
  );

  const outputProducts = useMemo(
    () => restaurantProducts.filter(isRestaurantRecipeOutput),
    [restaurantProducts]
  );

  const menuProducts = useMemo(
    () => outputProducts.filter(isRestaurantMenuProduct),
    [outputProducts]
  );

  const preparationProducts = useMemo(
    () => outputProducts.filter(isRestaurantPreparation),
    [outputProducts]
  );

  const inputProducts = useMemo(
    () => restaurantProducts.filter(isRestaurantRecipeInput),
    [restaurantProducts]
  );

  const loadRecipes = useCallback(async (showLoader = true) => {
    if (!currentUser?.id) return;
    if (showLoader) setLoading(true);

    try {
      const { data, error } = await supabase
        .from('production_recipes')
        .select('*, items:production_recipe_items(*)')
        .eq('user_id', currentUser.id)
        .eq('recipe_context', 'restaurant')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setRecipes((data || []).map(normalizeRecipe));
    } catch (error) {
      console.error('Error cargando recetas gastronómicas:', error);
      setNotice({
        type: 'error',
        message: `No se pudieron cargar las recetas: ${error.message}`,
      });
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;

    const channel = supabase
      .channel(`restaurant-recipes-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_recipes',
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => loadRecipes(false)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_recipe_items',
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => loadRecipes(false)
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUser?.id, loadRecipes]);

  const enrichedRecipes = useMemo(
    () => buildRestaurantRecipeCollection(recipes, productsById),
    [recipes, productsById]
  );

  const recipesByOutputId = useMemo(
    () => new Map(recipes.map(recipe => [String(recipe.output_product_id), recipe])),
    [recipes]
  );

  const usedOutputIds = useMemo(
    () => new Set(recipes.map(recipe => String(recipe.output_product_id))),
    [recipes]
  );

  const visibleRecipes = useMemo(() => {
    const term = search.trim().toLowerCase();

    return enrichedRecipes.filter(recipe => {
      if (recipe.recipeKind !== tab) return false;
      const hasWarnings = recipe.costSummary.warnings.length > 0;
      const commercial = recipe.commercialSummary;
      const overTarget = recipe.recipeKind === 'menu'
        && commercial.foodCostPercent > commercial.targetFoodCostPercent;
      const matchesFilter = filter === 'all'
        || (filter === 'active' && recipe.is_active)
        || (filter === 'inactive' && !recipe.is_active)
        || (filter === 'alerts' && (hasWarnings || overTarget));
      const matchesSearch = !term || [
        recipe.name,
        recipe.outputProduct?.name,
        recipe.outputProduct?.category,
        ...(recipe.costSummary.lines || []).map(line => line.ingredient?.name),
      ].some(value => String(value || '').toLowerCase().includes(term));

      return matchesFilter && matchesSearch;
    });
  }, [enrichedRecipes, filter, search, tab]);

  const menuRecipes = enrichedRecipes.filter(recipe => recipe.recipeKind === 'menu');
  const preparationRecipes = enrichedRecipes.filter(recipe => recipe.recipeKind === 'preparation');
  const alertsCount = enrichedRecipes.filter(recipe => {
    const commercial = recipe.commercialSummary;
    return recipe.costSummary.warnings.length > 0
      || (recipe.recipeKind === 'menu' && commercial.foodCostPercent > commercial.targetFoodCostPercent);
  }).length;
  const menuWithoutRecipe = menuProducts.filter(product => !usedOutputIds.has(String(product.id))).length;

  function resetEditor() {
    setEditingRecipe(null);
    setForm(EMPTY_FORM);
    setEditorOpen(false);
  }

  function openNewRecipe(kind = tab, outputProductId = '') {
    const product = productsById.get(String(outputProductId));
    const effectiveKind = product ? getRestaurantRecipeKind(product) : kind;
    setTab(effectiveKind);
    setEditingRecipe(null);
    setForm({
      ...EMPTY_FORM,
      outputProductId: outputProductId ? String(outputProductId) : '',
      name: product ? `Receta de ${product.name}` : '',
      yieldQuantity: product && isRestaurantMenuProduct(product) ? '1' : '1',
      yieldUnit: product ? getSuggestedRestaurantRecipeUnit(product) : (effectiveKind === 'menu' ? 'porción' : 'kg'),
      items: [createEmptyItem()],
    });
    setNotice(null);
    setEditorOpen(true);
  }

  useEffect(() => {
    const preferredProductId = sessionStorage.getItem('inventiq_restaurant_recipe_product_id');
    if (!preferredProductId || outputProducts.length === 0 || loading) return;
    sessionStorage.removeItem('inventiq_restaurant_recipe_product_id');
    const product = productsById.get(String(preferredProductId));
    if (product && isRestaurantRecipeOutput(product)) {
      const existing = recipesByOutputId.get(String(product.id));
      if (existing) {
        openEditRecipe(existing);
      } else {
        openNewRecipe(getRestaurantRecipeKind(product), product.id);
      }
    }
  }, [loading, outputProducts.length]);

  function openEditRecipe(recipe) {
    const outputProduct = productsById.get(String(recipe.output_product_id));
    setEditingRecipe(recipe);
    setTab(getRestaurantRecipeKind(outputProduct));
    setForm({
      outputProductId: String(recipe.output_product_id || ''),
      name: recipe.name || '',
      yieldQuantity: String(recipe.yield_quantity || 1),
      yieldUnit: recipe.yield_unit || getSuggestedRestaurantRecipeUnit(outputProduct),
      isActive: Boolean(recipe.is_active),
      laborCost: String(recipe.labor_cost || 0),
      overheadCost: String(recipe.overhead_cost || 0),
      targetFoodCostPercent: String(recipe.target_food_cost_percent || 30),
      notes: recipe.notes || '',
      items: (recipe.items || []).map(item => ({
        localId: String(item.id),
        ingredientProductId: String(item.ingredient_product_id || ''),
        quantity: String(item.quantity || ''),
        unit: item.unit || '',
        wastePercent: String(item.waste_percent || 0),
        notes: item.notes || '',
      })),
    });
    setNotice(null);
    setEditorOpen(true);
  }

  function updateForm(field, value) {
    setForm(previous => ({ ...previous, [field]: value }));
  }

  function selectOutputProduct(productId) {
    const product = productsById.get(String(productId));
    setForm(previous => ({
      ...previous,
      outputProductId: String(productId),
      name: previous.name || (product ? `Receta de ${product.name}` : ''),
      yieldUnit: getSuggestedRestaurantRecipeUnit(product),
      yieldQuantity: isRestaurantMenuProduct(product) ? '1' : previous.yieldQuantity,
    }));
  }

  function addIngredientRow() {
    setForm(previous => ({ ...previous, items: [...previous.items, createEmptyItem()] }));
  }

  function updateIngredientRow(localId, field, value) {
    setForm(previous => ({
      ...previous,
      items: previous.items.map(item => {
        if (item.localId !== localId) return item;
        if (field === 'ingredientProductId') {
          const product = productsById.get(String(value));
          return {
            ...item,
            ingredientProductId: String(value),
            unit: getSuggestedRestaurantRecipeUnit(product),
          };
        }
        return { ...item, [field]: value };
      }),
    }));
  }

  function removeIngredientRow(localId) {
    setForm(previous => ({
      ...previous,
      items: previous.items.filter(item => item.localId !== localId),
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
    is_active: Boolean(form.isActive),
    items: form.items.map(item => ({
      ingredient_product_id: item.ingredientProductId,
      quantity: Number(item.quantity || 0),
      unit: item.unit,
      waste_percent: Number(item.wastePercent || 0),
      notes: item.notes,
    })),
  }), [editingRecipe?.id, form]);

  const editorRecipesByOutputId = useMemo(() => {
    const map = new Map();
    recipes.forEach(recipe => {
      if (recipe.id !== editingRecipe?.id && recipe.is_active !== false) {
        map.set(String(recipe.output_product_id), recipe);
      }
    });
    if (editorPreview.output_product_id) {
      map.set(String(editorPreview.output_product_id), editorPreview);
    }
    return map;
  }, [recipes, editingRecipe?.id, editorPreview]);

  const editorCostSummary = useMemo(
    () => buildRestaurantRecipeCostSummary(
      editorPreview,
      productsById,
      editorRecipesByOutputId,
      { ignoreCache: true }
    ),
    [editorPreview, productsById, editorRecipesByOutputId]
  );

  const selectedOutputProduct = productsById.get(String(form.outputProductId));
  const editorSalePrice = isRestaurantMenuProduct(selectedOutputProduct)
    ? Number(selectedOutputProduct?.price || 0)
    : 0;
  const editorFoodCostPercent = editorSalePrice > 0
    ? (editorCostSummary.unitCost / editorSalePrice) * 100
    : 0;
  const editorTargetPercent = Math.max(Number(form.targetFoodCostPercent || 30), 1);
  const editorSuggestedPrice = editorCostSummary.unitCost > 0
    ? editorCostSummary.unitCost / (editorTargetPercent / 100)
    : 0;

  function validateForm() {
    if (!form.outputProductId) return 'Selecciona el plato o preparación que tendrá la receta.';
    if (!form.name.trim()) return 'Ingresa un nombre para la receta.';
    if (Number(form.yieldQuantity || 0) <= 0) return 'El rendimiento debe ser mayor a cero.';
    if (!form.yieldUnit.trim()) return 'Selecciona la unidad del rendimiento.';
    if (Number(form.laborCost || 0) < 0 || Number(form.overheadCost || 0) < 0) return 'Los costos adicionales no pueden ser negativos.';
    if (Number(form.targetFoodCostPercent || 0) <= 0 || Number(form.targetFoodCostPercent || 0) > 100) return 'El costo objetivo debe estar entre 1% y 100%.';
    if (form.items.length === 0) return 'Agrega al menos un ingrediente o preparación.';

    const ids = form.items.map(item => String(item.ingredientProductId || '')).filter(Boolean);
    if (ids.length !== form.items.length) return 'Selecciona el artículo de cada fila.';
    if (new Set(ids).size !== ids.length) return 'No repitas el mismo ingrediente o preparación.';
    if (ids.includes(String(form.outputProductId))) return 'El resultado de la receta no puede utilizarse como ingrediente de sí mismo.';

    for (const item of form.items) {
      if (Number(item.quantity || 0) <= 0) return 'Todas las cantidades deben ser mayores a cero.';
      if (!item.unit.trim()) return 'Selecciona la unidad de cada ingrediente.';
      const waste = Number(item.wastePercent || 0);
      if (waste < 0 || waste > 100) return 'La merma prevista debe estar entre 0% y 100%.';
    }

    const unitWarning = editorCostSummary.warnings.find(message => message.includes('no coincide') || message.includes('unidad de stock'));
    if (unitWarning) return `Corrige las unidades antes de guardar: ${unitWarning}`;
    const circularWarning = editorCostSummary.warnings.find(message => message.includes('circular'));
    if (circularWarning) return circularWarning;
    return null;
  }

  async function saveRecipe(event) {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setNotice({ type: 'error', message: validationError });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const { error } = await supabase.rpc('save_restaurant_recipe', {
        p_recipe_id: editingRecipe?.id || null,
        p_output_product_id: form.outputProductId,
        p_name: form.name.trim(),
        p_yield_quantity: Number(form.yieldQuantity),
        p_yield_unit: form.yieldUnit.trim(),
        p_notes: form.notes.trim() || null,
        p_is_active: Boolean(form.isActive),
        p_labor_cost: Number(form.laborCost || 0),
        p_overhead_cost: Number(form.overheadCost || 0),
        p_target_food_cost_percent: Number(form.targetFoodCostPercent || 30),
        p_items: form.items.map(item => ({
          ingredient_product_id: item.ingredientProductId,
          quantity: Number(item.quantity),
          unit: item.unit.trim(),
          waste_percent: Number(item.wastePercent || 0),
          notes: item.notes.trim() || null,
        })),
      });
      if (error) throw error;

      await loadRecipes(false);
      resetEditor();
      setNotice({
        type: 'success',
        message: editingRecipe ? 'Receta gastronómica actualizada.' : 'Receta gastronómica creada.',
      });
    } catch (error) {
      console.error('Error guardando receta gastronómica:', error);
      setNotice({ type: 'error', message: `No se pudo guardar la receta: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function toggleRecipe(recipe) {
    try {
      const { error } = await supabase.rpc('set_restaurant_recipe_active', {
        p_recipe_id: recipe.id,
        p_is_active: !recipe.is_active,
      });
      if (error) throw error;
      await loadRecipes(false);
      setNotice({
        type: 'success',
        message: recipe.is_active ? 'Receta desactivada.' : 'Receta activada.',
      });
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo cambiar el estado: ${error.message}` });
    }
  }

  async function deleteRecipe(recipeId) {
    try {
      const { error } = await supabase.rpc('delete_restaurant_recipe', {
        p_recipe_id: recipeId,
      });
      if (error) throw error;
      setPendingDeleteId(null);
      await loadRecipes(false);
      setNotice({ type: 'success', message: 'Receta eliminada.' });
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo eliminar la receta: ${error.message}` });
    }
  }

  const currentOutputList = tab === 'menu' ? menuProducts : preparationProducts;
  return (
    <div className="space-y-6">
      {notice && !editorOpen && <Notice notice={notice} onClose={() => setNotice(null)} />}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={UtensilsCrossed} label="Platos con receta" value={menuRecipes.length} detail={`${menuWithoutRecipe} plato(s) pendientes`} tone="cyan" />
        <MetricCard icon={Layers3} label="Preparaciones" value={preparationRecipes.length} detail="salsas, fondos y bases" tone="violet" />
        <MetricCard icon={CheckCircle2} label="Recetas activas" value={enrichedRecipes.filter(recipe => recipe.is_active).length} detail="listas para operar" tone="emerald" />
        <MetricCard icon={AlertTriangle} label="Por revisar" value={alertsCount} detail="costos, unidades o margen" tone="rose" />
      </section>

      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-950 p-5 text-white sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                <ChefHat className="h-4 w-4" /> Costeo gastronómico
              </p>
              <h3 className="mt-2 text-2xl font-black sm:text-3xl">Recetas y costo real por plato</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Relaciona ingredientes, empaques y preparaciones internas. El costo se recalcula con los valores actuales de compra y muestra el porcentaje real sobre el precio de venta.
              </p>
            </div>
            <button type="button" onClick={() => openNewRecipe(tab)} className="iq-primary-button shrink-0 bg-white text-slate-950 hover:bg-cyan-50">
              <Plus className="h-5 w-5" /> Nueva receta
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[auto_1fr_auto] lg:items-center">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
              <TabButton active={tab === 'menu'} onClick={() => setTab('menu')} icon={UtensilsCrossed} label="Platos del menú" count={menuRecipes.length} />
              <TabButton active={tab === 'preparation'} onClick={() => setTab('preparation')} icon={Layers3} label="Preparaciones" count={preparationRecipes.length} />
            </div>

            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder={tab === 'menu' ? 'Buscar plato, ingrediente o categoría...' : 'Buscar salsa, fondo, base o ingrediente...'}
                className="iq-input pl-11"
              />
            </label>

            <select value={filter} onChange={event => setFilter(event.target.value)} className="iq-input min-w-[180px]">
              <option value="all">Todas</option>
              <option value="active">Activas</option>
              <option value="inactive">Inactivas</option>
              <option value="alerts">Por revisar</option>
            </select>
          </div>
        </div>
      </section>

      {loading ? (
        <LoadingState />
      ) : enrichedRecipes.length === 0 ? (
        <EmptyState
          kind={tab}
          outputCount={currentOutputList.length}
          inputCount={inputProducts.length}
          onCreate={() => openNewRecipe(tab)}
          onGoProducts={() => setActive('Productos')}
        />
      ) : visibleRecipes.length === 0 ? (
        <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-10 text-center">
          <Search className="mx-auto h-8 w-8 text-slate-300" />
          <h3 className="mt-4 text-lg font-black text-slate-900">No hay resultados</h3>
          <p className="mt-1 text-sm text-slate-500">Cambia la búsqueda o el filtro seleccionado.</p>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {visibleRecipes.map(recipe => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              pendingDelete={pendingDeleteId === recipe.id}
              onEdit={() => openEditRecipe(recipe)}
              onToggle={() => toggleRecipe(recipe)}
              onRequestDelete={() => setPendingDeleteId(recipe.id)}
              onCancelDelete={() => setPendingDeleteId(null)}
              onDelete={() => deleteRecipe(recipe.id)}
            />
          ))}
        </section>
      )}

      {editorOpen && (
        <RecipeEditor
          form={form}
          editingRecipe={editingRecipe}
          outputProducts={tab === 'menu' ? menuProducts : preparationProducts}
          inputProducts={inputProducts}
          productsById={productsById}
          usedOutputIds={usedOutputIds}
          selectedOutputProduct={selectedOutputProduct}
          costSummary={editorCostSummary}
          salePrice={editorSalePrice}
          foodCostPercent={editorFoodCostPercent}
          suggestedPrice={editorSuggestedPrice}
          targetPercent={editorTargetPercent}
          notice={notice}
          saving={saving}
          onClose={resetEditor}
          onSave={saveRecipe}
          onUpdateForm={updateForm}
          onSelectOutput={selectOutputProduct}
          onAddIngredient={addIngredientRow}
          onUpdateIngredient={updateIngredientRow}
          onRemoveIngredient={removeIngredientRow}
          onClearNotice={() => setNotice(null)}
        />
      )}
    </div>
  );
}

function Notice({ notice, onClose }) {
  return (
    <div className={`flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm font-semibold ${
      notice.type === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-red-200 bg-red-50 text-red-700'
    }`}>
      <span>{notice.message}</span>
      <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-white/70" aria-label="Cerrar aviso"><X className="h-4 w-4" /></button>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone }) {
  const tones = {
    cyan: 'bg-cyan-50 text-cyan-700',
    violet: 'bg-violet-50 text-violet-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
  };
  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tones[tone] || tones.cyan}`}><Icon className="h-5 w-5" /></div>
      <p className="mt-4 text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate-400">{detail}</p>
    </article>
  );
}

function TabButton({ active, onClick, icon: Icon, label, count }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
      <Icon className="h-4 w-4" /> {label} <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{count}</span>
    </button>
  );
}

function LoadingState() {
  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-10 text-center">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-700" />
      <p className="mt-3 text-sm font-bold text-slate-500">Calculando recetas y costos...</p>
    </section>
  );
}

function EmptyState({ kind, outputCount, inputCount, onCreate, onGoProducts }) {
  const ready = outputCount > 0 && inputCount > 0;
  return (
    <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-8 sm:p-10">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-50 text-cyan-700">
          {kind === 'menu' ? <UtensilsCrossed className="h-8 w-8" /> : <Layers3 className="h-8 w-8" />}
        </div>
        <h3 className="mt-5 text-2xl font-black text-slate-950">{kind === 'menu' ? 'Crea la primera receta del menú' : 'Crea la primera preparación interna'}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {kind === 'menu'
            ? 'Define ingredientes y porciones para conocer el costo real del plato y su margen.'
            : 'Costea salsas, fondos, aderezos o bases para reutilizarlos dentro de varios platos.'}
        </p>
        <div className="mt-6 grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
          <ReadyCheck ready={outputCount > 0} label={kind === 'menu' ? 'Plato del menú registrado' : 'Preparación registrada en Productos'} />
          <ReadyCheck ready={inputCount > 0} label="Ingredientes o insumos registrados" />
        </div>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          {ready && <button type="button" onClick={onCreate} className="iq-primary-button"><Plus className="h-5 w-5" /> Crear receta</button>}
          <button type="button" onClick={onGoProducts} className="iq-secondary-button"><Package className="h-5 w-5" /> Ir a Menú e inventario</button>
        </div>
      </div>
    </section>
  );
}

function ReadyCheck({ ready, label }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-4 text-sm font-bold ${ready ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-amber-100 bg-amber-50 text-amber-800'}`}>
      {ready ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />} {label}
    </div>
  );
}

function RecipeCard({ recipe, pendingDelete, onEdit, onToggle, onRequestDelete, onCancelDelete, onDelete }) {
  const { outputProduct, costSummary, commercialSummary } = recipe;
  const isMenu = recipe.recipeKind === 'menu';
  const overTarget = isMenu && commercialSummary.foodCostPercent > commercialSummary.targetFoodCostPercent;
  const hasWarnings = costSummary.warnings.length > 0;
  const tone = costTone(commercialSummary.foodCostPercent, commercialSummary.targetFoodCostPercent);
  const toneClasses = {
    slate: 'bg-slate-100 text-slate-600',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
  };

  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${recipe.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {recipe.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} {recipe.is_active ? 'Activa' : 'Inactiva'}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${isMenu ? 'bg-cyan-50 text-cyan-700' : 'bg-violet-50 text-violet-700'}`}>
                {isMenu ? 'Plato del menú' : 'Preparación interna'}
              </span>
              {(hasWarnings || overTarget) && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> Revisar</span>}
            </div>
            <h3 className="mt-3 truncate text-xl font-black text-slate-950">{outputProduct?.name || recipe.name}</h3>
            <p className="mt-1 truncate text-sm font-semibold text-slate-500">{cleanOperationalCategoryLabel(outputProduct?.category)}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={onEdit} className="iq-action-icon" aria-label="Editar receta"><Edit3 className="h-4 w-4" /></button>
            <button type="button" onClick={onToggle} className="iq-action-icon" aria-label={recipe.is_active ? 'Desactivar receta' : 'Activar receta'}>{recipe.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            <button type="button" onClick={onRequestDelete} className="iq-action-icon text-red-600" aria-label="Eliminar receta"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <RecipeStat label="Rendimiento" value={`${formatRecipeQuantity(recipe.yield_quantity)} ${recipe.yield_unit}`} />
          <RecipeStat label="Componentes" value={recipe.items.length} />
          <RecipeStat label="Costo total" value={formatRecipeMoney(costSummary.totalCost)} />
          <RecipeStat label={isMenu ? 'Costo por plato' : 'Costo por unidad'} value={formatRecipeMoney(costSummary.unitCost)} />
        </div>

        {isMenu ? (
          <div className="mt-4 grid grid-cols-1 gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3">
            <CommercialStat label="Precio de venta" value={formatRecipeMoney(commercialSummary.salePrice)} />
            <CommercialStat label="Costo gastronómico" value={`${formatRecipeQuantity(commercialSummary.foodCostPercent, 1)}%`} className={toneClasses[tone]} />
            <CommercialStat label="Precio sugerido" value={formatRecipeMoney(commercialSummary.suggestedPrice)} />
          </div>
        ) : (
          <div className="mt-4 rounded-2xl bg-violet-50 p-4 text-sm text-violet-800">
            <p className="font-black">Costo reutilizable en otros platos</p>
            <p className="mt-1">Al incluir esta preparación en una receta, InventIQ utilizará automáticamente su costo actualizado de {formatRecipeMoney(costSummary.unitCost)} por {outputProduct?.stockUnit || recipe.yield_unit}.</p>
          </div>
        )}

        {(hasWarnings || overTarget) && (
          <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="flex items-center gap-2 font-black"><AlertTriangle className="h-4 w-4" /> Revisión pendiente</p>
            <p className="mt-1 leading-5">{costSummary.warnings[0] || `El costo gastronómico supera el objetivo de ${commercialSummary.targetFoodCostPercent}%.`}</p>
          </div>
        )}
      </div>

      {pendingDelete && (
        <div className="border-t border-red-100 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-800">¿Eliminar esta receta? El producto y sus existencias se conservarán.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={onDelete} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white">Eliminar</button>
            <button type="button" onClick={onCancelDelete} className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-black text-red-700">Cancelar</button>
          </div>
        </div>
      )}
    </article>
  );
}

function RecipeStat({ label, value }) {
  return <div className="rounded-2xl border border-slate-100 bg-white p-3"><p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 truncate text-sm font-black text-slate-900">{value}</p></div>;
}

function CommercialStat({ label, value, className = '' }) {
  return <div className={`rounded-xl px-3 py-2 ${className}`}><p className="text-[11px] font-black uppercase tracking-wide opacity-70">{label}</p><p className="mt-1 font-black">{value}</p></div>;
}

function RecipeEditor({
  form,
  editingRecipe,
  outputProducts,
  inputProducts,
  productsById,
  usedOutputIds,
  selectedOutputProduct,
  costSummary,
  salePrice,
  foodCostPercent,
  suggestedPrice,
  targetPercent,
  notice,
  saving,
  onClose,
  onSave,
  onUpdateForm,
  onSelectOutput,
  onAddIngredient,
  onUpdateIngredient,
  onRemoveIngredient,
  onClearNotice,
}) {
  const isMenu = selectedOutputProduct
    ? isRestaurantMenuProduct(selectedOutputProduct)
    : outputProducts.some(isRestaurantMenuProduct);

  return (
    <div className="iq-modal-overlay z-50">
      <div className="iq-modal-card max-h-[94vh] w-full max-w-7xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-700"><BookOpenText className="h-4 w-4" /> {editingRecipe ? 'Editar receta' : 'Nueva receta gastronómica'}</p>
            <h3 className="mt-1 text-2xl font-black text-slate-950">{selectedOutputProduct?.name || 'Define el plato o preparación'}</h3>
            <p className="mt-1 text-sm text-slate-500">Ingredientes, rendimiento, costos operativos y margen en una sola ficha.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="iq-action-icon"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={onSave} className="grid max-h-[calc(94vh-96px)] grid-cols-1 overflow-y-auto xl:grid-cols-[1fr_360px]">
          <div className="space-y-6 p-5 sm:p-6">
            {notice && <Notice notice={notice} onClose={onClearNotice} />}

            <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <h4 className="font-black text-slate-900">1. Resultado y rendimiento</h4>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label={isMenu ? 'Plato o bebida del menú' : 'Preparación interna'}>
                  <select value={form.outputProductId} onChange={event => onSelectOutput(event.target.value)} disabled={Boolean(editingRecipe)} className="iq-input">
                    <option value="">Seleccionar...</option>
                    {outputProducts.map(product => {
                      const used = usedOutputIds.has(String(product.id)) && String(product.id) !== String(editingRecipe?.output_product_id || '');
                      return <option key={product.id} value={product.id} disabled={used}>{product.name}{used ? ' · ya tiene receta' : ''}</option>;
                    })}
                  </select>
                </Field>
                <Field label="Nombre de la receta">
                  <input value={form.name} onChange={event => onUpdateForm('name', event.target.value)} className="iq-input" placeholder="Ej: Hamburguesa clásica estándar" />
                </Field>
                <Field label="Rendimiento">
                  <input type="number" min="0.001" step="0.001" value={form.yieldQuantity} onChange={event => onUpdateForm('yieldQuantity', event.target.value)} className="iq-input" />
                </Field>
                <Field label="Unidad del rendimiento">
                  <select value={form.yieldUnit} onChange={event => onUpdateForm('yieldUnit', event.target.value)} className="iq-input">
                    {RESTAURANT_RECIPE_UNIT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </Field>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><h4 className="font-black text-slate-900">2. Ingredientes y preparaciones</h4><p className="mt-1 text-sm text-slate-500">La merma aumenta la cantidad utilizada para reflejar limpieza, cocción o recorte.</p></div>
                <button type="button" onClick={onAddIngredient} className="iq-secondary-button"><Plus className="h-4 w-4" /> Agregar componente</button>
              </div>

              <div className="mt-5 space-y-3">
                {form.items.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm font-semibold text-slate-500">Agrega al menos un ingrediente, empaque o preparación interna.</div>}
                {form.items.map((item, index) => {
                  const selected = productsById.get(String(item.ingredientProductId));
                  const role = selected ? getRestaurantProductRole(selected) : '';
                  return (
                    <div key={item.localId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-400">Componente {index + 1}</p>
                        <button type="button" onClick={() => onRemoveIngredient(item.localId)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.5fr_0.55fr_0.7fr_0.55fr]">
                        <select value={item.ingredientProductId} onChange={event => onUpdateIngredient(item.localId, 'ingredientProductId', event.target.value)} className="iq-input">
                          <option value="">Seleccionar ingrediente o preparación...</option>
                          {inputProducts.map(product => <option key={product.id} value={product.id}>{product.name} · {getRestaurantProductRole(product) === 'preparation' ? 'Preparación interna' : 'Insumo o empaque'}</option>)}
                        </select>
                        <input type="number" min="0.0001" step="0.0001" value={item.quantity} onChange={event => onUpdateIngredient(item.localId, 'quantity', event.target.value)} className="iq-input" placeholder="Cantidad" />
                        <select value={item.unit} onChange={event => onUpdateIngredient(item.localId, 'unit', event.target.value)} className="iq-input">
                          <option value="">Unidad...</option>
                          {RESTAURANT_RECIPE_UNIT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        <div className="relative"><input type="number" min="0" max="100" step="0.1" value={item.wastePercent} onChange={event => onUpdateIngredient(item.localId, 'wastePercent', event.target.value)} className="iq-input pr-8" placeholder="Merma" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">%</span></div>
                      </div>
                      <input value={item.notes} onChange={event => onUpdateIngredient(item.localId, 'notes', event.target.value)} className="iq-input mt-3" placeholder="Nota opcional: limpio, cocido, sin hueso, para llevar..." />
                      {selected && <p className={`mt-2 text-xs font-bold ${role === 'preparation' ? 'text-violet-700' : 'text-slate-500'}`}>{role === 'preparation' ? 'Costo calculado desde su propia receta.' : `Costo actual: ${formatRecipeMoney(selected.cost)} por ${selected.stockUnit || selected.size || 'unidad'}.`}</p>}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <h4 className="font-black text-slate-900">3. Costos operativos y objetivo</h4>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="Mano de obra por lote"><input type="number" min="0" step="0.01" value={form.laborCost} onChange={event => onUpdateForm('laborCost', event.target.value)} className="iq-input" /></Field>
                <Field label="Gas, energía y otros"><input type="number" min="0" step="0.01" value={form.overheadCost} onChange={event => onUpdateForm('overheadCost', event.target.value)} className="iq-input" /></Field>
                <Field label="Costo gastronómico objetivo"><div className="relative"><input type="number" min="1" max="100" step="0.1" value={form.targetFoodCostPercent} onChange={event => onUpdateForm('targetFoodCostPercent', event.target.value)} className="iq-input pr-8" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">%</span></div></Field>
              </div>
              <Field label="Notas de preparación" className="mt-4"><textarea rows="3" value={form.notes} onChange={event => onUpdateForm('notes', event.target.value)} className="iq-input resize-none" placeholder="Secuencia, temperatura, presentación o indicaciones internas..." /></Field>
              <label className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-700"><input type="checkbox" checked={form.isActive} onChange={event => onUpdateForm('isActive', event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-cyan-700" /> Receta activa y disponible para la operación</label>
            </section>
          </div>

          <aside className="border-t border-slate-200 bg-slate-50 p-5 sm:p-6 xl:sticky xl:top-0 xl:self-start xl:border-l xl:border-t-0">
            <div className="flex items-center gap-2"><Calculator className="h-5 w-5 text-cyan-700" /><h4 className="font-black text-slate-950">Costo en tiempo real</h4></div>
            <div className="mt-5 space-y-3">
              <CostLine label="Ingredientes directos" value={costSummary.directIngredientCost} />
              <CostLine label="Preparaciones internas" value={costSummary.preparationCost} />
              <CostLine label="Empaques" value={costSummary.packagingCost} />
              <CostLine label="Mano de obra" value={costSummary.laborCost} />
              <CostLine label="Gas, energía y otros" value={costSummary.overheadCost} />
              <div className="border-t border-slate-200 pt-3"><CostLine label="Costo total" value={costSummary.totalCost} strong /></div>
              <div className="rounded-2xl bg-slate-950 p-4 text-white"><p className="text-xs font-black uppercase tracking-wide text-slate-300">{isMenu ? 'Costo por plato' : 'Costo por unidad de stock'}</p><p className="mt-1 text-3xl font-black">{formatRecipeMoney(costSummary.unitCost)}</p></div>
            </div>

            {isMenu && (
              <div className="mt-5 space-y-3 rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
                <div className="flex items-center gap-2 text-cyan-900"><CircleDollarSign className="h-5 w-5" /><p className="font-black">Lectura comercial</p></div>
                <SummaryRow label="Precio actual" value={formatRecipeMoney(salePrice)} />
                <SummaryRow label="Costo gastronómico" value={`${formatRecipeQuantity(foodCostPercent, 1)}%`} />
                <SummaryRow label="Objetivo" value={`${formatRecipeQuantity(targetPercent, 1)}%`} />
                <SummaryRow label="Precio sugerido" value={formatRecipeMoney(suggestedPrice)} strong />
              </div>
            )}

            {costSummary.warnings.length > 0 && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="flex items-center gap-2 font-black"><AlertTriangle className="h-4 w-4" /> Observaciones</p>
                <ul className="mt-2 space-y-1.5 text-xs font-semibold">{costSummary.warnings.slice(0, 5).map(message => <li key={message}>• {message}</li>)}</ul>
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 gap-2">
              <button type="submit" disabled={saving} className="iq-primary-button w-full justify-center">{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />} {editingRecipe ? 'Guardar cambios' : 'Crear receta'}</button>
              <button type="button" onClick={onClose} disabled={saving} className="iq-secondary-button w-full justify-center">Cancelar</button>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children, className = '' }) {
  return <label className={`block ${className}`}><span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>{children}</label>;
}

function CostLine({ label, value, strong = false }) {
  return <div className="flex items-center justify-between gap-3"><span className={`text-sm ${strong ? 'font-black text-slate-900' : 'font-semibold text-slate-500'}`}>{label}</span><span className={`${strong ? 'text-lg' : 'text-sm'} font-black text-slate-950`}>{formatRecipeMoney(value)}</span></div>;
}

function SummaryRow({ label, value, strong = false }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-cyan-800">{label}</span><span className={`${strong ? 'text-base' : 'text-sm'} font-black text-cyan-950`}>{value}</span></div>;
}
