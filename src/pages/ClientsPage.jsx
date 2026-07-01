import React, { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, DollarSign, Edit, ReceiptText, Search, ShoppingCart, Trash2, Users } from 'lucide-react';
import Field from '../components/Field';
import Metric from '../components/Metric';
import EmptyState from '../components/EmptyState';
import { getProductDisplayName } from '../utils/products';
import { findProductByCodeOrName } from '../utils/productSearch';
import { toMoneyNumber } from '../utils/payments';
import {
  isCustomerAccountsAvailable,
  safeJsonArray,
  getClientAccountTotals,
} from '../utils/clientAccounts';

export default function ClientsPage({ currentUser, clients, products, sales, clientForm, setClientForm, saveClient, resetClientForm, editClient, deleteClient, editingClientId, pendingDeleteClientId, setPendingDeleteClientId, clientNotice, clientsLoading, setActive, setSaleForm, addClientAccountItem, addClientAccountPayment, cancelClientAccountItem }) {
  const CLIENTS_PAGE_SIZE = 15;
  const [accountForms, setAccountForms] = useState({});
  const [paymentForms, setPaymentForms] = useState({});
  const [expandedAccounts, setExpandedAccounts] = useState({});
  const [clientSearch, setClientSearch] = useState('');
  const [clientPage, setClientPage] = useState(1);
  const customerAccountsEnabled = isCustomerAccountsAvailable(currentUser);
  const completedSales = sales.filter(sale => sale.status !== 'Anulada');
  const accountSummary = clients.reduce((acc, client) => {
    const totals = getClientAccountTotals(client);
    acc.pending += totals.pending;
    acc.paid += totals.paid;
    acc.pendingItems += totals.pendingItems;
    return acc;
  }, { pending: 0, paid: 0, pendingItems: 0 });
  const clientsWithStats = clients.map(client => {
    const clientSales = getClientSales(client);
    const totalPurchased = clientSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const lastSale = clientSales[0];
    return { ...client, clientSales, totalPurchased, lastSale };
  });
  const normalizedClientSearch = clientSearch.trim().toLowerCase();
  const filteredClientsWithStats = clientsWithStats.filter(client => {
    if (!normalizedClientSearch) return true;

    const searchableText = [
      client.name,
      client.phone,
      client.email,
      client.identification,
      client.invoiceName,
      client.address,
      client.type,
      client.notes,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchableText.includes(normalizedClientSearch);
  });
  const totalClientPages = Math.max(1, Math.ceil(filteredClientsWithStats.length / CLIENTS_PAGE_SIZE));
  const safeClientPage = Math.min(clientPage, totalClientPages);
  const paginatedClients = filteredClientsWithStats.slice(
    (safeClientPage - 1) * CLIENTS_PAGE_SIZE,
    safeClientPage * CLIENTS_PAGE_SIZE,
  );
  const bestClient = [...clientsWithStats].sort((a, b) => b.totalPurchased - a.totalPurchased)[0];

  useEffect(() => {
    setClientPage(1);
  }, [clientSearch, clients.length]);

  const defaultAccountForm = {
    type: 'acumulativo',
    productId: '',
    productSearch: '',
    quantity: '1',
    unitPrice: '',
    initialPayment: '',
    paymentMethod: 'Efectivo',
    note: '',
  };

  function sellToClient(client) {
    setSaleForm(prev => ({
      ...prev,
      saleType: 'factura',
      customerId: client.id,
      customer: client.name,
      invoiceEnabled: true,
      invoiceName: client.invoiceName || client.name,
      invoiceIdentification: client.identification || '',
      invoiceAddress: client.address || '',
      invoiceEmail: client.email || '',
    }));
    setActive('Ventas');
  }

  function getClientSales(client) {
    return sales.filter(sale => {
      if (sale.status === 'Anulada') return false;
      const saleCustomer = String(sale.customer || '').trim().toLowerCase();
      const saleInvoiceName = String(sale.invoiceName || '').trim().toLowerCase();
      const saleId = String(sale.invoiceIdentification || '').trim();
      const clientName = String(client.name || '').trim().toLowerCase();
      const clientInvoiceName = String(client.invoiceName || '').trim().toLowerCase();
      const clientId = String(client.identification || '').trim();

      return (
        saleCustomer === clientName ||
        saleInvoiceName === clientName ||
        (clientInvoiceName && saleCustomer === clientInvoiceName) ||
        (clientInvoiceName && saleInvoiceName === clientInvoiceName) ||
        (clientId && saleId && saleId === clientId)
      );
    });
  }

  function getAccountForm(clientId) {
    return accountForms[clientId] || defaultAccountForm;
  }

  function updateAccountForm(clientId, changes) {
    setAccountForms(prev => ({
      ...prev,
      [clientId]: {
        ...getAccountForm(clientId),
        ...changes,
      },
    }));
  }

  function getPaymentForm(itemId) {
    return paymentForms[itemId] || { amount: '', paymentMethod: 'Efectivo', note: '' };
  }

  function updatePaymentForm(itemId, changes) {
    setPaymentForms(prev => ({
      ...prev,
      [itemId]: {
        ...getPaymentForm(itemId),
        ...changes,
      },
    }));
  }

  function toggleClientAccounts(clientId) {
    setExpandedAccounts(prev => ({
      ...prev,
      [clientId]: !prev[clientId],
    }));
  }

  function findAccountProductBySearch(value) {
    return findProductByCodeOrName(products, value);
  }

  function getAccountProductPreview(clientId) {
    const form = getAccountForm(clientId);
    if (form.productId) return products.find(product => String(product.id) === String(form.productId));
    return findAccountProductBySearch(form.productSearch);
  }

  function handleAccountProductSearch(clientId, value) {
    const product = findAccountProductBySearch(value);
    updateAccountForm(clientId, {
      productSearch: value,
      productId: product ? product.id : '',
      unitPrice: product ? String(product.price || '') : getAccountForm(clientId).unitPrice,
    });
  }

  async function submitAccountItem(e, client) {
    e.preventDefault();
    const form = getAccountForm(client.id);
    const product = form.productId ? products.find(item => String(item.id) === String(form.productId)) : findAccountProductBySearch(form.productSearch);
    const saved = await addClientAccountItem(client.id, {
      ...form,
      productId: product?.id || form.productId,
    });
    if (saved) setAccountForms(prev => ({ ...prev, [client.id]: defaultAccountForm }));
  }

  async function submitPayment(e, client, item) {
    e.preventDefault();
    const saved = await addClientAccountPayment(client.id, item.id, getPaymentForm(item.id));
    if (saved) setPaymentForms(prev => ({ ...prev, [item.id]: { amount: '', paymentMethod: 'Efectivo', note: '' } }));
  }

  function formatShortDate(value) {
    if (!value) return 'Sin fecha';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Sin fecha';
    return date.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function renderAccountItems(client) {
    const accountItems = safeJsonArray(client.accountItems);
    const activeItems = accountItems.filter(item => item.status !== 'Cancelado');
    const totals = getClientAccountTotals(client);
    const isOpen = Boolean(expandedAccounts[client.id]);
    const selectedProduct = getAccountProductPreview(client.id);
    if (!customerAccountsEnabled) return null;

    return (
      <div className="mt-3">
        {!isOpen ? null : (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="font-bold text-emerald-950">Fiado / plan acumulativo</h4>
                <p className="text-xs font-semibold text-emerald-700">Busca por código de barras o nombre. Los abonos entran como ingreso y el stock baja al completar el pago.</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700">Pendiente: ${totals.pending.toFixed(2)}</span>
            </div>

            <form onSubmit={e => submitAccountItem(e, client)} className="mb-4 rounded-2xl bg-white p-3">
              <div className="grid gap-3 lg:grid-cols-[2fr_1fr_90px_110px_120px_130px]">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-600">Código o nombre de la prenda</span>
                  <input
                    value={getAccountForm(client.id).productSearch}
                    onChange={e => handleAccountProductSearch(client.id, e.target.value)}
                    placeholder="Escanea código o escribe nombre"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                  {selectedProduct ? (
                    <p className="mt-1 text-xs font-semibold text-emerald-700">
                      {getProductDisplayName(selectedProduct)} · Stock {selectedProduct.stock}
                    </p>
                  ) : getAccountForm(client.id).productSearch ? (
                    <p className="mt-1 text-xs font-semibold text-amber-600">No se encontró una coincidencia exacta por código o nombre.</p>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-600">Tipo</span>
                  <select value={getAccountForm(client.id).type} onChange={e => updateAccountForm(client.id, { type: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200">
                    <option value="acumulativo">Plan acumulativo</option>
                    <option value="fiado">Fiado</option>
                  </select>
                </label>

                <Field label="Cant." type="number" value={getAccountForm(client.id).quantity} onChange={v => updateAccountForm(client.id, { quantity: v })} min="1" step="1" />
                <Field label="Valor" type="number" value={getAccountForm(client.id).unitPrice} onChange={v => updateAccountForm(client.id, { unitPrice: v })} placeholder="Ej: 25" min="0" step="0.01" />
                <Field label="Abono inicial" type="number" value={getAccountForm(client.id).initialPayment} onChange={v => updateAccountForm(client.id, { initialPayment: v })} placeholder="Opcional" min="0" step="0.01" />

                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-600">Método</span>
                  <select value={getAccountForm(client.id).paymentMethod} onChange={e => updateAccountForm(client.id, { paymentMethod: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200">
                    <option>Efectivo</option>
                    <option>Transferencia</option>
                    <option>Tarjeta</option>
                  </select>
                </label>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                <Field label="Nota" value={getAccountForm(client.id).note} onChange={v => updateAccountForm(client.id, { note: v })} placeholder="Ej: separa para retirar el viernes" />
                <div className="flex items-end">
                  <button type="submit" className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700">Agregar prenda</button>
                </div>
              </div>
            </form>

            {activeItems.length === 0 ? (
              <p className="rounded-2xl bg-white p-3 text-sm font-semibold text-slate-500">Este cliente no tiene prendas fiadas ni en plan acumulativo.</p>
            ) : (
              <div className="space-y-3">
                {activeItems.map(item => {
                  const total = toMoneyNumber(item.total);
                  const paid = toMoneyNumber(item.paid);
                  const pending = Math.max(total - paid, 0);
                  const paymentForm = getPaymentForm(item.id);
                  const isPaid = item.status === 'Pagado';
                  const typeLabel = item.type === 'fiado' ? 'Fiado' : 'Plan acumulativo';

                  return (
                    <div key={item.id} className="rounded-2xl bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-slate-900">{item.productName}</p>
                            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">{typeLabel}</span>
                            <span className={`rounded-full px-2 py-1 text-xs font-bold ${isPaid ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{isPaid ? 'Pagado' : 'Pendiente'}</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">Cantidad: {item.quantity} · Registrado: {formatShortDate(item.createdAt)}</p>
                          {item.note && <p className="mt-1 text-xs text-slate-500">Nota: {item.note}</p>}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold text-slate-600">
                          <div className="rounded-xl bg-slate-50 p-2"><span className="block text-slate-400">Total</span>${total.toFixed(2)}</div>
                          <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><span className="block text-emerald-500">Abonado</span>${paid.toFixed(2)}</div>
                          <div className="rounded-xl bg-amber-50 p-2 text-amber-700"><span className="block text-amber-500">Falta</span>${pending.toFixed(2)}</div>
                        </div>
                      </div>

                      {!isPaid && (
                        <form onSubmit={e => submitPayment(e, client, item)} className="mt-3 grid gap-3 rounded-2xl bg-slate-50 p-3 md:grid-cols-[120px_150px_1fr_auto]">
                          <Field label="Abono" type="number" value={paymentForm.amount} onChange={v => updatePaymentForm(item.id, { amount: v })} placeholder={`Máx. ${pending.toFixed(2)}`} min="0" step="0.01" />
                          <label className="block">
                            <span className="mb-1 block text-xs font-bold text-slate-600">Método</span>
                            <select value={paymentForm.paymentMethod} onChange={e => updatePaymentForm(item.id, { paymentMethod: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200">
                              <option>Efectivo</option>
                              <option>Transferencia</option>
                              <option>Tarjeta</option>
                            </select>
                          </label>
                          <Field label="Nota del abono" value={paymentForm.note} onChange={v => updatePaymentForm(item.id, { note: v })} placeholder="Ej: segundo abono" />
                          <div className="flex items-end gap-2">
                            <button type="submit" className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700">Abonar</button>
                            <button type="button" onClick={() => cancelClientAccountItem(client.id, item.id)} className="rounded-xl border border-red-100 px-3 py-3 text-sm font-bold text-red-600 hover:bg-red-50">Quitar</button>
                          </div>
                        </form>
                      )}

                      {safeJsonArray(item.payments).length > 0 && (
                        <div className="mt-3 rounded-2xl border border-slate-100 p-3">
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Historial de abonos</p>
                          <div className="space-y-1">
                            {safeJsonArray(item.payments).map(payment => (
                              <div key={payment.id} className="flex flex-wrap justify-between gap-2 text-xs text-slate-600">
                                <span>{formatShortDate(payment.createdAt)} · {payment.paymentMethod}</span>
                                <strong className="text-emerald-700">${toMoneyNumber(payment.amount).toFixed(2)}</strong>
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
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric icon={Users} label="Clientes" value={clients.length} note="registrados" color="emerald" />
        <Metric icon={ShoppingCart} label="Ventas con cliente" value={completedSales.filter(sale => sale.customer && sale.customer !== 'Consumidor final').length} note="factura / nombre" color="blue" />
        <Metric icon={DollarSign} label="Mejor cliente" value={bestClient?.totalPurchased ? `$${bestClient.totalPurchased.toFixed(2)}` : '$0.00'} note={bestClient?.name || 'sin datos'} color="amber" />
        <Metric icon={ReceiptText} label="Facturan" value={clients.filter(client => client.wantsInvoice).length} note="clientes" color="red" />
      </section>

      {customerAccountsEnabled && (
        <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Metric icon={ClipboardList} label="Prendas pendientes" value={accountSummary.pendingItems} note="fiado / acumulativo" color="amber" />
          <Metric icon={DollarSign} label="Saldo pendiente" value={`$${accountSummary.pending.toFixed(2)}`} note="por cobrar" color="red" />
          <Metric icon={CheckCircle2} label="Abonos recibidos" value={`$${accountSummary.paid.toFixed(2)}`} note="registrados" color="emerald" />
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
        <section className="order-2 rounded-3xl border border-slate-200 bg-white shadow-sm xl:order-1">
          {clientsLoading && <div className="border-b border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Cargando clientes desde Supabase...</div>}
          <div className="border-b border-slate-100 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-xl font-bold"><Users className="h-5 w-5 text-emerald-600" /> Clientes registrados</h3>
                <p className="mt-1 text-sm text-slate-500">Busca por nombre, teléfono, correo o cédula. Se muestran 15 clientes por página.</p>
              </div>
              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  placeholder="Buscar cliente..."
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {clients.length === 0 && <div className="p-5"><EmptyState icon={Users} title="Aún no tienes clientes" text="Guarda clientes frecuentes para facturar más rápido y consultar su información." /></div>}
            {clients.length > 0 && filteredClientsWithStats.length === 0 && (
              <div className="p-5"><EmptyState icon={Search} title="No se encontraron clientes" text="Prueba con otro nombre, teléfono, correo o cédula." /></div>
            )}
            {paginatedClients.map(client => {
              const isDeleting = pendingDeleteClientId === client.id;
              const clientSales = client.clientSales;
              const totalPurchased = client.totalPurchased;
              const lastSale = client.lastSale;
              const totals = getClientAccountTotals(client);
              return (
                <div key={client.id} className="p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-900">{client.name}</p>
                        {customerAccountsEnabled && (
                          <button
                            type="button"
                            onClick={() => toggleClientAccounts(client.id)}
                            className={`rounded-full px-3 py-1 text-xs font-bold transition ${expandedAccounts[client.id] ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                          >
                            Fiado / Plan acumulativo
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">{client.phone} · {client.type}</p>
                      <div className="mt-1 space-y-1">
                        <p className="text-xs text-slate-400">{client.email || 'Sin correo'} {client.wantsInvoice ? '· pide factura' : ''}</p>
                        <p className="text-xs font-semibold text-emerald-700">Historial: {clientSales.length} compra(s) · Total ${totalPurchased.toFixed(2)}</p>
                        {customerAccountsEnabled && totals.pending > 0 && <p className="text-xs font-bold text-amber-600">Pendiente fiado/acumulativo: ${totals.pending.toFixed(2)}</p>}
                        {lastSale && <p className="text-xs text-slate-500">Última compra: {lastSale.code} · {lastSale.date} · ${Number(lastSale.total || 0).toFixed(2)}</p>}
                        {client.notes && <p className="text-xs text-slate-500">Nota: {client.notes}</p>}
                      </div>
                    </div>
                    {isDeleting ? (
                      <div className="flex gap-2">
                        <button onClick={() => deleteClient(client.id)} className="rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-white hover:bg-red-600">Confirmar</button>
                        <button onClick={() => setPendingDeleteClientId(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50">Cancelar</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => sellToClient(client)} className="rounded-xl border border-emerald-100 px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50">Vender</button>
                        <button onClick={() => editClient(client)} className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50"><Edit className="h-4 w-4" /></button>
                        <button onClick={() => setPendingDeleteClientId(client.id)} className="rounded-xl border border-red-100 p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    )}
                  </div>
                  {renderAccountItems(client)}
                </div>
              );
            })}
          </div>
          {filteredClientsWithStats.length > CLIENTS_PAGE_SIZE && (
            <div className="flex flex-col gap-3 border-t border-slate-100 p-5 text-sm font-semibold text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Mostrando {((safeClientPage - 1) * CLIENTS_PAGE_SIZE) + 1} a {Math.min(safeClientPage * CLIENTS_PAGE_SIZE, filteredClientsWithStats.length)} de {filteredClientsWithStats.length} clientes
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setClientPage(page => Math.max(1, page - 1))}
                  disabled={safeClientPage === 1}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-50"
                >
                  Anterior
                </button>
                {Array.from({ length: totalClientPages }, (_, index) => index + 1).map(page => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setClientPage(page)}
                    className={`rounded-xl px-3 py-2 text-xs font-bold transition ${safeClientPage === page ? 'bg-emerald-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setClientPage(page => Math.min(totalClientPages, page + 1))}
                  disabled={safeClientPage === totalClientPages}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </section>

        <form onSubmit={saveClient} className="order-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:order-2">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">{editingClientId ? 'Editar cliente' : 'Registrar cliente'}</h3>
              <p className="text-sm text-slate-500">Administra tus clientes frecuentes.</p>
            </div>
            <button type="button" onClick={resetClientForm} className="rounded-xl p-2 hover:bg-slate-50">×</button>
          </div>

          {clientNotice && (
            <div className={`mb-4 rounded-2xl p-4 text-sm font-semibold ${clientNotice.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {clientNotice.message}
            </div>
          )}

          <div className="space-y-4">
            <Field label="Nombre del cliente" value={clientForm.name} onChange={v => setClientForm({ ...clientForm, name: v })} placeholder="Ej: Juan Pérez" />
            <Field label="Teléfono" value={clientForm.phone} onChange={v => setClientForm({ ...clientForm, phone: v })} placeholder="Ej: 099 000 0000" />
            <Field label="Correo" value={clientForm.email} onChange={v => setClientForm({ ...clientForm, email: v })} placeholder="Ej: cliente@email.com" />
            <Field label="Cédula / RUC" value={clientForm.identification} onChange={v => setClientForm({ ...clientForm, identification: v })} placeholder="Ej: 1000000001" />
            <Field label="Dirección" value={clientForm.address} onChange={v => setClientForm({ ...clientForm, address: v })} placeholder="Dirección para factura" />
            <Field label="Nombre para factura" value={clientForm.invoiceName} onChange={v => setClientForm({ ...clientForm, invoiceName: v })} placeholder="Nombre o razón social" />
            <label className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
              <input type="checkbox" checked={clientForm.wantsInvoice} onChange={e => setClientForm({ ...clientForm, wantsInvoice: e.target.checked })} className="h-4 w-4" />
              Cliente frecuente que solicita factura
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Tipo de cliente</span>
              <select value={clientForm.type} onChange={e => setClientForm({ ...clientForm, type: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200">
                <option>Nuevo</option>
                <option>Regular</option>
                <option>Frecuente</option>
                <option>Mayorista</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Observaciones</span>
              <textarea value={clientForm.notes} onChange={e => setClientForm({ ...clientForm, notes: e.target.value })} className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200" placeholder="Preferencias, horarios, notas..." />
            </label>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button type="button" onClick={resetClientForm} className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold hover:bg-slate-50">Cancelar</button>
              <button type="submit" className="rounded-2xl bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700">{editingClientId ? 'Actualizar cliente' : 'Guardar cliente'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
