import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Boxes,
  DollarSign,
  Download,
  Search,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';

import Field from '../components/Field';
import Metric from '../components/Metric';
import EmptyState from '../components/EmptyState';
import { PRODUCT_SEARCH_LIMIT } from '../config/constants';
import { getBusinessConfig } from '../config/businessTypes';
import { exportToCSV } from '../utils/csv';
import {
  getProductDisplayName,
  searchProductsForPicker,
} from '../utils/products';
import {
  INVENTORY_ALERTS_PAGE_SIZE,
  INVENTORY_MOVEMENTS_PAGE_SIZE,
  INVENTORY_SUMMARY_PAGE_SIZE,
  buildInventoryExportRows,
  buildInventoryMovements,
  getInventoryCollections,
  getPaginatedData,
} from '../utils/inventoryPage';

export default function InventoryPage({ currentUser, products, sales, purchases, lowStock, noStock, inventoryValue, potentialProfit, statusText, expirationText, adjustProductStock }) {
  const [inventoryView, setInventoryView] = useState('Alertas');
  const [adjustForm, setAdjustForm] = useState({ productId: '', stock: '', reason: 'Conteo físico' });
  const [adjustNotice, setAdjustNotice] = useState(null);
  const [adjustProductSearch, setAdjustProductSearch] = useState('');
  const [inventoryAlertsPage, setInventoryAlertsPage] = useState(1);
  const [expirationAlertsPage, setExpirationAlertsPage] = useState(1);
  const [movementsPage, setMovementsPage] = useState(1);
  const [summaryCriticalPage, setSummaryCriticalPage] = useState(1);
  const [summaryLowStockPage, setSummaryLowStockPage] = useState(1);
  const [summaryExpirationPage, setSummaryExpirationPage] = useState(1);

  const businessConfig = getBusinessConfig(currentUser?.businessType);
  const {
    alerts,
    criticalProducts,
    expiredProducts,
    expiringProducts,
    expirationAlerts,
    lowStockProducts,
  } = useMemo(
    () => getInventoryCollections(products, businessConfig, expirationText),
    [products, businessConfig, expirationText]
  );
  const selectedProduct = products.find(product => String(product.id) === String(adjustForm.productId));
  const adjustSearchResults = useMemo(() => searchProductsForPicker(products, adjustProductSearch, { limit: PRODUCT_SEARCH_LIMIT }), [products, adjustProductSearch]);


  function PaginationControls({ pageData, onPageChange, label }) {
    if (pageData.totalItems <= pageData.items.length || pageData.totalPages <= 1) return null;

    return (
      <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>{label || 'Mostrando'} {pageData.startIndex + 1} a {pageData.endIndex} de {pageData.totalItems}</span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page => Math.max(1, page - 1))}
            disabled={pageData.safePage === 1}
            className="rounded-xl border border-slate-200 px-3 py-2 font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="rounded-xl bg-slate-50 px-3 py-2 font-bold text-slate-700">Página {pageData.safePage} de {pageData.totalPages}</span>
          <button
            type="button"
            onClick={() => onPageChange(page => Math.min(pageData.totalPages, page + 1))}
            disabled={pageData.safePage === pageData.totalPages}
            className="rounded-xl border border-slate-200 px-3 py-2 font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      </div>
    );
  }

  const inventoryAlertsData = getPaginatedData(alerts, inventoryAlertsPage, INVENTORY_ALERTS_PAGE_SIZE);
  const expirationAlertsData = getPaginatedData(expirationAlerts, expirationAlertsPage, INVENTORY_ALERTS_PAGE_SIZE);

  useEffect(() => {
    setInventoryAlertsPage(1);
  }, [alerts.length]);

  useEffect(() => {
    setExpirationAlertsPage(1);
  }, [expirationAlerts.length]);

  useEffect(() => {
    setSummaryCriticalPage(1);
  }, [criticalProducts.length]);

  useEffect(() => {
    setSummaryLowStockPage(1);
  }, [lowStockProducts.length]);

  useEffect(() => {
    setSummaryExpirationPage(1);
  }, [expirationAlerts.length]);

  function selectAdjustProduct(productId) {
    const product = products.find(item => String(item.id) === String(productId));
    if (!product) return;
    setAdjustForm({ ...adjustForm, productId: product.id, stock: product.stock });
    setAdjustProductSearch(getProductDisplayName(product));
  }

  function handleAdjustProductSearch(value) {
    setAdjustProductSearch(value);
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return;

    const exactProduct = products.find(product =>
      String(product.barcode || '').trim().toLowerCase() === normalized ||
      String(product.sku || '').trim().toLowerCase() === normalized
    );

    if (exactProduct) selectAdjustProduct(exactProduct.id);
  }

  const inventoryMovements = useMemo(
    () => buildInventoryMovements(purchases, sales),
    [purchases, sales]
  );

  const movementsData = getPaginatedData(inventoryMovements, movementsPage, INVENTORY_MOVEMENTS_PAGE_SIZE);
  const criticalSummaryData = getPaginatedData(criticalProducts, summaryCriticalPage, INVENTORY_SUMMARY_PAGE_SIZE);
  const lowStockSummaryData = getPaginatedData(lowStockProducts, summaryLowStockPage, INVENTORY_SUMMARY_PAGE_SIZE);
  const expirationSummaryData = getPaginatedData(expirationAlerts, summaryExpirationPage, INVENTORY_SUMMARY_PAGE_SIZE);

  useEffect(() => {
    setMovementsPage(1);
  }, [inventoryMovements.length]);

  async function submitStockAdjustment(e) {
    e.preventDefault();

    if (!selectedProduct) {
      setAdjustNotice({ type: 'error', message: 'Selecciona un producto para ajustar.' });
      return;
    }

    try {
      await adjustProductStock(selectedProduct.id, adjustForm.stock, adjustForm.reason);
      setAdjustNotice({ type: 'success', message: `Stock de ${selectedProduct.name} ajustado correctamente.` });
      setAdjustForm({ productId: '', stock: '', reason: 'Conteo físico' });
      setAdjustProductSearch('');
    } catch (error) {
      setAdjustNotice({ type: 'error', message: `No se pudo ajustar el stock: ${error.message}` });
    }
  }

  function exportInventory() {
    const rows = buildInventoryExportRows(products, businessConfig, statusText, expirationText);

    exportToCSV(`inventiq_inventario_${currentUser?.businessType || 'general'}.csv`, rows);
  }

  function renderSummaryCard({ title, subtitle, empty, pageData, onPageChange, items }) {
    function badgeClasses(tone) {
      if (tone === 'red') return 'bg-red-50 text-red-700';
      if (tone === 'amber') return 'bg-amber-50 text-amber-700';
      return 'bg-emerald-50 text-emerald-700';
    }

    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="space-y-3">
          {items.length === 0 && <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{empty}</p>}
          {items.map(item => (
            <div key={item.key} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 p-4">
              <div>
                <p className="font-bold text-slate-900">{item.title}</p>
                <p className="text-sm text-slate-500">{item.subtitle}</p>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${badgeClasses(item.tone)}`}>{item.badge}</span>
            </div>
          ))}
        </div>
        <PaginationControls pageData={pageData} onPageChange={onPageChange} label="Mostrando" />
      </section>
    );
  }

  const views = ['Alertas', 'Movimientos', 'Ajuste de stock', 'Resumen'];

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Metric icon={DollarSign} label="Valor inventario" value={`$${inventoryValue.toFixed(2)}`} note="actual" color="blue" />
        <Metric icon={TrendingUp} label="Ganancia potencial" value={`$${potentialProfit.toFixed(2)}`} note="estimada" color="emerald" />
        <Metric icon={Boxes} label="Stock bajo" value={lowStock} note="productos" color="amber" />
        <Metric icon={ShoppingCart} label="Sin stock" value={noStock} note="productos" color="red" />
      </section>

      <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-emerald-900">Control de inventario</h3>
            <p className="text-sm text-emerald-800">{alerts.length} productos con alerta, {criticalProducts.length} sin stock{businessConfig.usesExpiration ? `, ${expiringProducts.length} próximos a caducar y ${expiredProducts.length} vencidos` : '. Este tipo de negocio no usa caducidad.'}</p>
          </div>
          <button onClick={exportInventory} className="rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700">
            <Download className="mr-2 inline h-5 w-5" />Exportar inventario
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {views.map(view => (
            <button key={view} onClick={() => setInventoryView(view)} className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${inventoryView === view ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
              {view}
            </button>
          ))}
        </div>
      </section>

      {inventoryView === 'Alertas' && (
        <section className={`grid grid-cols-1 gap-5 ${businessConfig.usesExpiration ? 'xl:grid-cols-2' : ''}`}>
          {businessConfig.usesExpiration && <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-xl font-bold">Alertas de caducidad</h3>
                <p className="text-sm text-slate-500">Vencidos y próximos a caducar.</p>
              </div>
              {expirationAlerts.length > 0 && <span className="text-xs font-bold text-slate-500">{expirationAlerts.length} alerta(s)</span>}
            </div>
            <div className="space-y-3">
              {expirationAlerts.length === 0 && <p className="rounded-2xl bg-emerald-50 p-4 text-emerald-700">No existen productos vencidos o próximos a caducar.</p>}
              {expirationAlertsData.items.map(product => {
                const exp = expirationText(product);
                return (
                  <div key={`exp-${product.id}`} className="flex items-center justify-between rounded-2xl border border-slate-100 p-4">
                    <div>
                      <p className="font-bold">{product.name}</p>
                      <p className={`text-sm ${exp.color}`}>Caducidad: {product.expirationDate} · {exp.label} {exp.days !== null ? `(${exp.days} días)` : ''}</p>
                      <p className="text-xs text-slate-500">Lote: {product.batchNumber || 'No registrado'} · Stock: {product.stock}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${exp.badge}`}>{exp.label}</span>
                  </div>
                );
              })}
            </div>
            <PaginationControls pageData={expirationAlertsData} onPageChange={setExpirationAlertsPage} label="Mostrando" />
          </section>}

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-xl font-bold">Alertas de inventario</h3>
                <p className="text-sm text-slate-500">Stock bajo o agotado.</p>
              </div>
              {alerts.length > 0 && <span className="text-xs font-bold text-slate-500">{alerts.length} alerta(s)</span>}
            </div>
            <div className="space-y-3">
              {alerts.length === 0 && <p className="rounded-2xl bg-emerald-50 p-4 text-emerald-700">No existen alertas críticas de inventario.</p>}
              {inventoryAlertsData.items.map(product => {
                const s = statusText(product);
                return (
                  <div key={product.id} className="flex items-center justify-between rounded-2xl border border-slate-100 p-4">
                    <div>
                      <p className="font-bold">{product.name}</p>
                      <p className={`text-sm ${s.color}`}>{s.label} · Stock actual {product.stock} · Mínimo {product.minStock}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.badge}`}>{s.label}</span>
                  </div>
                );
              })}
            </div>
            <PaginationControls pageData={inventoryAlertsData} onPageChange={setInventoryAlertsPage} label="Mostrando" />
          </section>
        </section>
      )}

      {inventoryView === 'Movimientos' && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-xl font-bold">Movimientos de inventario</h3>
              <p className="text-sm text-slate-500">Entradas por compras, salidas por ventas y devoluciones por anulaciones.</p>
            </div>
            {inventoryMovements.length > 0 && <span className="text-xs font-bold text-slate-500">{inventoryMovements.length} movimiento(s)</span>}
          </div>
          <div className="space-y-3">
            {inventoryMovements.length === 0 && <EmptyState icon={Activity} title="Sin movimientos" text="Cuando registres compras o ventas, aquí aparecerá la bitácora de inventario." />}
            {movementsData.items.map(movement => (
              <div key={movement.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-slate-900">{movement.product}</p>
                  <p className="text-sm text-slate-500">{movement.type} · {movement.detail}</p>
                  <p className="text-xs text-slate-400">{movement.date}</p>
                </div>
                <span className={`rounded-full px-4 py-2 text-sm font-extrabold ${movement.tone === 'emerald' ? 'bg-emerald-50 text-emerald-700' : movement.tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                  {movement.quantity}
                </span>
              </div>
            ))}
          </div>
          <PaginationControls pageData={movementsData} onPageChange={setMovementsPage} label="Mostrando" />
        </section>
      )}

      {inventoryView === 'Ajuste de stock' && (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
          <form onSubmit={submitStockAdjustment} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-2 text-xl font-bold">Ajuste manual de stock</h3>
            <p className="mb-5 text-sm text-slate-500">Úsalo cuando el conteo físico no coincide con el sistema.</p>

            {adjustNotice && (
              <div className={`mb-4 rounded-2xl p-4 text-sm font-semibold ${adjustNotice.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {adjustNotice.message}
              </div>
            )}

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Buscar producto</span>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <input value={adjustProductSearch} onChange={e => handleAdjustProductSearch(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-emerald-200" placeholder="Buscar por nombre, SKU o código de barras..." />
                </div>
                {adjustProductSearch && adjustSearchResults.length > 0 && !selectedProduct && (
                  <div className="mb-3 max-h-56 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-2 shadow-sm">
                    {adjustSearchResults.map(product => (
                      <button type="button" key={product.id} onClick={() => selectAdjustProduct(product.id)} className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm hover:bg-emerald-50">
                        <span>
                          <strong className="text-slate-900">{getProductDisplayName(product)}</strong>
                          <span className="block text-xs text-slate-500">{product.sku || 'Sin SKU'} · {product.category}</span>
                        </span>
                        <span className="text-xs font-bold text-emerald-700">Stock {product.stock}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedProduct ? (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase text-emerald-700">Producto seleccionado</p>
                        <p className="mt-1 font-bold text-emerald-950">{getProductDisplayName(selectedProduct)}</p>
                        <p className="text-sm text-emerald-800">{selectedProduct.sku || 'Sin SKU'} · Stock actual {selectedProduct.stock}</p>
                      </div>
                      <button type="button" onClick={() => { setAdjustForm({ ...adjustForm, productId: '', stock: '' }); setAdjustProductSearch(''); }} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">Cambiar</button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Busca y selecciona un producto para ajustar el stock.</div>
                )}
                {adjustProductSearch && <p className="mt-2 text-xs text-slate-500">Mostrando máximo {PRODUCT_SEARCH_LIMIT} resultado(s). Escribe al menos 2 letras o escanea el código.</p>}
              </label>
              <Field label="Stock contado físicamente" type="number" min="0" value={adjustForm.stock} onChange={v => setAdjustForm({ ...adjustForm, stock: v })} placeholder="Ej: 18" />
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Motivo</span>
                <select value={adjustForm.reason} onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200">
                  <option>Conteo físico</option>
                  <option>Pérdida / daño</option>
                  {businessConfig.usesExpiration && <option>Producto vencido</option>}
                  <option>Corrección de inventario</option>
                  <option>Otro</option>
                </select>
              </label>
              {selectedProduct && (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  Stock actual en sistema: <strong>{selectedProduct.stock}</strong><br />
                  Diferencia: <strong>{Number(adjustForm.stock || 0) - Number(selectedProduct.stock || 0)}</strong>
                </div>
              )}
              <button type="submit" className="w-full rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700">Guardar ajuste</button>
            </div>
          </form>

          <section className="rounded-3xl border border-amber-100 bg-amber-50 p-6">
            <h3 className="mb-3 text-xl font-bold text-amber-900">Uso recomendado</h3>
            <p className="text-sm leading-6 text-amber-900">El ajuste manual debe usarse solo cuando se realiza conteo físico, se identifica pérdida/daño{businessConfig.usesExpiration ? ', producto vencido' : ''} o una corrección puntual. Las compras y ventas deben registrarse desde sus secciones correspondientes para mantener la trazabilidad.</p>
          </section>
        </section>
      )}

      {inventoryView === 'Resumen' && (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {renderSummaryCard({
            title: 'Sin stock',
            subtitle: 'Requieren reposición urgente',
            empty: 'No hay productos sin stock.',
            pageData: criticalSummaryData,
            onPageChange: setSummaryCriticalPage,
            items: criticalSummaryData.items.map(product => ({ key: `critical-${product.id}`, title: product.name, subtitle: `${product.category} · mínimo ${product.minStock}`, badge: 'Comprar', tone: 'red' })),
          })}
          {renderSummaryCard({
            title: 'Stock bajo',
            subtitle: 'Debes revisar reposición',
            empty: 'No hay stock bajo.',
            pageData: lowStockSummaryData,
            onPageChange: setSummaryLowStockPage,
            items: lowStockSummaryData.items.map(product => ({ key: `low-${product.id}`, title: product.name, subtitle: `${product.category} · Stock ${product.stock}/${product.minStock}`, badge: 'Alerta', tone: 'amber' })),
          })}
          {businessConfig.usesExpiration && renderSummaryCard({
            title: 'Caducidad',
            subtitle: 'Vencidos o próximos a caducar',
            empty: 'No hay alertas de caducidad.',
            pageData: expirationSummaryData,
            onPageChange: setSummaryExpirationPage,
            items: expirationSummaryData.items.map(product => {
              const exp = expirationText(product);
              return { key: `summary-exp-${product.id}`, title: product.name, subtitle: `${product.category} · ${product.expirationDate || 'Sin fecha'}`, badge: exp.label, tone: exp.label === 'Vencido' ? 'red' : 'amber' };
            }),
          })}
        </section>
      )}
    </div>
  );
}
