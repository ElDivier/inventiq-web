import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Inbox,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  UserRoundCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { businessTypes } from '../config/businessTypes';

const STATUS_OPTIONS = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'contactado', label: 'Contactado' },
  { value: 'seguimiento', label: 'En seguimiento' },
  { value: 'convertido', label: 'Convertido' },
  { value: 'descartado', label: 'Descartado' },
];

const PLAN_LABELS = {
  por_definir: 'Por definir',
  esencial: 'Esencial (anterior)',
  negocio: 'Negocio',
  gastronomico: 'Gastronomía',
  pro: 'Pro (anterior)',
  personalizado: 'Personalizado',
};

const STATUS_STYLES = {
  nuevo: 'border-cyan-100 bg-cyan-50 text-cyan-700',
  contactado: 'border-blue-100 bg-blue-50 text-blue-700',
  seguimiento: 'border-amber-100 bg-amber-50 text-amber-700',
  convertido: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  descartado: 'border-slate-200 bg-slate-100 text-slate-600',
};

function formatDate(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleString('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getBusinessLabel(value) {
  return businessTypes.find(option => option.value === value)?.label || value || 'Otro negocio';
}

function normalizeWhatsAppNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `593${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith('9')) return `593${digits}`;
  return digits;
}

function buildWhatsAppUrl(lead) {
  const number = normalizeWhatsAppNumber(lead.whatsapp);
  if (!number) return '';
  const message = `Hola ${lead.full_name || ''}, te contactamos de InventIQ por la solicitud enviada para ${lead.business_name || 'tu negocio'}.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export default function LandingLeadsPanel() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [notesDraft, setNotesDraft] = useState({});
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    loadLeads();

    const channel = supabase
      .channel('inventiq-landing-leads-admin')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'landing_leads' },
        payload => {
          const newLead = payload.new;
          if (!newLead?.id) return;

          setLeads(previous => [
            newLead,
            ...previous.filter(item => item.id !== newLead.id),
          ]);
          setNotesDraft(previous => ({
            ...previous,
            [newLead.id]: newLead.admin_notes || '',
          }));
          setNotice({
            type: 'success',
            message: 'Nueva solicitud recibida desde la landing page.',
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredLeads = useMemo(() => {
    const text = search.trim().toLowerCase();
    return leads.filter(lead => {
      if (statusFilter !== 'todos' && lead.status !== statusFilter) return false;
      if (!text) return true;
      return [
        lead.full_name,
        lead.business_name,
        lead.whatsapp,
        lead.email,
        lead.business_type,
        lead.plan_code,
        lead.message,
      ].some(value => String(value || '').toLowerCase().includes(text));
    });
  }, [leads, search, statusFilter]);

  const stats = useMemo(() => ({
    total: leads.length,
    nuevos: leads.filter(lead => lead.status === 'nuevo').length,
    seguimiento: leads.filter(lead => lead.status === 'seguimiento' || lead.status === 'contactado').length,
    convertidos: leads.filter(lead => lead.status === 'convertido').length,
  }), [leads]);

  async function loadLeads() {
    try {
      setLoading(true);
      setNotice(null);

      const { data, error } = await supabase
        .from('landing_leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const safeLeads = Array.isArray(data) ? data : [];
      setLeads(safeLeads);
      setNotesDraft(Object.fromEntries(safeLeads.map(lead => [lead.id, lead.admin_notes || ''])));
    } catch (error) {
      console.error('Error cargando prospectos:', error);
      setNotice({
        type: 'error',
        message: `No se pudieron cargar los prospectos: ${error.message}. Revisa que hayas ejecutado la migración de la Fase 4 y sus políticas RLS.`,
      });
    } finally {
      setLoading(false);
    }
  }

  async function updateLeadStatus(lead, nextStatus) {
    try {
      setSavingId(lead.id);
      const payload = {
        status: nextStatus,
        contacted_at: nextStatus === 'nuevo' ? null : (lead.contacted_at || new Date().toISOString()),
      };

      const { error } = await supabase
        .from('landing_leads')
        .update(payload)
        .eq('id', lead.id);

      if (error) throw error;
      setLeads(previous => previous.map(item => item.id === lead.id ? { ...item, ...payload } : item));
      setNotice({ type: 'success', message: 'Estado del prospecto actualizado.' });
    } catch (error) {
      console.error('Error actualizando prospecto:', error);
      setNotice({ type: 'error', message: `No se pudo actualizar el estado: ${error.message}` });
    } finally {
      setSavingId(null);
    }
  }

  async function saveLeadNotes(lead) {
    try {
      setSavingId(lead.id);
      const adminNotes = String(notesDraft[lead.id] || '').trim().slice(0, 2000);
      const { error } = await supabase
        .from('landing_leads')
        .update({ admin_notes: adminNotes || null })
        .eq('id', lead.id);

      if (error) throw error;
      setLeads(previous => previous.map(item => item.id === lead.id ? { ...item, admin_notes: adminNotes } : item));
      setNotice({ type: 'success', message: 'Notas del prospecto guardadas.' });
    } catch (error) {
      console.error('Error guardando notas:', error);
      setNotice({ type: 'error', message: `No se pudieron guardar las notas: ${error.message}` });
    } finally {
      setSavingId(null);
    }
  }

  async function deleteLead(lead) {
    const confirmed = window.confirm(`¿Eliminar la solicitud de ${lead.full_name || lead.business_name}? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    try {
      setSavingId(lead.id);
      const { error } = await supabase.from('landing_leads').delete().eq('id', lead.id);
      if (error) throw error;
      setLeads(previous => previous.filter(item => item.id !== lead.id));
      setNotice({ type: 'success', message: 'Solicitud eliminada.' });
    } catch (error) {
      console.error('Error eliminando prospecto:', error);
      setNotice({ type: 'error', message: `No se pudo eliminar la solicitud: ${error.message}` });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-700">Landing page</p>
          <h3 className="mt-2 text-2xl font-black text-slate-900">Solicitudes y prospectos</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Revisa las demostraciones solicitadas desde la página pública, registra el seguimiento y conserva notas comerciales.
          </p>
        </div>

        <button
          type="button"
          onClick={loadLeads}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-100 bg-white px-4 py-3 text-sm font-black text-cyan-700 shadow-sm transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Actualizar solicitudes
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [Inbox, 'Total', stats.total, 'Todas las solicitudes', 'text-slate-700 bg-slate-100'],
          [Clock3, 'Nuevas', stats.nuevos, 'Pendientes de contacto', 'text-cyan-700 bg-cyan-100'],
          [Users, 'Seguimiento', stats.seguimiento, 'Contactadas o en proceso', 'text-amber-700 bg-amber-100'],
          [UserRoundCheck, 'Convertidas', stats.convertidos, 'Prospectos que contrataron', 'text-emerald-700 bg-emerald-100'],
        ].map(([Icon, label, value, detail, tone]) => (
          <article key={label} className="rounded-3xl border border-white bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}><Icon className="h-5 w-5" /></span>
              <span className="text-3xl font-black text-slate-900">{value}</span>
            </div>
            <p className="mt-4 font-black text-slate-800">{label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
          </article>
        ))}
      </div>

      {notice && (
        <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold ${notice.type === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-red-100 bg-red-50 text-red-700'}`}>
          <div className="flex items-start gap-2">
            {notice.type === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{notice.message}</span>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-50"
            placeholder="Buscar por nombre, negocio, teléfono o plan..."
          />
        </div>
        <select
          value={statusFilter}
          onChange={event => setStatusFilter(event.target.value)}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-50 lg:w-56"
        >
          <option value="todos">Todos los estados</option>
          {STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando solicitudes...
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
            <Inbox className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            No hay solicitudes para mostrar.
          </div>
        ) : filteredLeads.map(lead => {
          const whatsappUrl = buildWhatsAppUrl(lead);
          const busy = savingId === lead.id;
          return (
            <article key={lead.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-xl font-black text-slate-900">{lead.business_name || 'Negocio sin nombre'}</h4>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wide ${STATUS_STYLES[lead.status] || STATUS_STYLES.nuevo}`}>
                      {STATUS_OPTIONS.find(option => option.value === lead.status)?.label || 'Nuevo'}
                    </span>
                    {lead.request_type === 'personalizacion' && (
                      <span className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-violet-700">Personalización</span>
                    )}
                  </div>

                  <p className="mt-2 font-bold text-slate-700">{lead.full_name}</p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                    <span>{getBusinessLabel(lead.business_type)}</span>
                    <span>Plan: <strong className="text-slate-700">{PLAN_LABELS[lead.plan_code] || lead.plan_code || 'Por definir'}</strong></span>
                    <span>{lead.billing_cycle === 'annual' ? 'Pago anual' : 'Pago mensual'}</span>
                    <span>Recibido: {formatDate(lead.created_at)}</span>
                  </div>

                  {lead.message && (
                    <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{lead.message}</p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {whatsappUrl && (
                      <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100">
                        <MessageCircle className="h-4 w-4" /> {lead.whatsapp}
                      </a>
                    )}
                    {lead.email && (
                      <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100">
                        <Mail className="h-4 w-4" /> {lead.email}
                      </a>
                    )}
                  </div>
                </div>

                <div className="w-full space-y-3 xl:max-w-sm">
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Estado comercial</span>
                    <select
                      value={lead.status || 'nuevo'}
                      onChange={event => updateLeadStatus(lead, event.target.value)}
                      disabled={busy}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-cyan-300"
                    >
                      {STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Notas internas</span>
                    <textarea
                      value={notesDraft[lead.id] || ''}
                      onChange={event => setNotesDraft(previous => ({ ...previous, [lead.id]: event.target.value }))}
                      className="min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-6 text-slate-700 outline-none focus:border-cyan-300"
                      placeholder="Fecha de llamada, necesidades, siguiente acción..."
                      maxLength={2000}
                    />
                  </label>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveLeadNotes(lead)}
                      disabled={busy}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#071a33] px-3 py-2.5 text-xs font-black text-white hover:bg-blue-950 disabled:opacity-60"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar notas
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteLead(lead)}
                      disabled={busy}
                      className="inline-flex items-center justify-center rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-red-600 hover:bg-red-100 disabled:opacity-60"
                      aria-label="Eliminar solicitud"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
