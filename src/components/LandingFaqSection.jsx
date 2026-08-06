import { useState } from 'react';
import { ArrowRight, ChevronDown, HelpCircle } from 'lucide-react';

const FAQ_GROUPS = [
  {
    title: 'Uso y configuración',
    items: [
      {
        question: '¿Debo instalar algo y desde qué dispositivos puedo usarlo?',
        answer: 'No necesitas instalar un programa. InventIQ funciona desde el navegador y puedes ingresar desde una computadora, tablet o celular con conexión a internet. Para configuraciones extensas o cargas masivas, una computadora resulta más cómoda.',
      },
      {
        question: '¿Puedo importar mis productos desde Excel?',
        answer: 'Sí. Las ediciones Negocio y Gastronomía permiten importar productos desde Excel. Cuando la información requiere depuración o una migración más compleja, primero revisamos el archivo y definimos el alcance.',
      },
      {
        question: '¿La plataforma se adapta al tipo de negocio?',
        answer: 'Sí. InventIQ mantiene una base común y adapta campos y herramientas según la actividad. Una tienda puede trabajar con tallas y colores, mientras un restaurante utiliza recetas, ingredientes, mesas y comandas.',
      },
    ],
  },
  {
    title: 'Contratación y soporte',
    items: [
      {
        question: '¿Tengo que contratar por un año?',
        answer: 'No. Puedes elegir pago mensual o anual. La modalidad anual incluye el beneficio indicado en la sección de planes y las condiciones se confirman antes de contratar.',
      },
      {
        question: '¿Puedo solicitar ajustes o funciones adicionales?',
        answer: 'Sí. Primero revisamos la necesidad y confirmamos si puede resolverse con la configuración existente o si requiere trabajo adicional. Antes de iniciar se informa el alcance, plazo y costo.',
      },
      {
        question: '¿Cómo se protege la información de mi negocio?',
        answer: 'Cada cuenta trabaja con autenticación y reglas de acceso que separan la información entre negocios. La base de datos aplica permisos para impedir que una cuenta consulte o modifique información de otra.',
      },
    ],
  },
];

export default function LandingFaqSection({ onContact }) {
  const [openItem, setOpenItem] = useState('0-0');

  return (
    <section id="preguntas" className="bg-white px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto max-w-[1220px]">
        <div className="grid items-end gap-6 border-b border-slate-200 pb-9 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Preguntas frecuentes</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-black tracking-tight text-[#071a33] sm:text-4xl lg:text-5xl">
              Información clara antes de empezar
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              Reunimos las consultas más comunes sobre el uso, la configuración y la contratación de InventIQ.
            </p>
          </div>

          <button
            type="button"
            onClick={onContact}
            className="group inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-[#071a33] transition hover:border-cyan-300 hover:text-cyan-700"
          >
            Tengo otra pregunta <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </button>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-14">
          {FAQ_GROUPS.map((group, groupIndex) => (
            <div key={group.title}>
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <HelpCircle className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-black uppercase tracking-[0.12em] text-slate-500">{group.title}</h3>
              </div>

              <div className="border-y border-slate-200">
                {group.items.map(({ question, answer }, itemIndex) => {
                  const itemKey = `${groupIndex}-${itemIndex}`;
                  const panelId = `faq-panel-${itemKey}`;
                  const buttonId = `faq-button-${itemKey}`;
                  const isOpen = openItem === itemKey;

                  return (
                    <article key={question} className={itemIndex > 0 ? 'border-t border-slate-200' : ''}>
                      <button
                        id={buttonId}
                        type="button"
                        onClick={() => setOpenItem(isOpen ? '' : itemKey)}
                        className="flex w-full items-center justify-between gap-5 py-5 text-left sm:py-6"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                      >
                        <span className="text-base font-black leading-6 text-[#071a33] sm:text-lg">{question}</span>
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${isOpen ? 'border-cyan-200 bg-cyan-50 text-cyan-700' : 'border-slate-200 text-slate-500'}`}>
                          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                        </span>
                      </button>

                      <div
                        id={panelId}
                        className={`landing-faq-panel ${isOpen ? 'is-open' : ''}`}
                        role="region"
                        aria-labelledby={buttonId}
                        aria-hidden={!isOpen}
                      >
                        <div>
                          <p className="max-w-xl pb-6 pr-10 text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">
                            {answer}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
