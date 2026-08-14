import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  Boxes,
  ChefHat,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  ClipboardCheck,
  CookingPot,
  Loader2,
  PackageCheck,
  PackageSearch,
  Plus,
  RefreshCcw,
  Scale,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import {
  buildRestaurantPreparationPreview,
  fetchRestaurantInventoryData,
  formatInventoryDate,
  formatInventoryMoney,
  formatInventoryQuantity,
  getLocalDateValue,
  getRestaurantInternalProducts,
  registerRestaurantPreparationBatch,
  registerRestaurantStockAdjustment,
  RESTAURANT_COUNT_REASONS,
  RESTAURANT_WASTE_REASONS,
  subscribeRestaurantInventory,
} from '../utils/restaurantInventory';
import { getProductStockUnit } from '../utils/productionRecipes';
import { isRestaurantPreparation } from '../utils/restaurantMenu';
import { hasRestaurantPermission } from '../utils/restaurantPermissions';
import { auditRestaurantAction } from '../utils/restaurantStaff';

const TABS = [
  { value: 'resumen', label: 'Resumen', icon: Boxes },
  { value: 'preparaciones', label: 'Preparaciones', icon: CookingPot },
  { value: 'mermas', label: 'Mermas y conteos', icon: ClipboardCheck },
];

const EMPTY_PREPARATION_FORM = {
  recipeId: '',
  producedQuantity: '',
  productionDate: getLocalDateValue(),
  batchCode: '',
  notes: '',
};

const EMPTY_ADJUSTMENT_FORM = {
  kind: 'waste',
  productId: '',
  quantity: '',
  eventDate: getLocalDateValue(),
  reasonCode: '',
  notes: '',
  batchId: '',
};

