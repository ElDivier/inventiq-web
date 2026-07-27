import { useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  CircleHelp,
  FileSpreadsheet,
  Globe2,
  MonitorSmartphone,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
  Wrench,
} from 'lucide-react';

const FAQ_ITEMS = [
  {
    question: '¿Necesito instalar InventIQ en mi computadora?',
    answer: 'No. InventIQ funciona desde el navegador. Solo necesitas una conexión a internet y una cuenta activa para ingresar desde una computadora, tablet o teléfono compatible.',
    icon: Globe2,
  },
  {
    question: '¿Puedo utilizar InventIQ desde el celular?',
    answer: 'Sí. La interfaz se adapta a pantallas pequeñas para consultar información y realizar tareas esenciales. Para procesos largos, como cargas masivas o configuración inicial, una computadora ofrece mayor comodidad.',
    icon: MonitorSmartphone,
  },
  {
    question: '¿Puedo importar los productos que ya tengo en Excel?',
    answer: 'Sí. InventIQ Negocio y Gastronomía incluyen importación desde Excel. En una implementación personalizada también puede realizarse una migración o depuración de información, según el alcance acordado.',
    icon: FileSpreadsheet,
  },
  {
    question: '¿La plataforma cambia según mi tipo de negocio?',
    answer: 'Sí. El perfil seleccionado adapta campos, nombres y herramientas. Una boutique puede trabajar con tallas y colores, mientras un restaurante puede utilizar recetas, ingredientes, mesas y comandas.',
    icon: Sparkles,
  },
  {
    question: '¿El tipo de negocio y la edición contratada son lo mismo?',
    answer: 'No. El tipo de negocio adapta los campos y herramientas a tu actividad. La edición contratada define el paquete comercial: InventIQ Negocio, InventIQ Gastronomía o una propuesta Personalizada.',
    icon: CircleHelp,
  },
  {
    question: '¿InventIQ sirve para cafeterías y restaurantes?',
    answer: 'Sí. La edición InventIQ Gastronomía contempla menú, recetas, insumos, descuento automático de ingredientes, mesas, comandas, ventas para llevar, delivery y reportes especializados.',
    icon: UtensilsCrossed,
  },
  {
    question: '¿La facturación electrónica del SRI ya está incluida?',
    answer: 'Todavía no. La integración se encuentra planteada como un complemento futuro y se anunciará únicamente cuando el proceso de generación, firma, transmisión y autorización esté terminado y probado.',
    icon: ReceiptText,
  },
  {
    question: '¿Puedo solicitar una función especial para mi negocio?',
    answer: 'Sí. Las configuraciones sencillas y los desarrollos especiales se revisan previamente. Después recibirás el alcance, costo, tiempo estimado y condiciones antes de iniciar cualquier personalización.',
    icon: Wrench,
  },
  {
    question: '¿Cómo se protege la información de mi negocio?',
    answer: 'InventIQ utiliza autenticación y reglas de acceso para separar la información de cada cuenta. También se aplican controles de permisos en la base de datos. Las políticas definitivas de respaldo y seguridad se publicarán antes del lanzamiento comercial.',
    icon: ShieldCheck,
  },
  {
    question: '¿Tengo que contratar por un año?',
    answer: 'No necesariamente. Puedes trabajar con modalidad mensual o elegir el pago anual para acceder al descuento correspondiente. Las condiciones exactas se detallarán antes de confirmar la contratación.',
    icon: CircleHelp,
  },
];

export default function LandingFaqSection({ onContact }) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section id="preguntas" className="scroll-mt-6 bg-[#f5f8fc] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto max-w-[1320px]">
        <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <div data-landing-reveal className="landing-reveal lg:sticky lg:top-28">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-700 shadow-sm">
              <CircleHelp className="h-4 w-4" /> Preguntas frecuentes
            </span>
            <h2 className="mt-5 text-3xl font-black tracking-tight text-[#071a33] sm:text-4xl lg:text-5xl">
              Resolvemos las dudas antes de que tomes una decisión
            </h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
              Conoce cómo funciona InventIQ, qué incluyen las ediciones y qué aspectos siguen en desarrollo.
            </p>

            <div className="mt-8 rounded-[1.7rem] bg-[#071a33] p-6 text-white shadow-[0_20px_58px_rgba(7,26,51,0.2)] sm:p-7">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">¿Tienes otra pregunta?</p>
              <h3 className="mt-3 text-2xl font-black">Cuéntanos cómo trabaja tu negocio.</h3>
              <p className="mt-3 leading-7 text-slate-300">
                Revisaremos tu necesidad antes de recomendar una edición o una propuesta personalizada.
              </p>
              <button
                type="button"
                onClick={onContact}
                className="group mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-400 px-5 py-3.5 text-sm font-black text-white transition hover:-translate-y-0.5"
              >
                Hablar con InventIQ <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </button>
            </div>
          </div>

          <div data-landing-reveal className="landing-reveal space-y-4">
            {FAQ_ITEMS.map(({ question, answer, icon: Icon }, index) => {
              const isOpen = openIndex === index;
              return (
                <article
                  key={question}
                  className={`landing-faq-item overflow-hidden rounded-[1.35rem] border bg-white shadow-[0_10px_34px_rgba(15,23,42,0.05)] ${isOpen ? 'border-cyan-200' : 'border-slate-200'}`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? -1 : index)}
                    className="flex w-full items-center gap-4 px-5 py-5 text-left sm:px-6"
                    aria-expanded={isOpen}
                  >
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition ${isOpen ? 'bg-gradient-to-br from-blue-600 to-cyan-400 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="flex-1 text-base font-black leading-6 text-[#071a33] sm:text-lg">{question}</span>
                    <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-cyan-600' : ''}`} />
                  </button>
                  <div className={`landing-faq-panel ${isOpen ? 'is-open' : ''}`}>
                    <div>
                      <p className="px-5 pb-6 pl-20 text-sm leading-7 text-slate-600 sm:px-6 sm:pl-[5.5rem] sm:text-base">
                        {answer}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
