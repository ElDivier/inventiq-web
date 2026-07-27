import { useEffect } from 'react';
import { FileText, Mail, ShieldCheck, X } from 'lucide-react';

const LEGAL_DOCUMENTS = {
  privacy: {
    eyebrow: 'Información y privacidad',
    title: 'Política de privacidad preliminar',
    icon: ShieldCheck,
    introduction: 'Este texto resume de forma provisional cómo InventIQ prevé tratar la información recibida desde la landing page y la plataforma. Debe revisarse legalmente antes del lanzamiento comercial definitivo.',
    sections: [
      {
        title: 'Información que puede recopilarse',
        body: 'Datos de contacto, información del negocio, solicitudes de demostración, preferencias de plan y datos necesarios para crear y administrar una cuenta de usuario.',
      },
      {
        title: 'Finalidad del tratamiento',
        body: 'Responder solicitudes, coordinar demostraciones, recomendar planes, prestar el servicio contratado, brindar soporte y mantener la seguridad y funcionamiento de la plataforma.',
      },
      {
        title: 'Acceso y conservación',
        body: 'El acceso se limita a usuarios autorizados y a los servicios tecnológicos necesarios para operar InventIQ. Los periodos definitivos de conservación se establecerán en la política final.',
      },
      {
        title: 'Derechos del titular',
        body: 'La persona podrá solicitar información, actualización, rectificación o eliminación de sus datos, cuando corresponda, mediante el correo oficial de InventIQ.',
      },
      {
        title: 'Seguridad',
        body: 'La plataforma utiliza autenticación y reglas de acceso en la base de datos. Ningún sistema es completamente infalible, por lo que también se establecerán procedimientos de respaldo, gestión de incidentes y recuperación.',
      },
    ],
  },
  terms: {
    eyebrow: 'Condiciones del servicio',
    title: 'Términos y condiciones preliminares',
    icon: FileText,
    introduction: 'Estas condiciones son una guía inicial para explicar el uso de InventIQ. Los términos contractuales definitivos se entregarán al cliente antes de la contratación.',
    sections: [
      {
        title: 'Objeto del servicio',
        body: 'InventIQ ofrece herramientas web para gestionar ventas, productos, inventario, clientes, compras, caja, reportes y módulos adaptados al tipo de negocio y plan contratado.',
      },
      {
        title: 'Planes y pagos',
        body: 'Las funciones, usuarios y nivel de soporte dependen del plan contratado. Los precios, impuestos, fechas de pago y condiciones de renovación se confirmarán en la propuesta o comprobante correspondiente.',
      },
      {
        title: 'Responsabilidad del cliente',
        body: 'El cliente debe registrar información correcta, proteger sus credenciales y utilizar la plataforma de manera lícita. También es responsable de revisar la información comercial, contable y tributaria generada a partir de sus propios registros.',
      },
      {
        title: 'Disponibilidad y mantenimiento',
        body: 'InventIQ procurará mantener el servicio disponible, pero puede requerir pausas por mantenimiento, actualizaciones, incidentes técnicos o servicios de terceros. Los niveles formales de servicio se definirán cuando correspondan.',
      },
      {
        title: 'Personalizaciones',
        body: 'Los desarrollos especiales se cotizan por separado y deben contar con un alcance aprobado. Las nuevas solicitudes o cambios posteriores pueden generar costos y plazos adicionales.',
      },
      {
        title: 'Facturación electrónica',
        body: 'La integración con el SRI no se considera disponible mientras no haya sido terminada, probada y anunciada oficialmente. Hasta entonces, los comprobantes internos de InventIQ no sustituyen documentos tributarios autorizados.',
      },
      {
        title: 'Cancelación',
        body: 'Las condiciones de cancelación, acceso a la información y cierre de cuenta se establecerán en la contratación definitiva de acuerdo con el plan y periodo pagado.',
      },
    ],
  },
};

export default function LandingLegalModal({ type, onClose }) {
  const legalDocument = type ? LEGAL_DOCUMENTS[type] : null;

  useEffect(() => {
    if (!legalDocument) return undefined;

    const previousOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [legalDocument, onClose]);

  if (!legalDocument) return null;

  const Icon = legalDocument.icon;

  return (
    <div className="landing-legal-backdrop fixed inset-0 z-[80] flex items-end justify-center bg-[#021022]/75 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="presentation" onMouseDown={onClose}>
      <section
        className="landing-legal-dialog max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-t-[2rem] bg-white shadow-[0_35px_100px_rgba(0,0,0,0.35)] sm:rounded-[2rem]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="landing-legal-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-5 border-b border-slate-200 bg-[#f8fafc] px-6 py-5 sm:px-8 sm:py-6">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 text-white shadow-md">
              <Icon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">{legalDocument.eyebrow}</p>
              <h2 id="landing-legal-title" className="mt-1 text-2xl font-black text-[#071a33] sm:text-3xl">{legalDocument.title}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-cyan-200 hover:text-cyan-700" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="max-h-[calc(92vh-110px)] overflow-y-auto px-6 py-6 sm:px-8 sm:py-8">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
            <strong>Documento provisional:</strong> {legalDocument.introduction}
          </div>

          <div className="mt-7 space-y-7">
            {legalDocument.sections.map((section, index) => (
              <article key={section.title} className="grid gap-3 sm:grid-cols-[38px_1fr]">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-xs font-black text-cyan-700">{index + 1}</span>
                <div>
                  <h3 className="text-lg font-black text-[#071a33]">{section.title}</h3>
                  <p className="mt-2 leading-7 text-slate-600">{section.body}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-4 rounded-2xl bg-[#071a33] p-5 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black">Consultas sobre estos documentos</p>
              <p className="mt-1 text-sm text-slate-300">La versión final se publicará antes del lanzamiento comercial.</p>
            </div>
            <a href="mailto:inventiqweb@gmail.com" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-[#071a33] transition hover:-translate-y-0.5">
              <Mail className="h-4 w-4" /> inventiqweb@gmail.com
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
