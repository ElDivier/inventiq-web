import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileSpreadsheet,
  MonitorSmartphone,
  Settings2,
  Store,
  Users,
} from 'lucide-react';

const steps = [
  {
    number: '01',
    title: 'Elige la edición adecuada',
    description: 'Revisamos tu actividad para identificar si InventIQ Negocio, Gastronomía o una configuración personalizada es la opción correcta.',
    icon: Store,
  },
  {
    number: '02',
    title: 'Organizamos la configuración inicial',
    description: 'Preparamos categorías, parámetros y datos básicos para que la plataforma responda a la forma en que trabaja tu negocio.',
    icon: Settings2,
  },
  {
    number: '03',
    title: 'Empieza a trabajar con información ordenada',
    description: 'Registra ventas, controla existencias, administra caja y consulta reportes desde una sola plataforma.',
    icon: BarChart3,
  },
];

const implementationItems = [
  {
    title: 'Acceso desde cualquier dispositivo',
    description: 'Funciona desde el navegador en computadora, tablet o celular.',
    icon: MonitorSmartphone,
  },
  {
    title: 'Carga inicial flexible',
    description: 'Puedes registrar la información manualmente o importarla desde Excel.',
    icon: FileSpreadsheet,
  },
  {
    title: 'Orientación durante la puesta en marcha',
    description: 'Te explicamos el funcionamiento de los módulos que utilizarás.',
    icon: Users,
  },
  {
    title: 'Configuración revisada',
    description: 'Antes de iniciar verificamos que los datos y parámetros principales estén correctamente organizados.',
    icon: CheckCircle2,
  },
];

export default function LandingHowItWorksSection({ onDemo, onPlans }) {
  return (
    <section id="como-funciona" className="scroll-mt-6 overflow-hidden bg-white px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto max-w-[1320px]">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
            <Settings2 className="h-4 w-4" /> Cómo funciona
          </span>
          <h2 className="mt-5 text-3xl font-black tracking-tight text-[#071a33] sm:text-4xl lg:text-5xl">
            De la configuración al uso diario
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
            El proceso es sencillo: definimos la edición adecuada, organizamos la información inicial y dejamos InventIQ listo para comenzar.
          </p>
        </div>

        <div className="mt-14 overflow-hidden rounded-[1.9rem] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
          <div className="grid lg:grid-cols-3">
            {steps.map(({ number, title, description, icon: Icon }, index) => (
              <article
                key={number}
                className={`relative p-7 sm:p-8 lg:min-h-[320px] ${index > 0 ? 'border-t border-slate-200 lg:border-l lg:border-t-0' : ''}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#071a33] text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-black tracking-[0.18em] text-slate-300">{number}</span>
                </div>
                <h3 className="mt-7 text-xl font-black leading-snug text-[#071a33] sm:text-2xl">{title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-10 overflow-hidden rounded-[1.9rem] border border-slate-200 bg-[#f6f8fb]">
          <div className="grid lg:grid-cols-[0.88fr_1.12fr]">
            <div className="bg-[#071a33] p-7 text-white sm:p-9 lg:p-10">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
                <CheckCircle2 className="h-4 w-4" /> Antes de empezar
              </span>
              <h3 className="mt-5 text-3xl font-black leading-tight">Revisamos contigo lo necesario</h3>
              <p className="mt-5 leading-8 text-slate-300">
                Puedes conocer la plataforma, aclarar qué incluye cada edición y confirmar el proceso de implementación antes de tomar una decisión.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                <button
                  type="button"
                  onClick={onDemo}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-400 px-5 py-3.5 text-sm font-black text-white transition hover:-translate-y-0.5"
                >
                  Ver InventIQ en funcionamiento <ArrowRight className="h-4 w-4" />
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

            <div className="divide-y divide-slate-200 px-6 sm:px-8 lg:px-10">
              {implementationItems.map(({ title, description, icon: Icon }) => (
                <article key={title} className="flex gap-4 py-6 sm:py-7">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-cyan-700 shadow-sm ring-1 ring-slate-200">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h4 className="font-black text-[#071a33]">{title}</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
