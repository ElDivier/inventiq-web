import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Edit3,
  Loader2,
  MapPin,
  MessageCircle,
  PackageCheck,
  Phone,
  Plus,
  Search,
  UserRoundCheck,
  WalletCards,
  X,
  XCircle,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import {
  BAKERY_FULFILLMENT_OPTIONS,
  BAKERY_ORDER_STATUSES,
  BAKERY_PAYMENT_METHODS,
  buildBakeryOrderSummary,
  createBakeryOrderItem,
  createEmptyBakeryOrderForm,
  formatBakeryOrderDate,
  formatBakeryOrderMoney,
  formatBakeryOrderTime,
  getBakeryOrderStatus,
  getBakeryOrderTotals,
  getNextBakeryOrderActionLabel,
  getNextBakeryOrderStatus,
  getTodayDateInput,
  isBakeryOrderDueToday,
  isBakeryOrderDueWithinDays,
  isBakeryOrderOverdue,
  normalizeBakeryOrder,
  normalizePhoneForWhatsApp,
} from '../utils/bakeryOrders';

const FILTER_OPTIONS = [
  { value: 'active', label: 'Activos' },
  { value: 'today', label: 'Para hoy' },
  { value: 'week', label: 'Próximos 7 días' },
  { value: 'overdue', label: 'Atrasados' },
  { value: 'all', label: 'Todos' },
];

