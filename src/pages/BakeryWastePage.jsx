import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  DollarSign,
  History,
  Loader2,
  PackageSearch,
  Plus,
  Scale,
  Search,
  Trash2,
  Wheat,
  X,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { formatRecipeMoney, formatRecipeQuantity } from '../utils/productionRecipes';
import { formatProductionDate, getLocalDateInputValue } from '../utils/productionBatches';

const EMPTY_FORM = {
  kind: 'waste',
  productId: '',
  quantity: '',
  eventDate: getLocalDateInputValue(),
  reasonCode: '',
  batchId: '',
  notes: '',
};

const REASONS = {
  waste: [
    ['expired', 'Caducidad o deterioro'],
    ['burned', 'Producto quemado o sobrehorneado'],
    ['quality', 'No cumple el estándar de calidad'],
    ['handling', 'Daño durante manipulación'],
    ['spill', 'Derrame o pérdida de materia prima'],
    ['unsold', 'Sobrante no apto para venta'],
    ['other', 'Otro motivo'],
  ],
  physical_count: [
    ['physical_count', 'Conteo físico de inventario'],
    ['record_correction', 'Corrección de registro anterior'],
    ['unregistered_entry', 'Entrada no registrada'],
    ['unregistered_exit', 'Salida no registrada'],
    ['other', 'Otro motivo'],
  ],
};

function normalizeAdjustment(item) {
  return {
    ...item,
    quantity_reported: Number(item?.quantity_reported || 0),
    quantity_delta: Number(item?.quantity_delta || 0),
    stock_before: Number(item?.stock_before || 0),
    stock_after: Number(item?.stock_after || 0),
    unit_cost: Number(item?.unit_cost || 0),
    cost_impact: Number(item?.cost_impact || 0),
  };
}

function normalizeBatch(batch) {
  return {
    ...batch,
    items: Array.isArray(batch?.items) ? batch.items : [],
  };
}

function getProductUnit(product) {
  return product?.stockUnit || product?.size || 'unidad';
}

function getProductTypeLabel(productType) {
  const labels = {
    raw_material: 'Materia prima',
    packaging: 'Empaque',
    intermediate: 'Producto intermedio',
    finished_product: 'Producto terminado',
    sale_product: 'Producto de venta',
  };
  return labels[productType] || 'Producto';
}

function getAdjustmentKindLabel(kind) {
  return kind === 'physical_count' ? 'Conteo físico' : 'Merma';
}

