import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  MessageCircle,
  Send,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { businessTypes } from '../config/businessTypes';

const PLAN_OPTIONS = [
  { value: 'por_definir', label: 'Todavía no lo sé' },
  { value: 'negocio', label: 'InventIQ Negocio — $29,99 al mes (IVA incluido)' },
  { value: 'gastronomico', label: 'InventIQ Gastronomía — $39,99 al mes (IVA incluido)' },
  { value: 'personalizado', label: 'InventIQ Personalizado — desde $49,99 al mes (IVA incluido)' },
];

const INTEREST_OPTIONS = [
  { value: 'conocer_inventiq', label: 'Conocer InventIQ' },
  { value: 'facturacion_electronica', label: 'Facturación electrónica' },
  { value: 'configuracion_especial', label: 'Configuración o función especial' },
];

const INTEREST_LABELS = Object.fromEntries(
  INTEREST_OPTIONS.map(option => [option.value, option.label]),
);

const LEAD_COOLDOWN_MS = 15 * 60 * 1000;
const MIN_FORM_TIME_MS = 2500;
const LEAD_STORAGE_KEY = 'inventiq_landing_last_lead';

const INITIAL_FORM = {
  full_name: '',
  business_name: '',
  whatsapp: '',
  email: '',
  business_type: 'general',
  plan_code: 'por_definir',
  interest: 'conocer_inventiq',
  preferred_contact: 'whatsapp',
  message: '',
  consent: false,
  website: '',
};

