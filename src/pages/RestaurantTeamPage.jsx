import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Building2,
  Copy,
  ExternalLink,
  BadgeCheck,
  Check,
  Clock3,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRoundCog,
  UsersRound,
  X,
} from 'lucide-react';
import {
  RESTAURANT_PERMISSION_GROUPS,
  RESTAURANT_ROLE_PRESETS,
  getRestaurantRolePreset,
  hasRestaurantPermission,
} from '../utils/restaurantPermissions';
import {
  buildRestaurantStaffDraft,
  createRestaurantStaff,
  fetchRestaurantAudit,
  fetchRestaurantStaff,
  updateRestaurantStaff,
  fetchRestaurantEmployeeAccessSettings,
  saveRestaurantEmployeeAccessSettings,
} from '../utils/restaurantStaff';

function formatDate(value) {
  if (!value) return 'Sin actividad todavía';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin actividad todavía';
  return date.toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
}


const AUDIT_LABELS = {
  'operator.activated': 'Inicio de turno',
  'staff.created': 'Perfil creado',
  'staff.updated': 'Perfil actualizado',
  'order_item.cancelled': 'Producto cancelado',
  'order.transferred': 'Cuenta transferida',
  'checkout.charges_updated': 'Descuento / servicio actualizado',
  'checkout.payment_registered': 'Cobro registrado',
  'checkout.payment_voided': 'Cobro anulado',
  'sale.cancelled': 'Venta anulada',
  'inventory.adjusted': 'Inventario ajustado',
  'inventory.waste_registered': 'Merma registrada',
  'inventory.physical_count': 'Conteo físico',
  'inventory.preparation_batch': 'Preparación elaborada',
  'kitchen.item_status': 'Estado de cocina actualizado',
  'kitchen.station_status': 'Estación de cocina actualizada',
  'kitchen.priority_toggled': 'Prioridad de cocina modificada',
  'recipe.created': 'Receta creada',
  'recipe.updated': 'Receta actualizada',
  'recipe.deleted': 'Receta eliminada',
  'recipe.status_changed': 'Estado de receta actualizado',
};

function auditLabel(action) {
  return AUDIT_LABELS[action] || String(action || '').replaceAll('.', ' · ');
}