export default function BakeryWastePage({ currentUser, products, setActive }) {
  const [adjustments, setAdjustments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState('');
  const [filterKind, setFilterKind] = useState('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState(null);

  const eligibleProducts = useMemo(
    () => (products || [])
      .filter(product => product.productType !== 'service')
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es')),
    [products]
  );

  const productsById = useMemo(
    () => new Map(eligibleProducts.map(product => [String(product.id), product])),
    [eligibleProducts]
  );

  const loadData = useCallback(async (showLoader = true) => {
    if (!currentUser?.id) return;
    if (showLoader) setLoading(true);

    try {
      const [adjustmentsResponse, batchesResponse] = await Promise.all([
        supabase
          .from('bakery_stock_adjustments')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('event_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(250),
        supabase
          .from('production_batches')
          .select('id,batch_code,production_date,output_product_id,output_product_name,items:production_batch_items(ingredient_product_id)')
          .eq('user_id', currentUser.id)
          .order('production_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(120),
      ]);

      if (adjustmentsResponse.error) throw adjustmentsResponse.error;
      if (batchesResponse.error) throw batchesResponse.error;

      setAdjustments((adjustmentsResponse.data || []).map(normalizeAdjustment));
      setBatches((batchesResponse.data || []).map(normalizeBatch));
    } catch (error) {
      console.error('Error cargando mermas y ajustes:', error);
      setNotice({ type: 'error', message: `No se pudo cargar la información: ${error.message}` });
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;

    const channel = supabase
      .channel(`bakery-adjustments-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bakery_stock_adjustments',
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => loadData(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, loadData]);

  const selectedProduct = productsById.get(String(form.productId));
  const selectedUnit = getProductUnit(selectedProduct);
  const currentStock = Number(selectedProduct?.stock || 0);
  const enteredQuantity = Number(form.quantity || 0);
  const quantityDelta = form.kind === 'physical_count'
    ? enteredQuantity - currentStock
    : -enteredQuantity;
  const stockAfter = currentStock + quantityDelta;
  const estimatedImpact = Math.abs(quantityDelta) * Number(selectedProduct?.cost || 0);

  const relatedBatches = useMemo(() => {
    if (!form.productId) return [];
    return batches.filter(batch => (
      String(batch.output_product_id) === String(form.productId)
      || batch.items.some(item => String(item.ingredient_product_id) === String(form.productId))
    ));
  }, [batches, form.productId]);

  const visibleAdjustments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return adjustments.filter(item => {
      const matchesKind = filterKind === 'all' || item.adjustment_kind === filterKind;
      const matchesSearch = !term || [
        item.product_name,
        item.reason_label,
        item.batch_code,
        item.notes,
      ].some(value => String(value || '').toLowerCase().includes(term));
      return matchesKind && matchesSearch;
    });
  }, [adjustments, filterKind, search]);

  const monthKey = getLocalDateInputValue().slice(0, 7);
  const monthAdjustments = adjustments.filter(item => String(item.event_date || '').startsWith(monthKey));
  const monthWaste = monthAdjustments.filter(item => item.adjustment_kind === 'waste');
  const monthWasteImpact = monthWaste.reduce((sum, item) => sum + Number(item.cost_impact || 0), 0);
  const physicalCounts = monthAdjustments.filter(item => item.adjustment_kind === 'physical_count');
  const affectedProducts = new Set(monthAdjustments.map(item => String(item.product_id))).size;

  function openEditor(kind = 'waste') {
    setForm({ ...EMPTY_FORM, kind, eventDate: getLocalDateInputValue() });
    setNotice(null);
    setEditorOpen(true);
  }

  function closeEditor() {
    if (saving) return;
    setEditorOpen(false);
    setForm(EMPTY_FORM);
  }

  function updateForm(field, value) {
    setForm(previous => {
      const next = { ...previous, [field]: value };
      if (field === 'kind') {
        next.reasonCode = '';
        next.quantity = '';
      }
      if (field === 'productId') next.batchId = '';
      return next;
    });
  }

  function validateForm() {
    if (!form.productId) return 'Selecciona el producto o insumo.';
    if (!form.eventDate) return 'Selecciona la fecha del registro.';
    if (!form.reasonCode) return 'Selecciona el motivo del registro.';

    if (form.kind === 'waste') {
      if (enteredQuantity <= 0) return 'La cantidad de la merma debe ser mayor a cero.';
      if (stockAfter < 0) return `La merma supera el stock disponible de ${formatRecipeQuantity(currentStock)} ${selectedUnit}.`;
    } else {
      if (enteredQuantity < 0 || form.quantity === '') return 'El conteo real no puede ser negativo.';
      if (Math.abs(quantityDelta) < 0.000001) return 'El conteo coincide con el stock actual; no existe una diferencia que registrar.';
    }

    return null;
  }

  async function saveAdjustment(event) {
    event.preventDefault();
    const validationError = validateForm();

    if (validationError) {
      setNotice({ type: 'error', message: validationError });
      return;
    }

    const reason = (REASONS[form.kind] || []).find(([code]) => code === form.reasonCode);
    setSaving(true);
    setNotice(null);

    try {
      const { data, error } = await supabase.rpc('register_bakery_stock_adjustment', {
        p_product_id: form.productId,
        p_adjustment_kind: form.kind,
        p_quantity: enteredQuantity,
        p_event_date: form.eventDate,
        p_reason_code: form.reasonCode,
        p_reason_label: reason?.[1] || form.reasonCode,
        p_notes: form.notes.trim() || null,
        p_batch_id: form.batchId || null,
      });

      if (error) throw error;

      await loadData(false);
      setEditorOpen(false);
      setForm(EMPTY_FORM);
      setNotice({
        type: 'success',
        message: form.kind === 'waste'
          ? `Merma registrada. El stock de ${data?.product_name || selectedProduct?.name || 'producto'} fue actualizado.`
          : `Conteo físico registrado. InventIQ aplicó una diferencia de ${Number(data?.quantity_delta || 0) > 0 ? '+' : ''}${formatRecipeQuantity(data?.quantity_delta || 0)} ${data?.unit || selectedUnit}.`,
      });
    } catch (error) {
      console.error('Error guardando merma o ajuste:', error);
      setNotice({ type: 'error', message: `No se pudo guardar el registro: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {notice && !editorOpen && <Notice notice={notice} onClose={() => setNotice(null)} />}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Trash2} label="Mermas del mes" value={monthWaste.length} detail="registros de salida" tone="rose" />
        <MetricCard icon={DollarSign} label="Impacto estimado" value={formatRecipeMoney(monthWasteImpact)} detail="costo de mermas del mes" tone="amber" />
        <MetricCard icon={Scale} label="Conteos físicos" value={physicalCounts.length} detail="ajustes del mes" tone="cyan" />
        <MetricCard icon={PackageSearch} label="Productos revisados" value={affectedProducts} detail="productos e insumos" tone="violet" />
      </section>

      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-slate-900 to-rose-950 p-5 text-white sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-rose-200">
                <ClipboardCheck className="h-4 w-4" /> Control de inventario
              </p>
              <h3 className="mt-2 text-2xl font-black sm:text-3xl">Registra pérdidas y corrige diferencias con trazabilidad</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Cada movimiento conserva el motivo, el stock anterior, el nuevo saldo, el responsable y su impacto económico estimado.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => openEditor('physical_count')} className="iq-secondary-button border-white/20 bg-white/10 text-white hover:bg-white/20">
                <Scale className="h-5 w-5" /> Registrar conteo
              </button>
              <button type="button" onClick={() => openEditor('waste')} className="iq-primary-button bg-white text-slate-950 hover:bg-rose-50">
                <Plus className="h-5 w-5" /> Registrar merma
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-center">
          <label className="relative block w-full">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={event => setSearch(event.target.value)} className="iq-input pl-11" placeholder="Buscar por producto, motivo o lote" />
          </label>

          <select value={filterKind} onChange={event => setFilterKind(event.target.value)} className="iq-input">
            <option value="all">Todos los movimientos</option>
            <option value="waste">Solo mermas</option>
            <option value="physical_count">Solo conteos físicos</option>
          </select>

          <button type="button" onClick={() => setActive('Inventario')} className="iq-secondary-button justify-center">
            <Wheat className="h-5 w-5" /> Ver inventario
          </button>
        </div>
      </section>

      {loading ? (
        <div className="flex min-h-56 items-center justify-center rounded-[1.75rem] border border-slate-200 bg-white">
          <Loader2 className="h-7 w-7 animate-spin text-rose-600" />
        </div>
      ) : adjustments.length === 0 ? (
        <EmptyAdjustments onWaste={() => openEditor('waste')} onCount={() => openEditor('physical_count')} />
      ) : visibleAdjustments.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-10 text-center">
          <Search className="mx-auto h-8 w-8 text-slate-300" />
          <h3 className="mt-3 text-lg font-black text-slate-900">No encontramos registros</h3>
          <p className="mt-1 text-sm text-slate-500">Cambia la búsqueda o el filtro seleccionado.</p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <h3 className="text-lg font-black text-slate-950">Historial de mermas y ajustes</h3>
            <p className="mt-1 text-sm text-slate-500">Los registros son permanentes para conservar la trazabilidad del inventario.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {visibleAdjustments.map(item => (
              <AdjustmentRow
                key={item.id}
                item={item}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId(previous => previous === item.id ? null : item.id)}
              />
            ))}
          </div>
        </section>
      )}

      {editorOpen && (
        <AdjustmentEditor
          form={form}
          products={eligibleProducts}
          selectedProduct={selectedProduct}
          relatedBatches={relatedBatches}
          selectedUnit={selectedUnit}
          currentStock={currentStock}
          quantityDelta={quantityDelta}
          stockAfter={stockAfter}
          estimatedImpact={estimatedImpact}
          notice={notice}
          saving={saving}
          onClose={closeEditor}
          onSave={saveAdjustment}
          onUpdate={updateForm}
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
    rose: 'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-700',
    cyan: 'bg-cyan-50 text-cyan-700',
    violet: 'bg-violet-50 text-violet-700',
  };
  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tones[tone] || tones.rose}`}><Icon className="h-5 w-5" /></div>
      <p className="mt-4 text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 truncate text-3xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate-400">{detail}</p>
    </article>
  );
}

function EmptyAdjustments({ onWaste, onCount }) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-50 text-rose-700"><ClipboardCheck className="h-8 w-8" /></div>
      <h3 className="mt-5 text-2xl font-black text-slate-950">Aún no existen mermas ni ajustes</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
        Registra pérdidas reales o utiliza un conteo físico para corregir diferencias entre el sistema y las existencias del negocio.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <button type="button" onClick={onCount} className="iq-secondary-button justify-center"><Scale className="h-5 w-5" /> Registrar conteo</button>
        <button type="button" onClick={onWaste} className="iq-primary-button justify-center"><Trash2 className="h-5 w-5" /> Registrar merma</button>
      </div>
    </section>
  );
}

function AdjustmentRow({ item, expanded, onToggle }) {
  const isWaste = item.adjustment_kind === 'waste';
  const delta = Number(item.quantity_delta || 0);
  return (
    <article>
      <button type="button" onClick={onToggle} className="grid w-full grid-cols-1 gap-4 px-5 py-5 text-left hover:bg-slate-50 sm:px-6 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(110px,0.65fr))_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${isWaste ? 'bg-rose-50 text-rose-700' : 'bg-cyan-50 text-cyan-700'}`}>
              {getAdjustmentKindLabel(item.adjustment_kind)}
            </span>
            <span className="text-xs font-black uppercase tracking-wide text-slate-400">{getProductTypeLabel(item.product_type)}</span>
          </div>
          <p className="mt-2 truncate text-base font-black text-slate-950">{item.product_name}</p>
          <p className="mt-1 truncate text-sm text-slate-500">{item.reason_label}</p>
        </div>
        <RowValue label="Fecha" value={formatProductionDate(item.event_date)} />
        <RowValue label="Movimiento" value={`${delta > 0 ? '+' : ''}${formatRecipeQuantity(delta)} ${item.unit}`} tone={delta < 0 ? 'negative' : 'positive'} />
        <RowValue label="Stock final" value={`${formatRecipeQuantity(item.stock_after)} ${item.unit}`} />
        <RowValue label="Impacto" value={formatRecipeMoney(item.cost_impact)} />
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-5 sm:px-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DetailCard label="Stock anterior" value={`${formatRecipeQuantity(item.stock_before)} ${item.unit}`} />
            <DetailCard label={isWaste ? 'Cantidad retirada' : 'Conteo registrado'} value={`${formatRecipeQuantity(item.quantity_reported)} ${item.unit}`} />
            <DetailCard label="Costo unitario" value={formatRecipeMoney(item.unit_cost)} />
            <DetailCard label="Lote relacionado" value={item.batch_code || 'Sin lote relacionado'} />
          </div>
          {item.notes && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Observaciones</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{item.notes}</p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function RowValue({ label, value, tone }) {
  const valueClass = tone === 'negative' ? 'text-rose-700' : tone === 'positive' ? 'text-emerald-700' : 'text-slate-900';
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-sm font-black ${valueClass}`}>{value}</p>
    </div>
  );
}

function DetailCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function AdjustmentEditor({
  form,
  products,
  selectedProduct,
  relatedBatches,
  selectedUnit,
  currentStock,
  quantityDelta,
  stockAfter,
  estimatedImpact,
  notice,
  saving,
  onClose,
  onSave,
  onUpdate,
  onClearNotice,
}) {
  const isWaste = form.kind === 'waste';
  const isValidPreview = selectedProduct && Number(form.quantity || 0) >= 0 && stockAfter >= 0;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[96vh] w-full max-w-5xl overflow-hidden rounded-t-[2rem] bg-slate-50 shadow-2xl sm:rounded-[2rem]">
        <form onSubmit={onSave} className="flex max-h-[96vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
            <div>
              <p className={`text-xs font-black uppercase tracking-[0.16em] ${isWaste ? 'text-rose-700' : 'text-cyan-700'}`}>
                {isWaste ? 'Salida por pérdida' : 'Ajuste por conteo'}
              </p>
              <h3 className="mt-1 text-2xl font-black text-slate-950">{isWaste ? 'Registrar merma' : 'Registrar conteo físico'}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {isWaste ? 'Retira del inventario una pérdida real y conserva su motivo.' : 'Ingresa la existencia real; InventIQ calculará la diferencia automáticamente.'}
              </p>
            </div>
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50" aria-label="Cerrar">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="overflow-y-auto p-4 sm:p-6">
            {notice && <Notice notice={notice} onClose={onClearNotice} />}

            <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-5">
                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <span className="mb-2 block text-sm font-bold text-slate-700">Tipo de registro</span>
                      <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
                        <button type="button" onClick={() => onUpdate('kind', 'waste')} className={`rounded-xl px-4 py-3 text-sm font-black transition ${isWaste ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500'}`}>
                          <Trash2 className="mr-2 inline h-4 w-4" /> Merma
                        </button>
                        <button type="button" onClick={() => onUpdate('kind', 'physical_count')} className={`rounded-xl px-4 py-3 text-sm font-black transition ${!isWaste ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500'}`}>
                          <Scale className="mr-2 inline h-4 w-4" /> Conteo físico
                        </button>
                      </div>
                    </label>

                    <label className="block sm:col-span-2">
                      <span className="mb-2 block text-sm font-bold text-slate-700">Producto o insumo</span>
                      <select value={form.productId} onChange={event => onUpdate('productId', event.target.value)} className="iq-input">
                        <option value="">Seleccionar producto</option>
                        {products.map(product => (
                          <option key={product.id} value={product.id}>
                            {product.name} · {formatRecipeQuantity(product.stock)} {getProductUnit(product)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">{isWaste ? 'Cantidad perdida' : 'Cantidad encontrada'}</span>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={form.quantity}
                          onChange={event => onUpdate('quantity', event.target.value)}
                          className="iq-input pr-24"
                          placeholder="0"
                        />
                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">{selectedUnit}</span>
                      </div>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">Fecha del registro</span>
                      <input type="date" value={form.eventDate} onChange={event => onUpdate('eventDate', event.target.value)} className="iq-input" />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">Motivo</span>
                      <select value={form.reasonCode} onChange={event => onUpdate('reasonCode', event.target.value)} className="iq-input">
                        <option value="">Seleccionar motivo</option>
                        {(REASONS[form.kind] || []).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">Lote relacionado (opcional)</span>
                      <select value={form.batchId} onChange={event => onUpdate('batchId', event.target.value)} className="iq-input" disabled={!selectedProduct || relatedBatches.length === 0}>
                        <option value="">Sin lote relacionado</option>
                        {relatedBatches.map(batch => (
                          <option key={batch.id} value={batch.id}>{batch.batch_code} · {formatProductionDate(batch.production_date)}</option>
                        ))}
                      </select>
                    </label>

                    <label className="block sm:col-span-2">
                      <span className="mb-2 block text-sm font-bold text-slate-700">Observaciones (opcional)</span>
                      <textarea value={form.notes} onChange={event => onUpdate('notes', event.target.value)} className="iq-input min-h-24 resize-y" placeholder="Detalle de lo ocurrido, responsable del conteo o acción correctiva..." />
                    </label>
                  </div>
                </section>

                <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="flex items-center gap-2 font-black"><AlertTriangle className="h-4 w-4" /> Registro permanente</p>
                  <p className="mt-1 leading-6">Después de guardar, el historial no se edita ni elimina. Una corrección posterior debe registrarse como un nuevo conteo físico.</p>
                </div>
              </div>

              <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
                <section className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-rose-200"><History className="h-4 w-4" /> Vista previa</p>
                  <h4 className="mt-3 text-xl font-black">{selectedProduct?.name || 'Selecciona un producto'}</h4>
                  <p className="mt-1 text-sm text-slate-400">{selectedProduct ? `${getProductTypeLabel(selectedProduct.productType)} · ${selectedUnit}` : 'Sin información de inventario'}</p>

                  <div className="mt-5 space-y-3">
                    <PreviewLine label="Stock actual" value={selectedProduct ? `${formatRecipeQuantity(currentStock)} ${selectedUnit}` : '—'} />
                    <PreviewLine label={isWaste ? 'Salida prevista' : 'Diferencia calculada'} value={selectedProduct && form.quantity !== '' ? `${quantityDelta > 0 ? '+' : ''}${formatRecipeQuantity(quantityDelta)} ${selectedUnit}` : '—'} tone={quantityDelta < 0 ? 'negative' : quantityDelta > 0 ? 'positive' : undefined} />
                    <PreviewLine label="Stock resultante" value={selectedProduct && form.quantity !== '' ? `${formatRecipeQuantity(stockAfter)} ${selectedUnit}` : '—'} strong />
                    <PreviewLine label="Impacto estimado" value={selectedProduct && form.quantity !== '' ? formatRecipeMoney(estimatedImpact) : '—'} />
                  </div>
                </section>

                <div className={`rounded-[1.5rem] border p-4 text-sm ${
                  isValidPreview && form.quantity !== '' && Math.abs(quantityDelta) > 0.000001
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}>
                  <p className="flex items-center gap-2 font-black">
                    {isValidPreview && form.quantity !== '' && Math.abs(quantityDelta) > 0.000001 ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {isValidPreview && form.quantity !== '' && Math.abs(quantityDelta) > 0.000001 ? 'Movimiento listo' : 'Completa el registro'}
                  </p>
                  <p className="mt-1 leading-5">InventIQ actualizará el stock y guardará un movimiento de inventario con trazabilidad.</p>
                </div>
              </aside>
            </div>
          </div>

          <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-slate-100 bg-white/95 p-4 backdrop-blur sm:flex-row sm:justify-end sm:px-6">
            <button type="button" onClick={onClose} disabled={saving} className="iq-secondary-button">Cancelar</button>
            <button type="submit" disabled={saving} className="iq-primary-button disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : isWaste ? <ArrowDownRight className="h-5 w-5" /> : quantityDelta >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
              {saving ? 'Guardando...' : isWaste ? 'Confirmar merma' : 'Aplicar conteo físico'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PreviewLine({ label, value, strong = false, tone }) {
  const toneClass = tone === 'negative' ? 'text-rose-300' : tone === 'positive' ? 'text-emerald-300' : 'text-white';
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? 'font-black text-white' : 'text-sm font-semibold text-slate-400'}>{label}</span>
      <span className={`${strong ? 'text-xl' : 'text-sm'} font-black ${toneClass}`}>{value}</span>
    </div>
  );
}
