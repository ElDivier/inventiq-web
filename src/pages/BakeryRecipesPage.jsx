import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpenText,
  Calculator,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Edit3,
  Eye,
  EyeOff,
  Loader2,
  PackagePlus,
  Plus,
  Search,
  Trash2,
  Wheat,
  X,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { PRODUCT_TYPE_LABELS } from '../config/productTypes';
import {
  RECIPE_UNIT_OPTIONS,
  buildRecipeCostSummary,
  formatRecipeMoney,
  formatRecipeQuantity,
  getBakeryProductType,
  getProductStockUnit,
  getRecipeMarginSummary,
  getSuggestedRecipeUnit,
  isBakeryIngredientProduct,
  isBakeryOutputProduct,
} from '../utils/productionRecipes';

const EMPTY_FORM = {
  outputProductId: '',
  name: '',
  yieldQuantity: '1',
  yieldUnit: 'unidad',
  isActive: true,
  notes: '',
  additionalCost: '0',
  additionalCostNotes: '',
  items: [],
};

function createEmptyItem() {
  return {
    localId: `recipe-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ingredientProductId: '',
    quantity: '',
    unit: '',
    wastePercent: '0',
    notes: '',
  };
}

function normalizeRecipeFromDb(recipe) {
  return {
    ...recipe,
    items: Array.isArray(recipe?.items) ? recipe.items : [],
  };
}

export default function BakeryRecipesPage({ currentUser, products, setActive }) {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const bakeryProducts = useMemo(
    () => (products || []).filter(product => product?.status !== 'Eliminado'),
    [products]
  );

  const outputProducts = useMemo(
    () => bakeryProducts.filter(isBakeryOutputProduct),
    [bakeryProducts]
  );

  const ingredientProducts = useMemo(
    () => bakeryProducts.filter(isBakeryIngredientProduct),
    [bakeryProducts]
  );

  const productsById = useMemo(
    () => new Map(bakeryProducts.map(product => [String(product.id), product])),
    [bakeryProducts]
  );

  const loadRecipes = useCallback(async (showLoader = true) => {
    if (!currentUser?.id) return;
    if (showLoader) setLoading(true);

    try {
      const { data, error } = await supabase
        .from('production_recipes')
        .select('*, items:production_recipe_items(*)')
        .eq('user_id', currentUser.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setRecipes((data || []).map(normalizeRecipeFromDb));
    } catch (error) {
      console.error('Error cargando recetas de producción:', error);
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

    const recipeChannel = supabase
      .channel(`bakery-recipes-${currentUser.id}`)
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

    return () => {
      supabase.removeChannel(recipeChannel);
    };
  }, [currentUser?.id, loadRecipes]);

  const enrichedRecipes = useMemo(() => recipes.map(recipe => {
    const outputProduct = productsById.get(String(recipe.output_product_id));
    const costSummary = buildRecipeCostSummary(recipe, productsById);
    const marginSummary = getRecipeMarginSummary(recipe, outputProduct, costSummary);

    return {
      ...recipe,
      outputProduct,
      costSummary,
      marginSummary,
    };
  }), [recipes, productsById]);

  const visibleRecipes = useMemo(() => {
    const term = search.trim().toLowerCase();

    return enrichedRecipes.filter(recipe => {
      const matchesSearch = !term || [
        recipe.name,
        recipe.outputProduct?.name,
        recipe.outputProduct?.category,
      ].some(value => String(value || '').toLowerCase().includes(term));

      const hasAlerts = recipe.costSummary.warnings.length > 0;
      const matchesFilter = filter === 'all'
        || (filter === 'active' && recipe.is_active)
        || (filter === 'inactive' && !recipe.is_active)
        || (filter === 'alerts' && hasAlerts);

      return matchesSearch && matchesFilter;
    });
  }, [enrichedRecipes, search, filter]);

  const usedOutputIds = useMemo(
    () => new Set(recipes.map(recipe => String(recipe.output_product_id))),
    [recipes]
  );

  const activeRecipes = enrichedRecipes.filter(recipe => recipe.is_active).length;
  const recipesWithAlerts = enrichedRecipes.filter(recipe => recipe.costSummary.warnings.length > 0).length;
  const productsWithoutRecipe = outputProducts.filter(product => !usedOutputIds.has(String(product.id))).length;

  function openNewRecipe() {
    setEditingRecipe(null);
    setForm({ ...EMPTY_FORM, items: [createEmptyItem()] });
    setNotice(null);
    setEditorOpen(true);
  }

  function openEditRecipe(recipe) {
    setEditingRecipe(recipe);
    setForm({
      outputProductId: String(recipe.output_product_id || ''),
      name: recipe.name || '',
      yieldQuantity: String(recipe.yield_quantity || 1),
      yieldUnit: recipe.yield_unit || 'unidad',
      isActive: Boolean(recipe.is_active),
      notes: recipe.notes || '',
      additionalCost: String(recipe.additional_cost || 0),
      additionalCostNotes: recipe.additional_cost_notes || '',
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

  function closeEditor() {
    if (saving) return;
    setEditorOpen(false);
    setEditingRecipe(null);
    setForm(EMPTY_FORM);
  }

  function updateForm(field, value) {
    setForm(previous => ({ ...previous, [field]: value }));
  }

  function selectOutputProduct(productId) {
    const product = productsById.get(String(productId));
    setForm(previous => ({
      ...previous,
      outputProductId: productId,
      name: previous.name || (product ? `Fórmula de ${product.name}` : ''),
      yieldUnit: previous.yieldUnit || getSuggestedRecipeUnit(product),
    }));
  }

  function addIngredientRow() {
    setForm(previous => ({
      ...previous,
      items: [...previous.items, createEmptyItem()],
    }));
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
            ingredientProductId: value,
            unit: getSuggestedRecipeUnit(product),
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

  const editorRecipePreview = useMemo(() => ({
    yield_quantity: Number(form.yieldQuantity || 0),
    yield_unit: form.yieldUnit,
    additional_cost: Number(form.additionalCost || 0),
    items: form.items.map(item => ({
      ingredient_product_id: item.ingredientProductId,
      quantity: Number(item.quantity || 0),
      unit: item.unit,
      waste_percent: Number(item.wastePercent || 0),
      notes: item.notes,
    })),
  }), [form]);

  const editorCostSummary = useMemo(
    () => buildRecipeCostSummary(editorRecipePreview, productsById),
    [editorRecipePreview, productsById]
  );

  const selectedOutputProduct = productsById.get(String(form.outputProductId));
  const editorMarginSummary = getRecipeMarginSummary(
    editorRecipePreview,
    selectedOutputProduct,
    editorCostSummary
  );

  function validateRecipeForm() {
    if (!form.outputProductId) return 'Selecciona el producto terminado que se elaborará.';
    if (!form.name.trim()) return 'Ingresa el nombre de la receta.';
    if (Number(form.yieldQuantity || 0) <= 0) return 'El rendimiento debe ser mayor a cero.';
    if (!form.yieldUnit.trim()) return 'Selecciona la unidad del rendimiento.';
    if (form.items.length === 0) return 'Agrega al menos un ingrediente.';

    const ingredientIds = form.items.map(item => item.ingredientProductId).filter(Boolean);
    if (ingredientIds.length !== form.items.length) return 'Selecciona el ingrediente de cada fila.';
    if (new Set(ingredientIds).size !== ingredientIds.length) return 'No repitas el mismo ingrediente en una receta.';
    if (ingredientIds.includes(String(form.outputProductId))) return 'El producto terminado no puede ser ingrediente de sí mismo.';

    for (const item of form.items) {
      if (Number(item.quantity || 0) <= 0) return 'Todas las cantidades deben ser mayores a cero.';
      if (!item.unit.trim()) return 'Selecciona la unidad de cada ingrediente.';
      const wastePercent = Number(item.wastePercent || 0);
      if (wastePercent < 0 || wastePercent > 100) return 'La merma debe estar entre 0 y 100%.';
    }

    const conversionWarnings = editorCostSummary.warnings.filter(message => message.includes('no coincide') || message.includes('define la unidad'));
    if (conversionWarnings.length > 0) {
      return `Corrige las unidades antes de guardar: ${conversionWarnings[0]}`;
    }

    return null;
  }

  async function saveRecipe(event) {
    event.preventDefault();
    const validationError = validateRecipeForm();

    if (validationError) {
      setNotice({ type: 'error', message: validationError });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const { error } = await supabase.rpc('save_production_recipe', {
        p_recipe_id: editingRecipe?.id || null,
        p_output_product_id: form.outputProductId,
        p_name: form.name.trim(),
        p_yield_quantity: Number(form.yieldQuantity),
        p_yield_unit: form.yieldUnit.trim(),
        p_notes: form.notes.trim() || null,
        p_is_active: Boolean(form.isActive),
        p_additional_cost: Number(form.additionalCost || 0),
        p_additional_cost_notes: form.additionalCostNotes.trim() || null,
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
      setEditorOpen(false);
      setEditingRecipe(null);
      setForm(EMPTY_FORM);
      setNotice({
        type: 'success',
        message: editingRecipe ? 'Receta actualizada correctamente.' : 'Receta creada correctamente.',
      });
    } catch (error) {
      console.error('Error guardando receta:', error);
      setNotice({
        type: 'error',
        message: `No se pudo guardar la receta: ${error.message}`,
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleRecipe(recipe) {
    try {
      setNotice(null);
      const { error } = await supabase.rpc('set_production_recipe_active', {
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
      setNotice(null);
      const { error } = await supabase.rpc('delete_production_recipe', {
        p_recipe_id: recipeId,
      });
      if (error) throw error;
      setPendingDeleteId(null);
      await loadRecipes(false);
      setNotice({ type: 'success', message: 'Receta eliminada correctamente.' });
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo eliminar la receta: ${error.message}` });
    }
  }

  return (
    <div className="space-y-6">
      {notice && !editorOpen && (
        <Notice notice={notice} onClose={() => setNotice(null)} />
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={BookOpenText} label="Recetas registradas" value={recipes.length} detail="fórmulas de producción" tone="cyan" />
        <MetricCard icon={CheckCircle2} label="Recetas activas" value={activeRecipes} detail="listas para producir" tone="emerald" />
        <MetricCard icon={PackagePlus} label="Sin receta" value={productsWithoutRecipe} detail="productos terminados" tone="amber" />
        <MetricCard icon={AlertTriangle} label="Por revisar" value={recipesWithAlerts} detail="costos o unidades" tone="rose" />
      </section>

      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 p-5 text-white sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                <Wheat className="h-4 w-4" /> Producción de panadería
              </p>
              <h3 className="mt-2 text-2xl font-black sm:text-3xl">Recetas con rendimiento y costo actualizado</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Cada fórmula utiliza el costo actual de las materias primas. Cuando cambias el costo de compra de un ingrediente, el costo estimado de la receta se actualiza automáticamente.
              </p>
            </div>

            <button type="button" onClick={openNewRecipe} className="iq-primary-button shrink-0 bg-white text-slate-950 hover:bg-cyan-50">
              <Plus className="h-5 w-5" /> Nueva receta
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                className="iq-input pl-11"
                placeholder="Buscar por producto o receta"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {[
                ['all', 'Todas'],
                ['active', 'Activas'],
                ['inactive', 'Inactivas'],
                ['alerts', 'Por revisar'],
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                    filter === value
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:text-cyan-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex min-h-56 items-center justify-center rounded-[1.75rem] border border-slate-200 bg-white">
          <Loader2 className="h-7 w-7 animate-spin text-cyan-600" />
        </div>
      ) : recipes.length === 0 ? (
        <EmptyRecipes
          outputProducts={outputProducts}
          ingredientProducts={ingredientProducts}
          onCreate={openNewRecipe}
          onGoProducts={() => setActive('Productos')}
        />
      ) : visibleRecipes.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-10 text-center">
          <Search className="mx-auto h-8 w-8 text-slate-300" />
          <h3 className="mt-3 text-lg font-black text-slate-900">No encontramos recetas</h3>
          <p className="mt-1 text-sm text-slate-500">Cambia el filtro o el término de búsqueda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
              onProduce={() => {
                sessionStorage.setItem('inventiq_production_recipe_id', recipe.id);
                setActive('Producción');
              }}
            />
          ))}
        </div>
      )}

      {editorOpen && (
        <RecipeEditor
          form={form}
          editingRecipe={editingRecipe}
          outputProducts={outputProducts}
          ingredientProducts={ingredientProducts}
          productsById={productsById}
          usedOutputIds={usedOutputIds}
          selectedOutputProduct={selectedOutputProduct}
          costSummary={editorCostSummary}
          marginSummary={editorMarginSummary}
          notice={notice}
          saving={saving}
          onClose={closeEditor}
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
      <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-1 hover:bg-white/70" aria-label="Cerrar aviso">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone }) {
  const tones = {
    cyan: 'bg-cyan-50 text-cyan-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
  };

  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tones[tone] || tones.cyan}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate-400">{detail}</p>
    </article>
  );
}