function getNowLocalInput() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export default function BakeryOrdersPage({ currentUser, products, clients, setActive }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(() => createEmptyBakeryOrderForm());
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'Efectivo',
    paidAt: getNowLocalInput(),
    notes: '',
  });
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  const saleProducts = useMemo(
    () => (products || [])
      .filter(product => ['finished_product', 'sale_product', 'service'].includes(product.productType || product.product_type || 'sale_product'))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es')),
    [products]
  );

  const clientsById = useMemo(
    () => new Map((clients || []).map(client => [String(client.id), client])),
    [clients]
  );

  const productsById = useMemo(
    () => new Map((products || []).map(product => [String(product.id), product])),
    [products]
  );

  const loadOrders = useCallback(async (showLoader = true) => {
    if (!currentUser?.id) return;
    if (showLoader) setLoading(true);

    try {
      const { data, error } = await supabase
        .from('bakery_custom_orders')
        .select('*, items:bakery_custom_order_items(*), payments:bakery_custom_order_payments(*)')
        .eq('user_id', currentUser.id)
        .order('delivery_date', { ascending: true })
        .order('delivery_time', { ascending: true, nullsFirst: false })
        .limit(300);

      if (error) throw error;

      const normalized = (data || []).map(order => {
        const item = normalizeBakeryOrder(order);
        item.items = [...item.items].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
        item.payments = [...item.payments].sort((a, b) => new Date(b.paid_at || b.created_at).getTime() - new Date(a.paid_at || a.created_at).getTime());
        return item;
      });

      normalized.sort((a, b) => {
        const aClosed = ['delivered', 'cancelled'].includes(a.status);
        const bClosed = ['delivered', 'cancelled'].includes(b.status);
        if (aClosed !== bClosed) return aClosed ? 1 : -1;
        if (!aClosed) {
          return `${a.delivery_date || ''} ${a.delivery_time || ''}`.localeCompare(`${b.delivery_date || ''} ${b.delivery_time || ''}`);
        }
        return new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime();
      });

      setOrders(normalized);
    } catch (error) {
      console.error('Error cargando pedidos especiales:', error);
      setNotice({ type: 'error', message: `No se pudieron cargar los pedidos: ${error.message}` });
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;

    const channel = supabase
      .channel(`bakery-orders-${currentUser.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bakery_custom_orders',
        filter: `user_id=eq.${currentUser.id}`,
      }, () => loadOrders(false))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bakery_custom_order_payments',
        filter: `user_id=eq.${currentUser.id}`,
      }, () => loadOrders(false))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, loadOrders]);

  const today = getTodayDateInput();

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase();

    return orders.filter(order => {
      const matchesSearch = !term || [
        order.order_code,
        order.customer_name,
        order.customer_phone,
        order.occasion,
        order.theme,
        ...(order.items || []).map(item => item.item_name),
      ].some(value => String(value || '').toLowerCase().includes(term));

      if (!matchesSearch) return false;

      if (statusFilter === 'today') return isBakeryOrderDueToday(order, today);
      if (statusFilter === 'week') return isBakeryOrderDueWithinDays(order, 7, today);
      if (statusFilter === 'overdue') return isBakeryOrderOverdue(order, today);
      if (statusFilter === 'active') return !['delivered', 'cancelled'].includes(order.status);
      if (BAKERY_ORDER_STATUSES.some(item => item.value === statusFilter)) return order.status === statusFilter;
      return true;
    });
  }, [orders, search, statusFilter, today]);

  const activeOrders = orders.filter(order => !['delivered', 'cancelled'].includes(order.status));
  const todayOrders = orders.filter(order => isBakeryOrderDueToday(order, today));
  const weekOrders = orders.filter(order => isBakeryOrderDueWithinDays(order, 7, today));
  const overdueOrders = orders.filter(order => isBakeryOrderOverdue(order, today));
  const pendingBalance = orders
    .filter(order => order.status !== 'cancelled')
    .reduce((sum, order) => sum + Math.max(0, Number(order.total || 0) - Number(order.paid_amount || 0)), 0);

  function openNewOrder() {
    setForm(createEmptyBakeryOrderForm());
    setNotice(null);
    setEditorOpen(true);
  }

  function openEditOrder(order) {
    if (['delivered', 'cancelled'].includes(order.status)) {
      setNotice({ type: 'error', message: 'Los pedidos entregados o cancelados conservan su información como historial.' });
      return;
    }

    setForm({
      id: order.id,
      clientId: order.client_id || '',
      customerName: order.customer_name || '',
      customerPhone: order.customer_phone || '',
      customerEmail: order.customer_email || '',
      fulfillmentType: order.fulfillment_type || 'pickup',
      deliveryDate: order.delivery_date || '',
      deliveryTime: String(order.delivery_time || '').slice(0, 5),
      deliveryAddress: order.delivery_address || '',
      status: order.status || 'quote',
      occasion: order.occasion || '',
      flavor: order.flavor || '',
      filling: order.filling || '',
      sizeLabel: order.size_label || '',
      servings: order.servings ?? '',
      theme: order.theme || '',
      inscription: order.inscription || '',
      notes: order.notes || '',
      discount: String(order.discount || 0),
      deliveryFee: String(order.delivery_fee || 0),
      initialPayment: '0',
      paymentMethod: 'Efectivo',
      paymentNotes: '',
      items: (order.items || []).map(item => createBakeryOrderItem({
        key: item.id,
        productId: item.product_id || '',
        name: item.item_name || '',
        quantity: String(item.quantity || 1),
        unit: item.unit || 'unidad',
        unitPrice: String(item.unit_price || 0),
        notes: item.notes || '',
      })),
    });
    setNotice(null);
    setEditorOpen(true);
  }

  function closeEditor() {
    if (saving) return;
    setEditorOpen(false);
    setForm(createEmptyBakeryOrderForm());
  }

  function updateForm(field, value) {
    setForm(previous => ({ ...previous, [field]: value }));
  }

  function selectClient(clientId) {
    const client = clientsById.get(String(clientId));
    setForm(previous => ({
      ...previous,
      clientId,
      customerName: client?.name || previous.customerName,
      customerPhone: client?.phone === 'Sin teléfono' ? '' : (client?.phone || previous.customerPhone),
      customerEmail: client?.email || previous.customerEmail,
      deliveryAddress: client?.address || previous.deliveryAddress,
    }));
  }

  function updateItem(key, field, value) {
    setForm(previous => ({
      ...previous,
      items: previous.items.map(item => item.key === key ? { ...item, [field]: value } : item),
    }));
  }

  function selectProductForItem(key, productId) {
    const product = productsById.get(String(productId));
    setForm(previous => ({
      ...previous,
      items: previous.items.map(item => item.key === key ? {
        ...item,
        productId,
        name: product?.name || item.name,
        unit: product?.stockUnit || product?.size || 'unidad',
        unitPrice: product ? String(Number(product.price || 0)) : item.unitPrice,
      } : item),
    }));
  }

  function addItem() {
    setForm(previous => ({ ...previous, items: [...previous.items, createBakeryOrderItem()] }));
  }

  function removeItem(key) {
    setForm(previous => ({
      ...previous,
      items: previous.items.length <= 1
        ? previous.items
        : previous.items.filter(item => item.key !== key),
    }));
  }

  const formTotals = useMemo(() => getBakeryOrderTotals(form), [form]);
  const currentEditedOrder = form.id ? orders.find(order => order.id === form.id) : null;
  const currentPaid = Number(currentEditedOrder?.paid_amount || 0);
  const resultingBalance = Math.max(0, formTotals.total - currentPaid - (form.id ? 0 : Number(form.initialPayment || 0)));

  function validateForm() {
    if (!form.customerName.trim()) return 'Ingresa el nombre del cliente.';
    if (!form.customerPhone.trim()) return 'Ingresa un teléfono de contacto.';
    if (!form.deliveryDate) return 'Selecciona la fecha de entrega.';
    if (form.fulfillmentType === 'delivery' && !form.deliveryAddress.trim()) return 'Ingresa la dirección de entrega.';
    if (!Array.isArray(form.items) || form.items.length === 0) return 'Agrega al menos un producto al pedido.';

    for (const item of form.items) {
      if (!item.name.trim()) return 'Todos los productos deben tener una descripción.';
      if (Number(item.quantity || 0) <= 0) return `La cantidad de “${item.name || 'producto'}” debe ser mayor a cero.`;
      if (Number(item.unitPrice || 0) < 0) return `El precio de “${item.name || 'producto'}” no puede ser negativo.`;
    }

    if (Number(form.discount || 0) > formTotals.subtotal) return 'El descuento no puede superar el subtotal.';
    if (form.id && formTotals.total < currentPaid) return 'El nuevo total no puede ser menor al valor ya abonado.';
    if (!form.id && Number(form.initialPayment || 0) > formTotals.total) return 'El anticipo no puede superar el total del pedido.';
    return null;
  }

  async function saveOrder(event) {
    event.preventDefault();
    const validationError = validateForm();

    if (validationError) {
      setNotice({ type: 'error', message: validationError });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const payloadItems = form.items.map((item, index) => ({
        product_id: item.productId || null,
        item_name: item.name.trim(),
        quantity: Number(item.quantity),
        unit: item.unit.trim() || 'unidad',
        unit_price: Number(item.unitPrice || 0),
        notes: item.notes.trim() || null,
        sort_order: index,
      }));

      const { data, error } = await supabase.rpc('save_bakery_custom_order', {
        p_order_id: form.id || null,
        p_client_id: form.clientId || null,
        p_customer_name: form.customerName.trim(),
        p_customer_phone: form.customerPhone.trim(),
        p_customer_email: form.customerEmail.trim() || null,
        p_fulfillment_type: form.fulfillmentType,
        p_delivery_date: form.deliveryDate,
        p_delivery_time: form.deliveryTime || null,
        p_delivery_address: form.fulfillmentType === 'delivery' ? form.deliveryAddress.trim() : null,
        p_status: form.status,
        p_occasion: form.occasion.trim() || null,
        p_flavor: form.flavor.trim() || null,
        p_filling: form.filling.trim() || null,
        p_size_label: form.sizeLabel.trim() || null,
        p_servings: form.servings === '' ? null : Number(form.servings),
        p_theme: form.theme.trim() || null,
        p_inscription: form.inscription.trim() || null,
        p_notes: form.notes.trim() || null,
        p_discount: Number(form.discount || 0),
        p_delivery_fee: Number(form.deliveryFee || 0),
        p_items: payloadItems,
        p_initial_payment: form.id ? 0 : Number(form.initialPayment || 0),
        p_payment_method: form.paymentMethod,
        p_payment_notes: form.paymentNotes.trim() || null,
      });

      if (error) throw error;

      await loadOrders(false);
      setEditorOpen(false);
      setForm(createEmptyBakeryOrderForm());
      setExpandedOrderId(data?.order_id || null);
      setNotice({
        type: 'success',
        message: form.id
          ? `Pedido ${data?.order_code || ''} actualizado correctamente.`
          : `Pedido ${data?.order_code || ''} creado correctamente.`,
      });
    } catch (error) {
      console.error('Error guardando pedido especial:', error);
      setNotice({ type: 'error', message: `No se pudo guardar el pedido: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function finalizeOrderSale(order) {
    if (!order || updatingOrderId) return;

    const balance = Math.max(0, Number(order.total || 0) - Number(order.paid_amount || 0));
    if (balance > 0.009) {
      setNotice({
        type: 'error',
        message: `El pedido ${order.order_code} mantiene un saldo de ${formatBakeryOrderMoney(balance)}. Registra el cobro antes de entregarlo.`,
      });
      openPayment(order);
      return;
    }

    const itemCount = (order.items || []).length;
    const confirmed = window.confirm(
      `Se registrará la entrega del pedido ${order.order_code} como una venta por ${formatBakeryOrderMoney(order.total)}. `
      + `InventIQ descontará el stock de ${itemCount} producto(s) vinculados y conservará los abonos en caja sin duplicarlos. ¿Continuar?`
    );
    if (!confirmed) return;

    setUpdatingOrderId(order.id);
    setNotice(null);

    try {
      const { data, error } = await supabase.rpc('finalize_bakery_custom_order_sale', {
        p_order_id: order.id,
      });
      if (error) throw error;

      await loadOrders(false);
      setExpandedOrderId(order.id);
      setNotice({
        type: 'success',
        message: data?.already_registered
          ? `El pedido ${order.order_code} ya estaba vinculado a una venta.`
          : `Pedido ${order.order_code} entregado y registrado como venta ${data?.sale_code || ''}. El inventario fue actualizado.`,
      });
    } catch (error) {
      console.error('Error finalizando pedido como venta:', error);
      setNotice({ type: 'error', message: `No se pudo completar la entrega: ${error.message}` });
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function changeStatus(order, nextStatus) {
    if (!nextStatus || updatingOrderId) return;

    if (nextStatus === 'delivered') {
      await finalizeOrderSale(order);
      return;
    }

    if (nextStatus === 'cancelled') {
      const paid = Number(order.paid_amount || 0);
      const message = paid > 0
        ? `El pedido ${order.order_code} tiene ${formatBakeryOrderMoney(paid)} abonados. Al cancelar, el pago quedará en el historial para gestionar su devolución o compensación. ¿Continuar?`
        : `¿Cancelar el pedido ${order.order_code}? El registro se conservará en el historial.`;
      if (!window.confirm(message)) return;
    }

    setUpdatingOrderId(order.id);
    setNotice(null);

    try {
      const { error } = await supabase.rpc('update_bakery_custom_order_status', {
        p_order_id: order.id,
        p_status: nextStatus,
      });
      if (error) throw error;
      await loadOrders(false);
      setNotice({
        type: 'success',
        message: nextStatus === 'cancelled'
          ? `Pedido ${order.order_code} cancelado. El historial se mantiene.`
          : `Pedido ${order.order_code} actualizado a “${getBakeryOrderStatus(nextStatus).label}”.`,
      });
    } catch (error) {
      console.error('Error actualizando estado:', error);
      setNotice({ type: 'error', message: `No se pudo actualizar el pedido: ${error.message}` });
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function openPayment(order) {
    const balance = Math.max(0, Number(order.total || 0) - Number(order.paid_amount || 0));
    setPaymentOrder(order);
    setPaymentForm({
      amount: balance > 0 ? String(balance.toFixed(2)) : '',
      paymentMethod: 'Efectivo',
      paidAt: getNowLocalInput(),
      notes: '',
    });
    setNotice(null);
  }

  async function registerPayment(event) {
    event.preventDefault();
    if (!paymentOrder) return;

    const amount = Number(paymentForm.amount || 0);
    const balance = Math.max(0, Number(paymentOrder.total || 0) - Number(paymentOrder.paid_amount || 0));

    if (amount <= 0) {
      setNotice({ type: 'error', message: 'El valor del abono debe ser mayor a cero.' });
      return;
    }
    if (amount > balance + 0.001) {
      setNotice({ type: 'error', message: 'El abono no puede superar el saldo pendiente.' });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const paidAt = paymentForm.paidAt ? new Date(paymentForm.paidAt).toISOString() : new Date().toISOString();
      const { error } = await supabase.rpc('register_bakery_custom_order_payment', {
        p_order_id: paymentOrder.id,
        p_amount: amount,
        p_payment_method: paymentForm.paymentMethod,
        p_paid_at: paidAt,
        p_notes: paymentForm.notes.trim() || null,
      });
      if (error) throw error;

      await loadOrders(false);
      setPaymentOrder(null);
      setNotice({ type: 'success', message: `Abono de ${formatBakeryOrderMoney(amount)} registrado en el pedido ${paymentOrder.order_code}.` });
    } catch (error) {
      console.error('Error registrando abono:', error);
      setNotice({ type: 'error', message: `No se pudo registrar el abono: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function copyOrderSummary(order) {
    try {
      await navigator.clipboard.writeText(buildBakeryOrderSummary(order));
      setNotice({ type: 'success', message: `Resumen del pedido ${order.order_code} copiado.` });
    } catch (error) {
      console.error('No se pudo copiar:', error);
      setNotice({ type: 'error', message: 'No se pudo copiar el resumen en este navegador.' });
    }
  }

  function openWhatsApp(order) {
    const phone = normalizePhoneForWhatsApp(order.customer_phone);
    if (!phone) {
      setNotice({ type: 'error', message: 'El pedido no tiene un teléfono válido para WhatsApp.' });
      return;
    }
    const message = encodeURIComponent(buildBakeryOrderSummary(order));
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="space-y-6">
      {notice && !editorOpen && !paymentOrder && (
        <Notice notice={notice} onClose={() => setNotice(null)} />
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={PackageCheck} label="Pedidos activos" value={activeOrders.length} detail="por preparar o entregar" tone="blue" />
        <MetricCard icon={CalendarDays} label="Entregas de hoy" value={todayOrders.length} detail={overdueOrders.length ? `${overdueOrders.length} atrasado(s)` : 'agenda al día'} tone={overdueOrders.length ? 'red' : 'cyan'} />
        <MetricCard icon={Clock3} label="Próximos 7 días" value={weekOrders.length} detail="pedidos programados" tone="amber" />
        <MetricCard icon={CircleDollarSign} label="Saldo por cobrar" value={formatBakeryOrderMoney(pendingBalance)} detail="pedidos no cancelados" tone="emerald" />
      </section>

      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-950 p-5 text-white sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                <ClipboardCheck className="h-4 w-4" /> Pedidos especiales
              </p>
              <h3 className="mt-2 text-2xl font-black sm:text-3xl">Organiza encargos, anticipos y entregas</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Registra tortas, bocaditos y pedidos personalizados con fecha de entrega, especificaciones, pagos y seguimiento de estado.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button type="button" onClick={() => setActive('Clientes')} className="iq-secondary-button border-white/20 bg-white/10 text-white hover:bg-white/20">
                <UserRoundCheck className="h-5 w-5" /> Revisar clientes
              </button>
              <button type="button" onClick={openNewOrder} className="iq-primary-button">
                <Plus className="h-5 w-5" /> Nuevo pedido
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 border-b border-slate-100 bg-slate-50 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center sm:p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              className="iq-input bg-white pl-11"
              placeholder="Buscar por código, cliente, teléfono o producto..."
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:justify-end">
            {FILTER_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                className={`shrink-0 rounded-xl px-3.5 py-2.5 text-xs font-black transition ${
                  statusFilter === option.value
                    ? 'bg-slate-950 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-sm font-bold text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Cargando pedidos...
          </div>
        ) : visibleOrders.length === 0 ? (
          <EmptyOrders onCreate={openNewOrder} filter={statusFilter} />
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleOrders.map(order => (
              <OrderRow
                key={order.id}
                order={order}
                expanded={expandedOrderId === order.id}
                updating={updatingOrderId === order.id}
                onToggle={() => setExpandedOrderId(current => current === order.id ? null : order.id)}
                onEdit={() => openEditOrder(order)}
                onPayment={() => openPayment(order)}
                onNextStatus={() => changeStatus(order, getNextBakeryOrderStatus(order.status))}
                onFinalize={() => finalizeOrderSale(order)}
                onViewSales={() => setActive('Ventas')}
                onCancel={() => changeStatus(order, 'cancelled')}
                onCopy={() => copyOrderSummary(order)}
                onWhatsApp={() => openWhatsApp(order)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[1.5rem] border border-cyan-100 bg-cyan-50 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-black text-cyan-950">Los pedidos no descuentan inventario automáticamente</p>
            <p className="mt-1 text-sm leading-6 text-cyan-800">
              La producción y el consumo de materias primas continúan registrándose desde Producción por lotes, evitando movimientos duplicados.
            </p>
          </div>
          <button type="button" onClick={() => setActive('Producción')} className="iq-secondary-button shrink-0 border-cyan-200 bg-white text-cyan-900 hover:bg-cyan-100">
            <PackageCheck className="h-5 w-5" /> Ir a producción
          </button>
        </div>
      </section>

      {editorOpen && (
        <OrderEditor
          form={form}
          totals={formTotals}
          currentPaid={currentPaid}
          resultingBalance={resultingBalance}
          clients={clients || []}
          saleProducts={saleProducts}
          saving={saving}
          notice={notice}
          onClose={closeEditor}
          onSave={saveOrder}
          onUpdateForm={updateForm}
          onSelectClient={selectClient}
          onUpdateItem={updateItem}
          onSelectProduct={selectProductForItem}
          onAddItem={addItem}
          onRemoveItem={removeItem}
          onClearNotice={() => setNotice(null)}
        />
      )}

      {paymentOrder && (
        <PaymentModal
          order={paymentOrder}
          form={paymentForm}
          saving={saving}
          notice={notice}
          onClose={() => !saving && setPaymentOrder(null)}
          onChange={(field, value) => setPaymentForm(previous => ({ ...previous, [field]: value }))}
          onSubmit={registerPayment}
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
      <div className="flex items-start gap-2">
        {notice.type === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
        <span>{notice.message}</span>
      </div>
      <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-black/5" aria-label="Cerrar aviso"><X className="h-4 w-4" /></button>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone }) {
  const tones = {
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    cyan: 'border-cyan-100 bg-cyan-50 text-cyan-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    red: 'border-red-100 bg-red-50 text-red-700',
  };

  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${tones[tone] || tones.blue}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>
    </article>
  );
}

function EmptyOrders({ onCreate, filter }) {
  return (
    <div className="p-10 text-center sm:p-14">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <CalendarDays className="h-6 w-6" />
      </div>
      <h4 className="mt-4 text-lg font-black text-slate-950">
        {filter === 'active' ? 'No hay pedidos activos' : 'No se encontraron pedidos'}
      </h4>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
        Registra el primer encargo con su cliente, fecha de entrega, personalización y anticipo.
      </p>
      <button type="button" onClick={onCreate} className="iq-primary-button mt-5">
        <Plus className="h-5 w-5" /> Crear pedido
      </button>
    </div>
  );
}

function OrderRow({
  order,
  expanded,
  updating,
  onToggle,
  onEdit,
  onPayment,
  onNextStatus,
  onFinalize,
  onViewSales,
  onCancel,
  onCopy,
  onWhatsApp,
}) {
  const status = getBakeryOrderStatus(order.status);
  const balance = Math.max(0, Number(order.total || 0) - Number(order.paid_amount || 0));
  const overdue = isBakeryOrderOverdue(order);
  const nextStatus = getNextBakeryOrderStatus(order.status);
  const nextAction = getNextBakeryOrderActionLabel(order.status);
  const saleRegistered = Boolean(order.sale_id);
  const pendingSaleRegistration = order.status === 'delivered' && !saleRegistered;
  const statusTones = {
    slate: 'bg-slate-100 text-slate-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
  };

  return (
    <article className="bg-white">
      <button type="button" onClick={onToggle} className="w-full p-5 text-left transition hover:bg-slate-50 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(180px,0.7fr)_minmax(190px,0.7fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-black ${statusTones[status.tone] || statusTones.slate}`}>{status.label}</span>
              {overdue && <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">Entrega atrasada</span>}
              {saleRegistered && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Venta registrada</span>}
              {pendingSaleRegistration && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">Venta pendiente</span>}
              <span className="text-xs font-black uppercase tracking-wide text-slate-400">{order.order_code}</span>
            </div>
            <h4 className="mt-2 truncate text-lg font-black text-slate-950">{order.customer_name}</h4>
            <p className="mt-1 line-clamp-1 text-sm font-semibold text-slate-500">
              {(order.items || []).map(item => item.item_name).join(' · ') || 'Sin detalle de productos'}
            </p>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">Entrega</p>
            <p className={`mt-1 font-black ${overdue ? 'text-red-700' : 'text-slate-900'}`}>{formatBakeryOrderDate(order.delivery_date, { short: true })}</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-500">{formatBakeryOrderTime(order.delivery_time)}</p>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">Pago</p>
            <p className="mt-1 font-black text-slate-900">{formatBakeryOrderMoney(order.total)}</p>
            <p className={`mt-0.5 text-sm font-bold ${balance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {balance > 0 ? `Saldo ${formatBakeryOrderMoney(balance)}` : 'Pagado por completo'}
            </p>
          </div>

          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500">
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/70 p-5 sm:p-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h5 className="font-black text-slate-950">Detalle del pedido</h5>
                <div className="mt-4 divide-y divide-slate-100">
                  {(order.items || []).map(item => (
                    <div key={item.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                      <div>
                        <p className="font-black text-slate-900">{item.item_name}</p>
                        {item.notes && <p className="mt-1 text-xs font-semibold text-slate-500">{item.notes}</p>}
                      </div>
                      <p className="text-sm font-bold text-slate-600">{Number(item.quantity || 0)} {item.unit || 'unidad'}</p>
                      <p className="font-black text-slate-900">{formatBakeryOrderMoney(item.line_total)}</p>
                    </div>
                  ))}
                </div>
              </section>

              {(order.occasion || order.flavor || order.filling || order.size_label || order.servings || order.theme || order.inscription || order.notes) && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h5 className="font-black text-slate-950">Especificaciones</h5>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Detail label="Ocasión" value={order.occasion} />
                    <Detail label="Tamaño / porciones" value={[order.size_label, order.servings ? `${order.servings} porciones` : ''].filter(Boolean).join(' · ')} />
                    <Detail label="Sabor" value={order.flavor} />
                    <Detail label="Relleno" value={order.filling} />
                    <Detail label="Tema o decoración" value={order.theme} />
                    <Detail label="Texto solicitado" value={order.inscription} />
                  </div>
                  {order.notes && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{order.notes}</p>}
                </section>
              )}

              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <h5 className="font-black text-slate-950">Historial de pagos</h5>
                  <span className="text-xs font-black uppercase tracking-wide text-slate-400">{(order.payments || []).length} movimiento(s)</span>
                </div>
                {(order.payments || []).length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">Todavía no se han registrado abonos.</p>
                ) : (
                  <div className="mt-3 divide-y divide-slate-100">
                    {order.payments.map(payment => (
                      <div key={payment.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-black text-slate-900">{payment.payment_method}</p>
                          <p className="mt-0.5 text-xs font-semibold text-slate-500">
                            {new Date(payment.paid_at || payment.created_at).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })}
                            {payment.notes ? ` · ${payment.notes}` : ''}
                          </p>
                        </div>
                        <p className="font-black text-emerald-700">{formatBakeryOrderMoney(payment.amount)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <aside className="space-y-4">
              <section className="rounded-2xl bg-slate-950 p-5 text-white">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-200">Resumen</p>
                <div className="mt-4 space-y-3">
                  <MoneyLine label="Subtotal" value={order.subtotal} />
                  <MoneyLine label="Descuento" value={-Number(order.discount || 0)} />
                  <MoneyLine label="Entrega" value={order.delivery_fee} />
                  <div className="border-t border-white/10 pt-3"><MoneyLine label="Total" value={order.total} strong /></div>
                  <MoneyLine label="Abonado" value={order.paid_amount} />
                  <MoneyLine label="Saldo" value={balance} strong={balance > 0} />
                  <div className="border-t border-white/10 pt-3 text-xs font-bold text-slate-300">
                    {saleRegistered
                      ? `Integrado con Ventas${order.sale_registered_at ? ` · ${new Date(order.sale_registered_at).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })}` : ''}`
                      : 'Aún no se ha registrado como venta'}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h5 className="font-black text-slate-950">Entrega y contacto</h5>
                <div className="mt-4 space-y-3 text-sm">
                  <InfoLine icon={Phone} text={order.customer_phone || 'Sin teléfono'} />
                  <InfoLine icon={CalendarDays} text={`${formatBakeryOrderDate(order.delivery_date)} · ${formatBakeryOrderTime(order.delivery_time)}`} />
                  <InfoLine icon={MapPin} text={order.fulfillment_type === 'delivery' ? (order.delivery_address || 'Dirección pendiente') : 'Retiro en el local'} />
                </div>
              </section>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                {balance > 0 && order.status !== 'cancelled' && (
                  <button type="button" onClick={onPayment} className="iq-action-primary"><WalletCards className="h-4 w-4" /> Registrar abono</button>
                )}
                {nextStatus && (
                  <button type="button" onClick={onNextStatus} disabled={updating} className={nextStatus === 'delivered' ? 'iq-action-primary disabled:opacity-50' : 'iq-action-secondary disabled:opacity-50'}>
                    {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : nextStatus === 'delivered' ? <CircleDollarSign className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} {nextAction}
                  </button>
                )}
                {pendingSaleRegistration && (
                  <button type="button" onClick={onFinalize} disabled={updating} className="iq-action-primary disabled:opacity-50">
                    {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleDollarSign className="h-4 w-4" />} Registrar venta pendiente
                  </button>
                )}
                {saleRegistered && (
                  <button type="button" onClick={onViewSales} className="iq-action-secondary"><CircleDollarSign className="h-4 w-4" /> Ver en Ventas</button>
                )}
                {!['delivered', 'cancelled'].includes(order.status) && (
                  <button type="button" onClick={onEdit} className="iq-action-neutral"><Edit3 className="h-4 w-4" /> Editar pedido</button>
                )}
                <button type="button" onClick={onWhatsApp} className="iq-action-neutral"><MessageCircle className="h-4 w-4" /> Abrir WhatsApp</button>
                <button type="button" onClick={onCopy} className="iq-action-neutral"><ClipboardCheck className="h-4 w-4" /> Copiar resumen</button>
                {!['delivered', 'cancelled'].includes(order.status) && (
                  <button type="button" onClick={onCancel} disabled={updating} className="iq-action-danger disabled:opacity-50"><XCircle className="h-4 w-4" /> Cancelar pedido</button>
                )}
              </div>
            </aside>
          </div>
        </div>
      )}
    </article>
  );
}

function Detail({ label, value }) {
  if (!value) return null;
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

function MoneyLine({ label, value, strong = false }) {
  const amount = Number(value || 0);
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? 'font-black text-white' : 'text-sm font-semibold text-slate-400'}>{label}</span>
      <span className={strong ? 'text-lg font-black text-white' : 'text-sm font-black text-white'}>{formatBakeryOrderMoney(amount)}</span>
    </div>
  );
}

function InfoLine({ icon: Icon, text }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Icon className="h-4 w-4" /></span>
      <p className="pt-1.5 font-semibold leading-5 text-slate-600">{text}</p>
    </div>
  );
}

function OrderEditor({
  form,
  totals,
  currentPaid,
  resultingBalance,
  clients,
  saleProducts,
  saving,
  notice,
  onClose,
  onSave,
  onUpdateForm,
  onSelectClient,
  onUpdateItem,
  onSelectProduct,
  onAddItem,
  onRemoveItem,
  onClearNotice,
}) {
  return (
    <div className="iq-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="bakery-order-editor-title">
      <div className="iq-modal-card max-w-6xl">
        <form onSubmit={onSave} className="flex max-h-[94vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Pedido especial</p>
              <h3 id="bakery-order-editor-title" className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
                {form.id ? 'Editar pedido' : 'Registrar nuevo pedido'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">Cliente, productos, personalización, entrega y anticipo en una sola ficha.</p>
            </div>
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50" aria-label="Cerrar">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="overflow-y-auto bg-slate-50 p-4 sm:p-6">
            {notice && (
              <div className="mb-5"><Notice notice={notice} onClose={onClearNotice} /></div>
            )}

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
              <div className="space-y-5">
                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                  <SectionTitle number="01" title="Cliente y entrega" subtitle="Datos de contacto y compromiso de entrega." />
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <span className="mb-2 block text-sm font-bold text-slate-700">Cliente registrado (opcional)</span>
                      <select value={form.clientId} onChange={event => onSelectClient(event.target.value)} className="iq-input">
                        <option value="">Ingresar cliente manualmente</option>
                        {clients.map(client => <option key={client.id} value={client.id}>{client.name} · {client.phone || 'Sin teléfono'}</option>)}
                      </select>
                    </label>
                    <Field label="Nombre del cliente *">
                      <input value={form.customerName} onChange={event => onUpdateForm('customerName', event.target.value)} className="iq-input" placeholder="Nombre o razón social" />
                    </Field>
                    <Field label="Teléfono / WhatsApp *">
                      <input value={form.customerPhone} onChange={event => onUpdateForm('customerPhone', event.target.value)} className="iq-input" placeholder="09XXXXXXXX" />
                    </Field>
                    <Field label="Correo (opcional)">
                      <input type="email" value={form.customerEmail} onChange={event => onUpdateForm('customerEmail', event.target.value)} className="iq-input" placeholder="cliente@correo.com" />
                    </Field>
                    <Field label="Modalidad">
                      <select value={form.fulfillmentType} onChange={event => onUpdateForm('fulfillmentType', event.target.value)} className="iq-input">
                        {BAKERY_FULFILLMENT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Fecha de entrega *">
                      <input type="date" value={form.deliveryDate} onChange={event => onUpdateForm('deliveryDate', event.target.value)} className="iq-input" />
                    </Field>
                    <Field label="Hora de entrega">
                      <input type="time" value={form.deliveryTime} onChange={event => onUpdateForm('deliveryTime', event.target.value)} className="iq-input" />
                    </Field>
                    {form.fulfillmentType === 'delivery' && (
                      <label className="block sm:col-span-2">
                        <span className="mb-2 block text-sm font-bold text-slate-700">Dirección de entrega *</span>
                        <input value={form.deliveryAddress} onChange={event => onUpdateForm('deliveryAddress', event.target.value)} className="iq-input" placeholder="Dirección y referencia" />
                      </label>
                    )}
                  </div>
                </section>

                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <SectionTitle number="02" title="Productos solicitados" subtitle="Puedes usar productos registrados o escribir un concepto personalizado." />
                    <button type="button" onClick={onAddItem} className="iq-action-secondary shrink-0"><Plus className="h-4 w-4" /> Agregar producto</button>
                  </div>

                  <div className="mt-5 space-y-4">
                    {form.items.map((item, index) => (
                      <div key={item.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Producto {index + 1}</p>
                          <button type="button" onClick={() => onRemoveItem(item.key)} disabled={form.items.length <= 1} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30" aria-label="Quitar producto">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
                          <label className="block lg:col-span-5">
                            <span className="mb-2 block text-xs font-bold text-slate-600">Producto registrado (opcional)</span>
                            <select value={item.productId} onChange={event => onSelectProduct(item.key, event.target.value)} className="iq-input bg-white">
                              <option value="">Concepto personalizado</option>
                              {saleProducts.map(product => <option key={product.id} value={product.id}>{product.name} · {formatBakeryOrderMoney(product.price)}</option>)}
                            </select>
                          </label>
                          <label className="block lg:col-span-7">
                            <span className="mb-2 block text-xs font-bold text-slate-600">Descripción *</span>
                            <input value={item.name} onChange={event => onUpdateItem(item.key, 'name', event.target.value)} className="iq-input bg-white" placeholder="Ej. Torta personalizada de cumpleaños" />
                          </label>
                          <label className="block lg:col-span-2">
                            <span className="mb-2 block text-xs font-bold text-slate-600">Cantidad</span>
                            <input type="number" min="0.001" step="0.001" value={item.quantity} onChange={event => onUpdateItem(item.key, 'quantity', event.target.value)} className="iq-input bg-white" />
                          </label>
                          <label className="block lg:col-span-3">
                            <span className="mb-2 block text-xs font-bold text-slate-600">Unidad</span>
                            <input value={item.unit} onChange={event => onUpdateItem(item.key, 'unit', event.target.value)} className="iq-input bg-white" placeholder="unidad" />
                          </label>
                          <label className="block lg:col-span-3">
                            <span className="mb-2 block text-xs font-bold text-slate-600">Precio unitario</span>
                            <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={event => onUpdateItem(item.key, 'unitPrice', event.target.value)} className="iq-input bg-white" placeholder="0.00" />
                          </label>
                          <div className="lg:col-span-4">
                            <span className="mb-2 block text-xs font-bold text-slate-600">Total</span>
                            <div className="flex min-h-12 items-center rounded-xl border border-slate-200 bg-white px-4 font-black text-slate-950">
                              {formatBakeryOrderMoney(Number(item.quantity || 0) * Number(item.unitPrice || 0))}
                            </div>
                          </div>
                          <label className="block lg:col-span-12">
                            <span className="mb-2 block text-xs font-bold text-slate-600">Detalle del producto (opcional)</span>
                            <input value={item.notes} onChange={event => onUpdateItem(item.key, 'notes', event.target.value)} className="iq-input bg-white" placeholder="Tamaño, presentación o detalle específico de esta línea" />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                  <SectionTitle number="03" title="Personalización" subtitle="Información útil para producción y revisión con el cliente." />
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Ocasión"><input value={form.occasion} onChange={event => onUpdateForm('occasion', event.target.value)} className="iq-input" placeholder="Cumpleaños, boda..." /></Field>
                    <Field label="Sabor"><input value={form.flavor} onChange={event => onUpdateForm('flavor', event.target.value)} className="iq-input" placeholder="Chocolate, vainilla..." /></Field>
                    <Field label="Relleno"><input value={form.filling} onChange={event => onUpdateForm('filling', event.target.value)} className="iq-input" placeholder="Manjar, crema..." /></Field>
                    <Field label="Tamaño"><input value={form.sizeLabel} onChange={event => onUpdateForm('sizeLabel', event.target.value)} className="iq-input" placeholder="Pequeña, 2 pisos..." /></Field>
                    <Field label="Número de porciones"><input type="number" min="0" step="1" value={form.servings} onChange={event => onUpdateForm('servings', event.target.value)} className="iq-input" placeholder="20" /></Field>
                    <Field label="Tema o decoración"><input value={form.theme} onChange={event => onUpdateForm('theme', event.target.value)} className="iq-input" placeholder="Colores, personaje, estilo..." /></Field>
                    <label className="block sm:col-span-2 lg:col-span-3">
                      <span className="mb-2 block text-sm font-bold text-slate-700">Texto o inscripción</span>
                      <input value={form.inscription} onChange={event => onUpdateForm('inscription', event.target.value)} className="iq-input" placeholder="Ej. Feliz cumpleaños, Ana" />
                    </label>
                    <label className="block sm:col-span-2 lg:col-span-3">
                      <span className="mb-2 block text-sm font-bold text-slate-700">Observaciones generales</span>
                      <textarea value={form.notes} onChange={event => onUpdateForm('notes', event.target.value)} className="iq-input min-h-24 resize-y" placeholder="Referencias, alergias declaradas por el cliente, condiciones de entrega o cualquier detalle importante..." />
                    </label>
                  </div>
                </section>
              </div>

              <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
                <section className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Valores del pedido</p>
                  <div className="mt-5 space-y-4">
                    <FieldDark label="Descuento">
                      <input type="number" min="0" step="0.01" value={form.discount} onChange={event => onUpdateForm('discount', event.target.value)} className="iq-input border-white/10 bg-white/10 text-white placeholder:text-slate-500" />
                    </FieldDark>
                    <FieldDark label="Costo de entrega">
                      <input type="number" min="0" step="0.01" value={form.deliveryFee} onChange={event => onUpdateForm('deliveryFee', event.target.value)} className="iq-input border-white/10 bg-white/10 text-white placeholder:text-slate-500" />
                    </FieldDark>
                  </div>

                  <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
                    <MoneyLine label="Subtotal" value={totals.subtotal} />
                    <MoneyLine label="Descuento" value={-totals.discount} />
                    <MoneyLine label="Entrega" value={totals.deliveryFee} />
                    <MoneyLine label="Total" value={totals.total} strong />
                    {form.id && <MoneyLine label="Ya abonado" value={currentPaid} />}
                    <MoneyLine label="Saldo resultante" value={resultingBalance} strong />
                  </div>
                </section>

                {!form.id && (
                  <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                    <p className="flex items-center gap-2 font-black text-slate-950"><WalletCards className="h-4 w-4 text-cyan-700" /> Anticipo inicial</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Puede quedar en cero y registrarse después.</p>
                    <div className="mt-4 space-y-4">
                      <Field label="Valor del anticipo"><input type="number" min="0" step="0.01" value={form.initialPayment} onChange={event => onUpdateForm('initialPayment', event.target.value)} className="iq-input" /></Field>
                      <Field label="Método de pago">
                        <select value={form.paymentMethod} onChange={event => onUpdateForm('paymentMethod', event.target.value)} className="iq-input">
                          {BAKERY_PAYMENT_METHODS.map(method => <option key={method} value={method}>{method}</option>)}
                        </select>
                      </Field>
                      <Field label="Nota del pago"><input value={form.paymentNotes} onChange={event => onUpdateForm('paymentNotes', event.target.value)} className="iq-input" placeholder="Referencia o comprobante" /></Field>
                    </div>
                  </section>
                )}

                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                  <p className="font-black text-slate-950">Estado inicial</p>
                  <select value={form.status} onChange={event => onUpdateForm('status', event.target.value)} className="iq-input mt-3" disabled={Boolean(form.id)}>
                    <option value="quote">Cotización</option>
                    <option value="confirmed">Confirmado</option>
                    {form.id && BAKERY_ORDER_STATUSES.filter(item => !['quote', 'confirmed'].includes(item.value)).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {form.id ? 'El estado se actualiza desde la ficha del pedido.' : 'Usa “Confirmado” cuando el cliente ya aprobó las condiciones.'}
                  </p>
                </section>
              </aside>
            </div>
          </div>

          <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-slate-100 bg-white/95 p-4 backdrop-blur sm:flex-row sm:justify-end sm:px-6">
            <button type="button" onClick={onClose} disabled={saving} className="iq-secondary-button">Cancelar</button>
            <button type="submit" disabled={saving} className="iq-primary-button disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <ClipboardCheck className="h-5 w-5" />}
              {saving ? 'Guardando...' : form.id ? 'Guardar cambios' : 'Crear pedido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PaymentModal({ order, form, saving, notice, onClose, onChange, onSubmit, onClearNotice }) {
  const balance = Math.max(0, Number(order.total || 0) - Number(order.paid_amount || 0));

  return (
    <div className="iq-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="bakery-payment-title">
      <div className="iq-modal-card max-w-lg">
        <form onSubmit={onSubmit}>
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">{order.order_code}</p>
              <h3 id="bakery-payment-title" className="mt-1 text-xl font-black text-slate-950">Registrar abono</h3>
              <p className="mt-1 text-sm text-slate-500">Saldo actual: {formatBakeryOrderMoney(balance)}</p>
            </div>
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X className="h-5 w-5" /></button>
          </div>

          <div className="space-y-4 bg-slate-50 p-5">
            {notice && <Notice notice={notice} onClose={onClearNotice} />}
            <Field label="Valor del abono *"><input type="number" min="0.01" max={balance} step="0.01" value={form.amount} onChange={event => onChange('amount', event.target.value)} className="iq-input bg-white" /></Field>
            <Field label="Método de pago"><select value={form.paymentMethod} onChange={event => onChange('paymentMethod', event.target.value)} className="iq-input bg-white">{BAKERY_PAYMENT_METHODS.map(method => <option key={method}>{method}</option>)}</select></Field>
            <Field label="Fecha y hora"><input type="datetime-local" value={form.paidAt} onChange={event => onChange('paidAt', event.target.value)} className="iq-input bg-white" /></Field>
            <Field label="Referencia u observación"><input value={form.notes} onChange={event => onChange('notes', event.target.value)} className="iq-input bg-white" placeholder="Número de comprobante o nota" /></Field>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-white p-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={saving} className="iq-secondary-button">Cancelar</button>
            <button type="submit" disabled={saving} className="iq-primary-button disabled:opacity-50">
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <WalletCards className="h-5 w-5" />}
              {saving ? 'Registrando...' : 'Guardar abono'}
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

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function FieldDark({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-300">{label}</span>
      {children}
    </label>
  );
}
