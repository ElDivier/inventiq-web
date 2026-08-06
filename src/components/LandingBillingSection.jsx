import { ArrowRight, CheckCircle2, ReceiptText } from 'lucide-react';

const BILLING_POINTS = [
  'Registra la venta y los datos del cliente dentro del mismo flujo.',
  'Emite comprobantes electrónicos desde la gestión de InventIQ.',
  'Recibe acompañamiento para la configuración inicial del módulo.',
];

export default function LandingBillingSection({ onContact }) {
  return (
    <section id="facturacion" className="bg-[#eef4fa] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
      <div className="mx-auto max-w-[1220px]">
        <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
            <div className="border-b border-slate-200 p-7 sm:p-10 lg:border-b-0 lg:border-r lg:p-12">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <ReceiptText className="h-6 w-6" />
                </span>
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-700 ring-1 ring-emerald-100">
                  Disponible
                </span>
              </div>
              <p className="mt-7 text-xs font-black uppercase tracking-[0.18em] text-blue-700">Facturación electrónica</p>
              <h2 className="mt-4 max-w-xl text-3xl font-black tracking-tight text-[#071a33] sm:text-4xl">
                La venta y el comprobante en un solo proceso
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-slate-600">
                InventIQ incorpora facturación electrónica para que la gestión comercial no quede separada de la emisión de comprobantes.
              </p>
            </div>

            <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
              <div className="space-y-4">
                {BILLING_POINTS.map(point => (
                  <div key={point} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-cyan-600" />
                    <p className="text-sm leading-7 text-slate-700 sm:text-base">{point}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-col gap-4 border-t border-slate-200 pt-7 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-md text-sm leading-6 text-slate-500">
                  La activación se revisa según los datos tributarios y la operación de cada negocio.
                </p>
                <button
                  type="button"
                  onClick={onContact}
                  className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#071a33] px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700"
                >
                  Consultar activación <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
