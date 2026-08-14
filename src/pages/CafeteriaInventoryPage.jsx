import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Coffee,
  CookingPot,
  DollarSign,
  Gauge,
  Loader2,
  Milk,
  PackageCheck,
  PackageSearch,
  Plus,
  RefreshCcw,
  Search,
  ShoppingCart,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react';
import {
  buildCafeteriaPreparationPreview,
  buildCafeteriaReplenishment,
  CAFETERIA_COUNT_REASONS,
  CAFETERIA_WASTE_REASONS,
  fetchCafeteriaInventoryData,
  formatCafeInventoryDate,
  formatCafeInventoryMoney,
  formatCafeInventoryQuantity,
  getCafeteriaInventoryProducts,
  getLocalDateValue,
  registerCafeteriaPreparationBatch,
  registerCafeteriaStockAdjustment,
  resolveCafeteriaInventoryIssue,
  subscribeCafeteriaInventory,
} from '../utils/cafeteriaInventory';
import { getProductStockUnit } from '../utils/productionRecipes';
import { isCafeteriaPreparation, isCafeteriaSupply } from '../utils/cafeteriaRecipes';
import { hasRestaurantPermission } from '../utils/restaurantPermissions';
import { auditRestaurantAction } from '../utils/restaurantStaff';

const TABS = [
  { value: 'resumen', label: 'Resumen', icon: Boxes },
  { value: 'reposicion', label: 'Reposición', icon: ShoppingCart },
  { value: 'preparaciones', label: 'Preparaciones', icon: CookingPot },
  { value: 'ajustes', label: 'Mermas y conteos', icon: ClipboardCheck },
];

const EMPTY_PREPARATION = {
  recipeId: '',
  producedQuantity: '',
  productionDate: getLocalDateValue(),
  batchCode: '',
  notes: '',
};

const EMPTY_ADJUSTMENT = {
  kind: 'waste',
  productId: '',
  quantity: '',
  eventDate: getLocalDateValue(),
  reasonCode: '',
  notes: '',
  batchId: '',
};