function EmptyRecipes({ outputProducts, ingredientProducts, onCreate, onGoProducts }) {
  const ready = outputProducts.length > 0 && ingredientProducts.length > 0;

  return (
    <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-7 sm:p-10">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-50 text-cyan-700">
          <BookOpenText className="h-8 w-8" />
        </div>
        <h3 className="mt-5 text-2xl font-black text-slate-950">Crea la primera fórmula de producción</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Relaciona un producto terminado con sus materias primas, define el rendimiento del lote y conoce su costo estimado por unidad.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
          <ReadyCheck ready={outputProducts.length > 0} label="Producto terminado registrado" />
          <ReadyCheck ready={ingredientProducts.length > 0} label="Materia prima o empaque registrado" />
        </div>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          {ready && (
            <button type="button" onClick={onCreate} className="iq-primary-button">
              <Plus className="h-5 w-5" /> Crear receta
            </button>
          )}
          <button type="button" onClick={onGoProducts} className="iq-secondary-button">
            <PackagePlus className="h-5 w-5" /> Ir a Productos
          </button>
        </div>
      </div>
    </section>
  );
}

function ReadyCheck({ ready, label }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-4 text-sm font-bold ${
      ready ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-amber-100 bg-amber-50 text-amber-800'
    }`}>
      {ready ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
      {label}
    </div>
  );
}

function RecipeCard({ recipe, pendingDelete, onEdit, onToggle, onRequestDelete, onCancelDelete, onDelete, onProduce }) {
  const { outputProduct, costSummary, marginSummary } = recipe;
  const hasWarnings = costSummary.warnings.length > 0;
  const marginPositive = marginSummary.marginValue >= 0;

  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${
                recipe.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {recipe.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {recipe.is_active ? 'Activa' : 'Inactiva'}
              </span>
              {hasWarnings && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" /> Revisar
                </span>
              )}
            </div>
            <h3 className="mt-3 truncate text-xl font-black text-slate-950">{outputProduct?.name || recipe.name}</h3>
            <p className="mt-1 truncate text-sm font-semibold text-slate-500">{recipe.name}</p>
          </div>

          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={onEdit} className="iq-action-icon" aria-label="Editar receta">
              <Edit3 className="h-4 w-4" />
            </button>
            <button type="button" onClick={onToggle} className="iq-action-icon" aria-label={recipe.is_active ? 'Desactivar receta' : 'Activar receta'}>
              {recipe.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button type="button" onClick={onRequestDelete} className="iq-action-icon text-red-600" aria-label="Eliminar receta">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <RecipeStat label="Rendimiento" value={`${formatRecipeQuantity(recipe.yield_quantity)} ${recipe.yield_unit}`} />
          <RecipeStat label="Ingredientes" value={recipe.items.length} />
          <RecipeStat label="Costo del lote" value={formatRecipeMoney(costSummary.totalCost)} />
          <RecipeStat label="Costo unitario" value={formatRecipeMoney(costSummary.unitCost)} />
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">Precio de venta</p>
            <p className="mt-1 font-black text-slate-900">{formatRecipeMoney(marginSummary.salePrice)}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">Margen estimado</p>
            <p className={`mt-1 font-black ${marginPositive ? 'text-emerald-700' : 'text-red-600'}`}>
              {formatRecipeMoney(marginSummary.marginValue)} · {formatRecipeQuantity(marginSummary.marginPercent, 1)}%
            </p>
          </div>
        </div>

        {recipe.is_active && !hasWarnings && (
          <button type="button" onClick={onProduce} className="iq-primary-button mt-4 w-full justify-center">
            <PackagePlus className="h-5 w-5" /> Registrar producción
          </button>
        )}

        {hasWarnings && (
          <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="flex items-center gap-2 font-black"><AlertTriangle className="h-4 w-4" /> Revisión pendiente</p>
            <p className="mt-1 leading-5">{costSummary.warnings[0]}</p>
            {costSummary.warnings.length > 1 && (
              <p className="mt-1 text-xs font-bold">+{costSummary.warnings.length - 1} observación(es) adicional(es)</p>
            )}
          </div>
        )}
      </div>

      {pendingDelete && (
        <div className="border-t border-red-100 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-800">¿Eliminar definitivamente esta receta? El producto y sus existencias no se eliminarán.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={onDelete} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white hover:bg-red-700">Eliminar</button>
            <button type="button" onClick={onCancelDelete} className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-black text-red-700">Cancelar</button>
          </div>
        </div>
      )}
    </article>
  );
}

function RecipeStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function RecipeEditor({
  form,
  editingRecipe,
  outputProducts,
  ingredientProducts,
  productsById,
  usedOutputIds,
  selectedOutputProduct,
  costSummary,
  marginSummary,
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
  return (
    <div className="iq-modal-overlay z-50">
      <div className="iq-modal-card max-h-[94vh] w-full max-w-6xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-700">
              <BookOpenText className="h-4 w-4" /> {editingRecipe ? 'Editar fórmula' : 'Nueva fórmula'}
            </p>
            <h3 className="mt-2 text-2xl font-black text-slate-950">Receta de producción</h3>
            <p className="mt-1 text-sm text-slate-500">Define rendimiento, ingredientes y costos por lote.</p>
          </div>
          <button type="button" onClick={onClose} className="iq-action-icon" aria-label="Cerrar formulario">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSave} className="max-h-[calc(94vh-105px)] overflow-y-auto">
          <div className="grid grid-cols-1 gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.7fr)]">
            <div className="space-y-6">
              {notice && (
                <Notice notice={notice} onClose={onClearNotice} />
              )}

              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <SectionTitle number="01" title="Producto y rendimiento" subtitle="Una receta corresponde a un producto terminado." />

                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <label className="block lg:col-span-2">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Producto terminado</span>
                    <div className="relative">
                      <select
                        value={form.outputProductId}
                        onChange={event => onSelectOutput(event.target.value)}
                        disabled={Boolean(editingRecipe)}
                        className="iq-input appearance-none pr-10 disabled:bg-slate-100 disabled:text-slate-500"
                      >
                        <option value="">Seleccionar producto</option>
                        {outputProducts.map(product => {
                          const used = usedOutputIds.has(String(product.id)) && String(product.id) !== String(editingRecipe?.output_product_id);
                          return (
                            <option key={product.id} value={product.id} disabled={used}>
                              {product.name}{used ? ' · ya tiene receta' : ''}
                            </option>
                          );
                        })}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                  </label>

                  <label className="block lg:col-span-2">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Nombre de la receta</span>
                    <input value={form.name} onChange={event => onUpdateForm('name', event.target.value)} className="iq-input" placeholder="Ej: Fórmula de pan de sal" />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Rendimiento del lote</span>
                    <input type="number" min="0.001" step="0.001" value={form.yieldQuantity} onChange={event => onUpdateForm('yieldQuantity', event.target.value)} className="iq-input" />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Unidad del rendimiento</span>
                    <select value={form.yieldUnit} onChange={event => onUpdateForm('yieldUnit', event.target.value)} className="iq-input">
                      {RECIPE_UNIT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>

                  <label className="block lg:col-span-2">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Notas de elaboración (opcional)</span>
                    <textarea value={form.notes} onChange={event => onUpdateForm('notes', event.target.value)} className="iq-input min-h-24 resize-y" placeholder="Temperatura, tiempos, reposo, orden de mezcla u observaciones..." />
                  </label>
                </div>
              </section>

              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <SectionTitle number="02" title="Ingredientes e insumos" subtitle="La merma incrementa la cantidad y el costo necesario por lote." />
                  <button type="button" onClick={onAddIngredient} className="iq-secondary-button shrink-0">
                    <Plus className="h-4 w-4" /> Agregar ingrediente
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  {form.items.map((item, index) => (
                    <IngredientRow
                      key={item.localId}
                      index={index}
                      item={item}
                      allItems={form.items}
                      ingredientProducts={ingredientProducts}
                      productsById={productsById}
                      costLine={costSummary.lines[index]}
                      onUpdate={(field, value) => onUpdateIngredient(item.localId, field, value)}
                      onRemove={() => onRemoveIngredient(item.localId)}
                    />
                  ))}

                  {form.items.length === 0 && (
                    <button type="button" onClick={onAddIngredient} className="w-full rounded-2xl border border-dashed border-slate-300 p-7 text-sm font-bold text-slate-500 hover:border-cyan-300 hover:bg-cyan-50/40 hover:text-cyan-800">
                      + Agregar el primer ingrediente
                    </button>
                  )}
                </div>
              </section>

              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <SectionTitle number="03" title="Costos adicionales" subtitle="Opcional para mano de obra, energía u otros costos que no se controlan como inventario." />
                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Costo adicional por lote</span>
                    <input type="number" min="0" step="0.01" value={form.additionalCost} onChange={event => onUpdateForm('additionalCost', event.target.value)} className="iq-input" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Detalle del costo</span>
                    <input value={form.additionalCostNotes} onChange={event => onUpdateForm('additionalCostNotes', event.target.value)} className="iq-input" placeholder="Ej: energía y mano de obra" />
                  </label>
                </div>
              </section>
            </div>

            <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
              <section className="rounded-[1.5rem] border border-cyan-100 bg-gradient-to-b from-cyan-50 to-white p-5 shadow-sm">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-cyan-700">
                  <Calculator className="h-4 w-4" /> Costo estimado
                </p>
                <div className="mt-5 space-y-3">
                  <CostRow label="Ingredientes" value={formatRecipeMoney(costSummary.ingredientCost)} />
                  <CostRow label="Costos adicionales" value={formatRecipeMoney(costSummary.additionalCost)} />
                  <div className="border-t border-cyan-100 pt-3">
                    <CostRow label="Costo del lote" value={formatRecipeMoney(costSummary.totalCost)} strong />
                    <CostRow label="Costo por unidad" value={formatRecipeMoney(costSummary.unitCost)} strong />
                  </div>
                </div>
              </section>

              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                  <CircleDollarSign className="h-4 w-4" /> Margen estimado
                </p>
                <div className="mt-4 space-y-3">
                  <CostRow label="Precio de venta" value={formatRecipeMoney(marginSummary.salePrice)} />
                  <CostRow label="Utilidad por unidad" value={formatRecipeMoney(marginSummary.marginValue)} strong />
                  <CostRow label="Margen" value={`${formatRecipeQuantity(marginSummary.marginPercent, 1)}%`} strong />
                </div>
                {selectedOutputProduct && Number(selectedOutputProduct.price || 0) <= 0 && (
                  <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">Registra un precio de venta en Productos para calcular el margen.</p>
                )}
              </section>

              {costSummary.warnings.length > 0 && (
                <section className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5">
                  <p className="flex items-center gap-2 text-sm font-black text-amber-800"><AlertTriangle className="h-4 w-4" /> Observaciones</p>
                  <ul className="mt-3 space-y-2 text-xs font-semibold leading-5 text-amber-800">
                    {costSummary.warnings.slice(0, 5).map(warning => <li key={warning}>• {warning}</li>)}
                  </ul>
                </section>
              )}

              <label className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <div>
                  <p className="font-black text-slate-900">Receta activa</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Estará disponible para la producción por lotes en la siguiente fase.</p>
                </div>
                <input type="checkbox" checked={form.isActive} onChange={event => onUpdateForm('isActive', event.target.checked)} className="h-5 w-5 accent-cyan-600" />
              </label>
            </aside>
          </div>

          <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-slate-100 bg-white/95 p-4 backdrop-blur sm:flex-row sm:justify-end sm:px-6">
            <button type="button" onClick={onClose} disabled={saving} className="iq-secondary-button sm:min-w-32">Cancelar</button>
            <button type="submit" disabled={saving} className="iq-primary-button sm:min-w-44">
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              {saving ? 'Guardando...' : editingRecipe ? 'Actualizar receta' : 'Guardar receta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SectionTitle({ number, title, subtitle }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white">{number}</span>
      <div>
        <h4 className="font-black text-slate-950">{title}</h4>
        <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function IngredientRow({ index, item, allItems, ingredientProducts, productsById, costLine, onUpdate, onRemove }) {
  const selectedProduct = productsById.get(String(item.ingredientProductId));
  const selectedIds = new Set(allItems.filter(row => row.localId !== item.localId).map(row => String(row.ingredientProductId)).filter(Boolean));
  const stockUnit = getProductStockUnit(selectedProduct);
  const productType = selectedProduct ? getBakeryProductType(selectedProduct) : '';

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-black text-slate-800">Ingrediente {index + 1}</p>
        <button type="button" onClick={onRemove} className="rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Quitar ingrediente">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <label className="block lg:col-span-5">
          <span className="mb-2 block text-xs font-bold text-slate-600">Materia prima / insumo</span>
          <select value={item.ingredientProductId} onChange={event => onUpdate('ingredientProductId', event.target.value)} className="iq-input">
            <option value="">Seleccionar</option>
            {ingredientProducts.map(product => (
              <option key={product.id} value={product.id} disabled={selectedIds.has(String(product.id))}>
                {product.name} · {product.category}
              </option>
            ))}
          </select>
        </label>

        <label className="block lg:col-span-2">
          <span className="mb-2 block text-xs font-bold text-slate-600">Cantidad</span>
          <input type="number" min="0.0001" step="0.0001" value={item.quantity} onChange={event => onUpdate('quantity', event.target.value)} className="iq-input" placeholder="0" />
        </label>

        <label className="block lg:col-span-2">
          <span className="mb-2 block text-xs font-bold text-slate-600">Unidad</span>
          <select value={item.unit} onChange={event => onUpdate('unit', event.target.value)} className="iq-input">
            <option value="">Seleccionar</option>
            {RECIPE_UNIT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>

        <label className="block lg:col-span-3">
          <span className="mb-2 block text-xs font-bold text-slate-600">Merma prevista (%)</span>
          <input type="number" min="0" max="100" step="0.1" value={item.wastePercent} onChange={event => onUpdate('wastePercent', event.target.value)} className="iq-input" />
        </label>
      </div>

      {selectedProduct && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <IngredientDetail label="Tipo" value={PRODUCT_TYPE_LABELS[productType] || productType.replaceAll('_', ' ')} />
          <IngredientDetail label="Stock" value={`${formatRecipeQuantity(selectedProduct.stock)} ${stockUnit || 'sin unidad'}`} />
          <IngredientDetail label="Costo unitario" value={formatRecipeMoney(selectedProduct.cost)} />
          <IngredientDetail label="Costo en receta" value={formatRecipeMoney(costLine?.lineCost || 0)} />
        </div>
      )}

      <label className="mt-3 block">
        <span className="mb-2 block text-xs font-bold text-slate-600">Nota del ingrediente (opcional)</span>
        <input value={item.notes} onChange={event => onUpdate('notes', event.target.value)} className="iq-input" placeholder="Ej: tamizada, temperatura ambiente, marca específica..." />
      </label>
    </article>
  );
}

function IngredientDetail({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-2.5">
      <p className="font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 truncate font-black capitalize text-slate-700" title={String(value)}>{value}</p>
    </div>
  );
}

function CostRow({ label, value, strong = false }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? 'font-black text-slate-800' : 'text-sm font-semibold text-slate-500'}>{label}</span>
      <span className={strong ? 'text-lg font-black text-slate-950' : 'text-sm font-black text-slate-800'}>{value}</span>
    </div>
  );
}
