import React, { useEffect, useMemo, useState } from 'react';
import { PRODUCT_SEARCH_LIMIT } from '../config/constants';
import {
  getProductDisplayName,
  getProductVariantText,
} from '../utils/products';
import Metric from '../components/Metric';
import EmptyState from '../components/EmptyState';
import Field from '../components/Field';
import BarcodeScanner from '../components/BarcodeScanner';
import { filterProductsForBarcodeSearch, productMatchesExactCode } from '../utils/productSearch';
import {
  toMoneyNumber,
  isSplitPaymentAvailable,
  getSplitPaymentTotal,
  getPaymentDisplay,
} from '../utils/payments';
import {
  Boxes,
  Camera,
  DollarSign,
  Percent,
  ReceiptText,
  RotateCcw,
  Search,
  ShoppingCart,
  Trash2,
  TrendingUp,
} from 'lucide-react';

export default function SalesPage({ currentUser, sales, products, clients, saleForm, setSaleForm, saleCart, addSaleItem, removeSaleItem, updateSaleItemDiscount, clearSaleCart, registerSale, resetSaleForm, cancelSale, totalSales, totalProfit, totalDiscount, totalUnitsSold, saleNotice, salePreview, salesLoading, setReceiptSale }) {
  const [productSearch, setProductSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [salesPage, setSalesPage] = useState(1);
  const [saleHistoryFilter, setSaleHistoryFilter] = useState('completed');
  const { product, subtotal, discount, discountPercent, total, profit, error } = salePreview;
  const splitPaymentEnabled = isSplitPaymentAvailable(currentUser);
  const splitPaymentTotal = getSplitPaymentTotal(saleForm);
  const splitPaymentDifference = toMoneyNumber(splitPaymentTotal - toMoneyNumber(total));
  const filteredProducts = useMemo(
    () => filterProductsForBarcodeSearch(products, productSearch, { limit: PRODUCT_SEARCH_LIMIT, onlyWithStock: true }),
    [products, productSearch]
  );
  const salesPerPage = 20;
  const completedHistorySales = sales.filter(sale => sale.status !== 'Anulada');
  const canceledHistorySales = sales.filter(sale => sale.status === 'Anulada');
  const visibleHistorySales = saleHistoryFilter === 'canceled'
    ? canceledHistorySales
    : saleHistoryFilter === 'all'
      ? sales
      : completedHistorySales;
  const salesTotalPages = Math.max(Math.ceil(visibleHistorySales.length / salesPerPage), 1);
  const safeSalesPage = Math.min(salesPage, salesTotalPages);
  const salesStartIndex = (safeSalesPage - 1) * salesPerPage;
  const paginatedSales = visibleHistorySales.slice(salesStartIndex, salesStartIndex + salesPerPage);

  useEffect(() => {
    setSalesPage(1);
  }, [sales.length, saleHistoryFilter]);

  function handleProductSearch(value) {
    const cleanValue = String(value || '').trim();
    setProductSearch(value);

    const normalized = cleanValue.toLowerCase();
    if (!normalized) return;

    const exactProduct = products.find(product =>
      Number(product.stock || 0) > 0 && productMatchesExactCode(product, normalized)
    );

    if (exactProduct) {
      setSaleForm(prev => ({ ...prev, productId: exactProduct.id }));
      setProductSearch(getProductDisplayName(exactProduct));
    }
  }

  function handleSearchKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
    }
  }

  function addSelectedProductToCart() {
    addSaleItem();
    setProductSearch('');
  }

  function setSaleType(type) {
    if (type === 'consumidor') {
      setSaleForm({
        ...saleForm,
        saleType: 'consumidor',
        customerId: '',
        customer: '',
        invoiceEnabled: false,
        invoiceName: '',
        invoiceIdentification: '',
        invoiceAddress: '',
        invoiceEmail: '',
      });
      return;
    }

    setSaleForm({
      ...saleForm,
      saleType: 'factura',
      invoiceEnabled: true,
      customer: saleForm.customer || '',
    });
  }

  function selectClient(clientId) {
    const client = clients.find(item => String(item.id) === String(clientId));
    if (!client) {
      setSaleForm({
        ...saleForm,
        customerId: '',
        customer: '',
        invoiceEnabled: true,
        invoiceName: '',
        invoiceIdentification: '',
        invoiceAddress: '',
        invoiceEmail: '',
      });
      return;
    }

    setSaleForm({
      ...saleForm,
      saleType: 'factura',
      customerId: client.id,
      customer: client.name,
      invoiceEnabled: true,
      invoiceName: client.invoiceName || client.name,
      invoiceIdentification: client.identification || '',
      invoiceAddress: client.address || '',
      invoiceEmail: client.email || '',
    });
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Metric icon={DollarSign} label="Ventas acumuladas" value={`$${totalSales.toFixed(2)}`} note="total" color="emerald" />
        <Metric icon={TrendingUp} label="Utilidad estimada" value={`$${totalProfit.toFixed(2)}`} note="ganancia" color="blue" />
        <Metric icon={Percent} label="Descuentos" value={`$${totalDiscount.toFixed(2)}`} note="aplicados" color="amber" />
        <Metric icon={Boxes} label="Unidades vendidas" value={totalUnitsSold} note="productos" color="red" />
      </section>

      {salesLoading && <div className="rounded-2xl bg-cyan-50 p-4 text-sm font-semibold text-cyan-800">Cargando ventas desde Supabase...</div>}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_430px]">
        <div className="order-2 space-y-5 xl:order-1">
          <section className="iq-operation-card">
            <div className="border-b border-slate-100 p-5">
              <h3 className="iq-strong-title flex items-center gap-2 text-xl"><ReceiptText className="h-5 w-5 text-cyan-700" /> Historial de ventas</h3>
              <p className="mt-1 text-sm text-slate-500">Separa las ventas completadas de las anuladas para revisar mejor el movimiento.</p>
            </div>
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setSaleHistoryFilter('completed')} className={`rounded-xl px-4 py-2 text-xs font-bold transition ${saleHistoryFilter === 'completed' ? 'bg-cyan-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  Completadas ({completedHistorySales.length})
                </button>
                <button type="button" onClick={() => setSaleHistoryFilter('canceled')} className={`rounded-xl px-4 py-2 text-xs font-bold transition ${saleHistoryFilter === 'canceled' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  Anuladas ({canceledHistorySales.length})
                </button>
                <button type="button" onClick={() => setSaleHistoryFilter('all')} className={`rounded-xl px-4 py-2 text-xs font-bold transition ${saleHistoryFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  Todas ({sales.length})
                </button>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {visibleHistorySales.length === 0 && <div className="p-5"><EmptyState icon={ShoppingCart} title={saleHistoryFilter === 'canceled' ? 'No tienes ventas anuladas' : 'Aún no tienes ventas completadas'} text={saleHistoryFilter === 'canceled' ? 'Las ventas anuladas aparecerán separadas en esta pestaña.' : 'Registra tu primera venta para empezar a medir ingresos, utilidad y rotación.'} /></div>}
              {paginatedSales.map(sale => (
                <div key={sale.id} className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700"><ShoppingCart className="h-5 w-5" /></div>
                    <div>
                      <p className="font-bold">{sale.code}</p>
                      <p className="text-sm text-slate-500">{sale.product} · {sale.quantity} unidades · {sale.date}</p>
                      <p className="text-xs text-slate-400">Cliente: {sale.customer || 'Consumidor final'} · Pago: {getPaymentDisplay(sale)} {sale.invoiceEnabled ? '· Factura' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 lg:justify-end">
                    <div className="text-right">
                      <p className="font-bold">${sale.total.toFixed(2)}</p>
                      <p className="text-xs text-slate-500">Utilidad: ${(sale.profit || 0).toFixed(2)}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${sale.status === 'Anulada' ? 'bg-red-50 text-red-700' : 'bg-cyan-50 text-cyan-800'}`}>{sale.status}</span>
                    </div>
                    <button type="button" onClick={() => setReceiptSale(sale)} className="iq-action-secondary">
                      Comprobante
                    </button>
                    {sale.status !== 'Anulada' && (
                      <button onClick={() => cancelSale(sale.id)} className="iq-action-danger">
                        Anular
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {visibleHistorySales.length > salesPerPage && (
              <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <span>Mostrando {salesStartIndex + 1}-{Math.min(salesStartIndex + salesPerPage, visibleHistorySales.length)} de {visibleHistorySales.length} ventas</span>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={safeSalesPage <= 1} onClick={() => setSalesPage(page => Math.max(page - 1, 1))} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
                  <span className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">Página {safeSalesPage} de {salesTotalPages}</span>
                  <button type="button" disabled={safeSalesPage >= salesTotalPages} onClick={() => setSalesPage(page => Math.min(page + 1, salesTotalPages))} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button>
                </div>
              </div>
            )}
          </section>
        </div>

        <form onSubmit={registerSale} className="order-1 iq-operation-card iq-operation-card-accent iq-sticky-workspace p-6 xl:order-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Registrar nueva venta</h3>
              <p className="text-sm text-slate-500">Agrega varios productos al carrito y registra una sola venta.</p>
            </div>
            <button type="button" onClick={resetSaleForm} className="rounded-xl p-2 text-slate-500 hover:bg-slate-50"><RotateCcw className="h-5 w-5" /></button>
          </div>

          {saleNotice && (
            <div className={`mb-4 rounded-2xl p-4 text-sm font-semibold ${saleNotice.type === 'success' ? 'bg-cyan-50 text-cyan-800' : 'bg-red-50 text-red-700'}`}>
              {saleNotice.message}
            </div>
          )}

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Buscar producto</span>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <input value={productSearch} onChange={e => handleProductSearch(e.target.value)} onFocus={event => event.target.select()} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-cyan-200" placeholder="Buscar o escanear código de barras..." />
              </div>
              <button type="button" onClick={() => setScannerOpen(true)} className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-200 px-4 py-3 text-sm font-bold text-cyan-800 hover:bg-cyan-50">
                <Camera className="h-4 w-4" /> Escanear con cámara
              </button>
              {scannerOpen && <BarcodeScanner onScan={handleProductSearch} onClose={() => setScannerOpen(false)} />}
              {productSearch && filteredProducts.length > 0 && (
                <div className="mb-3 max-h-56 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-2 shadow-sm">
                  {filteredProducts.slice(0, 8).map(product => (
                    <button
                      type="button"
                      key={product.id}
                      onClick={() => {
                        setSaleForm(prev => ({ ...prev, productId: product.id }));
                        setProductSearch(getProductDisplayName(product));
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm hover:bg-cyan-50"
                    >
                      <span>
                        <strong className="text-slate-900">{getProductDisplayName(product)}</strong>
                        <span className="block text-xs text-slate-500">{product.sku || 'Sin SKU'} · {product.category}</span>
                      </span>
                      <span className="text-xs font-bold text-cyan-800">Stock {product.stock}</span>
                    </button>
                  ))}
                </div>
              )}
              {product ? (
                <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-cyan-800">Producto seleccionado</p>
                      <p className="mt-1 font-bold text-cyan-950">{getProductDisplayName(product)}</p>
                      <p className="text-sm text-cyan-900">{product.sku || 'Sin SKU'} · Stock disponible {product.stock}</p>
                    </div>
                    <button type="button" onClick={() => { setSaleForm(prev => ({ ...prev, productId: '' })); setProductSearch(''); }} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-cyan-800 hover:bg-cyan-100">Cambiar</button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Busca y selecciona un producto para agregarlo a la venta.</div>
              )}
              {productSearch && <p className="mt-2 text-xs text-slate-500">Mostrando máximo {PRODUCT_SEARCH_LIMIT} producto(s) con stock. Escribe al menos 2 letras o escanea el código.</p>}
            </label>

            {product && (
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-bold">{getProductDisplayName(product)}</p>
                <p className="text-sm text-slate-500">Precio: ${product.price.toFixed(2)} · Costo: ${product.cost.toFixed(2)} · Stock disponible: {product.stock}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Cantidad" type="number" value={saleForm.quantity} onChange={v => setSaleForm({ ...saleForm, quantity: v })} placeholder="1" min="1" />
              <button type="button" onClick={addSelectedProductToCart} className="mt-7 rounded-2xl bg-cyan-700 px-4 py-3 font-semibold text-white hover:bg-cyan-800">Agregar al carrito</button>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-bold text-slate-800">Carrito de venta</h4>
                {saleCart.length > 0 && <button type="button" onClick={clearSaleCart} className="text-xs font-bold text-red-500 hover:underline">Vaciar</button>}
              </div>
              {saleCart.length === 0 && <p className="text-sm text-slate-500">Todavía no agregas productos.</p>}
              <div className="space-y-2">
                {saleCart.map(item => {
                  const originalSubtotal = Number(item.originalSubtotal ?? (item.price * item.quantity));
                  const lineDiscount = Number(item.discount || 0);
                  const lineTotal = Number(item.subtotal ?? originalSubtotal);
                  const hasDiscount = lineDiscount > 0;

                  return (
                    <div key={item.productId} className="rounded-2xl bg-white p-3 text-sm shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-900">{item.product}</p>
                          <p className="text-xs text-slate-500">{item.quantity} x ${item.price.toFixed(2)} = ${originalSubtotal.toFixed(2)}</p>
                          {hasDiscount && <p className="mt-1 text-xs font-semibold text-cyan-800">Descuento: -${lineDiscount.toFixed(2)}</p>}
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="text-right">
                            <p className="font-bold text-cyan-800">${lineTotal.toFixed(2)}</p>
                            {hasDiscount && <p className="text-[11px] text-slate-400 line-through">${originalSubtotal.toFixed(2)}</p>}
                          </div>
                          <button type="button" onClick={() => removeSaleItem(item.productId)} className="rounded-xl border border-red-100 p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>

                      <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-600">Descuento</span>
                          {hasDiscount && <span className="rounded-full bg-cyan-100 px-2 py-1 text-[11px] font-bold text-cyan-800">-{item.discountPercent.toFixed(2)}%</span>}
                        </div>
                        <div className="grid grid-cols-[1fr_110px] gap-2">
                          <select
                            value={item.discountType || 'percent'}
                            onChange={e => updateSaleItemDiscount(item.productId, { discountType: e.target.value, discountValue: '' })}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-cyan-200"
                          >
                            <option value="percent">Porcentaje %</option>
                            <option value="fixed">Valor $</option>
                          </select>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={Number(item.discountValue || 0) === 0 ? '' : item.discountValue}
                            onChange={e => updateSaleItemDiscount(item.productId, { discountValue: e.target.value })}
                            placeholder={item.discountType === 'fixed' ? 'Ej: 2' : 'Ej: 10'}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-cyan-200"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="mb-2 block text-sm font-semibold text-slate-700">Tipo de venta</span>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setSaleType('consumidor')} className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${saleForm.saleType === 'consumidor' ? 'border-cyan-200 bg-cyan-50 text-cyan-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  Consumidor final
                </button>
                <button type="button" onClick={() => setSaleType('factura')} className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${saleForm.saleType === 'factura' ? 'border-cyan-200 bg-cyan-50 text-cyan-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  Factura
                </button>
              </div>
            </div>

            {saleForm.saleType === 'factura' && (
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
                <h4 className="mb-3 font-bold text-cyan-950">Factura rápida</h4>
                <label className="mb-3 block">
                  <span className="mb-2 block text-sm font-semibold text-cyan-950">Buscar cliente guardado</span>
                  <select value={saleForm.customerId} onChange={e => selectClient(e.target.value)} className="w-full rounded-2xl border border-cyan-100 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-200">
                    <option value="">Persona no registrada / llenar manual</option>
                    {clients.map(client => <option key={client.id} value={client.id}>{client.name} {client.wantsInvoice ? '· cliente frecuente' : ''}</option>)}
                  </select>
                </label>

                <label className="mb-3 flex items-center gap-3 rounded-2xl bg-white p-4 text-sm font-semibold text-cyan-900">
                  <input type="checkbox" checked={saleForm.invoiceEnabled} onChange={e => setSaleForm({ ...saleForm, invoiceEnabled: e.target.checked })} className="h-4 w-4" />
                  Crear factura para esta venta
                </label>

                {saleForm.invoiceEnabled && (
                  <div>
                    <h4 className="mb-3 font-bold text-cyan-950">Datos de facturación</h4>
                    <div className="space-y-3">
                      <Field label="Nombre / Razón social" value={saleForm.invoiceName} onChange={v => setSaleForm({ ...saleForm, invoiceName: v, customer: v })} placeholder="Nombre para la factura" />
                      <Field label="Cédula / RUC" value={saleForm.invoiceIdentification} onChange={v => setSaleForm({ ...saleForm, invoiceIdentification: v })} placeholder="Ej: 1000000001" />
                      <Field label="Dirección" value={saleForm.invoiceAddress} onChange={v => setSaleForm({ ...saleForm, invoiceAddress: v })} placeholder="Dirección del cliente" />
                      <Field label="Correo para factura" type="email" value={saleForm.invoiceEmail} onChange={v => setSaleForm({ ...saleForm, invoiceEmail: v })} placeholder="cliente@email.com" />
                    </div>
                  </div>
                )}
              </div>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Método de pago</span>
              <select
                value={saleForm.paymentMethod}
                onChange={e => {
                  const paymentMethod = e.target.value;
                  setSaleForm({
                    ...saleForm,
                    paymentMethod,
                    ...(paymentMethod === 'Mixto' ? {} : { cashAmount: '', cardAmount: '', transferAmount: '' }),
                  });
                }}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-200"
              >
                <option>Efectivo</option>
                <option>Transferencia</option>
                <option>Tarjeta</option>
                <option>Crédito</option>
                {splitPaymentEnabled && <option>Mixto</option>}
              </select>
            </label>

            {splitPaymentEnabled && saleForm.paymentMethod === 'Mixto' && (
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-cyan-950">Pago mixto</h4>
                    <p className="text-xs font-semibold text-cyan-800">Divide el total entre efectivo, tarjeta o transferencia.</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${Math.abs(splitPaymentDifference) <= 0.01 ? 'bg-cyan-100 text-cyan-800' : 'bg-red-100 text-red-700'}`}>
                    Suma: ${splitPaymentTotal.toFixed(2)}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Efectivo" type="number" value={saleForm.cashAmount || ''} onChange={v => setSaleForm({ ...saleForm, cashAmount: v })} placeholder="Ej: 80" min="0" step="0.01" />
                  <Field label="Tarjeta" type="number" value={saleForm.cardAmount || ''} onChange={v => setSaleForm({ ...saleForm, cardAmount: v })} placeholder="Ej: 40" min="0" step="0.01" />
                  <Field label="Transferencia" type="number" value={saleForm.transferAmount || ''} onChange={v => setSaleForm({ ...saleForm, transferAmount: v })} placeholder="Ej: 0" min="0" step="0.01" />
                </div>

                {Math.abs(splitPaymentDifference) > 0.01 && (
                  <p className="mt-3 text-xs font-bold text-red-600">
                    Falta o sobra ${Math.abs(splitPaymentDifference).toFixed(2)} para completar el total de la venta.
                  </p>
                )}
              </div>
            )}

            {error && <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

            <div className="iq-total-highlight">
              <div className="space-y-2 text-sm text-cyan-900">
                <div className="flex justify-between"><span>Subtotal</span><strong>${subtotal.toFixed(2)}</strong></div>
                <div className="flex justify-between"><span>Descuento ({discountPercent.toFixed(2)}%)</span><strong>-${discount.toFixed(2)}</strong></div>
                <div className="flex justify-between"><span>Utilidad estimada</span><strong>${profit.toFixed(2)}</strong></div>
              </div>
              <div className="mt-3 border-t border-cyan-100 pt-3">
                <p className="text-sm text-cyan-800">Total a cobrar</p>
                <p className="text-3xl font-extrabold text-cyan-950">${total.toFixed(2)}</p>
              </div>
            </div>

            <button type="submit" className="iq-primary-button w-full">Registrar venta</button>
          </div>
        </form>
      </section>
    </div>
  );
}