function Notice({ notice, onClose }) {
  if (!notice) return null;
  const error = notice.type === 'error';
  return (
    <div className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
      <div className="flex items-start gap-2">
        {error ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
        <span className="font-semibold leading-5">{notice.message}</span>
      </div>
      <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-black/5" aria-label="Cerrar">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function MetricCard({ label, value, helper, icon: Icon, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
    cyan: 'bg-cyan-100 text-cyan-700',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
          {helper && <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p>}
        </div>
        <div className={`rounded-2xl p-2.5 ${tones[tone] || tones.slate}`}><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  );
}

function StockPill({ row }) {
  const config = row.priority === 'urgent'
    ? ['Urgente', 'bg-rose-100 text-rose-700']
    : row.priority === 'warning'
      ? ['Pronto', 'bg-amber-100 text-amber-700']
      : row.priority === 'plan'
        ? ['Planificar', 'bg-cyan-100 text-cyan-700']
        : ['Bien', 'bg-emerald-100 text-emerald-700'];
  return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${config[1]}`}>{config[0]}</span>;
}

function ProductKindIcon({ product }) {
  if (isCafeteriaPreparation(product)) return <CookingPot className="h-4 w-4" />;
  const category = String(product?.category || '').toLowerCase();
  if (category.includes('láct') || category.includes('leche')) return <Milk className="h-4 w-4" />;
  if (category.includes('café') || category.includes('cafe')) return <Coffee className="h-4 w-4" />;
  return <PackageSearch className="h-4 w-4" />;
}

function ReplenishmentTab({ rows, search, onSearch, onGoPurchases }) {
  const visible = rows.filter((row) => {
    const term = search.trim().toLowerCase();
    return !term || [row.product?.name, row.product?.category].some((value) => String(value || '').toLowerCase().includes(term));
  });
  const urgentCount = rows.filter((row) => row.priority === 'urgent').length;
  const warningCount = rows.filter((row) => row.priority === 'warning').length;

  return (
    <div className="space-y-4">
      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700">Reposición sugerida</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">Compra antes de quedarte sin insumos</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              La sugerencia combina stock mínimo y consumo real de los últimos 14 días. La meta busca aproximadamente 7 días de cobertura, sin reemplazar tu criterio de compra.
            </p>
          </div>
          <button type="button" onClick={onGoPurchases} className="iq-primary-button justify-center">
            <ShoppingCart className="h-4 w-4" /> Ir a Compras
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-rose-50 px-3 py-1.5 text-rose-700">{urgentCount} urgentes</span>
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">{warningCount} próximos</span>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">{rows.length} referencias controladas</span>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <label className="relative block max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar café, leche, jarabe, vasos..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-cyan-400" />
          </label>
        </div>
        <div className="divide-y divide-slate-100">
          {visible.length === 0 ? (
            <div className="p-10 text-center text-sm font-semibold text-slate-500">No hay insumos que coincidan con la búsqueda.</div>
          ) : visible.map((row) => {
            const unit = getProductStockUnit(row.product) || 'unidad';
            return (
              <div key={row.product.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(110px,0.65fr))_auto] lg:items-center">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="rounded-xl bg-slate-100 p-2 text-slate-600"><ProductKindIcon product={row.product} /></div>
                  <div className="min-w-0">
                    <p className="truncate font-black text-slate-900">{row.product.name}</p>
                    <p className="truncate text-xs font-semibold text-slate-400">{row.product.category || 'Inventario'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Stock</p>
                  <p className="mt-1 text-sm font-black text-slate-900">{formatCafeInventoryQuantity(row.stock)} {unit}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Consumo / día</p>
                  <p className="mt-1 text-sm font-black text-slate-900">{formatCafeInventoryQuantity(row.dailyDemand)} {unit}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cobertura</p>
                  <p className="mt-1 text-sm font-black text-slate-900">{row.coverageDays === null ? 'Sin historial' : `${formatCafeInventoryQuantity(row.coverageDays, 1)} días`}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Comprar aprox.</p>
                  <p className="mt-1 text-sm font-black text-cyan-800">{formatCafeInventoryQuantity(row.suggestedQuantity)} {unit}</p>
                </div>
                <StockPill row={row} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ inventoryProducts, replenishment, consumptions, issues, adjustments, onResolveIssue, canAdjust, onWaste, onCount, onPreparation, onTab }) {
  const urgent = replenishment.filter((row) => row.priority === 'urgent').slice(0, 6);
  const openIssues = issues.filter((issue) => !issue.resolvedAt).slice(0, 6);
  const recentConsumption = consumptions.slice(0, 8);
  const monthKey = getLocalDateValue().slice(0, 7);
  const monthWaste = adjustments.filter((item) => item.kind === 'waste' && String(item.eventDate || '').startsWith(monthKey));
  const wasteCost = monthWaste.reduce((sum, item) => sum + item.costImpact, 0);
  const inventoryValue = inventoryProducts.reduce((sum, product) => sum + Number(product.stock || 0) * Number(product.cost || 0), 0);
  const shortageCount = consumptions.filter((item) => item.shortageQuantity > 0 && String(item.consumedAt || '').startsWith(monthKey)).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Valor controlado" value={formatCafeInventoryMoney(inventoryValue)} helper={`${inventoryProducts.length} referencias`} icon={DollarSign} tone="cyan" />
        <MetricCard label="Reposición urgente" value={replenishment.filter((row) => row.priority === 'urgent').length} helper="Stock o cobertura crítica" icon={TriangleAlert} tone="rose" />
        <MetricCard label="Mermas del mes" value={formatCafeInventoryMoney(wasteCost)} helper={`${monthWaste.length} registros`} icon={AlertTriangle} tone="amber" />
        <MetricCard label="Faltantes de receta" value={shortageCount} helper={`${issues.filter((issue) => !issue.resolvedAt).length} incidencias abiertas`} icon={Gauge} tone="slate" />
      </div>

      {canAdjust && (
        <div className="grid gap-3 md:grid-cols-3">
          <button type="button" onClick={onPreparation} className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-cyan-300 hover:shadow-md">
            <div className="flex items-center justify-between"><div className="rounded-xl bg-cyan-50 p-2 text-cyan-700"><CookingPot className="h-5 w-5" /></div><ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1" /></div>
            <p className="mt-3 font-black text-slate-950">Elaborar preparación</p><p className="mt-1 text-xs leading-5 text-slate-500">Cold brew, crema, salsa, base o concentrado.</p>
          </button>
          <button type="button" onClick={onWaste} className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-amber-300 hover:shadow-md">
            <div className="flex items-center justify-between"><div className="rounded-xl bg-amber-50 p-2 text-amber-700"><AlertTriangle className="h-5 w-5" /></div><ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1" /></div>
            <p className="mt-3 font-black text-slate-950">Registrar merma</p><p className="mt-1 text-xs leading-5 text-slate-500">Leche sobrante, calibración, bebida rehecha o pérdida.</p>
          </button>
          <button type="button" onClick={onCount} className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md">
            <div className="flex items-center justify-between"><div className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><ClipboardCheck className="h-5 w-5" /></div><ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1" /></div>
            <p className="mt-3 font-black text-slate-950">Aplicar conteo físico</p><p className="mt-1 text-xs leading-5 text-slate-500">Corrige diferencias reales sin inventar movimientos.</p>
          </button>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div><p className="text-xs font-black uppercase tracking-wider text-rose-600">Reposición</p><h3 className="font-black text-slate-950">Atención inmediata</h3></div>
            <button type="button" onClick={() => onTab('reposicion')} className="text-xs font-black text-cyan-700 hover:text-cyan-900">Ver todo</button>
          </div>
          <div className="divide-y divide-slate-100">
            {urgent.length === 0 ? <div className="p-8 text-center text-sm font-semibold text-slate-500">No hay insumos en nivel crítico.</div> : urgent.map((row) => (
              <div key={row.product.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{row.product.name}</p><p className="mt-1 text-xs text-slate-500">Stock {formatCafeInventoryQuantity(row.stock)} · mín. {formatCafeInventoryQuantity(row.minStock)} {getProductStockUnit(row.product) || 'unidad'}</p></div>
                <StockPill row={row} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div><p className="text-xs font-black uppercase tracking-wider text-amber-600">Incidencias</p><h3 className="font-black text-slate-950">Recetas e inventario</h3></div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{issues.filter((issue) => !issue.resolvedAt).length} abiertas</span>
          </div>
          <div className="divide-y divide-slate-100">
            {openIssues.length === 0 ? <div className="p-8 text-center text-sm font-semibold text-slate-500">No hay incidencias pendientes.</div> : openIssues.map((issue) => (
              <div key={issue.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-sm font-black text-slate-900">{issue.menuProductName}</p><p className="mt-1 text-xs leading-5 text-slate-500">{issue.details}</p><p className="mt-1 text-[11px] font-semibold text-slate-400">{formatCafeInventoryDate(issue.createdAt, true)}</p></div>
                  {canAdjust && <button type="button" onClick={() => onResolveIssue(issue)} className="shrink-0 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-xs font-black text-emerald-700 hover:bg-emerald-100">Resolver</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Consumo real</p><h3 className="font-black text-slate-950">Últimos ingredientes descontados por Barra</h3></div>
        <div className="divide-y divide-slate-100">
          {recentConsumption.length === 0 ? <div className="p-8 text-center text-sm font-semibold text-slate-500">Aún no hay consumos registrados.</div> : recentConsumption.map((item) => (
            <div key={item.id} className="grid gap-2 p-4 sm:grid-cols-[1.4fr_1fr_auto] sm:items-center">
              <div><p className="text-sm font-black text-slate-900">{item.ingredientName}</p><p className="text-xs text-slate-500">{item.menuProductName} · {item.sourceLabel}</p></div>
              <p className="text-sm font-bold text-slate-700">-{formatCafeInventoryQuantity(item.appliedQuantity)} {item.stockUnit}</p>
              <div className="text-right"><p className="text-xs font-black text-slate-600">{formatCafeInventoryMoney(item.appliedCost)}</p><p className="text-[11px] text-slate-400">{formatCafeInventoryDate(item.consumedAt, true)}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PreparationsTab({ recipes, productsById, batches, onPrepare, expandedBatch, onToggle }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4"><p className="text-xs font-black uppercase tracking-wider text-cyan-700">Producción interna</p><h3 className="font-black text-slate-950">Preparaciones disponibles</h3></div>
        <div className="divide-y divide-slate-100">
          {recipes.length === 0 ? <div className="p-8 text-center text-sm font-semibold text-slate-500">Crea primero una receta de tipo Preparación interna.</div> : recipes.map((recipe) => {
            const product = productsById.get(String(recipe.output_product_id));
            return (
              <div key={recipe.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0"><p className="truncate font-black text-slate-900">{product?.name || recipe.name}</p><p className="mt-1 text-xs text-slate-500">Stock: {formatCafeInventoryQuantity(product?.stock || 0)} {getProductStockUnit(product) || recipe.yield_unit}</p></div>
                  <button type="button" onClick={() => onPrepare(recipe.id)} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white hover:bg-slate-800">Elaborar</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Historial</p><h3 className="font-black text-slate-950">Lotes elaborados</h3></div>
        <div className="divide-y divide-slate-100">
          {batches.length === 0 ? <div className="p-8 text-center text-sm font-semibold text-slate-500">Todavía no hay lotes de cafetería registrados.</div> : batches.slice(0, 60).map((batch) => {
            const open = expandedBatch === batch.id;
            return (
              <div key={batch.id}>
                <button type="button" onClick={() => onToggle(open ? null : batch.id)} className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-slate-50">
                  <div><p className="font-black text-slate-900">{batch.outputProductName}</p><p className="mt-1 text-xs text-slate-500">{batch.batchCode} · {formatCafeInventoryDate(batch.productionDate)}</p></div>
                  <div className="flex items-center gap-3 text-right"><div><p className="text-sm font-black text-slate-800">{formatCafeInventoryQuantity(batch.outputStockQuantity)} {batch.outputStockUnit}</p><p className="text-xs text-slate-400">{formatCafeInventoryMoney(batch.totalCost)}</p></div>{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div>
                </button>
                {open && (
                  <div className="border-t border-slate-100 bg-slate-50 p-4">
                    <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-400">Componentes consumidos</p>
                    <div className="space-y-2">
                      {batch.items.map((item, index) => <div key={`${batch.id}-${index}`} className="flex items-center justify-between text-sm"><span className="font-semibold text-slate-700">{item.ingredientName}</span><span className="font-black text-slate-900">-{formatCafeInventoryQuantity(item.stockQuantity)} {item.stockUnit}</span></div>)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AdjustmentsTab({ adjustments, onWaste, onCount, canAdjust }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-black uppercase tracking-wider text-amber-700">Trazabilidad</p><h3 className="font-black text-slate-950">Mermas y diferencias de conteo</h3></div>
        {canAdjust && <div className="flex gap-2"><button type="button" onClick={onWaste} className="iq-secondary-button"><AlertTriangle className="h-4 w-4" /> Merma</button><button type="button" onClick={onCount} className="iq-primary-button"><ClipboardCheck className="h-4 w-4" /> Conteo</button></div>}
      </div>
      <div className="divide-y divide-slate-100">
        {adjustments.length === 0 ? <div className="p-10 text-center text-sm font-semibold text-slate-500">No existen mermas ni conteos registrados todavía.</div> : adjustments.slice(0, 100).map((item) => (
          <div key={item.id} className="grid gap-2 p-4 sm:grid-cols-[1.4fr_0.8fr_0.8fr_auto] sm:items-center">
            <div><div className="flex items-center gap-2"><p className="font-black text-slate-900">{item.productName}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${item.kind === 'waste' ? 'bg-amber-100 text-amber-700' : 'bg-cyan-100 text-cyan-700'}`}>{item.kind === 'waste' ? 'MERMA' : 'CONTEO'}</span></div><p className="mt-1 text-xs text-slate-500">{item.reasonLabel}{item.notes ? ` · ${item.notes}` : ''}</p></div>
            <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Variación</p><p className={`text-sm font-black ${item.quantityDelta < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{item.quantityDelta > 0 ? '+' : ''}{formatCafeInventoryQuantity(item.quantityDelta)} {item.unit}</p></div>
            <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Impacto</p><p className="text-sm font-black text-slate-900">{formatCafeInventoryMoney(item.costImpact)}</p></div>
            <p className="text-xs font-semibold text-slate-400">{formatCafeInventoryDate(item.eventDate)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CafeteriaInventoryPage({ currentUser, products = [], setActive }) {
  const canAdjust = hasRestaurantPermission(currentUser, 'inventory.adjust');
  const [tab, setTab] = useState('resumen');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState('');
  const [data, setData] = useState({ consumptions: [], issues: [], adjustments: [], recipes: [], batches: [] });
  const [preparationOpen, setPreparationOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [preparationForm, setPreparationForm] = useState(EMPTY_PREPARATION);
  const [adjustmentForm, setAdjustmentForm] = useState(EMPTY_ADJUSTMENT);
  const [expandedBatch, setExpandedBatch] = useState(null);

  const productsById = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products]);
  const activeRecipeOutputIds = useMemo(() => new Set(data.recipes.filter((recipe) => recipe.is_active !== false).map((recipe) => String(recipe.output_product_id))), [data.recipes]);
  const inventoryProducts = useMemo(() => getCafeteriaInventoryProducts(products, activeRecipeOutputIds), [products, activeRecipeOutputIds]);
  const preparationRecipes = useMemo(() => data.recipes.filter((recipe) => isCafeteriaPreparation(productsById.get(String(recipe.output_product_id)))), [data.recipes, productsById]);
  const replenishment = useMemo(() => buildCafeteriaReplenishment(inventoryProducts, data.consumptions, 14), [inventoryProducts, data.consumptions]);

  const loadData = useCallback(async (showLoader = true) => {
    if (!currentUser?.id) return;
    if (showLoader) setLoading(true); else setRefreshing(true);
    try {
      const response = await fetchCafeteriaInventoryData(currentUser.id);
      setData(response);
    } catch (error) {
      console.error('Error cargando inventario de cafetería:', error);
      setNotice({ type: 'error', message: `No se pudo cargar el inventario de cafetería: ${error.message}` });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser?.id]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    if (!currentUser?.id) return undefined;
    return subscribeCafeteriaInventory(currentUser.id, () => loadData(false));
  }, [currentUser?.id, loadData]);
  useEffect(() => {
    if (!currentUser?.id) return undefined;
    const refresh = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') loadData(false);
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [currentUser?.id, loadData]);

  const selectedPreparation = useMemo(() => preparationRecipes.find((recipe) => String(recipe.id) === String(preparationForm.recipeId)), [preparationRecipes, preparationForm.recipeId]);
  const preparationPreview = useMemo(() => buildCafeteriaPreparationPreview(selectedPreparation, productsById, preparationForm.producedQuantity), [selectedPreparation, productsById, preparationForm.producedQuantity]);

  const selectedAdjustmentProduct = useMemo(() => inventoryProducts.find((product) => String(product.id) === String(adjustmentForm.productId)), [inventoryProducts, adjustmentForm.productId]);
  const relatedBatches = useMemo(() => data.batches.filter((batch) => String(batch.outputProductId) === String(adjustmentForm.productId)), [data.batches, adjustmentForm.productId]);
  const adjustmentQuantity = Number(adjustmentForm.quantity || 0);
  const adjustmentStock = Number(selectedAdjustmentProduct?.stock || 0);
  const adjustmentDelta = adjustmentForm.kind === 'waste' ? -adjustmentQuantity : adjustmentQuantity - adjustmentStock;
  const adjustmentStockAfter = adjustmentStock + adjustmentDelta;
  const adjustmentReasons = adjustmentForm.kind === 'waste' ? CAFETERIA_WASTE_REASONS : CAFETERIA_COUNT_REASONS;
  const adjustmentUnit = getProductStockUnit(selectedAdjustmentProduct) || 'unidad';

  function openPreparation(recipeId = '') {
    if (!canAdjust) return setNotice({ type: 'error', message: 'Tu perfil no tiene permiso para producir preparaciones internas.' });
    const recipe = preparationRecipes.find((item) => String(item.id) === String(recipeId));
    setPreparationForm({ ...EMPTY_PREPARATION, recipeId: recipe ? String(recipe.id) : '', producedQuantity: recipe ? String(recipe.yield_quantity || '') : '', productionDate: getLocalDateValue() });
    setNotice(null);
    setPreparationOpen(true);
  }

  function openAdjustment(kind) {
    if (!canAdjust) return setNotice({ type: 'error', message: 'Tu perfil no tiene permiso para registrar mermas o conteos.' });
    setAdjustmentForm({ ...EMPTY_ADJUSTMENT, kind, eventDate: getLocalDateValue() });
    setNotice(null);
    setAdjustmentOpen(true);
  }

  async function savePreparation(event) {
    event.preventDefault();
    if (!preparationForm.recipeId) return setNotice({ type: 'error', message: 'Selecciona la preparación que vas a elaborar.' });
    if (!preparationPreview.canProduce) return setNotice({ type: 'error', message: preparationPreview.warnings[0] || 'Revisa existencias y unidades.' });
    setSaving(true);
    try {
      const response = await registerCafeteriaPreparationBatch(preparationForm);
      await auditRestaurantAction(currentUser, 'cafeteria.preparation_batch', 'production_batch', response?.batch_id || preparationForm.recipeId, { recipeId: preparationForm.recipeId, quantity: Number(preparationForm.producedQuantity || 0), batchCode: response?.batch_code || '' });
      setPreparationOpen(false);
      setPreparationForm(EMPTY_PREPARATION);
      await loadData(false);
      setNotice({ type: 'success', message: `Preparación registrada${response?.batch_code ? ` · ${response.batch_code}` : ''}. Se descontaron sus componentes y aumentó el stock elaborado.` });
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo registrar la preparación: ${error.message}` });
    } finally { setSaving(false); }
  }

  async function saveAdjustment(event) {
    event.preventDefault();
    if (!adjustmentForm.productId) return setNotice({ type: 'error', message: 'Selecciona un producto o insumo.' });
    if (!adjustmentForm.reasonCode) return setNotice({ type: 'error', message: 'Selecciona el motivo del registro.' });
    if (adjustmentForm.kind === 'waste' && (adjustmentQuantity <= 0 || adjustmentStockAfter < -0.000001)) return setNotice({ type: 'error', message: 'La merma debe ser mayor a cero y no puede superar el stock disponible.' });
    if (adjustmentForm.kind === 'physical_count' && (adjustmentForm.quantity === '' || adjustmentQuantity < 0 || Math.abs(adjustmentDelta) < 0.000001)) return setNotice({ type: 'error', message: 'Ingresa un conteo físico distinto al stock registrado.' });
    const reason = adjustmentReasons.find(([code]) => code === adjustmentForm.reasonCode);
    setSaving(true);
    try {
      const response = await registerCafeteriaStockAdjustment({ ...adjustmentForm, reasonLabel: reason?.[1] || adjustmentForm.reasonCode });
      await auditRestaurantAction(currentUser, adjustmentForm.kind === 'waste' ? 'cafeteria.inventory_waste' : 'cafeteria.inventory_count', 'product', adjustmentForm.productId, { reason: reason?.[1] || adjustmentForm.reasonCode, quantity: adjustmentQuantity });
      setAdjustmentOpen(false);
      setAdjustmentForm(EMPTY_ADJUSTMENT);
      await loadData(false);
      setNotice({ type: 'success', message: adjustmentForm.kind === 'waste' ? `Merma registrada. Stock actualizado a ${formatCafeInventoryQuantity(response?.stock_after)} ${response?.unit || adjustmentUnit}.` : `Conteo aplicado. Diferencia ${Number(response?.quantity_delta || 0) > 0 ? '+' : ''}${formatCafeInventoryQuantity(response?.quantity_delta || 0)} ${response?.unit || adjustmentUnit}.` });
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo guardar el ajuste: ${error.message}` });
    } finally { setSaving(false); }
  }

  async function resolveIssue(issue) {
    if (!canAdjust) return;
    const notes = window.prompt('Nota de resolución (opcional):', '') ?? null;
    if (notes === null) return;
    try {
      await resolveCafeteriaInventoryIssue(issue.id, notes);
      await auditRestaurantAction(currentUser, 'cafeteria.inventory_issue_resolved', 'cafeteria_inventory_issue', issue.id, { notes });
      await loadData(false);
      setNotice({ type: 'success', message: 'Incidencia marcada como revisada.' });
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo resolver la incidencia: ${error.message}` });
    }
  }

  return (
    <div className="space-y-5">
      {notice && !preparationOpen && !adjustmentOpen && <Notice notice={notice} onClose={() => setNotice(null)} />}

      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-950 p-5 text-white sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-300"><Coffee className="h-4 w-4" /> Inventario de cafetería</p>
              <h2 className="mt-2 text-2xl font-black sm:text-3xl">Café, leche, jarabes y preparaciones bajo control</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">El consumo nace en Barra al iniciar la preparación. Aquí controlas reposición, lotes internos, faltantes, mermas y conteos físicos sin devolver ingredientes ya utilizados.</p>
            </div>
            {canAdjust && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => openPreparation()} className="iq-secondary-button border-white/20 bg-white/10 text-white hover:bg-white/20"><CookingPot className="h-4 w-4" /> Elaborar preparación</button><button type="button" onClick={() => openAdjustment('waste')} className="iq-primary-button bg-white text-slate-950 hover:bg-cyan-50"><Plus className="h-4 w-4" /> Registrar merma</button></div>}
          </div>
        </div>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TABS.map((item) => { const Icon = item.icon; const active = tab === item.value; return <button key={item.value} type="button" onClick={() => setTab(item.value)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition ${active ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}><Icon className="h-4 w-4" /> {item.label}</button>; })}
          </div>
          <button type="button" onClick={() => loadData(false)} disabled={refreshing} className="iq-secondary-button justify-center"><RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Actualizar</button>
        </div>
      </section>

      {loading ? <div className="flex min-h-64 items-center justify-center rounded-[1.75rem] border border-slate-200 bg-white"><Loader2 className="h-8 w-8 animate-spin text-cyan-700" /></div> : tab === 'resumen' ? (
        <OverviewTab inventoryProducts={inventoryProducts} replenishment={replenishment} consumptions={data.consumptions} issues={data.issues} adjustments={data.adjustments} onResolveIssue={resolveIssue} canAdjust={canAdjust} onWaste={() => openAdjustment('waste')} onCount={() => openAdjustment('physical_count')} onPreparation={() => openPreparation()} onTab={setTab} />
      ) : tab === 'reposicion' ? (
        <ReplenishmentTab rows={replenishment} search={search} onSearch={setSearch} onGoPurchases={() => setActive('Compras')} />
      ) : tab === 'preparaciones' ? (
        <PreparationsTab recipes={preparationRecipes} productsById={productsById} batches={data.batches} onPrepare={openPreparation} expandedBatch={expandedBatch} onToggle={setExpandedBatch} />
      ) : (
        <AdjustmentsTab adjustments={data.adjustments} onWaste={() => openAdjustment('waste')} onCount={() => openAdjustment('physical_count')} canAdjust={canAdjust} />
      )}

      {preparationOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={savePreparation} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[1.75rem] bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 p-5"><div><p className="text-xs font-black uppercase tracking-wider text-cyan-700">Preparación interna</p><h3 className="mt-1 text-xl font-black text-slate-950">Elaborar lote</h3></div><button type="button" onClick={() => setPreparationOpen(false)} className="rounded-xl bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"><X className="h-5 w-5" /></button></div>
            <div className="space-y-4 p-5">
              {notice && <Notice notice={notice} onClose={() => setNotice(null)} />}
              <label className="block"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Preparación</span><select value={preparationForm.recipeId} onChange={(event) => { const recipe = preparationRecipes.find((item) => String(item.id) === event.target.value); setPreparationForm((current) => ({ ...current, recipeId: event.target.value, producedQuantity: recipe ? String(recipe.yield_quantity || '') : '' })); }} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-cyan-400"><option value="">Selecciona...</option>{preparationRecipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{productsById.get(String(recipe.output_product_id))?.name || recipe.name}</option>)}</select></label>
              <div className="grid gap-3 sm:grid-cols-2"><label><span className="text-xs font-black uppercase tracking-wider text-slate-500">Cantidad elaborada</span><input type="number" min="0" step="0.001" value={preparationForm.producedQuantity} onChange={(event) => setPreparationForm((current) => ({ ...current, producedQuantity: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-400" /></label><label><span className="text-xs font-black uppercase tracking-wider text-slate-500">Fecha</span><input type="date" value={preparationForm.productionDate} onChange={(event) => setPreparationForm((current) => ({ ...current, productionDate: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-400" /></label></div>
              <label className="block"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Código de lote (opcional)</span><input value={preparationForm.batchCode} onChange={(event) => setPreparationForm((current) => ({ ...current, batchCode: event.target.value }))} placeholder="InventIQ lo genera automáticamente" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-400" /></label>
              {selectedPreparation && <div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center justify-between"><p className="font-black text-slate-900">Vista previa</p><p className="text-sm font-black text-cyan-800">{formatCafeInventoryMoney(preparationPreview.totalCost)}</p></div><div className="mt-3 space-y-2">{preparationPreview.lines.map((line, index) => <div key={`${line.id || 'line'}-${index}`} className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-slate-600">{line.ingredient?.name || 'Componente'}</span><span className={`font-black ${line.available ? 'text-slate-900' : 'text-rose-700'}`}>{formatCafeInventoryQuantity(line.stockQuantity)} {line.stockUnit}</span></div>)}</div>{preparationPreview.warnings.length > 0 && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">{preparationPreview.warnings[0]}</div>}</div>}
              <label className="block"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Notas</span><textarea rows="3" value={preparationForm.notes} onChange={(event) => setPreparationForm((current) => ({ ...current, notes: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-400" /></label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 p-5"><button type="button" onClick={() => setPreparationOpen(false)} className="iq-secondary-button">Cancelar</button><button type="submit" disabled={saving || !preparationPreview.canProduce} className="iq-primary-button">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />} Registrar lote</button></div>
          </form>
        </div>
      )}

      {adjustmentOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={saveAdjustment} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[1.75rem] bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 p-5"><div><p className="text-xs font-black uppercase tracking-wider text-amber-700">{adjustmentForm.kind === 'waste' ? 'Merma real' : 'Conteo físico'}</p><h3 className="mt-1 text-xl font-black text-slate-950">{adjustmentForm.kind === 'waste' ? 'Registrar pérdida de inventario' : 'Ajustar al stock contado'}</h3></div><button type="button" onClick={() => setAdjustmentOpen(false)} className="rounded-xl bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"><X className="h-5 w-5" /></button></div>
            <div className="space-y-4 p-5">
              {notice && <Notice notice={notice} onClose={() => setNotice(null)} />}
              <label className="block"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Producto / insumo</span><select value={adjustmentForm.productId} onChange={(event) => setAdjustmentForm((current) => ({ ...current, productId: event.target.value, batchId: '' }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-cyan-400"><option value="">Selecciona...</option>{inventoryProducts.map((product) => <option key={product.id} value={product.id}>{product.name} · stock {formatCafeInventoryQuantity(product.stock)} {getProductStockUnit(product) || 'unidad'}</option>)}</select></label>
              <div className="grid gap-3 sm:grid-cols-2"><label><span className="text-xs font-black uppercase tracking-wider text-slate-500">{adjustmentForm.kind === 'waste' ? 'Cantidad perdida' : 'Stock contado'}</span><input type="number" min="0" step="0.001" value={adjustmentForm.quantity} onChange={(event) => setAdjustmentForm((current) => ({ ...current, quantity: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-400" /></label><label><span className="text-xs font-black uppercase tracking-wider text-slate-500">Fecha</span><input type="date" value={adjustmentForm.eventDate} onChange={(event) => setAdjustmentForm((current) => ({ ...current, eventDate: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-400" /></label></div>
              <label className="block"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Motivo</span><select value={adjustmentForm.reasonCode} onChange={(event) => setAdjustmentForm((current) => ({ ...current, reasonCode: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-cyan-400"><option value="">Selecciona...</option>{adjustmentReasons.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
              {adjustmentForm.kind === 'waste' && relatedBatches.length > 0 && <label className="block"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Lote relacionado (opcional)</span><select value={adjustmentForm.batchId} onChange={(event) => setAdjustmentForm((current) => ({ ...current, batchId: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-cyan-400"><option value="">Sin lote específico</option>{relatedBatches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batchCode} · {formatCafeInventoryDate(batch.productionDate)}</option>)}</select></label>}
              {selectedAdjustmentProduct && <div className="rounded-2xl bg-slate-50 p-4"><div className="grid grid-cols-3 gap-3 text-center"><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Antes</p><p className="mt-1 font-black text-slate-900">{formatCafeInventoryQuantity(adjustmentStock)}</p></div><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Diferencia</p><p className={`mt-1 font-black ${adjustmentDelta < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{adjustmentDelta > 0 ? '+' : ''}{formatCafeInventoryQuantity(adjustmentDelta)}</p></div><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Después</p><p className="mt-1 font-black text-slate-900">{formatCafeInventoryQuantity(adjustmentStockAfter)}</p></div></div><p className="mt-2 text-center text-xs font-semibold text-slate-400">Unidad: {adjustmentUnit}</p></div>}
              <label className="block"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Notas</span><textarea rows="3" value={adjustmentForm.notes} onChange={(event) => setAdjustmentForm((current) => ({ ...current, notes: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-400" /></label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 p-5"><button type="button" onClick={() => setAdjustmentOpen(false)} className="iq-secondary-button">Cancelar</button><button type="submit" disabled={saving} className="iq-primary-button">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Guardar</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
