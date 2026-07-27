import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  MonitorSmartphone,
  Settings2,
  Sparkles,
  Store,
  Users,
} from 'lucide-react';

const steps = [
  {
    number: '01',
    title: 'Cuéntanos cómo trabaja tu negocio',
    description: 'En la demostración revisamos tu actividad, la forma en que vendes y las herramientas que realmente necesitas.',
    icon: Store,
  },
  {
    number: '02',
    title: 'Configuramos InventIQ para tu operación',
    description: 'Seleccionamos el perfil, organizamos categorías y dejamos lista la estructura inicial para empezar con orden.',
    icon: Settings2,
  },
  {
    number: '03',
    title: 'Registra, controla y toma decisiones',
    description: 'Empieza a trabajar con ventas, inventario, caja y reportes desde una misma plataforma.',
    icon: BarChart3,
  },
];

const onboardingBenefits = [
  {
    title: 'Acceso desde el navegador',
    description: 'Utiliza InventIQ desde computadora, tablet o celular, sin instalar programas pesados.',
    icon: MonitorSmartphone,
  },
  {
    title: 'Carga inicial flexible',
    description: 'Registra productos manualmente o impórtalos desde Excel cuando el plan contratado lo permita.',
    icon: FileSpreadsheet,
  },
  {
    title: 'Acompañamiento humano',
    description: 'Recibe orientación para comprender la plataforma y resolver dudas durante la implementación.',
    icon: Users,
  },
  {
    title: 'Configuración revisada',
    description: 'Antes de comenzar verificamos que los módulos principales respondan a la actividad del negocio.',
    icon: ClipboardCheck,
  },
];

export default function LandingHowItWorksSection({ onDemo, onPlans }) {
  return (
    <section id="como-funciona" className="scroll-mt-6 overflow-hidden bg-white px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto max-w-[1320px]">
        <div data-landing-reveal className="landing-reveal mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
            <Sparkles className="h-4 w-4" /> Cómo funciona
          </span>
          <h2 className="mt-5 text-3xl font-black tracking-tight text-[#071a33] sm:text-4xl lg:text-5xl">
            Empieza con una configuración pensada para tu negocio
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
            No se trata únicamente de abrir una cuenta. La idea es que InventIQ quede organizado según la forma en que trabajas desde el primer día.
          </p>
        </div>

        <div className="landing-steps-grid relative mt-14 grid gap-5 lg:grid-cols-3">
          {steps.map(({ number, title, description, icon: Icon }, index) => (
            <article
              key={number}
              data-landing-reveal
              className="landing-reveal landing-step-card relative overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white p-7 shadow-[0_16px_48px_rgba(15,23,42,0.07)] sm:p-8"
              style={{ transitionDelay: `${Math.min(index * 90, 240)}ms` }}
            >
              <span className="absolute right-5 top-3 text-[4.6rem] font-black leading-none text-slate-100" aria-hidden="true">{number}</span>
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 text-white shadow-lg shadow-cyan-100">
                <Icon className="h-6 w-6" />
              </div>
              <p className="relative mt-7 text-xs font-black uppercase tracking-[0.18em] text-cyan-600">Paso {number}</p>
              <h3 className="relative mt-3 text-xl font-black leading-snug text-[#071a33]">{title}</h3>
              <p className="relative mt-4 text-sm leading-7 text-slate-600">{description}</p>
            </article>
          ))}
        </div>

        <div data-landing-reveal className="landing-reveal mt-12 overflow-hidden rounded-[2rem] border border-slate-200 bg-[#f5f8fc] shadow-[0_20px_65px_rgba(15,23,42,0.08)]">
          <div className="grid lg:grid-cols-[0.8fr_1.2fr]">
            <div className="relative overflow-hidden bg-[#071a33] p-7 text-white sm:p-9 lg:p-10">
              <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />
              <div className="absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-blue-600/20 blur-3xl" />
              <div className="relative">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
                  <CheckCircle2 className="h-4 w-4" /> Implementación acompañada
                </span>
                <h3 className="mt-5 text-3xl font-black leading-tight">Conoce InventIQ antes de contratar</h3>
                <p className="mt-5 leading-8 text-slate-300">
                  Te mostramos un ejemplo relacionado con tu actividad y aclaramos qué incluye cada plan antes de iniciar la configuración.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                  <button
                    type="button"
                    onClick={onDemo}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-400 px-5 py-3.5 text-sm font-black text-white transition hover:-translate-y-0.5"
                  >
                    Solicitar demostración <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onPlans}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3.5 text-sm font-black text-white transition hover:bg-white/10"
                  >
                    Revisar planes
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8 lg:p-10">
              {onboardingBenefits.map(({ title, description, icon: Icon }) => (
                <article key={title} className="landing-onboarding-card rounded-2xl border border-white bg-white p-5 shadow-[0_10px_32px_rgba(15,23,42,0.05)]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h4 className="mt-4 font-black text-[#071a33]">{title}</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
