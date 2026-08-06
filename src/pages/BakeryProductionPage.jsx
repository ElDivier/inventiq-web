import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpenText,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Loader2,
  PackagePlus,
  Plus,
  Search,
  Wheat,
  ClipboardCheck,
  X,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import {
  formatRecipeMoney,
  formatRecipeQuantity,
} from '../utils/productionRecipes';
import {
  buildProductionPreview,
  formatProductionDate,
  getLocalDateInputValue,
} from '../utils/productionBatches';

const EMPTY_FORM = {
  recipeId: '',
  producedQuantity: '',
  productionDate: getLocalDateInputValue(),
  batchCode: '',
  notes: '',
};

function normalizeRecipe(recipe) {
  return {
    ...recipe,
    items: Array.isArray(recipe?.items) ? recipe.items : [],
  };
}

function normalizeBatch(batch) {
  return {
    ...batch,
    items: Array.isArray(batch?.items) ? batch.items : [],
  };
}

export default function BakeryProductionPage({ currentUser, products, setActive }) {
  const [recipes, setRecipes] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expandedBatchId, setExpandedBatchId] = useState(null);

  const productsById = useMemo(
    () => new Map((products || []).map(product => [String(product.id), product])),
    [products]
  );

  const loadProductionData = useCallback(async (showLoader = true) => {
    if (!currentUser?.id) return;
    if (showLoader) setLoading(true);

    try {
      const [recipesResponse, batchesResponse] = await Promise.all([
        supabase
          .from('production_recipes')
          .select('*, items:production_recipe_items(*)')
          .eq('user_id', currentUser.id)
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase
          .from('production_batches')
          .select('*, items:production_batch_items(*)')
          .eq('user_id', currentUser.id)
          .order('production_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(150),
      ]);

      if (recipesResponse.error) throw recipesResponse.error;
      if (batchesResponse.error) throw batchesResponse.error;

      setRecipes((recipesResponse.data || []).map(normalizeRecipe));
      setBatches((batchesResponse.data || []).map(normalizeBatch));
    } catch (error) {
      console.error('Error cargando producción:', error);
      setNotice({
        type: 'error',
        message: `No se pudo cargar la producción: ${error.message}`,
      });
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    loadProductionData();
  }, [loadProductionData]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;

    const channel = supabase
      .channel(`bakery-production-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_batches',
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => loadProductionData(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, loadProductionData]);

  useEffect(() => {
    const preferredRecipeId = sessionStorage.getItem('inventiq_production_recipe_id');
    if (!preferredRecipeId || recipes.length === 0) return;

    const recipe = recipes.find(item => String(item.id) === String(preferredRecipeId));
    sessionStorage.removeItem('inventiq_production_recipe_id');

    if (recipe) {
      openProduction(recipe.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes]);

  const selectedRecipe = useMemo(
    () => recipes.find(recipe => String(recipe.id) === String(form.recipeId)),
    [recipes, form.recipeId]
  );

  const preview = useMemo(
    () => buildProductionPreview(selectedRecipe, productsById, form.producedQuantity),
    [selectedRecipe, productsById, form.producedQuantity]
  );

  const visibleBatches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return batches;

    return batches.filter(batch => [
      batch.batch_code,
      batch.output_product_name,
      batch.recipe_name,
      batch.notes,
    ].some(value => String(value || '').toLowerCase().includes(term)));
  }, [batches, search]);

  const today = getLocalDateInputValue();
  const batchesToday = batches.filter(batch => batch.production_date === today);
  const costToday = batchesToday.reduce((sum, batch) => sum + Number(batch.total_cost || 0), 0);
  const productsProduced = new Set(batches.map(batch => String(batch.output_product_id))).size;

  function openProduction(recipeId = '') {
    const recipe = recipes.find(item => String(item.id) === String(recipeId));
    setForm({
      ...EMPTY_FORM,
      recipeId: recipe ? String(recipe.id) : '',
      producedQuantity: recipe ? String(recipe.yield_quantity || '') : '',
      productionDate: getLocalDateInputValue(),
    });
    setNotice(null);
    setEditorOpen(true);
  }

  function closeEditor() {
    if (saving) return;
    setEditorOpen(false);
    setForm(EMPTY_FORM);
  }

  function updateForm(field, value) {
    setForm(previous => ({ ...previous, [field]: value }));
  }

  function selectRecipe(recipeId) {
    const recipe = recipes.find(item => String(item.id) === String(recipeId));
    setForm(previous => ({
      ...previous,
      recipeId,
      producedQuantity: recipe ? String(recipe.yield_quantity || '') : '',
    }));
  }

  function validateForm() {
    if (!form.recipeId) return 'Selecciona la receta que se utilizará.';
    if (Number(form.producedQuantity || 0) <= 0) return 'La cantidad elaborada debe ser mayor a cero.';
    if (!form.productionDate) return 'Selecciona la fecha de producción.';
    if (!preview.canProduce) return preview.warnings[0] || 'Revisa existencias y unidades antes de continuar.';
    return null;
  }

  async function registerProduction(event) {
    event.preventDefault();
    const validationError = validateForm();

    if (validationError) {
      setNotice({ type: 'error', message: validationError });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const { data, error } = await supabase.rpc('register_production_batch', {
        p_recipe_id: form.recipeId,
        p_produced_quantity: Number(form.producedQuantity),
        p_production_date: form.productionDate,
        p_notes: form.notes.trim() || null,
        p_batch_code: form.batchCode.trim() || null,
      });

      if (error) throw error;

      await loadProductionData(false);
      setEditorOpen(false);
      setForm(EMPTY_FORM);
      setNotice({
        type: 'success',
        message: `Producción registrada correctamente${data?.batch_code ? ` en el lote ${data.batch_code}` : ''}. El inventario fue actualizado.`,
      });
    } catch (error) {
      console.error('Error registrando producción:', error);
      setNotice({
        type: 'error',
        message: `No se pudo registrar la producción: ${error.message}`,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {notice && !editorOpen && (
        <Notice notice={notice} onClose={() => setNotice(null)} />
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Wheat} label="Lotes registrados" value={batches.length} detail="historial de producción" tone="cyan" />
        <MetricCard icon={CheckCircle2} label="Producción de hoy" value={batchesToday.length} detail="lotes completados" tone="emerald" />
        <MetricCard icon={CircleDollarSign} label="Costo de hoy" value={formatRecipeMoney(costToday)} detail="materias primas y adicionales" tone="amber" />
        <MetricCard icon={PackagePlus} label="Productos elaborados" value={productsProduced} detail="productos con producción" tone="violet" />
      </section>

      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 p-5 text-white sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                <Wheat className="h-4 w-4" /> Producción por lotes
              </p>
              <h3 className="mt-2 text-2xl font-black sm:text-3xl">Convierte materias primas en producto terminado</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                InventIQ verifica las existencias, descuenta los ingredientes y aumenta el stock del producto terminado en una sola operación.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button type="button" onClick={() => setActive('Recetas')} className="iq-secondary-button border-white/20 bg-white/10 text-white hover:bg-white/20">
                <BookOpenText className="h-5 w-5" /> Revisar recetas
              </button>
              <button type="button" onClick={() => setActive('Mermas')} className="iq-secondary-button border-white/20 bg-white/10 text-white hover:bg-white/20">
                <ClipboardCheck className="h-5 w-5" /> Mermas y ajustes
              </button>
              <button type="button" onClick={() => openProduction()} className="iq-primary-button bg-white text-slate-950 hover:bg-cyan-50">
                <Plus className="h-5 w-5" /> Registrar producción
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <label className="relative block w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              className="iq-input pl-11"
              placeholder="Buscar por lote o producto"
            />
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="font-black text-slate-900">{recipes.length}</span> receta(s) activa(s) disponibles
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex min-h-56 items-center justify-center rounded-[1.75rem] border border-slate-200 bg-white">
          <Loader2 className="h-7 w-7 animate-spin text-cyan-600" />
        </div>
      ) : recipes.length === 0 ? (
        <EmptyProduction onGoRecipes={() => setActive('Recetas')} />
      ) : batches.length === 0 ? (
        <FirstProduction recipes={recipes} productsById={productsById} onCreate={openProduction} />
      ) : visibleBatches.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-10 text-center">
          <Search className="mx-auto h-8 w-8 text-slate-300" />
          <h3 className="mt-3 text-lg font-black text-slate-900">No encontramos lotes</h3>
          <p className="mt-1 text-sm text-slate-500">Cambia el término de búsqueda.</p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <h3 className="text-lg font-black text-slate-950">Historial de producción</h3>
            <p className="mt-1 text-sm text-slate-500">Cada lote conserva las cantidades, costos y movimientos de inventario aplicados.</p>
          </div>

          <div className="divide-y divide-slate-100">
            {visibleBatches.map(batch => (
              <BatchRow
                key={batch.id}
                batch={batch}
                expanded={expandedBatchId === batch.id}
                onToggle={() => setExpandedBatchId(previous => previous === batch.id ? null : batch.id)}
              />
            ))}
          </div>
        </section>
      )}

      {editorOpen && (
        <ProductionEditor
          form={form}
          recipes={recipes}
          selectedRecipe={selectedRecipe}
          productsById={productsById}
          preview={preview}
          notice={notice}
          saving={saving}
          onClose={closeEditor}
          onSave={registerProduction}
          onUpdateForm={updateForm}
          onSelectRecipe={selectRecipe}
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
    violet: 'bg-violet-50 text-violet-700',
  };

  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tones[tone] || tones.cyan}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 truncate text-3xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate-400">{detail}</p>
    </article>
  );
}

function EmptyProduction({ onGoRecipes }) {
  return (
    <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-8 text-center sm:p-10">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-50 text-amber-700">
        <BookOpenText className="h-8 w-8" />
      </div>
      <h3 className="mt-5 text-2xl font-black text-slate-950">Primero necesitas una receta activa</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
        La producción utiliza una fórmula para calcular las materias primas, el rendimiento y el costo del lote.
      </p>
      <button type="button" onClick={onGoRecipes} className="iq-primary-button mt-6">
        <BookOpenText className="h-5 w-5" /> Ir a Recetas
      </button>
    </section>
  );
}

function FirstProduction({ recipes, productsById, onCreate }) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="max-w-2xl">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Todo listo para iniciar</p>
        <h3 className="mt-2 text-2xl font-black text-slate-950">Registra el primer lote de producción</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Selecciona una receta, confirma la cantidad realmente elaborada y revisa el consumo de ingredientes antes de guardar.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {recipes.slice(0, 6).map(recipe => {
          const output = productsById.get(String(recipe.output_product_id));
          return (
            <button
              type="button"
              key={recipe.id}
              onClick={() => onCreate(recipe.id)}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-cyan-300 hover:bg-cyan-50"
            >
              <p className="font-black text-slate-900">{output?.name || recipe.name}</p>
              <p className="mt-1 text-sm text-slate-500">Rendimiento: {formatRecipeQuantity(recipe.yield_quantity)} {recipe.yield_unit}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function BatchRow({ batch, expanded, onToggle }) {
  return (
    <article>
      <button type="button" onClick={onToggle} className="grid w-full grid-cols-1 gap-4 px-5 py-5 text-left hover:bg-slate-50 sm:px-6 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(110px,0.65fr))_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Completado</span>
            <span className="text-xs font-black uppercase tracking-wide text-slate-400">{batch.batch_code}</span>
          </div>
          <p className="mt-2 truncate text-base font-black text-slate-950">{batch.output_product_name}</p>
          <p className="mt-1 truncate text-sm text-slate-500">{batch.recipe_name}</p>
        </div>

        <BatchValue label="Fecha" value={formatProductionDate(batch.production_date)} />
        <BatchValue label="Elaborado" value={`${formatRecipeQuantity(batch.produced_quantity)} ${batch.produced_unit}`} />
        <BatchValue label="Costo total" value={formatRecipeMoney(batch.total_cost)} />
        <BatchValue label="Costo unitario" value={formatRecipeMoney(batch.unit_cost)} />

        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-5 sm:px-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-black text-slate-900">Materias primas consumidas</p>
              </div>
              <div className="divide-y divide-slate-100">
                {(batch.items || []).map(item => (
                  <div key={item.id} className="grid grid-cols-1 gap-2 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_repeat(3,minmax(100px,0.55fr))] sm:items-center">
                    <p className="font-bold text-slate-900">{item.ingredient_name}</p>
                    <p className="text-slate-500"><span className="font-bold text-slate-700">Consumo:</span> {formatRecipeQuantity(item.stock_quantity)} {item.stock_unit}</p>
                    <p className="text-slate-500"><span className="font-bold text-slate-700">Stock final:</span> {formatRecipeQuantity(item.stock_after)} {item.stock_unit}</p>
                    <p className="font-black text-slate-900 sm:text-right">{formatRecipeMoney(item.total_cost)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Resumen del lote</p>
              <SummaryLine label="Ingredientes" value={formatRecipeMoney(batch.ingredient_cost)} />
              <SummaryLine label="Costos adicionales" value={formatRecipeMoney(batch.additional_cost)} />
              <SummaryLine label="Ingreso a stock" value={`${formatRecipeQuantity(batch.output_stock_quantity)} ${batch.output_stock_unit}`} />
              <div className="mt-3 border-t border-slate-100 pt-3">
                <SummaryLine label="Costo total" value={formatRecipeMoney(batch.total_cost)} strong />
              </div>
              {batch.notes && (
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-600">
                  <span className="font-black text-slate-800">Notas:</span> {batch.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function BatchValue({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function SummaryLine({ label, value, strong = false }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 text-sm">
      <span className={strong ? 'font-black text-slate-900' : 'font-semibold text-slate-500'}>{label}</span>
      <span className={strong ? 'text-base font-black text-slate-950' : 'font-black text-slate-900'}>{value}</span>
    </div>
  );
}

function ProductionEditor({
  form,
  recipes,
  selectedRecipe,
  productsById,
  preview,
  notice,
  saving,
  onClose,
  onSave,
  onUpdateForm,
  onSelectRecipe,
  onClearNotice,
}) {
  const outputProduct = selectedRecipe
    ? productsById.get(String(selectedRecipe.output_product_id))
    : null;

  return (
    <div className="iq-modal-overlay z-50">
      <div className="iq-modal-card max-h-[94vh] w-full max-w-6xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-700">
              <Wheat className="h-4 w-4" /> Nuevo lote
            </p>
            <h3 className="mt-2 text-2xl font-black text-slate-950">Registrar producción</h3>
            <p className="mt-1 text-sm text-slate-500">Confirma la cantidad elaborada antes de actualizar el inventario.</p>
          </div>
          <button type="button" onClick={onClose} className="iq-action-icon" aria-label="Cerrar formulario">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSave} className="max-h-[calc(94vh-105px)] overflow-y-auto">
          <div className="grid grid-cols-1 gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)]">
            <div className="space-y-5">
              {notice && <Notice notice={notice} onClose={onClearNotice} />}

              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <SectionTitle number="01" title="Datos del lote" subtitle="Selecciona la fórmula y registra la producción real." />

                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <label className="block lg:col-span-2">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Receta de producción</span>
                    <select value={form.recipeId} onChange={event => onSelectRecipe(event.target.value)} className="iq-input">
                      <option value="">Seleccionar receta</option>
                      {recipes.map(recipe => {
                        const product = productsById.get(String(recipe.output_product_id));
                        return (
                          <option key={recipe.id} value={recipe.id}>
                            {product?.name || recipe.name} · {formatRecipeQuantity(recipe.yield_quantity)} {recipe.yield_unit}
                          </option>
                        );
                      })}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Cantidad realmente elaborada</span>
                    <div className="relative">
                      <input
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={form.producedQuantity}
                        onChange={event => onUpdateForm('producedQuantity', event.target.value)}
                        className="iq-input pr-24"
                        placeholder="0"
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                        {selectedRecipe?.yield_unit || 'unidad'}
                      </span>
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Fecha de producción</span>
                    <input type="date" value={form.productionDate} onChange={event => onUpdateForm('productionDate', event.target.value)} className="iq-input" />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Código del lote (opcional)</span>
                    <input value={form.batchCode} onChange={event => onUpdateForm('batchCode', event.target.value.toUpperCase())} className="iq-input" placeholder="Se genera automáticamente" />
                  </label>

                  <label className="block lg:col-span-2">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Observaciones (opcional)</span>
                    <textarea value={form.notes} onChange={event => onUpdateForm('notes', event.target.value)} className="iq-input min-h-24 resize-y" placeholder="Turno, responsable, variación del rendimiento u observaciones del lote..." />
                  </label>
                </div>
              </section>

              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <SectionTitle number="02" title="Consumo previsto" subtitle="Las cantidades incluyen la merma definida en la receta." />

                {!selectedRecipe ? (
                  <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    Selecciona una receta para revisar las materias primas.
                  </div>
                ) : (
                  <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                    <div className="divide-y divide-slate-100">
                      {preview.lines.map(line => (
                        <div key={line.id} className="grid grid-cols-1 gap-3 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_repeat(3,minmax(110px,0.65fr))] sm:items-center">
                          <div>
                            <p className="font-black text-slate-900">{line.ingredient?.name || 'Ingrediente no disponible'}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-400">
                              {line.wastePercent > 0 ? `${formatRecipeQuantity(line.wastePercent, 2)}% de merma incluida` : 'Sin merma adicional'}
                            </p>
                          </div>
                          <PreviewValue label="Requerido" value={line.stockQuantity === null ? 'Unidad incompatible' : `${formatRecipeQuantity(line.stockQuantity)} ${line.stockUnit}`} />
                          <PreviewValue label="Disponible" value={`${formatRecipeQuantity(line.stock)} ${line.stockUnit}`} />
                          <div className="sm:text-right">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${
                              line.available ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                            }`}>
                              {line.available ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                              {line.available ? 'Disponible' : 'Insuficiente'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {preview.warnings.length > 0 && selectedRecipe && (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    <p className="flex items-center gap-2 font-black"><AlertTriangle className="h-4 w-4" /> Antes de registrar</p>
                    <ul className="mt-2 space-y-1 pl-5">
                      {preview.warnings.map((warning, index) => <li key={`${warning}-${index}`} className="list-disc">{warning}</li>)}
                    </ul>
                  </div>
                )}
              </section>
            </div>

            <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
              <section className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
                  <Calculator className="h-4 w-4" /> Resumen de producción
                </p>
                <h4 className="mt-3 text-xl font-black">{outputProduct?.name || 'Producto terminado'}</h4>
                <p className="mt-1 text-sm text-slate-400">{selectedRecipe?.name || 'Selecciona una receta'}</p>

                <div className="mt-5 space-y-3">
                  <CostLine label="Cantidad elaborada" value={selectedRecipe ? `${formatRecipeQuantity(form.producedQuantity)} ${selectedRecipe.yield_unit}` : '—'} />
                  <CostLine label="Ingreso al inventario" value={preview.outputStockQuantity > 0 ? `${formatRecipeQuantity(preview.outputStockQuantity)} ${preview.outputStockUnit}` : '—'} />
                  <CostLine label="Costo de ingredientes" value={formatRecipeMoney(preview.ingredientCost)} />
                  <CostLine label="Costos adicionales" value={formatRecipeMoney(preview.additionalCost)} />
                </div>

                <div className="mt-5 border-t border-white/10 pt-5">
                  <CostLine label="Costo total del lote" value={formatRecipeMoney(preview.totalCost)} strong />
                  <CostLine label="Costo por unidad de stock" value={formatRecipeMoney(preview.unitCost)} />
                </div>
              </section>

              <div className={`rounded-[1.5rem] border p-4 text-sm ${
                preview.canProduce
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}>
                <p className="flex items-center gap-2 font-black">
                  {preview.canProduce ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  {preview.canProduce ? 'Inventario suficiente' : 'Pendiente de validación'}
                </p>
                <p className="mt-1 leading-5">
                  {preview.canProduce
                    ? 'Al guardar se descontarán los ingredientes y se aumentará el producto terminado.'
                    : 'Completa los datos y corrige cualquier alerta antes de registrar.'}
                </p>
              </div>
            </aside>
          </div>

          <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-slate-100 bg-white/95 p-4 backdrop-blur sm:flex-row sm:justify-end sm:px-6">
            <button type="button" onClick={onClose} disabled={saving} className="iq-secondary-button">Cancelar</button>
            <button type="submit" disabled={saving || !preview.canProduce} className="iq-primary-button disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <PackagePlus className="h-5 w-5" />}
              {saving ? 'Registrando...' : 'Confirmar producción'}
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
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white">{number}</span>
      <div>
        <h4 className="font-black text-slate-950">{title}</h4>
        <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function PreviewValue({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function CostLine({ label, value, strong = false }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? 'font-black text-white' : 'text-sm font-semibold text-slate-400'}>{label}</span>
      <span className={strong ? 'text-xl font-black text-white' : 'text-sm font-black text-white'}>{value}</span>
    </div>
  );
}