function cleanText(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeWhatsAppNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `593${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith('9')) return `593${digits}`;
  return digits;
}

function buildWhatsAppUrl(number, message) {
  const normalized = normalizeWhatsAppNumber(number);
  if (!normalized) return '';
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

function buildLeadFingerprint(form) {
  return [
    normalizeWhatsAppNumber(form.whatsapp),
    cleanText(form.email, 160).toLowerCase(),
    cleanText(form.business_name, 160).toLowerCase(),
  ].join('|');
}

function getLastLeadSubmission() {
  try {
    const raw = window.localStorage.getItem(LEAD_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLastLeadSubmission(fingerprint) {
  try {
    window.localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify({
      fingerprint,
      submittedAt: Date.now(),
    }));
  } catch {
    // La solicitud ya fue guardada en Supabase; localStorage es una protección adicional.
  }
}

export default function LandingContactSection({
  initialPlan = 'por_definir',
  initialInterest = 'conocer_inventiq',
  billingCycle = 'monthly',
}) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const formOpenedAtRef = useRef(Date.now());

  const contactEmail = cleanText(import.meta.env.VITE_INVENTIQ_CONTACT_EMAIL || 'inventiqweb@gmail.com', 160);
  const contactWhatsApp = cleanText(import.meta.env.VITE_INVENTIQ_WHATSAPP, 40);

  const whatsappUrl = useMemo(
    () => buildWhatsAppUrl(
      contactWhatsApp,
      'Hola, me interesa conocer InventIQ y quisiera solicitar información.',
    ),
    [contactWhatsApp],
  );

  useEffect(() => {
    const validPlan = PLAN_OPTIONS.some(option => option.value === initialPlan)
      ? initialPlan
      : 'por_definir';
    const validInterest = INTEREST_OPTIONS.some(option => option.value === initialInterest)
      ? initialInterest
      : 'conocer_inventiq';

    setForm(previous => ({
      ...previous,
      plan_code: validPlan,
      interest: validInterest,
    }));
    setSubmitted(false);
    formOpenedAtRef.current = Date.now();
  }, [initialPlan, initialInterest]);

  function setField(field, value) {
    setForm(previous => ({ ...previous, [field]: value }));
    if (notice?.type === 'error') setNotice(null);
  }

  function validateForm() {
    if (cleanText(form.full_name, 120).length < 2) return 'Ingresa tu nombre completo.';
    if (cleanText(form.business_name, 160).length < 2) return 'Ingresa el nombre de tu negocio.';
    if (normalizeWhatsAppNumber(form.whatsapp).length < 9) return 'Ingresa un número de WhatsApp válido.';

    const email = cleanText(form.email, 160);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Revisa el correo electrónico ingresado.';
    }

    if (form.preferred_contact === 'email' && !email) {
      return 'Ingresa un correo electrónico o selecciona WhatsApp como medio de contacto.';
    }

    if (!form.consent) return 'Debes autorizar el contacto para enviar la solicitud.';
    return '';
  }

  async function submitLead(event) {
    event.preventDefault();

    const validationMessage = validateForm();
    if (validationMessage) {
      setNotice({ type: 'error', message: validationMessage });
      return;
    }

    if (form.website || Date.now() - formOpenedAtRef.current < MIN_FORM_TIME_MS) {
      setNotice({
        type: 'success',
        message: 'Solicitud recibida. Revisaremos la información y nos comunicaremos por el medio seleccionado.',
      });
      setSubmitted(true);
      return;
    }

    const fingerprint = buildLeadFingerprint(form);
    const lastSubmission = getLastLeadSubmission();
    if (
      lastSubmission?.fingerprint === fingerprint
      && Date.now() - Number(lastSubmission.submittedAt || 0) < LEAD_COOLDOWN_MS
    ) {
      setNotice({
        type: 'success',
        message: 'Ya recibimos una solicitud reciente con estos datos. No necesitas enviarla nuevamente.',
      });
      setSubmitted(true);
      return;
    }

    try {
      setSubmitting(true);
      setNotice(null);

      const selectedPlan = form.plan_code || 'por_definir';
      const selectedInterest = INTEREST_LABELS[form.interest] || INTEREST_LABELS.conocer_inventiq;
      const userMessage = cleanText(form.message, 1000);
      const combinedMessage = `Interés: ${selectedInterest}${userMessage ? `\n\n${userMessage}` : ''}`;
      const payload = {
        full_name: cleanText(form.full_name, 120),
        business_name: cleanText(form.business_name, 160),
        whatsapp: normalizeWhatsAppNumber(form.whatsapp),
        email: cleanText(form.email, 160) || null,
        business_type: cleanText(form.business_type, 50) || 'general',
        plan_code: selectedPlan,
        billing_cycle: billingCycle === 'annual' ? 'annual' : 'monthly',
        request_type: selectedPlan === 'personalizado' || form.interest === 'configuracion_especial'
          ? 'personalizacion'
          : 'demostracion',
        preferred_contact: form.preferred_contact === 'email' ? 'email' : 'whatsapp',
        message: cleanText(combinedMessage, 1200),
        source: 'landing_page',
        source_page: typeof window !== 'undefined' ? window.location.pathname : '/',
        consent_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('landing_leads').insert(payload);
      if (error) throw error;

      saveLastLeadSubmission(fingerprint);
      setNotice({
        type: 'success',
        message: 'Solicitud enviada correctamente. Revisaremos la información y nos comunicaremos por el medio seleccionado.',
      });
      setSubmitted(true);
      setForm({
        ...INITIAL_FORM,
        plan_code: selectedPlan,
        interest: form.interest,
      });
    } catch (error) {
      console.error('Error enviando solicitud de la landing:', error);
      setNotice({
        type: 'error',
        message: 'No pudimos enviar la solicitud en este momento. Inténtalo nuevamente o contáctanos por WhatsApp.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="contacto" className="scroll-mt-6 bg-[#f4f7fb] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto max-w-[1220px]">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Contacto</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-[#071a33] sm:text-4xl lg:text-5xl">
            Conversemos sobre tu negocio
          </h2>
          <p className="mt-4 text-base leading-8 text-slate-600 sm:text-lg">
            Indícanos qué necesitas y revisaremos la edición, el módulo o la configuración adecuada para tu operación.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-10">
          <aside className="rounded-[1.5rem] bg-[#071a33] p-7 text-white sm:p-8 lg:p-9">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Atención directa</p>
            <h3 className="mt-4 text-2xl font-black">Elige el canal que prefieras</h3>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Puedes completar el formulario o escribirnos directamente. Primero revisamos tu caso y después confirmamos el alcance y las condiciones.
            </p>

            <div className="mt-7 grid gap-3">
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between rounded-xl border border-white/12 bg-white/5 px-4 py-4 transition hover:border-emerald-300/50 hover:bg-white/10"
                >
                  <span className="flex items-center gap-3 text-sm font-black">
                    <MessageCircle className="h-5 w-5 text-emerald-300" /> WhatsApp
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-white" />
                </a>
              )}

              {contactEmail && (
                <a
                  href={`mailto:${contactEmail}`}
                  className="group flex items-center justify-between rounded-xl border border-white/12 bg-white/5 px-4 py-4 transition hover:border-cyan-300/50 hover:bg-white/10"
                >
                  <span className="flex min-w-0 items-center gap-3 text-sm font-black">
                    <Mail className="h-5 w-5 shrink-0 text-cyan-300" />
                    <span className="truncate">{contactEmail}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-white" />
                </a>
              )}
            </div>

            <div className="mt-8 border-t border-white/10 pt-7">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Podemos ayudarte con</p>
              <div className="mt-4 space-y-3">
                {[
                  'Presentación y configuración inicial de InventIQ.',
                  'Activación de facturación electrónica.',
                  'Migración de información o necesidades especiales.',
                ].map(item => (
                  <div key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-300">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <form
            onSubmit={submitLead}
            noValidate
            className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Formulario de contacto</p>
                <h3 className="mt-2 text-2xl font-black text-[#071a33]">Cuéntanos qué necesitas</h3>
              </div>
              <span className="hidden h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#071a33] sm:flex">
                <Send className="h-5 w-5" />
              </span>
            </div>

            <input
              type="text"
              name="website"
              value={form.website}
              onChange={event => setField('website', event.target.value)}
              tabIndex={-1}
              autoComplete="off"
              className="absolute -left-[10000px] h-px w-px opacity-0"
              aria-hidden="true"
            />

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">Nombre completo *</span>
                <input
                  name="full_name"
                  value={form.full_name}
                  onChange={event => setField('full_name', event.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  placeholder="Tu nombre"
                  autoComplete="name"
                  maxLength={120}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">Nombre del negocio *</span>
                <input
                  name="business_name"
                  value={form.business_name}
                  onChange={event => setField('business_name', event.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  placeholder="Nombre comercial"
                  autoComplete="organization"
                  maxLength={160}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">WhatsApp *</span>
                <input
                  name="whatsapp"
                  value={form.whatsapp}
                  onChange={event => setField('whatsapp', event.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  placeholder="Número de WhatsApp"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={40}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">Correo electrónico</span>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={event => setField('email', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  placeholder="correo@ejemplo.com"
                  autoComplete="email"
                  maxLength={160}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">Tipo de negocio *</span>
                <select
                  name="business_type"
                  value={form.business_type}
                  onChange={event => setField('business_type', event.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                >
                  {businessTypes.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">¿Qué necesitas? *</span>
                <select
                  name="interest"
                  value={form.interest}
                  onChange={event => setField('interest', event.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                >
                  {INTEREST_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">Edición de interés</span>
                <select
                  name="plan_code"
                  value={form.plan_code}
                  onChange={event => setField('plan_code', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                >
                  {PLAN_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-[0.72fr_1.28fr]">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">Prefiero contacto por</span>
                <select
                  name="preferred_contact"
                  value={form.preferred_contact}
                  onChange={event => setField('preferred_contact', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Correo electrónico</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">Mensaje opcional</span>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={event => setField('message', event.target.value)}
                  className="min-h-[112px] w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  placeholder="Describe brevemente tu actividad o la consulta que deseas realizar."
                  maxLength={1000}
                />
              </label>
            </div>

            <label className="mt-5 flex items-start gap-3 text-xs leading-6 text-slate-600">
              <input
                type="checkbox"
                name="consent"
                checked={form.consent}
                onChange={event => setField('consent', event.target.checked)}
                required
                className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              <span>Autorizo a InventIQ a utilizar estos datos únicamente para responder esta solicitud.</span>
            </label>

            {notice && (
              <div
                className={`mt-5 rounded-xl border px-4 py-3 text-sm leading-6 ${notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}
                role="status"
                aria-live="polite"
              >
                {notice.message}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-slate-500">Este formulario no genera ningún cobro ni contratación automática.</p>
              <button
                type="submit"
                disabled={submitting || submitted}
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-[#071a33] px-6 py-3.5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Enviando…' : submitted ? 'Solicitud enviada' : 'Enviar solicitud'}
                {!submitting && !submitted && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
