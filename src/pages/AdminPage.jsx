import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CalendarDays,
  CheckCircle2,
  DollarSign,
  Edit,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { businessTypes, getBusinessConfig } from '../config/businessTypes';

const STATUS_OPTIONS = [
  { value: 'activo', label: 'Activo' },
  { value: 'por_vencer', label: 'Por vencer' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'suspendido', label: 'Suspendido' },
  { value: 'prueba', label: 'Prueba' },
];

const PLAN_OPTIONS = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'anual', label: 'Anual' },
  { value: 'personalizado', label: 'Personalizado' },
];

const DEFAULT_EDIT_FORM = {
  plan: 'anual',
  subscription_status: 'activo',
  subscription_start: '',
  subscription_end: '',
  monthly_price: '25',
  annual_price: '300',
  max_products: '2000',
  is_suspended: false,
  admin_notes: '',
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function addMonthsToInputDate(months) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function normalizeText(value) {
  return String(value || '').trim();
}

function formatMoney(value) {
  const number = Number(value || 0);
  return `$${number.toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getDaysUntil(dateValue) {
  if (!dateValue) return null;
  const today = new Date();
  const target = new Date(dateValue);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getClientStatus(client) {
  if (client.is_suspended) {
    return {
      label: 'Suspendido',
      value: 'suspendido',
      className: 'bg-red-50 text-red-700 border-red-100',
    };
  }

  const days = getDaysUntil(client.subscription_end);

  if (days !== null && days < 0) {
    return {
      label: 'Vencido',
      value: 'vencido',
      className: 'bg-red-50 text-red-700 border-red-100',
    };
  }

  if (days !== null && days <= 15) {
    return {
      label: 'Por vencer',
      value: 'por_vencer',
      className: 'bg-amber-50 text-amber-700 border-amber-100',
    };
  }

  if (client.subscription_status === 'prueba') {
    return {
      label: 'Prueba',
      value: 'prueba',
      className: 'bg-sky-50 text-sky-700 border-sky-100',
    };
  }

  return {
    label: 'Activo',
    value: 'activo',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  };
}

function getBusinessTypeOptions() {
  if (Array.isArray(businessTypes)) return businessTypes;
  return Object.values(businessTypes || {});
}

function getBusinessTypeLabel(value) {
  const options = getBusinessTypeOptions();
  const found = options.find(option => option.id === value || option.value === value);
  return found?.name || found?.label || found?.title || value || 'General';
}

function buildEditForm(client) {
  return {
    plan: client.plan || 'anual',
    subscription_status: client.subscription_status || 'activo',
    subscription_start: client.subscription_start || todayInputValue(),
    subscription_end: client.subscription_end || addMonthsToInputDate(12),
    monthly_price: String(client.monthly_price ?? 25),
    annual_price: String(client.annual_price ?? 300),
    max_products: String(client.max_products ?? 2000),
    is_suspended: Boolean(client.is_suspended),
    admin_notes: client.admin_notes || '',
  };
}

export default function AdminPage({
  form,
  setForm,
  notice,
  createClientAccount,
}) {
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [adminPageNotice, setAdminPageNotice] = useState(null);
  const [search, setSearch] = useState('');
  const [editingClientId, setEditingClientId] = useState(null);
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM);
  const [savingClient, setSavingClient] = useState(false);
  const [previewBusinessType, setPreviewBusinessType] = useState('general');
  const [previewSaving, setPreviewSaving] = useState(false);

  const businessTypeOptions = getBusinessTypeOptions();
  const previewConfig = getBusinessConfig(previewBusinessType);

  useEffect(() => {
    loadClients();
    loadAdminPreviewBusinessType();
  }, []);

  const filteredClients = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return clients;

    return clients.filter(client => [
      client.store_name,
      client.owner_name,
      client.city,
      client.business_type,
      client.commercial_email,
      client.plan,
      client.subscription_status,
    ].some(value => String(value || '').toLowerCase().includes(text)));
  }, [clients, search]);

  const stats = useMemo(() => {
    const activeClients = clients.filter(client => getClientStatus(client).value === 'activo');
    const expiringClients = clients.filter(client => getClientStatus(client).value === 'por_vencer');
    const expiredClients = clients.filter(client => getClientStatus(client).value === 'vencido');
    const suspendedClients = clients.filter(client => getClientStatus(client).value === 'suspendido');

    const monthlyIncome = activeClients.reduce((sum, client) => {
      if (client.plan === 'mensual') return sum + Number(client.monthly_price || 0);
      if (client.plan === 'anual') return sum + (Number(client.annual_price || 0) / 12);
      return sum;
    }, 0);

    const annualIncome = activeClients.reduce((sum, client) => {
      if (client.plan === 'mensual') return sum + (Number(client.monthly_price || 0) * 12);
      if (client.plan === 'anual') return sum + Number(client.annual_price || 0);
      return sum;
    }, 0);

    const totalProducts = clients.reduce((sum, client) => sum + Number(client.product_count || 0), 0);

    return {
      total: clients.length,
      active: activeClients.length,
      expiring: expiringClients.length,
      expired: expiredClients.length,
      suspended: suspendedClients.length,
      monthlyIncome,
      annualIncome,
      totalProducts,
    };
  }, [clients]);

  function setCreateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function setEditField(field, value) {
    setEditForm(prev => ({ ...prev, [field]: value }));
  }

  async function loadAdminPreviewBusinessType() {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      const adminUser = userData?.user;
      if (!adminUser?.id) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('business_type')
        .eq('id', adminUser.id)
        .maybeSingle();

      if (profile?.business_type) {
        setPreviewBusinessType(profile.business_type);
      }
    } catch (error) {
      console.error('Error cargando modo de vista previa:', error);
    }
  }

  async function applyAdminPreviewBusinessType() {
    try {
      setPreviewSaving(true);
      setAdminPageNotice(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      const adminUser = userData?.user;

      if (!adminUser?.id) {
        throw new Error('No se encontró la sesión del administrador.');
      }

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: adminUser.id,
          business_type: previewBusinessType,
          owner_name: adminUser.email,
          store_name: 'InventiQ Admin',
          city: 'Administración',
        }, { onConflict: 'id' });

      if (error) {
        throw error;
      }

      setAdminPageNotice({
        type: 'success',
        message: `Vista previa cambiada a ${previewConfig.label}. La página se recargará para aplicar el cambio.`,
      });

      setTimeout(() => {
        window.location.reload();
      }, 900);
    } catch (error) {
      console.error('Error cambiando modo de vista previa:', error);
      setAdminPageNotice({
        type: 'error',
        message: `No se pudo cambiar el tipo de negocio: ${error.message}`,
      });
    } finally {
      setPreviewSaving(false);
    }
  }

  async function loadClients() {
    try {
      setClientsLoading(true);
      setAdminPageNotice(null);

      const { data, error } = await supabase
        .from('profiles')
        .select('*');

      if (error) {
        throw error;
      }

      const safeProfiles = Array.isArray(data) ? data : [];

      const profilesWithCounts = await Promise.all(
        safeProfiles.map(async client => {
          try {
            const { count, error: countError } = await supabase
              .from('products')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', client.id);

            if (countError) {
              return { ...client, product_count: 0 };
            }

            return { ...client, product_count: count || 0 };
          } catch (_) {
            return { ...client, product_count: 0 };
          }
        })
      );

      const sortedClients = profilesWithCounts.sort((a, b) =>
        normalizeText(a.store_name || a.owner_name).localeCompare(
          normalizeText(b.store_name || b.owner_name),
          'es'
        )
      );

      setClients(sortedClients);
    } catch (error) {
      console.error('Error cargando clientes:', error);
      setAdminPageNotice({
        type: 'error',
        message: `No se pudieron cargar los clientes: ${error.message}. Si Supabase bloquea la lectura, revisa las políticas RLS para el administrador.`,
      });
    } finally {
      setClientsLoading(false);
    }
  }

  async function handleCreateClient(event) {
    await createClientAccount(event);
    setTimeout(() => {
      loadClients();
    }, 1200);
  }

  function startEditClient(client) {
    setEditingClientId(client.id);
    setEditForm(buildEditForm(client));
    setAdminPageNotice(null);
  }

  function cancelEditClient() {
    setEditingClientId(null);
    setEditForm(DEFAULT_EDIT_FORM);
    setSavingClient(false);
  }

  async function saveClientAdminData() {
    if (!editingClientId) return;

    try {
      setSavingClient(true);
      setAdminPageNotice(null);

      const payload = {
        plan: editForm.plan || 'anual',
        subscription_status: editForm.is_suspended ? 'suspendido' : editForm.subscription_status,
        subscription_start: editForm.subscription_start || null,
        subscription_end: editForm.subscription_end || null,
        monthly_price: Number(editForm.monthly_price || 0),
        annual_price: Number(editForm.annual_price || 0),
        max_products: Number(editForm.max_products || 0),
        is_suspended: Boolean(editForm.is_suspended),
        admin_notes: editForm.admin_notes || '',
      };

      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', editingClientId);

      if (error) {
        throw error;
      }

      setClients(prev =>
        prev.map(client =>
          client.id === editingClientId
            ? { ...client, ...payload }
            : client
        )
      );

      setAdminPageNotice({ type: 'success', message: 'Datos administrativos actualizados correctamente.' });
      cancelEditClient();
    } catch (error) {
      console.error('Error actualizando cliente:', error);
      setAdminPageNotice({ type: 'error', message: `No se pudo actualizar el cliente: ${error.message}` });
    } finally {
      setSavingClient(false);
    }
  }

  async function toggleSuspendClient(client) {
    const nextSuspended = !client.is_suspended;

    try {
      const payload = {
        is_suspended: nextSuspended,
        subscription_status: nextSuspended ? 'suspendido' : 'activo',
      };

      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', client.id);

      if (error) throw error;

      setClients(prev =>
        prev.map(item =>
          item.id === client.id
            ? { ...item, ...payload }
            : item
        )
      );

      setAdminPageNotice({
        type: 'success',
        message: nextSuspended
          ? `Cuenta de ${client.store_name || client.owner_name} suspendida.`
          : `Cuenta de ${client.store_name || client.owner_name} reactivada.`,
      });
    } catch (error) {
      console.error('Error cambiando estado del cliente:', error);
      setAdminPageNotice({ type: 'error', message: `No se pudo cambiar el estado: ${error.message}` });
    }
  }

  async function renewAnnualPlan(client) {
    const payload = {
      plan: 'anual',
      subscription_status: 'activo',
      subscription_start: todayInputValue(),
      subscription_end: addMonthsToInputDate(12),
      annual_price: Number(client.annual_price || 300),
      is_suspended: false,
    };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', client.id);

      if (error) throw error;

      setClients(prev =>
        prev.map(item =>
          item.id === client.id
            ? { ...item, ...payload }
            : item
        )
      );

      setAdminPageNotice({ type: 'success', message: `Plan anual renovado para ${client.store_name || client.owner_name}.` });
    } catch (error) {
      console.error('Error renovando plan:', error);
      setAdminPageNotice({ type: 'error', message: `No se pudo renovar el plan: ${error.message}` });
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-600">InventiQ Admin</p>
            <h2 className="mt-2 text-3xl font-black text-slate-900">Panel de administración</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Gestiona clientes, planes, vencimientos, pagos y acceso a la plataforma.
            </p>
          </div>

          <button
            type="button"
            onClick={loadClients}
            disabled={clientsLoading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-bold text-emerald-700 shadow-sm hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {clientsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Actualizar clientes
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-black uppercase tracking-wide text-slate-500">Modo de vista previa</p>
            <h3 className="mt-1 text-2xl font-black text-slate-900">Revisar InventiQ como otro tipo de negocio</h3>
            <p className="mt-2 text-sm text-slate-500">
              Cambia el tipo de negocio de tu cuenta administradora para revisar cómo se adaptan textos, campos y categorías.
              Esto no cambia los clientes; solo afecta tu cuenta de administrador.
            </p>
          </div>

          <div className="w-full rounded-3xl border border-slate-100 bg-slate-50 p-4 xl:max-w-md">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Tipo de negocio para revisar</span>
              <select
                value={previewBusinessType}
                onChange={event => setPreviewBusinessType(event.target.value)}
                className="input-admin"
              >
                {businessTypeOptions.map(option => {
                  const value = option.id || option.value || option.key || 'general';
                  const label = option.name || option.label || option.title || value;
                  return (
                    <option key={value} value={value}>{label}</option>
                  );
                })}
              </select>
            </label>

            <button
              type="button"
              onClick={applyAdminPreviewBusinessType}
              disabled={previewSaving}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {previewSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Aplicar vista de {previewConfig.label}
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Nombre de producto</p>
            <p className="mt-2 text-sm font-bold text-emerald-950">{previewConfig.productNamePlaceholder}</p>
          </div>

          <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-blue-700">Categorías sugeridas</p>
            <p className="mt-2 text-sm font-bold text-blue-950">{previewConfig.categoryPlaceholder}</p>
          </div>

          <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-amber-700">Caducidad</p>
            <p className="mt-2 text-sm font-bold text-amber-950">
              {previewConfig.usesExpiration ? 'Activa para productos o insumos perecibles' : 'No activa para este tipo de negocio'}
            </p>
          </div>
        </div>

        {Array.isArray(previewConfig.defaultCategories) && previewConfig.defaultCategories.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Categorías base de este negocio</p>
            <div className="flex flex-wrap gap-2">
              {previewConfig.defaultCategories.slice(0, 12).map(item => (
                <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetric
          icon={Users}
          title="Clientes activos"
          value={stats.active}
          detail={`${stats.total} cliente(s) registrados`}
          tone="emerald"
        />
        <AdminMetric
          icon={AlertTriangle}
          title="Por vencer"
          value={stats.expiring}
          detail={`${stats.expired} vencido(s)`}
          tone="amber"
        />
        <AdminMetric
          icon={DollarSign}
          title="Ingreso anual estimado"
          value={formatMoney(stats.annualIncome)}
          detail={`${formatMoney(stats.monthlyIncome)} mensual estimado`}
          tone="blue"
        />
        <AdminMetric
          icon={Store}
          title="Productos clientes"
          value={stats.totalProducts}
          detail={`${stats.suspended} cuenta(s) suspendida(s)`}
          tone="slate"
        />
      </section>

      {(notice || adminPageNotice) && (
        <div className={`rounded-3xl p-4 text-sm font-semibold ${
          (notice || adminPageNotice)?.type === 'success'
            ? 'border border-emerald-100 bg-emerald-50 text-emerald-700'
            : 'border border-red-100 bg-red-50 text-red-700'
        }`}>
          {(notice || adminPageNotice)?.message}
        </div>
      )}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">Crear cliente</h3>
              <p className="text-sm text-slate-500">Registra una cuenta nueva para un negocio.</p>
            </div>
          </div>

          <form onSubmit={handleCreateClient} className="space-y-4">
            <AdminField label="Nombre del dueño">
              <input
                value={form.name || ''}
                onChange={event => setCreateField('name', event.target.value)}
                className="input-admin"
                placeholder="Ej: Diego Revelo"
              />
            </AdminField>

            <AdminField label="Nombre del negocio">
              <input
                value={form.store || ''}
                onChange={event => setCreateField('store', event.target.value)}
                className="input-admin"
                placeholder="Ej: KUEHNS 5"
              />
            </AdminField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AdminField label="Ciudad">
                <input
                  value={form.city || ''}
                  onChange={event => setCreateField('city', event.target.value)}
                  className="input-admin"
                  placeholder="Ej: Cuenca"
                />
              </AdminField>

              <AdminField label="Tipo de negocio">
                <select
                  value={form.businessType || 'general'}
                  onChange={event => setCreateField('businessType', event.target.value)}
                  className="input-admin"
                >
                  {businessTypeOptions.map(option => {
                    const value = option.id || option.value || option.key || 'general';
                    const label = option.name || option.label || option.title || value;
                    return (
                      <option key={value} value={value}>{label}</option>
                    );
                  })}
                </select>
              </AdminField>
            </div>

            <AdminField label="Correo de acceso">
              <input
                type="email"
                value={form.email || ''}
                onChange={event => setCreateField('email', event.target.value)}
                className="input-admin"
                placeholder="cliente@correo.com"
              />
            </AdminField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AdminField label="Contraseña temporal">
                <input
                  type="password"
                  value={form.password || ''}
                  onChange={event => setCreateField('password', event.target.value)}
                  className="input-admin"
                  placeholder="Mínimo 8 caracteres"
                />
              </AdminField>

              <AdminField label="Confirmar contraseña">
                <input
                  type="password"
                  value={form.confirmPassword || ''}
                  onChange={event => setCreateField('confirmPassword', event.target.value)}
                  className="input-admin"
                  placeholder="Repite la contraseña"
                />
              </AdminField>
            </div>

            <button
              type="submit"
              className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-emerald-700"
            >
              Crear cuenta del cliente
            </button>
          </form>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-900">Clientes registrados</h3>
              <p className="text-sm text-slate-500">Controla planes, fechas de vencimiento y acceso.</p>
            </div>

            <div className="relative w-full lg:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                placeholder="Buscar cliente..."
              />
            </div>
          </div>

          {clientsLoading ? (
            <div className="flex items-center justify-center rounded-3xl border border-dashed border-slate-200 p-10 text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Cargando clientes...
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
              <Users className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              No hay clientes para mostrar.
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-100">
              <div className="hidden bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 xl:grid xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.7fr_170px] xl:gap-3">
                <span>Cliente</span>
                <span>Plan</span>
                <span>Estado</span>
                <span>Vencimiento</span>
                <span>Productos</span>
                <span className="text-right">Acciones</span>
              </div>

              <div className="divide-y divide-slate-100">
                {filteredClients.map(client => {
                  const status = getClientStatus(client);
                  const days = getDaysUntil(client.subscription_end);
                  const isEditing = editingClientId === client.id;

                  return (
                    <div key={client.id} className="p-4">
                      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.7fr_170px] xl:items-center xl:gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-900">
                            {client.store_name || 'Negocio sin nombre'}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {client.owner_name || 'Sin dueño'} · {client.city || 'Sin ciudad'}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {getBusinessTypeLabel(client.business_type)}
                          </p>
                        </div>

                        <div>
                          <p className="text-sm font-bold capitalize text-slate-700">{client.plan || 'anual'}</p>
                          <p className="text-xs text-slate-400">
                            {client.plan === 'mensual'
                              ? `${formatMoney(client.monthly_price || 25)} / mes`
                              : `${formatMoney(client.annual_price || 300)} / año`}
                          </p>
                        </div>

                        <div>
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${status.className}`}>
                            {status.label}
                          </span>
                        </div>

                        <div>
                          <p className="text-sm font-bold text-slate-700">{formatDate(client.subscription_end)}</p>
                          <p className="text-xs text-slate-400">
                            {days === null
                              ? 'Sin vencimiento'
                              : days < 0
                                ? `Venció hace ${Math.abs(days)} día(s)`
                                : `Faltan ${days} día(s)`}
                          </p>
                        </div>

                        <div>
                          <p className="text-sm font-black text-slate-800">{client.product_count || 0}</p>
                          <p className="text-xs text-slate-400">Límite: {client.max_products || 2000}</p>
                        </div>

                        <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
                          <button
                            type="button"
                            onClick={() => startEditClient(client)}
                            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-emerald-600"
                            title="Editar cliente"
                          >
                            <Edit className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => renewAnnualPlan(client)}
                            className="rounded-xl border border-emerald-100 bg-white p-2 text-emerald-600 hover:bg-emerald-50"
                            title="Renovar plan anual"
                          >
                            <CalendarDays className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleSuspendClient(client)}
                            className={`rounded-xl border p-2 ${client.is_suspended ? 'border-emerald-100 text-emerald-600 hover:bg-emerald-50' : 'border-red-100 text-red-500 hover:bg-red-50'}`}
                            title={client.is_suspended ? 'Reactivar cuenta' : 'Suspender cuenta'}
                          >
                            {client.is_suspended ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {client.admin_notes && !isEditing && (
                        <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                          <span className="font-bold text-slate-600">Nota:</span> {client.admin_notes}
                        </div>
                      )}

                      {isEditing && (
                        <div className="mt-4 rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
                          <div className="mb-4 flex items-center gap-2 text-emerald-800">
                            <ShieldCheck className="h-4 w-4" />
                            <h4 className="text-sm font-black">Editar administración del cliente</h4>
                          </div>

                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <AdminField label="Plan">
                              <select
                                value={editForm.plan}
                                onChange={event => setEditField('plan', event.target.value)}
                                className="input-admin"
                              >
                                {PLAN_OPTIONS.map(option => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </AdminField>

                            <AdminField label="Estado">
                              <select
                                value={editForm.subscription_status}
                                onChange={event => setEditField('subscription_status', event.target.value)}
                                className="input-admin"
                              >
                                {STATUS_OPTIONS.map(option => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </AdminField>

                            <AdminField label="Inicio">
                              <input
                                type="date"
                                value={editForm.subscription_start}
                                onChange={event => setEditField('subscription_start', event.target.value)}
                                className="input-admin"
                              />
                            </AdminField>

                            <AdminField label="Vencimiento">
                              <input
                                type="date"
                                value={editForm.subscription_end}
                                onChange={event => setEditField('subscription_end', event.target.value)}
                                className="input-admin"
                              />
                            </AdminField>

                            <AdminField label="Precio mensual">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editForm.monthly_price}
                                onChange={event => setEditField('monthly_price', event.target.value)}
                                className="input-admin"
                              />
                            </AdminField>

                            <AdminField label="Precio anual">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editForm.annual_price}
                                onChange={event => setEditField('annual_price', event.target.value)}
                                className="input-admin"
                              />
                            </AdminField>

                            <AdminField label="Máximo productos">
                              <input
                                type="number"
                                min="0"
                                value={editForm.max_products}
                                onChange={event => setEditField('max_products', event.target.value)}
                                className="input-admin"
                              />
                            </AdminField>

                            <AdminField label="Acceso">
                              <label className="flex h-[46px] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600">
                                <input
                                  type="checkbox"
                                  checked={editForm.is_suspended}
                                  onChange={event => setEditField('is_suspended', event.target.checked)}
                                  className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                                />
                                Suspender cuenta
                              </label>
                            </AdminField>
                          </div>

                          <AdminField label="Notas internas" className="mt-4">
                            <textarea
                              value={editForm.admin_notes}
                              onChange={event => setEditField('admin_notes', event.target.value)}
                              className="input-admin min-h-[90px] resize-none"
                              placeholder="Ej: Cliente pagó anualidad, requiere soporte con etiquetas, etc."
                            />
                          </AdminField>

                          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                            <button
                              type="button"
                              onClick={cancelEditClient}
                              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={saveClientAdminData}
                              disabled={savingClient}
                              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {savingClient ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              Guardar cambios
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      <style>{`
        .input-admin {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgb(226 232 240);
          background: white;
          padding: 0.75rem 0.9rem;
          font-size: 0.875rem;
          color: rgb(15 23 42);
          outline: none;
        }

        .input-admin:focus {
          border-color: rgb(110 231 183);
          box-shadow: 0 0 0 3px rgb(209 250 229);
        }
      `}</style>
    </div>
  );
}

function AdminMetric({ icon: Icon, title, value, detail, tone }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{detail}</p>
        </div>
        <div className={`rounded-2xl border p-3 ${tones[tone] || tones.slate}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function AdminField({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
