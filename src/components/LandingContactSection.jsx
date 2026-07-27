import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Mail,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { businessTypes } from '../config/businessTypes';

const PLAN_OPTIONS = [
  { value: 'por_definir', label: 'Todavía no lo sé' },
  { value: 'negocio', label: 'InventIQ Negocio — $29,99 al mes' },
  { value: 'gastronomico', label: 'InventIQ Gastronomía — $39,99 al mes' },
  { value: 'personalizado', label: 'InventIQ Personalizado — desde $49,99 al mes' },
];

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
    // La solicitud ya fue guardada en Supabase; localStorage es solo una protección adicional.
  }
}

export default function LandingContactSection({ initialPlan = 'por_definir', billingCycle = 'monthly' }) {
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

    setForm(previous => ({ ...previous, plan_code: validPlan }));
    setSubmitted(false);
    formOpenedAtRef.current = Date.now();
  }, [initialPlan]);

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
    if (submitting || submitted) return;

    const validationMessage = validateForm();
    if (validationMessage) {
      setNotice({ type: 'error', message: validationMessage });
      return;
    }

    // Campo señuelo y tiempo mínimo contra envíos automatizados simples.
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
      const payload = {
        full_name: cleanText(form.full_name, 120),
        business_name: cleanText(form.business_name, 160),
        whatsapp: normalizeWhatsAppNumber(form.whatsapp),
        email: cleanText(form.email, 160) || null,
        business_type: cleanText(form.business_type, 50) || 'general',
        plan_code: selectedPlan,
        billing_cycle: billingCycle === 'annual' ? 'annual' : 'monthly',
        request_type: selectedPlan === 'personalizado' ? 'personalizacion' : 'demostracion',
        preferred_contact: form.preferred_contact === 'email' ? 'email' : 'whatsapp',
        message: cleanText(form.message, 1200) || null,
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
      setForm({ ...INITIAL_FORM, plan_code: selectedPlan });
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
    <section id="contacto" className="scroll-mt-6 bg-white px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto max-w-[1320px]">
        <div data-landing-reveal className="landing-reveal mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
            <Sparkles className="h-4 w-4" /> Conoce InventIQ
          </span>
          <h2 className="mt-5 text-3xl font-black tracking-tight text-[#071a33] sm:text-4xl lg:text-5xl">
            Solicita una demostración para tu negocio
          </h2>
          <p className="mt-5 text-base leading-8 text-slate-600 sm:text-lg">
            Cuéntanos cómo trabajas y te mostraremos las herramientas que mejor se adaptan a tu operación.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div data-landing-reveal className="landing-reveal space-y-5">
            <div className="overflow-hidden rounded-[2rem] bg-[#071a33] p-7 text-white shadow-[0_24px_70px_rgba(7,26,51,0.2)] sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Atención personalizada</p>
              <h3 className="mt-4 text-3xl font-black">Una demostración enfocada en tu tipo de negocio</h3>
              <p className="mt-4 leading-7 text-slate-300">
                No necesitas contratar inmediatamente. Primero revisamos tu operación, resolvemos tus dudas y te ayudamos a escoger la edición o propuesta adecuada.
              </p>

              <div className="mt-7 space-y-4">
                {[
                  [Clock3, 'Revisión inicial', 'Analizamos el tipo de negocio y las funciones que necesitas.'],
                  [MessageCircle, 'Demostración guiada', 'Te enseñamos ventas, inventario, caja y los módulos de tu perfil.'],
                  [ShieldCheck, 'Propuesta clara', 'Recibes la edición recomendada y los costos adicionales, si aplican.'],
                ].map(([Icon, title, description]) => (
                  <div key={title} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-300">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-black text-white">{title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {(contactEmail || whatsappUrl) && (
              <div className="rounded-[1.7rem] border border-slate-200 bg-[#f8fafc] p-6">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Contacto directo</p>
                <div className="mt-4 grid gap-3">
                  {whatsappUrl && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-black text-emerald-700 transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <MessageCircle className="h-5 w-5" /> Escribir por WhatsApp
                    </a>
                  )}
                  {contactEmail && (
                    <a
                      href={`mailto:${contactEmail}`}
                      className="inline-flex items-center gap-3 rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-black text-blue-700 transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <Mail className="h-5 w-5" /> {contactEmail}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          <form
            data-landing-reveal
            onSubmit={submitLead}
            className="landing-reveal rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.09)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Formulario comercial</p>
                <h3 className="mt-2 text-2xl font-black text-[#071a33] sm:text-3xl">Hablemos de tu negocio</h3>
              </div>
              <span className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 sm:flex">
                <Send className="h-5 w-5" />
              </span>
            </div>

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">Nombre completo *</span>
                <input
                  value={form.full_name}
                  onChange={event => setField('full_name', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  placeholder="Escribe tu nombre completo"
                  autoComplete="name"
                  maxLength={120}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">Nombre del negocio *</span>
                <input
                  value={form.business_name}
                  onChange={event => setField('business_name', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  placeholder="Escribe el nombre de tu negocio"
                  autoComplete="organization"
                  maxLength={160}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">WhatsApp *</span>
                <input
                  value={form.whatsapp}
                  onChange={event => setField('whatsapp', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
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
                  value={form.email}
                  onChange={event => setField('email', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  placeholder="Correo electrónico"
                  autoComplete="email"
                  maxLength={160}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">Tipo de negocio *</span>
                <select
                  value={form.business_type}
                  onChange={event => setField('business_type', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                >
                  {businessTypes.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">Edición de interés</span>
                <select
                  value={form.plan_code}
                  onChange={event => setField('plan_code', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                >
                  {PLAN_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-[0.72fr_1.28fr]">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">Prefiero que me contacten por</span>
                <select
                  value={form.preferred_contact}
                  onChange={event => setField('preferred_contact', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Correo electrónico</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">¿Qué necesitas controlar?</span>
                <textarea
                  value={form.message}
                  onChange={event => setField('message', event.target.value)}
                  className="min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm leading-6 text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  placeholder="Cuéntanos sobre tus ventas, inventario, sucursales o alguna función especial."
                  maxLength={1200}
                />
              </label>
            </div>

            <label className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
              Sitio web
              <input
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={event => setField('website', event.target.value)}
              />
            </label>

            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              <input
                type="checkbox"
                checked={form.consent}
                onChange={event => setField('consent', event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 accent-cyan-600"
              />
              <span>Autorizo a InventIQ a utilizar estos datos únicamente para responder mi solicitud y brindarme información comercial.</span>
            </label>

            {notice && (
              <div
                className={`mt-5 rounded-2xl border px-5 py-4 text-sm font-semibold ${notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-100 bg-red-50 text-red-700'}`}
                role="status"
              >
                <div className="flex items-start gap-3">
                  {notice.type === 'success' && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />}
                  <div>
                    {notice.type === 'success' && <p className="mb-1 font-black">Solicitud recibida</p>}
                    <span>{notice.message}</span>
                  </div>
                </div>
                {notice.type === 'success' && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-emerald-700"
                      >
                        <MessageCircle className="h-4 w-4" /> Escribir por WhatsApp
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSubmitted(false);
                        setNotice(null);
                        formOpenedAtRef.current = Date.now();
                      }}
                      className="rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"
                    >
                      Nueva solicitud
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || submitted}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-400 px-6 py-4 text-sm font-black text-white shadow-lg shadow-cyan-900/15 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Enviando solicitud...' : submitted ? 'Solicitud recibida' : 'Solicitar demostración'}
              {!submitting && !submitted && <ArrowRight className="h-4 w-4" />}
              {submitted && <CheckCircle2 className="h-4 w-4" />}
            </button>

            <p className="mt-4 text-center text-xs leading-5 text-slate-500">
              La solicitud no genera ningún cobro ni compromiso de contratación.
            </p>
          </form>
        </div>
      </div>

      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_14px_35px_rgba(16,185,129,0.35)] transition hover:-translate-y-1 hover:bg-emerald-600"
          aria-label="Contactar a InventIQ por WhatsApp"
          title="Contactar por WhatsApp"
        >
          <MessageCircle className="h-6 w-6" />
        </a>
      )}
    </section>
  );
}