export default function RestaurantInventoryPage({ currentUser, products = [], setActive }) {
  const canAdjustInventory = hasRestaurantPermission(currentUser, 'inventory.adjust');
  const [activeTab, setActiveTab] = useState('resumen');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [data, setData] = useState({
    consumptions: [],
    issues: [],
    adjustments: [],
    recipes: [],
    batches: [],
  });
  const [search, setSearch] = useState('');
  const [preparationOpen, setPreparationOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [preparationForm, setPreparationForm] = useState(EMPTY_PREPARATION_FORM);
  const [adjustmentForm, setAdjustmentForm] = useState(EMPTY_ADJUSTMENT_FORM);
  const [expandedBatch, setExpandedBatch] = useState(null);

  const productsById = useMemo(
    () => new Map(products.map(product => [String(product.id), product])),
    [products]
  );

  const internalProducts = useMemo(() => getRestaurantInternalProducts(products), [products]);
  const preparationRecipes = useMemo(
    () => data.recipes.filter(recipe => isRestaurantPreparation(productsById.get(String(recipe.output_product_id)))),
    [data.recipes, productsById]
  );

  const loadData = useCallback(async (showLoader = true) => {
    if (!currentUser?.id) return;
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    try {
      const response = await fetchRestaurantInventoryData(currentUser.id);
      setData(response);
    } catch (error) {
      console.error('Error cargando inventario gastronómico:', error);
      setNotice({ type: 'error', message: `No se pudo cargar el control gastronómico: ${error.message}` });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;
    return subscribeRestaurantInventory(currentUser.id, () => loadData(false));
  }, [currentUser?.id, loadData]);

  const todayKey = getLocalDateValue();
  const monthKey = todayKey.slice(0, 7);
  const currentMonthConsumptions = data.consumptions.filter(item => String(item.consumedAt || '').startsWith(monthKey) && !item.reversedAt);
  const currentMonthAdjustments = data.adjustments.filter(item => String(item.eventDate || '').startsWith(monthKey));
  const consumptionCost = currentMonthConsumptions.reduce((sum, item) => sum + item.theoreticalCost, 0);
  const shortageLines = currentMonthConsumptions.filter(item => item.shortageQuantity > 0);
  const openIssues = data.issues.filter(item => !item.resolvedAt);
  const wasteImpact = currentMonthAdjustments
    .filter(item => item.kind === 'waste')
    .reduce((sum, item) => sum + item.costImpact, 0);
  const criticalProducts = internalProducts.filter(product => Number(product.stock || 0) <= Number(product.minStock || 0));
  const inventoryValue = internalProducts.reduce((sum, product) => sum + (Number(product.stock || 0) * Number(product.cost || 0)), 0);

  const recentConsumptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = data.consumptions.filter(item => !item.reversedAt);
    if (!term) return rows.slice(0, 80);
    return rows.filter(item => [
      item.menuProductName,
      item.ingredientName,
      item.sourceKind,
    ].some(value => String(value || '').toLowerCase().includes(term))).slice(0, 80);
  }, [data.consumptions, search]);

  const selectedPreparationRecipe = useMemo(
    () => preparationRecipes.find(recipe => String(recipe.id) === String(preparationForm.recipeId)),
    [preparationRecipes, preparationForm.recipeId]
  );
  const preparationPreview = useMemo(
    () => buildRestaurantPreparationPreview(selectedPreparationRecipe, productsById, preparationForm.producedQuantity),
    [selectedPreparationRecipe, productsById, preparationForm.producedQuantity]
  );

  const selectedAdjustmentProduct = useMemo(
    () => internalProducts.find(product => String(product.id) === String(adjustmentForm.productId)),
    [internalProducts, adjustmentForm.productId]
  );
  const adjustmentQuantity = Number(adjustmentForm.quantity || 0);
  const adjustmentCurrentStock = Number(selectedAdjustmentProduct?.stock || 0);
  const adjustmentDelta = adjustmentForm.kind === 'waste'
    ? -adjustmentQuantity
    : adjustmentQuantity - adjustmentCurrentStock;
  const adjustmentStockAfter = adjustmentCurrentStock + adjustmentDelta;
  const adjustmentUnit = getProductStockUnit(selectedAdjustmentProduct) || 'unidad';
  const adjustmentReasons = adjustmentForm.kind === 'waste' ? RESTAURANT_WASTE_REASONS : RESTAURANT_COUNT_REASONS;
  const relatedBatches = data.batches.filter(batch => String(batch.outputProductId) === String(adjustmentForm.productId));

  function openPreparation(recipeId = '') {
    const recipe = preparationRecipes.find(item => String(item.id) === String(recipeId));
    setPreparationForm({
      ...EMPTY_PREPARATION_FORM,
      recipeId: recipe ? String(recipe.id) : '',
      producedQuantity: recipe ? String(recipe.yield_quantity || '') : '',
      productionDate: getLocalDateValue(),
    });
    setNotice(null);
    setPreparationOpen(true);
  }

  function openAdjustment(kind = 'waste') {
    if (!canAdjustInventory) {
      setNotice({ type: 'error', message: 'El operador actual no tiene permiso para registrar mermas o conteos.' });
      return;
    }
    setAdjustmentForm({ ...EMPTY_ADJUSTMENT_FORM, kind, eventDate: getLocalDateValue() });
    setNotice(null);
    setAdjustmentOpen(true);
  }

  async function savePreparation(event) {
    event.preventDefault();
    if (!canAdjustInventory) {
      setNotice({ type: 'error', message: 'El operador actual no tiene permiso para registrar producción interna.' });
      return;
    }
    if (!preparationForm.recipeId) {
      setNotice({ type: 'error', message: 'Selecciona la preparación que vas a elaborar.' });
      return;
    }
    if (!preparationPreview.canProduce) {
      setNotice({ type: 'error', message: preparationPreview.warnings[0] || 'Revisa existencias y unidades.' });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const response = await registerRestaurantPreparationBatch(preparationForm);
      await auditRestaurantAction(currentUser, 'inventory.preparation_batch', 'production_batch', response?.batch_id || response?.id || preparationForm.recipeId, { recipeId: preparationForm.recipeId, quantity: Number(preparationForm.producedQuantity || 0), batchCode: response?.batch_code || '' });
      await loadData(false);
      setPreparationOpen(false);
      setPreparationForm(EMPTY_PREPARATION_FORM);
      setNotice({
        type: 'success',
        message: `Preparación registrada${response?.batch_code ? ` en el lote ${response.batch_code}` : ''}. Se descontaron sus componentes y aumentó el stock elaborado.`,
      });
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo registrar la preparación: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function saveAdjustment(event) {
    event.preventDefault();
    if (!canAdjustInventory) {
      setNotice({ type: 'error', message: 'El operador actual no tiene permiso para ajustar inventario.' });
      return;
    }
    if (!adjustmentForm.productId) {
      setNotice({ type: 'error', message: 'Selecciona el insumo o preparación.' });
      return;
    }
    if (!adjustmentForm.reasonCode) {
      setNotice({ type: 'error', message: 'Selecciona el motivo del registro.' });
      return;
    }
    if (adjustmentForm.kind === 'waste' && (adjustmentQuantity <= 0 || adjustmentStockAfter < 0)) {
      setNotice({ type: 'error', message: 'La merma debe ser mayor a cero y no puede superar el stock disponible.' });
      return;
    }
    if (adjustmentForm.kind === 'physical_count' && (adjustmentForm.quantity === '' || adjustmentQuantity < 0 || Math.abs(adjustmentDelta) < 0.000001)) {
      setNotice({ type: 'error', message: 'Ingresa un conteo distinto al stock registrado.' });
      return;
    }

    const reason = adjustmentReasons.find(([code]) => code === adjustmentForm.reasonCode);
    setSaving(true);
    setNotice(null);
    try {
      const response = await registerRestaurantStockAdjustment({
        ...adjustmentForm,
        reasonLabel: reason?.[1] || adjustmentForm.reasonCode,
      });
      await loadData(false);
      setAdjustmentOpen(false);
      setAdjustmentForm(EMPTY_ADJUSTMENT_FORM);
      await auditRestaurantAction(currentUser, adjustmentForm.kind === 'waste' ? 'inventory.waste_registered' : 'inventory.physical_count', 'product', adjustmentForm.productId, { reason: reason?.[1] || adjustmentForm.reasonCode, quantity: adjustmentQuantity });
      setNotice({
        type: 'success',
        message: adjustmentForm.kind === 'waste'
          ? `Merma registrada. El stock de ${response?.product_name || selectedAdjustmentProduct?.name || 'producto'} fue actualizado.`
          : `Conteo aplicado. Diferencia: ${Number(response?.quantity_delta || 0) > 0 ? '+' : ''}${formatInventoryQuantity(response?.quantity_delta || 0)} ${response?.unit || adjustmentUnit}.`,
      });
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo guardar el ajuste: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {notice && !preparationOpen && !adjustmentOpen && <Notice notice={notice} onClose={() => setNotice(null)} />}

      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 p-5 text-white sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
                <ChefHat className="h-4 w-4" /> Control gastronómico
              </p>
              <h2 className="mt-2 text-2xl font-black sm:text-3xl">Del plato vendido al ingrediente consumido</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                InventIQ descuenta ingredientes al cerrar la cuenta, controla preparaciones internas y registra mermas sin mezclar insumos con productos de venta.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {canAdjustInventory && <button type="button" onClick={() => openPreparation()} className="iq-secondary-button border-white/20 bg-white/10 text-white hover:bg-white/20">
                <CookingPot className="h-5 w-5" /> Elaborar preparación
              </button>}
              {canAdjustInventory && <button type="button" onClick={() => openAdjustment('waste')} className="iq-primary-button bg-white text-slate-950 hover:bg-emerald-50">
                <Plus className="h-5 w-5" /> Registrar merma
              </button>}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition ${active ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  <Icon className="h-4 w-4" /> {tab.label}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => loadData(false)} disabled={refreshing} className="iq-secondary-button justify-center">
            <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>
      </section>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-[1.75rem] border border-slate-200 bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : activeTab === 'resumen' ? (
        <OverviewTab
          internalProducts={internalProducts}
          criticalProducts={criticalProducts}
          inventoryValue={inventoryValue}
          consumptionCost={consumptionCost}
          shortageLines={shortageLines}
          openIssues={openIssues}
          wasteImpact={wasteImpact}
          consumptions={recentConsumptions}
          search={search}
          onSearch={setSearch}
          onOpenPreparation={() => openPreparation()}
          onOpenAdjustment={() => openAdjustment('physical_count')}
          setActive={setActive}
        />
      ) : activeTab === 'preparaciones' ? (
        <PreparationsTab
          recipes={preparationRecipes}
          productsById={productsById}
          batches={data.batches}
          expandedBatch={expandedBatch}
          onToggleBatch={setExpandedBatch}
          onOpenPreparation={openPreparation}
          onGoRecipes={() => setActive('Recetas')}
        />
      ) : (
        <AdjustmentsTab
          adjustments={data.adjustments}
          onWaste={() => openAdjustment('waste')}
          onCount={() => openAdjustment('physical_count')}
        />
      )}

      {preparationOpen && (
        <PreparationModal
          recipes={preparationRecipes}
          productsById={productsById}
          form={preparationForm}
          preview={preparationPreview}
          notice={notice}
          saving={saving}
          onClose={() => !saving && setPreparationOpen(false)}
          onSave={savePreparation}
          onUpdate={(field, value) => setPreparationForm(previous => ({
            ...previous,
            [field]: value,
            ...(field === 'recipeId' ? {
              producedQuantity: String(preparationRecipes.find(item => String(item.id) === String(value))?.yield_quantity || ''),
            } : {}),
          }))}
          onClearNotice={() => setNotice(null)}
        />
      )}

      {adjustmentOpen && (
        <AdjustmentModal
          products={internalProducts}
          batches={relatedBatches}
          form={adjustmentForm}
          selectedProduct={selectedAdjustmentProduct}
          currentStock={adjustmentCurrentStock}
          stockAfter={adjustmentStockAfter}
          delta={adjustmentDelta}
          unit={adjustmentUnit}
          reasons={adjustmentReasons}
          notice={notice}
          saving={saving}
          onClose={() => !saving && setAdjustmentOpen(false)}
          onSave={saveAdjustment}
          onUpdate={(field, value) => setAdjustmentForm(previous => ({
            ...previous,
            [field]: value,
            ...(field === 'kind' ? { reasonCode: '', quantity: '', batchId: '' } : {}),
            ...(field === 'productId' ? { batchId: '' } : {}),
          }))}
          onClearNotice={() => setNotice(null)}
        />
      )}
    </div>
  );
}

function OverviewTab({
  internalProducts,
  criticalProducts,
  inventoryValue,
  consumptionCost,
  shortageLines,
  openIssues,
  wasteImpact,
  consumptions,
  search,
  onSearch,
  onOpenPreparation,
  onOpenAdjustment,
  setActive,
}) {
  const ingredientCount = internalProducts.filter(product => !isRestaurantPreparation(product)).length;
  const preparationCount = internalProducts.filter(isRestaurantPreparation).length;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={CircleDollarSign} label="Consumo del mes" value={formatInventoryMoney(consumptionCost)} detail="costo teórico de recetas" tone="emerald" />
        <MetricCard icon={PackageSearch} label="Stock crítico" value={criticalProducts.length} detail="insumos y preparaciones" tone="amber" />
        <MetricCard icon={TriangleAlert} label="Faltantes detectados" value={shortageLines.length + openIssues.length} detail="revisar recetas o existencias" tone="rose" />
        <MetricCard icon={Trash2} label="Mermas del mes" value={formatInventoryMoney(wasteImpact)} detail="impacto económico estimado" tone="violet" />
      </section>

      {(shortageLines.length > 0 || openIssues.length > 0) && (
        <section className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
            <div>
              <h3 className="font-black text-amber-950">Hay consumos que requieren revisión</h3>
              <p className="mt-1 text-sm leading-6 text-amber-800">
                Se detectaron {shortageLines.length} faltantes de stock y {openIssues.length} productos con recetas incompletas o unidades incompatibles. El cobro no se bloqueó; InventIQ dejó el detalle para corregirlo.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
        <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-950">Consumo reciente</h3>
              <p className="mt-1 text-sm text-slate-500">Ingredientes y preparaciones descontados al cerrar cuentas.</p>
            </div>
            <label className="relative block sm:w-72">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={event => onSearch(event.target.value)} className="iq-input pl-10" placeholder="Buscar plato o insumo" />
            </label>
          </div>
          {consumptions.length === 0 ? (
            <EmptyBlock icon={ArrowDownToLine} title="Todavía no hay consumos" description="Los movimientos aparecerán cuando se cierre una cuenta con recetas activas." />
          ) : (
            <div className="divide-y divide-slate-100">
              {consumptions.map(item => (
                <div key={item.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-slate-900">{item.ingredientName}</p>
                      <KindBadge kind={item.sourceKind} />
                      {item.shortageQuantity > 0 && <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-black text-red-700">Faltante</span>}
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-500">{item.menuProductName} · {formatInventoryDate(item.consumedAt, true)}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-black text-slate-950">-{formatInventoryQuantity(item.appliedQuantity)} {item.stockUnit}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{formatInventoryMoney(item.theoreticalCost)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-slate-950">Inventario interno</h3>
                <p className="mt-1 text-sm text-slate-500">Valor actual: {formatInventoryMoney(inventoryValue)}</p>
              </div>
              <Boxes className="h-7 w-7 text-emerald-600" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <SmallStat label="Insumos y empaques" value={ingredientCount} />
              <SmallStat label="Preparaciones" value={preparationCount} />
            </div>
            <button type="button" onClick={() => setActive('Inventario')} className="iq-secondary-button mt-4 w-full justify-center">
              Ver inventario general
            </button>
          </section>

          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-black text-slate-950">Acciones recomendadas</h3>
            <div className="mt-4 space-y-2">
              <ActionButton icon={CookingPot} label="Elaborar preparación" onClick={onOpenPreparation} />
              <ActionButton icon={Scale} label="Registrar conteo físico" onClick={onOpenAdjustment} />
              <ActionButton icon={PackageSearch} label="Revisar compras" onClick={() => setActive('Compras')} />
              <ActionButton icon={ChefHat} label="Revisar recetas" onClick={() => setActive('Recetas')} />
            </div>
          </section>

          {criticalProducts.length > 0 && (
            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-black text-slate-950">Stock crítico</h3>
              <div className="mt-3 space-y-3">
                {criticalProducts.slice(0, 5).map(product => (
                  <div key={product.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-800">{product.name}</p>
                      <p className="text-xs text-slate-500">Mínimo: {formatInventoryQuantity(product.minStock)} {getProductStockUnit(product) || 'unidad'}</p>
                    </div>
                    <span className="shrink-0 text-sm font-black text-amber-700">{formatInventoryQuantity(product.stock)} {getProductStockUnit(product) || 'u.'}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}

function PreparationsTab({ recipes, productsById, batches, expandedBatch, onToggleBatch, onOpenPreparation, onGoRecipes }) {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-950">Preparaciones disponibles</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">Salsas, fondos, masas y bases que se elaboran antes del servicio.</p>
            </div>
            <CookingPot className="h-7 w-7 text-emerald-600" />
          </div>
          {recipes.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-center">
              <p className="font-black text-slate-800">No hay preparaciones con receta</p>
              <p className="mt-1 text-sm text-slate-500">Crea primero una preparación interna y su receta gastronómica.</p>
              <button type="button" onClick={onGoRecipes} className="iq-primary-button mt-4 justify-center">Crear receta</button>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {recipes.map(recipe => {
                const product = productsById.get(String(recipe.output_product_id));
                return (
                  <button key={recipe.id} type="button" onClick={() => onOpenPreparation(recipe.id)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40">
                    <div className="min-w-0">
                      <p className="truncate font-black text-slate-900">{product?.name || recipe.name}</p>
                      <p className="mt-1 text-sm text-slate-500">Rinde {formatInventoryQuantity(recipe.yield_quantity)} {recipe.yield_unit}</p>
                    </div>
                    <Plus className="h-5 w-5 shrink-0 text-emerald-600" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h3 className="text-lg font-black text-slate-950">Historial de preparaciones</h3>
            <p className="mt-1 text-sm text-slate-500">Lotes elaborados, costos y componentes consumidos.</p>
          </div>
          {batches.length === 0 ? (
            <EmptyBlock icon={PackageCheck} title="Aún no hay lotes" description="Registra la primera preparación para ver su trazabilidad." />
          ) : (
            <div className="divide-y divide-slate-100">
              {batches.map(batch => {
                const expanded = expandedBatch === batch.id;
                return (
                  <div key={batch.id}>
                    <button type="button" onClick={() => onToggleBatch(expanded ? null : batch.id)} className="grid w-full gap-3 px-5 py-4 text-left sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                      <div>
                        <p className="font-black text-slate-900">{batch.outputProductName}</p>
                        <p className="mt-1 text-sm text-slate-500">{batch.batchCode} · {formatInventoryDate(batch.productionDate)}</p>
                      </div>
                      <div className="sm:text-right">
                        <p className="font-black text-slate-900">+{formatInventoryQuantity(batch.outputStockQuantity)} {batch.outputStockUnit}</p>
                        <p className="text-xs font-bold text-slate-500">{formatInventoryMoney(batch.totalCost)}</p>
                      </div>
                      {expanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                    </button>
                    {expanded && (
                      <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <SmallStat label="Cantidad elaborada" value={`${formatInventoryQuantity(batch.producedQuantity)} ${batch.producedUnit}`} />
                          <SmallStat label="Costo unitario" value={formatInventoryMoney(batch.unitCost)} />
                          <SmallStat label="Costo total" value={formatInventoryMoney(batch.totalCost)} />
                        </div>
                        <div className="mt-4 space-y-2">
                          {batch.items.map(item => (
                            <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-3 text-sm">
                              <span className="font-bold text-slate-700">{item.ingredientName}</span>
                              <span className="font-black text-slate-900">-{formatInventoryQuantity(item.stockQuantity)} {item.stockUnit}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function AdjustmentsTab({ adjustments, onWaste, onCount }) {
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-950">Historial de mermas y conteos</h3>
          <p className="mt-1 text-sm text-slate-500">Cada registro conserva stock anterior, diferencia, costo y motivo.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onCount} className="iq-secondary-button justify-center"><Scale className="h-5 w-5" /> Conteo físico</button>
          <button type="button" onClick={onWaste} className="iq-primary-button justify-center"><Trash2 className="h-5 w-5" /> Registrar merma</button>
        </div>
      </div>
      {adjustments.length === 0 ? (
        <EmptyBlock icon={ClipboardCheck} title="No hay movimientos registrados" description="Las mermas y diferencias de conteo aparecerán aquí." />
      ) : (
        <div className="divide-y divide-slate-100">
          {adjustments.map(item => (
            <div key={item.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black text-slate-900">{item.productName}</p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-black ${item.kind === 'waste' ? 'bg-rose-50 text-rose-700' : 'bg-cyan-50 text-cyan-700'}`}>
                    {item.kind === 'waste' ? 'Merma' : 'Conteo físico'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{item.reasonLabel} · {formatInventoryDate(item.eventDate)}{item.batchCode ? ` · ${item.batchCode}` : ''}</p>
              </div>
              <div className="sm:text-right">
                <p className={`font-black ${item.quantityDelta < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {item.quantityDelta > 0 ? '+' : ''}{formatInventoryQuantity(item.quantityDelta)} {item.unit}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-500">Impacto {formatInventoryMoney(item.costImpact)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PreparationModal({ recipes, productsById, form, preview, notice, saving, onClose, onSave, onUpdate, onClearNotice }) {
  const selectedRecipe = recipes.find(recipe => String(recipe.id) === String(form.recipeId));
  const outputProduct = productsById.get(String(selectedRecipe?.output_product_id || ''));

  return (
    <ModalShell title="Registrar preparación interna" subtitle="Descuenta componentes y aumenta el stock elaborado." onClose={onClose}>
      {notice && <Notice notice={notice} onClose={onClearNotice} compact />}
      <form onSubmit={onSave} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Preparación">
            <select value={form.recipeId} onChange={event => onUpdate('recipeId', event.target.value)} className="iq-input" required>
              <option value="">Seleccionar preparación</option>
              {recipes.map(recipe => (
                <option key={recipe.id} value={recipe.id}>{productsById.get(String(recipe.output_product_id))?.name || recipe.name}</option>
              ))}
            </select>
          </Field>
          <Field label={`Cantidad elaborada${selectedRecipe ? ` (${selectedRecipe.yield_unit})` : ''}`}>
            <input type="number" min="0" step="0.001" value={form.producedQuantity} onChange={event => onUpdate('producedQuantity', event.target.value)} className="iq-input" required />
          </Field>
          <Field label="Fecha de preparación">
            <input type="date" value={form.productionDate} onChange={event => onUpdate('productionDate', event.target.value)} className="iq-input" required />
          </Field>
          <Field label="Código de lote (opcional)">
            <input value={form.batchCode} onChange={event => onUpdate('batchCode', event.target.value)} className="iq-input" placeholder="InventIQ puede generarlo" />
          </Field>
        </div>

        {selectedRecipe && (
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-900">{outputProduct?.name || selectedRecipe.name}</p>
                <p className="mt-1 text-xs text-slate-500">Entrada estimada al stock: {formatInventoryQuantity(preview.outputStockQuantity)} {preview.outputStockUnit}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-slate-950">{formatInventoryMoney(preview.totalCost)}</p>
                <p className="text-xs text-slate-500">{formatInventoryMoney(preview.unitCost)} por {preview.outputStockUnit || 'unidad'}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {preview.lines.map(line => (
                <div key={line.id} className={`flex items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-3 text-sm ${line.available ? '' : 'border border-red-200'}`}>
                  <div>
                    <p className="font-bold text-slate-800">{line.ingredient?.name || 'Componente no disponible'}</p>
                    <p className="text-xs text-slate-500">Disponible: {formatInventoryQuantity(line.stock)} {line.stockUnit}</p>
                  </div>
                  <p className={`font-black ${line.available ? 'text-slate-900' : 'text-red-700'}`}>{formatInventoryQuantity(line.stockQuantity)} {line.stockUnit}</p>
                </div>
              ))}
            </div>
            {preview.warnings.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                {preview.warnings[0]}
              </div>
            )}
          </section>
        )}

        <Field label="Observaciones">
          <textarea value={form.notes} onChange={event => onUpdate('notes', event.target.value)} className="iq-input min-h-24" placeholder="Turno, responsable o detalle del lote" />
        </Field>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="iq-secondary-button justify-center" disabled={saving}>Cancelar</button>
          <button type="submit" className="iq-primary-button justify-center" disabled={saving || !preview.canProduce}>
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <PackageCheck className="h-5 w-5" />} Registrar preparación
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function AdjustmentModal({ products, batches, form, selectedProduct, currentStock, stockAfter, delta, unit, reasons, notice, saving, onClose, onSave, onUpdate, onClearNotice }) {
  return (
    <ModalShell title={form.kind === 'waste' ? 'Registrar merma' : 'Registrar conteo físico'} subtitle="El movimiento quedará guardado con trazabilidad." onClose={onClose}>
      {notice && <Notice notice={notice} onClose={onClearNotice} compact />}
      <form onSubmit={onSave} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo de registro">
            <select value={form.kind} onChange={event => onUpdate('kind', event.target.value)} className="iq-input">
              <option value="waste">Merma o pérdida</option>
              <option value="physical_count">Conteo físico</option>
            </select>
          </Field>
          <Field label="Fecha">
            <input type="date" value={form.eventDate} onChange={event => onUpdate('eventDate', event.target.value)} className="iq-input" required />
          </Field>
          <Field label="Insumo o preparación">
            <select value={form.productId} onChange={event => onUpdate('productId', event.target.value)} className="iq-input" required>
              <option value="">Seleccionar</option>
              {products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </Field>
          <Field label={form.kind === 'waste' ? `Cantidad perdida (${unit})` : `Existencia real encontrada (${unit})`}>
            <input type="number" min="0" step="0.001" value={form.quantity} onChange={event => onUpdate('quantity', event.target.value)} className="iq-input" required />
          </Field>
          <Field label="Motivo">
            <select value={form.reasonCode} onChange={event => onUpdate('reasonCode', event.target.value)} className="iq-input" required>
              <option value="">Seleccionar motivo</option>
              {reasons.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </Field>
          <Field label="Lote relacionado (opcional)">
            <select value={form.batchId} onChange={event => onUpdate('batchId', event.target.value)} className="iq-input" disabled={!selectedProduct || batches.length === 0}>
              <option value="">Sin lote relacionado</option>
              {batches.map(batch => <option key={batch.id} value={batch.id}>{batch.batchCode} · {batch.outputProductName}</option>)}
            </select>
          </Field>
        </div>

        {selectedProduct && (
          <section className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
            <SmallStat label="Stock actual" value={`${formatInventoryQuantity(currentStock)} ${unit}`} />
            <SmallStat label="Diferencia" value={`${delta > 0 ? '+' : ''}${formatInventoryQuantity(delta)} ${unit}`} />
            <SmallStat label="Stock resultante" value={`${formatInventoryQuantity(stockAfter)} ${unit}`} />
          </section>
        )}

        <Field label="Observaciones">
          <textarea value={form.notes} onChange={event => onUpdate('notes', event.target.value)} className="iq-input min-h-24" placeholder="Detalle de la pérdida o del conteo" />
        </Field>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="iq-secondary-button justify-center" disabled={saving}>Cancelar</button>
          <button type="submit" className="iq-primary-button justify-center" disabled={saving}>
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : form.kind === 'waste' ? <Trash2 className="h-5 w-5" /> : <Scale className="h-5 w-5" />}
            Guardar registro
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalShell({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-[1.75rem] bg-white shadow-2xl sm:rounded-[1.75rem]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
          <div>
            <h3 className="text-xl font-black text-slate-950">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-5 p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

function Notice({ notice, onClose, compact = false }) {
  return (
    <div className={`flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm font-semibold ${compact ? 'mb-4' : ''} ${
      notice.type === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-red-200 bg-red-50 text-red-700'
    }`}>
      <span>{notice.message}</span>
      <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-1 hover:bg-white/70" aria-label="Cerrar aviso"><X className="h-4 w-4" /></button>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    violet: 'bg-violet-50 text-violet-700',
  };
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${tones[tone] || tones.emerald}`}><Icon className="h-5 w-5" /></div>
      <p className="mt-4 text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-400">{detail}</p>
    </div>
  );
}

function SmallStat({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-100 px-3.5 py-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-3 text-left text-sm font-black text-slate-700 transition hover:bg-slate-100">
      <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-emerald-600" /> {label}</span>
      <span aria-hidden="true">›</span>
    </button>
  );
}

function KindBadge({ kind }) {
  const meta = {
    ingredient: ['Ingrediente', 'bg-cyan-50 text-cyan-700'],
    preparation: ['Preparación', 'bg-violet-50 text-violet-700'],
    packaging: ['Empaque', 'bg-amber-50 text-amber-700'],
  }[kind] || ['Componente', 'bg-slate-100 text-slate-600'];
  return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${meta[1]}`}>{meta[0]}</span>;
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function EmptyBlock({ icon: Icon, title, description }) {
  return (
    <div className="p-10 text-center">
      <Icon className="mx-auto h-9 w-9 text-slate-300" />
      <h3 className="mt-3 font-black text-slate-900">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