function suggestAccessCode(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function roleClass(role) {
  return ({
    administrador: 'border-violet-200 bg-violet-50 text-violet-700',
    supervisor: 'border-blue-200 bg-blue-50 text-blue-700',
    cajero: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    mesero: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    cocina: 'border-amber-200 bg-amber-50 text-amber-700',
    barista: 'border-orange-200 bg-orange-50 text-orange-700',
  })[role] || 'border-slate-200 bg-slate-50 text-slate-700';
}

export default function RestaurantTeamPage({ currentUser, onOpenOperatorSwitcher }) {
  const [staff, setStaff] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState(() => buildRestaurantStaffDraft(currentUser?.businessType === 'cafeteria' ? 'barista' : 'mesero'));
  const [employeeAccess, setEmployeeAccess] = useState({ accessCode: '', isActive: false, passwordConfigured: false });
  const [employeeAccessPassword, setEmployeeAccessPassword] = useState('');
  const [savingAccess, setSavingAccess] = useState(false);

  const canManage = hasRestaurantPermission(currentUser, 'team.manage');
  const isCafeteria = currentUser?.businessType === 'cafeteria';
  const businessLabel = isCafeteria ? 'Cafetería' : 'Restaurante';
  const employeeAccessUrl = typeof window !== 'undefined' ? `${window.location.origin}/empleados` : '/empleados';
  const roleEntries = useMemo(() => Object.entries(RESTAURANT_ROLE_PRESETS).filter(([key]) => {
    if (!isCafeteria) return key !== 'barista';
    return ['administrador', 'supervisor', 'cajero', 'barista'].includes(key) || key === draft.role;
  }), [isCafeteria, draft.role]);
  const permissionGroups = useMemo(() => RESTAURANT_PERMISSION_GROUPS.map((group) => ({
    ...group,
    items: isCafeteria
      ? group.items.filter(([permission]) => !['tables.manage', 'tables.view', 'orders.manage', 'orders.view', 'kitchen.manage', 'checkout.manage'].includes(permission))
      : group.items.filter(([permission]) => permission !== 'cafe.queue.manage'),
  })).filter((group) => group.items.length > 0), [isCafeteria]);

  const loadData = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const [staffRows, auditRows, accessSettings] = await Promise.all([
        fetchRestaurantStaff(currentUser.id),
        fetchRestaurantAudit(currentUser.id, 60),
        fetchRestaurantEmployeeAccessSettings(),
      ]);
      setStaff(staffRows);
      setAudit(auditRows);
      setEmployeeAccess({
        accessCode: accessSettings?.accessCode || suggestAccessCode(currentUser.store),
        isActive: Boolean(accessSettings?.isActive),
        passwordConfigured: Boolean(accessSettings?.passwordConfigured),
      });
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo cargar el equipo: ${error.message}` });
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const stats = useMemo(() => ({
    active: staff.filter((item) => item.isActive).length,
    supervisors: staff.filter((item) => ['administrador', 'supervisor'].includes(item.role) && item.isActive).length,
    operational: staff.filter((item) => ['cajero', 'mesero', 'cocina', 'barista'].includes(item.role) && item.isActive).length,
  }), [staff]);

  function newMember() {
    setDraft(buildRestaurantStaffDraft(currentUser?.businessType === 'cafeteria' ? 'barista' : 'mesero'));
    setEditorOpen(true);
    setNotice(null);
  }

  function editMember(member) {
    setDraft({
      id: member.id,
      name: member.name,
      role: member.role,
      pin: '',
      isActive: member.isActive,
      permissions: [...member.permissions],
    });
    setEditorOpen(true);
    setNotice(null);
  }

  function changeRole(role) {
    setDraft((current) => ({
      ...current,
      role,
      permissions: [...getRestaurantRolePreset(role).permissions],
    }));
  }

  function togglePermission(permission) {
    setDraft((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
    }));
  }

  async function saveEmployeeAccess(event) {
    event.preventDefault();
    if (!canManage) return;
    const code = String(employeeAccess.accessCode || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{3,39}$/.test(code)) {
      setNotice({ type: 'error', message: 'El código debe tener entre 4 y 40 caracteres y usar solo letras, números, guion o guion bajo.' });
      return;
    }
    if (!employeeAccess.passwordConfigured && employeeAccessPassword.length < 8) {
      setNotice({ type: 'error', message: 'Crea una contraseña de acceso del equipo de al menos 8 caracteres.' });
      return;
    }
    if (employeeAccessPassword && employeeAccessPassword.length < 8) {
      setNotice({ type: 'error', message: 'La nueva contraseña de acceso debe tener al menos 8 caracteres.' });
      return;
    }

    setSavingAccess(true);
    setNotice(null);
    try {
      const data = await saveRestaurantEmployeeAccessSettings({
        accessCode: code,
        password: employeeAccessPassword,
        isActive: employeeAccess.isActive,
      });
      setEmployeeAccess({
        accessCode: data?.accessCode || code,
        isActive: Boolean(data?.isActive),
        passwordConfigured: Boolean(data?.passwordConfigured),
      });
      setEmployeeAccessPassword('');
      setNotice({ type: 'success', message: 'Acceso de empleados actualizado. Comparte el enlace /empleados junto con el código del negocio; cada integrante ingresará después con su PIN.' });
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally {
      setSavingAccess(false);
    }
  }

  async function copyAccessCode() {
    const value = String(employeeAccess.accessCode || '').trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setNotice({ type: 'success', message: 'Código del negocio copiado.' });
    } catch {
      setNotice({ type: 'error', message: 'No se pudo copiar automáticamente. Puedes seleccionar el código y copiarlo manualmente.' });
    }
  }

  async function copyEmployeeAccessLink() {
    try {
      await navigator.clipboard.writeText(employeeAccessUrl);
      setNotice({ type: 'success', message: 'Enlace de acceso para empleados copiado.' });
    } catch {
      setNotice({ type: 'error', message: `No se pudo copiar automáticamente. Comparte este enlace: ${employeeAccessUrl}` });
    }
  }

  async function saveMember(event) {
    event.preventDefault();
    if (!canManage) return;
    if (!draft.name.trim()) {
      setNotice({ type: 'error', message: 'Ingresa el nombre del integrante.' });
      return;
    }
    if (!draft.id && !/^\d{4,6}$/.test(draft.pin)) {
      setNotice({ type: 'error', message: 'El PIN inicial debe tener entre 4 y 6 números.' });
      return;
    }
    if (draft.pin && !/^\d{4,6}$/.test(draft.pin)) {
      setNotice({ type: 'error', message: 'El nuevo PIN debe tener entre 4 y 6 números.' });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      if (draft.id) {
        await updateRestaurantStaff({
          id: draft.id,
          name: draft.name,
          role: draft.role,
          permissions: draft.permissions,
          isActive: draft.isActive,
          pin: draft.pin,
        });
        setNotice({ type: 'success', message: 'Perfil operativo actualizado correctamente.' });
      } else {
        await createRestaurantStaff({
          name: draft.name,
          role: draft.role,
          pin: draft.pin,
          permissions: draft.permissions,
        });
        setNotice({ type: 'success', message: 'Integrante creado. Ya puede seleccionarse como operador con su PIN.' });
      }
      setEditorOpen(false);
      await loadData();
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  }

  if (!['restaurante', 'cafeteria'].includes(currentUser?.businessType)) return null;

  if (!canManage) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h2 className="text-xl font-black">Equipo y permisos</h2>
        <p className="mt-2 text-sm font-semibold">El operador actual no tiene permiso para administrar perfiles del equipo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">{businessLabel} · Seguridad operativa</p>
            <h2 className="mt-3 flex items-center gap-3 text-3xl font-black"><UsersRound className="h-8 w-8 text-cyan-300" /> Equipo y permisos</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Crea perfiles por PIN para cada turno y limita las funciones visibles según el rol. El propietario conserva siempre el acceso administrador.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => loadData()} disabled={loading} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-black hover:bg-white/15 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar</button>
            <button type="button" onClick={onOpenOperatorSwitcher} className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-300/15"><KeyRound className="h-4 w-4" /> Cambiar operador</button>
            <button type="button" onClick={newMember} className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300"><Plus className="h-4 w-4" /> Nuevo integrante</button>
          </div>
        </div>
      </section>

      {notice && <div className={`rounded-3xl border p-4 text-sm font-bold ${notice.type === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-red-100 bg-red-50 text-red-700'}`}>{notice.message}</div>}

      <section className="rounded-[30px] border border-cyan-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)] xl:items-start">
          <div>
            <div className="flex items-start gap-3">
              <span className="rounded-2xl bg-cyan-50 p-2.5 text-cyan-700"><Building2 className="h-5 w-5" /></span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Acceso para tablets y empleados</p>
                <h3 className="mt-1 text-xl font-black text-slate-950">Entrada separada del administrador</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">El equipo no necesita conocer el correo ni la contraseña principal. Primero ingresa con el código del negocio y una contraseña compartida; después cada persona selecciona su perfil y usa su PIN individual.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Paso 1</p><p className="mt-1 text-sm font-black text-slate-800">Código + contraseña</p></div>
              <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Paso 2</p><p className="mt-1 text-sm font-black text-slate-800">Elegir integrante</p></div>
              <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Paso 3</p><p className="mt-1 text-sm font-black text-slate-800">PIN personal</p></div>
            </div>
            <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-cyan-700">Enlace exclusivo del equipo</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700">{employeeAccessUrl}</code>
                <button type="button" onClick={copyEmployeeAccessLink} className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs font-black text-cyan-800 hover:bg-cyan-50"><Copy className="h-3.5 w-3.5" /> Copiar enlace</button>
                <a href="/empleados" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"><ExternalLink className="h-3.5 w-3.5" /> Abrir</a>
              </div>
              <p className="mt-2 text-xs font-semibold leading-5 text-cyan-800">Este acceso no aparece en el login general. Está reservado para Restaurante y Cafetería.</p>
            </div>
          </div>

          <form onSubmit={saveEmployeeAccess} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-wide text-slate-400">Credenciales del negocio</p><p className="mt-1 text-sm font-black text-slate-900">Configura lo que compartes con el equipo</p></div>
              <label className="flex items-center gap-2 text-xs font-black text-slate-600"><input type="checkbox" checked={employeeAccess.isActive} onChange={(e) => setEmployeeAccess((current) => ({ ...current, isActive: e.target.checked }))} className="h-4 w-4" /> Activo</label>
            </div>
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-black text-slate-700">Código del negocio</span>
              <div className="flex gap-2">
                <input value={employeeAccess.accessCode} onChange={(e) => setEmployeeAccess((current) => ({ ...current, accessCode: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-cyan-100" placeholder="Ej: clan-destino" />
                <button type="button" onClick={copyAccessCode} className="rounded-2xl border border-slate-200 bg-white px-3 text-slate-500 hover:bg-slate-100" aria-label="Copiar código"><Copy className="h-4 w-4" /></button>
              </div>
            </label>
            <label className="mt-3 block">
              <span className="mb-2 block text-sm font-black text-slate-700">{employeeAccess.passwordConfigured ? 'Nueva contraseña de acceso (opcional)' : 'Contraseña de acceso del equipo'}</span>
              <input type="password" value={employeeAccessPassword} onChange={(e) => setEmployeeAccessPassword(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-cyan-100" placeholder={employeeAccess.passwordConfigured ? 'Déjala vacía para conservar la actual' : 'Mínimo 8 caracteres'} autoComplete="new-password" />
              <p className="mt-1.5 text-xs font-semibold text-slate-400">No uses la contraseña principal de INVENTIQ. Esta clave solo abre el acceso del equipo.</p>
            </label>
            <button type="submit" disabled={savingAccess} className="mt-4 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-900 disabled:opacity-50">{savingAccess ? 'Guardando...' : employeeAccess.passwordConfigured ? 'Guardar acceso del equipo' : 'Activar acceso del equipo'}</button>
          </form>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Perfiles activos</p><p className="mt-2 text-3xl font-black text-slate-950">{stats.active}</p><p className="mt-1 text-xs font-bold text-slate-400">Disponibles para el turno</p></article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Supervisión</p><p className="mt-2 text-3xl font-black text-slate-950">{stats.supervisors}</p><p className="mt-1 text-xs font-bold text-slate-400">Administradores y supervisores</p></article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Operación</p><p className="mt-2 text-3xl font-black text-slate-950">{stats.operational}</p><p className="mt-1 text-xs font-bold text-slate-400">Caja, atención y producción</p></article>
      </section>

      <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)]">
        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Perfiles del turno</p><h3 className="mt-1 text-xl font-black text-slate-950">Quién puede hacer qué</h3></div>
            <ShieldCheck className="h-6 w-6 text-cyan-700" />
          </div>

          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400">Cargando equipo...</div>
          ) : staff.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <UserRoundCog className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 font-black text-slate-800">Todavía no existen perfiles operativos</p>
              <p className="mt-1 text-sm text-slate-500">{currentUser?.businessType === 'cafeteria' ? 'Crea cajeros, baristas o supervisores y asigna un PIN individual.' : 'Crea cajeros, meseros, cocina o supervisores y asigna un PIN individual.'}</p>
              <button type="button" onClick={newMember} className="mt-4 iq-primary-button"><Plus className="h-4 w-4" /> Crear primer perfil</button>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {staff.map((member) => {
                const preset = getRestaurantRolePreset(member.role);
                return (
                  <article key={member.id} className={`rounded-3xl border p-4 ${member.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-70'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="truncate text-lg font-black text-slate-950">{member.name}</h4>
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${roleClass(member.role)}`}>{preset.label}</span>
                          {!member.isActive && <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-black text-slate-600">Inactivo</span>}
                        </div>
                        <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{preset.description}</p>
                      </div>
                      <button type="button" onClick={() => editMember(member)} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label={`Editar ${member.name}`}><Pencil className="h-4 w-4" /></button>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-slate-500">
                      <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] uppercase tracking-wide text-slate-400">Permisos</p><p className="mt-1 text-slate-800">{member.permissions.length} habilitados</p></div>
                      <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] uppercase tracking-wide text-slate-400">Último uso</p><p className="mt-1 truncate text-slate-800">{formatDate(member.lastUsedAt)}</p></div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-3"><span className="rounded-2xl bg-cyan-50 p-2.5 text-cyan-700"><Activity className="h-5 w-5" /></span><div><p className="text-xs font-black uppercase tracking-wide text-slate-400">Auditoría</p><h3 className="text-lg font-black text-slate-950">Actividad reciente</h3></div></div>
          <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
            {audit.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Todavía no existen eventos auditados.</p> : audit.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-100 p-3">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-800">{item.operator_name}</p><p className="mt-0.5 text-xs font-bold text-cyan-700">{auditLabel(item.action)}</p></div><BadgeCheck className="h-4 w-4 shrink-0 text-emerald-500" /></div>
                <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-slate-400"><Clock3 className="h-3.5 w-3.5" /> {formatDate(item.created_at)}</p>
              </article>
            ))}
          </div>
        </aside>
      </section>

      {editorOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5">
          <form onSubmit={saveMember} className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-[30px] bg-white p-5 shadow-2xl sm:rounded-[30px] sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">{draft.id ? 'Editar perfil' : 'Nuevo perfil'}</p><h3 className="mt-1 text-2xl font-black text-slate-950">Permisos del operador</h3></div>
              <button type="button" onClick={() => setEditorOpen(false)} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label><span className="mb-2 block text-sm font-black text-slate-700">Nombre</span><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-cyan-100" placeholder="Ej: María López" /></label>
              <label><span className="mb-2 block text-sm font-black text-slate-700">Rol</span><select value={draft.role} onChange={(e) => changeRole(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none">{roleEntries.map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
              <label><span className="mb-2 block text-sm font-black text-slate-700">{draft.id ? 'Nuevo PIN (opcional)' : 'PIN'}</span><input inputMode="numeric" maxLength={6} value={draft.pin} onChange={(e) => setDraft({ ...draft, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-cyan-100" placeholder={draft.id ? 'Dejar vacío para conservar' : '4 a 6 números'} /></label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} className="h-4 w-4" /><div><p className="font-black text-slate-800">Perfil activo</p><p className="text-xs font-semibold text-slate-400">Disponible al cambiar de operador.</p></div></label>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {permissionGroups.map((group) => (
                <section key={group.label} className="rounded-3xl border border-slate-200 p-4">
                  <h4 className="font-black text-slate-900">{group.label}</h4>
                  <div className="mt-3 space-y-2">
                    {group.items.map(([permission, label]) => {
                      const checked = draft.permissions.includes(permission);
                      return <button key={permission} type="button" onClick={() => togglePermission(permission)} className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm font-bold ${checked ? 'border-cyan-200 bg-cyan-50 text-cyan-900' : 'border-slate-100 bg-slate-50 text-slate-500'}`}><span className={`flex h-6 w-6 items-center justify-center rounded-lg ${checked ? 'bg-cyan-700 text-white' : 'bg-white text-slate-300'}`}>{checked && <Check className="h-4 w-4" />}</span>{label}</button>;
                    })}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setEditorOpen(false)} className="rounded-2xl border border-slate-200 px-5 py-3 font-black text-slate-600">Cancelar</button>
              <button type="submit" disabled={saving} className="rounded-2xl bg-cyan-700 px-5 py-3 font-black text-white hover:bg-cyan-800 disabled:opacity-50">{saving ? 'Guardando...' : draft.id ? 'Guardar cambios' : 'Crear perfil'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
