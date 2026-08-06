import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowUp,
  BarChart3,
  Bell,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Coffee,
  Menu,
  Package,
  ReceiptText,
  ShoppingCart,
  Sparkles,
  Store,
  Users,
  Wrench,
  Wheat,
  X,
} from 'lucide-react';
import InventiQIcon from '../components/InventiQIcon';
import LandingContactSection from '../components/LandingContactSection';
import LandingBillingSection from '../components/LandingBillingSection';
import LandingFaqSection from '../components/LandingFaqSection';
import LandingLegalModal from '../components/LandingLegalModal';
import LandingHowItWorksSection from '../components/LandingHowItWorksSection';

const landingSections = [
  { label: 'Negocios', id: 'negocios' },
  { label: 'Funciones', id: 'funciones' },
  { label: 'Cómo funciona', id: 'como-funciona' },
  { label: 'Planes', id: 'planes' },
  { label: 'Facturación', id: 'facturacion' },
  { label: 'Preguntas', id: 'preguntas' },
];

const businessOptions = [
  {
    title: 'Tienda general',
    description: 'Productos, ventas, caja e inventario.',
    icon: Store,
    tone: 'blue',
  },
  {
    title: 'Ropa y accesorios',
    description: 'Tallas, colores, marcas y categorías.',
    icon: Package,
    tone: 'violet',
  },
  {
    title: 'Cafetería',
    description: 'Menú, insumos, recetas y atención rápida.',
    icon: Coffee,
    tone: 'cyan',
  },
  {
    title: 'Restaurante',
    description: 'Mesas, comandas, recetas y delivery.',
    icon: ReceiptText,
    tone: 'amber',
  },
  {
    title: 'Panadería',
    description: 'Productos terminados, materias primas y control de stock.',
    icon: Wheat,
    tone: 'amber',
  },
  {
    title: 'Ferretería',
    description: 'Códigos, medidas, marcas y proveedores.',
    icon: Wrench,
    tone: 'emerald',
  },
  {
    title: 'Taller y servicios',
    description: 'Repuestos, clientes, servicios y caja.',
    icon: ClipboardList,
    tone: 'slate',
  },
  {
    title: 'Otros negocios',
    description: 'Configuración flexible para operaciones comerciales y de servicios.',
    icon: Store,
    tone: 'blue',
  },
];

const featureGroups = [
  {
    title: 'Ventas y caja',
    description: 'Registra las ventas del día y mantén organizados los movimientos de caja.',
    icon: ShoppingCart,
    tone: 'blue',
    items: ['Ventas e historial', 'Caja diaria y gastos', 'Anulaciones y formas de pago'],
  },
  {
    title: 'Inventario y compras',
    description: 'Controla existencias, registra abastecimientos y detecta productos por reponer.',
    icon: Boxes,
    tone: 'cyan',
    items: ['Productos y existencias', 'Compras y proveedores', 'Alertas e importación desde Excel'],
  },
  {
    title: 'Clientes y reportes',
    description: 'Consulta la información comercial necesaria para dar seguimiento y decidir mejor.',
    icon: BarChart3,
    tone: 'violet',
    items: ['Registro de clientes', 'Reportes de ventas y costos', 'Productos destacados y utilidad'],
  },
];

const featureToneClasses = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
  violet: 'bg-violet-50 text-violet-700 ring-violet-100',
};


const pricingPlans = [
  {
    code: 'negocio',
    name: 'Negocio',
    monthlyPrice: 29.99,
    annualPrice: 329.90,
    annualEquivalent: 27.49,
    description: 'Para comercios y servicios que necesitan ordenar ventas, inventario, compras y caja.',
    audience: 'Tiendas, boutiques, minimarkets, ferreterías, talleres y negocios comerciales.',
    icon: Boxes,
    tone: 'cyan',
    featured: true,
    features: [
      'Ventas, productos e inventario',
      'Compras y proveedores',
      'Caja diaria y gastos',
      'Clientes, alertas y reportes',
      'Importación y exportación desde Excel',
    ],
  },
  {
    code: 'gastronomico',
    name: 'Gastronomía',
    monthlyPrice: 39.99,
    annualPrice: 439.90,
    annualEquivalent: 36.66,
    description: 'Para cafeterías, restaurantes y panaderías que trabajan con productos, insumos, recetas y operación diaria.',
    audience: 'Cafeterías, restaurantes, panaderías y negocios de alimentos y bebidas.',
    icon: Coffee,
    tone: 'violet',
    features: [
      'Todo lo incluido en InventIQ Negocio',
      'Menú, productos, recetas e ingredientes',
      'Control de insumos y existencias',
      'Flujos especializados según la actividad',
      'Costos y reportes gastronómicos',
    ],
  },
  {
    code: 'personalizado',
    name: 'Personalizado',
    monthlyPrice: 49.99,
    annualPrice: 549.90,
    annualEquivalent: 45.83,
    pricePrefix: 'Desde',
    description: 'Para operaciones que requieren migración de datos, ajustes específicos o acompañamiento adicional.',
    audience: 'Negocios con procesos particulares o necesidades fuera del alcance estándar.',
    icon: Sparkles,
    tone: 'navy',
    features: [
      'Edición Negocio o Gastronomía',
      'Revisión previa de requerimientos',
      'Migración o depuración de información',
      'Configuraciones y reportes adicionales',
      'Propuesta definida antes de iniciar',
    ],
  },
];

const planComparisonRows = [
  { label: 'Cuenta administradora incluida', values: ['1', '1', 'Según alcance'] },
  { label: 'Ventas, productos e inventario', values: [true, true, true] },
  { label: 'Compras, proveedores, caja y gastos', values: [true, true, true] },
  { label: 'Importación y exportación desde Excel', values: [true, true, 'Incluida o migración'] },
  { label: 'Clientes, alertas y reportes', values: [true, true, true] },
  { label: 'Recetas, ingredientes y costos gastronómicos', values: [false, true, 'Según actividad'] },
  { label: 'Mesas, comandas y órdenes', values: [false, 'Restaurantes', 'Según actividad'] },
  { label: 'Configuración', values: ['Estándar', 'Especializada', 'A medida'] },
  { label: 'Soporte', values: ['Estándar', 'Especializado', 'Según propuesta'] },
];

function formatPrice(value) {
  return Number(value).toFixed(2).replace('.', ',');
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function scrollToSection(id) {
  const section = document.getElementById(id);
  if (!section) return;
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function DashboardPreview() {
  return (
    <div className="landing-preview-wrap relative mx-auto w-full max-w-[690px] lg:mr-0">
      <div className="landing-preview-glow landing-preview-glow-one" />
      <div className="landing-preview-glow landing-preview-glow-two" />

      <div className="landing-preview-status landing-float hidden sm:flex">
        <span className="landing-status-dot" />
        Información actualizada
      </div>

      <div className="landing-preview-shell relative">
        <div className="overflow-hidden rounded-[1.35rem] border border-slate-200/90 bg-[#f7f9fd]">
          <div className="flex h-11 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-5">
            <div className="flex gap-1.5" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </div>
            <div className="rounded-lg bg-slate-100 px-3 py-1.5 text-[9px] font-bold tracking-wide text-slate-500 sm:text-[10px]">
              inventiqweb.com / panel
            </div>
            <Bell className="h-3.5 w-3.5 text-slate-500" />
          </div>

          <img
            src="/landing-dashboard.png"
            alt="Panel principal de InventIQ en computadora"
            width="1806"
            height="871"
            decoding="async"
            fetchPriority="high"
            className="block h-auto w-full"
          />
        </div>
      </div>

      <div className="landing-preview-note landing-float-delayed hidden md:flex">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
          <Boxes className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-black text-[#071a33]">Operación conectada</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Ventas, caja e inventario</p>
        </div>
      </div>

      <div className="landing-mobile-preview absolute -bottom-8 right-0 w-[116px] sm:-bottom-12 sm:right-5 sm:w-[148px] lg:w-[170px]">
        <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-slate-300" />
        <div className="overflow-hidden rounded-[1rem] border border-slate-200 bg-[#f5f8fc]">
          <img
            src="/landing-mobile.png"
            alt="Vista móvil de InventIQ"
            width="332"
            height="717"
            decoding="async"
            className="block h-auto w-full"
          />
        </div>
      </div>
    </div>
  );
}

export default function LandingPage({ currentUser, onNavigate }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('inicio');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [contactPlan, setContactPlan] = useState('por_definir');
  const [contactInterest, setContactInterest] = useState('conocer_inventiq');
  const [legalDocument, setLegalDocument] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const sectionIds = ['inicio', ...landingSections.map(section => section.id), 'contacto'];

    function handleScroll() {
      const activationLine = 118;
      let currentSection = 'inicio';

      sectionIds.forEach(id => {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= activationLine) {
          currentSection = id;
        }
      });

      setActiveSection(currentSection);
      setShowScrollTop(window.scrollY > 720);
    }

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event) {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    }

    function handleResize() {
      if (window.innerWidth >= 1024) setMobileMenuOpen(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [mobileMenuOpen]);

  function handleSectionNavigation(section) {
    setMobileMenuOpen(false);
    window.requestAnimationFrame(() => scrollToSection(section.id));
  }

  function goToLogin() {
    setMobileMenuOpen(false);
    onNavigate(currentUser ? '/app' : '/iniciar-sesion');
  }

  function openContact(planCode = 'por_definir', interest = 'conocer_inventiq') {
    setMobileMenuOpen(false);
    setContactPlan(planCode);
    setContactInterest(interest);
    window.requestAnimationFrame(() => scrollToSection('contacto'));
  }

  return (
    <div className="landing-page min-h-screen bg-white text-slate-900">
      <header className="landing-header sticky top-0 z-50 border-b border-white/10 bg-[#04152d]/95 text-white backdrop-blur-xl">
          <nav className="mx-auto flex h-[76px] max-w-[1320px] items-center justify-between gap-5 px-5 sm:px-8 lg:px-10">
            <button type="button" onClick={scrollToTop} className="group flex shrink-0 items-center gap-3 text-left" aria-label="Ir al inicio">
              <InventiQIcon className="h-10 w-10 rounded-xl object-cover shadow-lg shadow-cyan-950/30 transition group-hover:scale-[1.03] sm:h-11 sm:w-11" />
              <div>
                <div className="text-lg font-black tracking-[0.13em] sm:text-xl">INVENTI<span className="text-cyan-300">Q</span></div>
                <div className="text-[10px] font-semibold tracking-wide text-slate-400 sm:text-[11px]">Gestión para negocios</div>
              </div>
            </button>

            <div className="hidden items-center gap-1 text-sm font-semibold text-slate-300 xl:flex">
              <button
                type="button"
                onClick={scrollToTop}
                className={`landing-nav-link ${activeSection === 'inicio' ? 'is-active' : ''}`}
                aria-current={activeSection === 'inicio' ? 'page' : undefined}
              >
                Inicio
              </button>
              {landingSections.map(section => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => handleSectionNavigation(section)}
                  className={`landing-nav-link ${activeSection === section.id ? 'is-active' : ''}`}
                  aria-current={activeSection === section.id ? 'page' : undefined}
                >
                  {section.label}
                </button>
              ))}
            </div>

            <div className="hidden items-center gap-2 lg:flex">
              <button type="button" onClick={goToLogin} className="landing-header-login">
                {currentUser ? 'Ir al panel' : 'Iniciar sesión'}
              </button>
              <button type="button" onClick={() => openContact('por_definir')} className="landing-header-cta">
                Empezar ahora <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(open => !open)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white transition hover:bg-white/10 lg:hidden"
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileMenuOpen}
              aria-controls="landing-mobile-navigation"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </nav>

          {mobileMenuOpen && (
            <div id="landing-mobile-navigation" className="landing-mobile-menu border-t border-white/10 bg-[#061a35]/98 px-5 py-5 lg:hidden">
              <div className="mx-auto grid max-w-[1320px] gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    window.requestAnimationFrame(scrollToTop);
                  }}
                  className={`landing-mobile-link ${activeSection === 'inicio' ? 'is-active' : ''}`}
                  aria-current={activeSection === 'inicio' ? 'page' : undefined}
                >
                  Inicio
                </button>
                {landingSections.map(section => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => handleSectionNavigation(section)}
                    className={`landing-mobile-link ${activeSection === section.id ? 'is-active' : ''}`}
                    aria-current={activeSection === section.id ? 'page' : undefined}
                  >
                    {section.label}
                  </button>
                ))}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={goToLogin} className="rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/5">
                    {currentUser ? 'Ir al panel' : 'Iniciar sesión'}
                  </button>
                  <button type="button" onClick={() => openContact('por_definir')} className="landing-header-cta justify-center">
                    Empezar ahora <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </header>

      <section id="inicio" className="landing-hero relative isolate overflow-hidden bg-[#04152d] text-white">
        <div className="landing-grid absolute inset-0 opacity-30" />
        <div className="landing-hero-orb landing-hero-orb-left" />
        <div className="landing-hero-orb landing-hero-orb-right" />



        <div className="relative z-10 mx-auto grid max-w-[1320px] items-center gap-14 px-5 pb-24 pt-14 sm:px-8 sm:pb-28 sm:pt-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:px-10 lg:pb-32 lg:pt-24 xl:gap-20">
          <div className="max-w-[610px]">
            <div className="landing-hero-eyebrow">
              <span className="landing-status-dot" /> Software de gestión para negocios
            </div>

            <h1 className="mt-6 max-w-[600px] text-[2.7rem] font-black leading-[1.04] tracking-[-0.035em] sm:text-[3.55rem] lg:text-[4rem] xl:text-[4.45rem]">
              Controla tu negocio. Decide con <span className="landing-hero-gradient">información real.</span>
            </h1>


            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => openContact('por_definir')}
                className="landing-primary-button group"
              >
                Empezar con InventIQ <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('como-funciona')}
                className="landing-secondary-button"
              >
                Ver cómo funciona <ChevronRight className="h-4 w-4" />
              </button>
            </div>

          </div>

          <DashboardPreview />
        </div>

        <div className="relative z-20 border-t border-white/10 bg-[#031126]/70 backdrop-blur-xl">
          <div className="mx-auto grid max-w-[1320px] gap-3 px-5 py-5 sm:grid-cols-3 sm:px-8 lg:px-10">
            {[
              ['Todo conectado', 'Administra tu operación desde un solo lugar', Boxes],
              ['Información clara', 'Consulta datos útiles sin procesos complicados', BarChart3],
              ['Soporte cercano', 'Acompañamiento para poner tu negocio en marcha', Users],
            ].map(([title, description, Icon]) => (
              <div key={title} className="landing-hero-proof">
                <span className="landing-hero-proof-icon"><Icon className="h-5 w-5" /></span>
                <div>
                  <p className="text-sm font-black text-white">{title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-400">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="negocios" className="scroll-mt-6 bg-[#f5f8fc] px-5 py-20 sm:px-8 lg:px-12 lg:py-24">
        <div className="mx-auto max-w-[1320px]">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
              <Sparkles className="h-4 w-4" /> Se adapta a tu actividad
            </span>
            <h2 className="mt-5 text-3xl font-black tracking-tight text-[#071a33] sm:text-4xl lg:text-5xl">
              Hecho para distintos tipos de negocio
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              La plataforma mantiene una base sencilla y adapta sus herramientas a la forma de trabajar de cada negocio.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {businessOptions.map(({ title, description, icon: Icon, tone }) => (
              <article
                key={title}
                className="landing-business-card group flex min-h-[190px] flex-col items-center rounded-[1.5rem] border border-slate-200 bg-white p-5 text-center shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
              >
                <div className={`landing-icon-tile landing-icon-${tone}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-black text-[#071a33]">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-[1.5rem] border border-slate-200 bg-white px-6 py-5 text-center shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:flex-row sm:text-left">
            <div>
              <h3 className="font-black text-[#071a33]">¿Tu actividad no aparece?</h3>
              <p className="mt-1 text-sm text-slate-500">Podemos revisar tu operación y recomendarte la edición adecuada.</p>
            </div>
            <button type="button" onClick={() => openContact('por_definir')} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#071a33] px-5 py-3 text-sm font-black text-white transition hover:bg-blue-900">
              Cuéntanos sobre tu negocio <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <section id="funciones" className="scroll-mt-6 bg-[#f6f8fb] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto max-w-[1240px]">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-blue-700">
              <Boxes className="h-4 w-4" /> Funciones principales
            </span>
            <h2 className="mt-5 text-3xl font-black tracking-tight text-[#071a33] sm:text-4xl lg:text-5xl">
              Las herramientas que necesitas para trabajar con orden
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              Ventas, inventario, compras, caja, clientes y reportes dentro del mismo sistema.
            </p>
          </div>

          <div className="mt-12 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
            <div className="grid lg:grid-cols-3">
              {featureGroups.map(({ title, description, icon: Icon, tone, items }, index) => (
                <article
                  key={title}
                  className={`p-7 sm:p-8 lg:min-h-[390px] ${index > 0 ? 'border-t border-slate-200 lg:border-l lg:border-t-0' : ''}`}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${featureToneClasses[tone]}`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  <h3 className="mt-6 text-xl font-black text-[#071a33] sm:text-2xl">{title}</h3>
                  <p className="mt-3 min-h-[72px] text-sm leading-7 text-slate-600">{description}</p>

                  <ul className="mt-6 space-y-3 border-t border-slate-100 pt-5">
                    {items.map(item => (
                      <li key={item} className="flex items-start gap-3 text-sm font-semibold leading-6 text-slate-700">
                        <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-cyan-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-7 py-6 sm:px-8 lg:flex lg:items-center lg:justify-between lg:gap-8">
              <div>
                <h3 className="text-base font-black text-[#071a33]">Los módulos comparten la misma información</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Una venta actualiza el inventario, queda registrada en caja y se refleja en los reportes sin volver a ingresar los datos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => scrollToSection('como-funciona')}
                className="group mt-5 inline-flex shrink-0 items-center gap-2 text-sm font-black text-blue-700 transition hover:text-cyan-700 lg:mt-0"
              >
                Ver cómo funciona <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <LandingHowItWorksSection
        onDemo={() => openContact('por_definir')}
        onPlans={() => scrollToSection('planes')}
      />


      <section id="planes" className="scroll-mt-6 bg-[#f7f9fc] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto max-w-[1320px]">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-700 shadow-sm ring-1 ring-slate-200">
              <CircleDollarSign className="h-4 w-4" /> Planes y precios
            </span>
            <h2 className="mt-5 text-3xl font-black tracking-tight text-[#071a33] sm:text-4xl lg:text-5xl">
              Una edición para cada forma de trabajar
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              Compara lo que incluye cada opción y elige la que corresponda a la operación actual de tu negocio. Todos los precios publicados incluyen IVA.
            </p>
          </div>

          <div className="mx-auto mt-9 flex w-fit items-center rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              aria-pressed={billingCycle === 'monthly'}
              className={`rounded-xl px-5 py-3 text-sm font-black transition ${billingCycle === 'monthly' ? 'bg-[#071a33] text-white shadow-md' : 'text-slate-600 hover:text-[#071a33]'}`}
            >
              Pago mensual
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              aria-pressed={billingCycle === 'annual'}
              className={`rounded-xl px-5 py-3 text-sm font-black transition ${billingCycle === 'annual' ? 'bg-gradient-to-r from-blue-600 to-cyan-400 text-white shadow-md' : 'text-slate-600 hover:text-[#071a33]'}`}
            >
              Pago anual <span className="hidden sm:inline">· incluye 1 mes</span>
            </button>
          </div>

          <div className="mx-auto mt-12 grid max-w-[1120px] gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pricingPlans.map(plan => {
              const Icon = plan.icon;
              const displayedPrice = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
              const displayedPeriod = billingCycle === 'annual' ? '/año' : '/mes';

              return (
                <article
                  key={plan.code}
                  className={`landing-pricing-card relative flex h-full flex-col rounded-[1.8rem] border p-6 sm:p-7 ${plan.featured ? 'border-cyan-300 bg-[#071a33] text-white shadow-[0_26px_70px_rgba(7,26,51,0.22)]' : 'border-slate-200 bg-white shadow-[0_14px_45px_rgba(15,23,42,0.06)]'}`}
                >
                  {plan.featured && (
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white shadow-lg">
                      Más elegido
                    </span>
                  )}

                  <div className="flex items-start justify-between gap-4">
                    <div className={`landing-plan-icon landing-plan-icon-${plan.tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wide ${plan.featured ? 'bg-white/10 text-cyan-300' : 'bg-slate-100 text-slate-500'}`}>
                      {plan.code === 'personalizado' ? 'Según alcance' : 'Edición estándar'}
                    </span>
                  </div>

                  <h3 className={`mt-5 text-2xl font-black ${plan.featured ? 'text-white' : 'text-[#071a33]'}`}>InventIQ {plan.name}</h3>
                  <p className={`mt-3 min-h-[72px] text-sm leading-6 ${plan.featured ? 'text-slate-300' : 'text-slate-600'}`}>{plan.description}</p>

                  <div className="mt-6">
                    {plan.pricePrefix && (
                      <p className={`mb-1 text-xs font-black uppercase tracking-[0.14em] ${plan.featured ? 'text-cyan-300' : 'text-cyan-700'}`}>
                        {plan.pricePrefix}
                      </p>
                    )}
                    <div className="flex items-end gap-1">
                      <span className={`text-sm font-black ${plan.featured ? 'text-cyan-300' : 'text-cyan-600'}`}>$</span>
                      <span className={`text-4xl font-black tracking-tight ${plan.featured ? 'text-white' : 'text-[#071a33]'}`}>{formatPrice(displayedPrice)}</span>
                      <span className={`pb-1 text-sm font-bold ${plan.featured ? 'text-slate-400' : 'text-slate-500'}`}>{displayedPeriod}</span>
                    </div>
                    <p className={`mt-2 text-xs ${plan.featured ? 'text-slate-400' : 'text-slate-500'}`}>
                      {billingCycle === 'annual'
                        ? `${plan.code === 'personalizado' ? 'IVA incluido. Valor referencial; ' : 'IVA incluido. '}equivale a $${formatPrice(plan.annualEquivalent)} al mes.`
                        : plan.code === 'personalizado'
                          ? 'IVA incluido. El valor final depende del alcance aprobado.'
                          : 'IVA incluido. Precio final mensual.'}
                    </p>
                  </div>

                  <div className={`my-6 h-px ${plan.featured ? 'bg-white/10' : 'bg-slate-200'}`} />

                  <ul className="flex-1 space-y-3">
                    {plan.features.map(feature => (
                      <li key={feature} className={`flex items-start gap-2.5 text-sm leading-6 ${plan.featured ? 'text-slate-200' : 'text-slate-600'}`}>
                        <CheckCircle2 className={`mt-1 h-4 w-4 shrink-0 ${plan.featured ? 'text-cyan-300' : 'text-cyan-600'}`} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <p className={`mt-6 border-t pt-5 text-xs leading-5 ${plan.featured ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                    Recomendado para: {plan.audience}
                  </p>

                  <button
                    type="button"
                    onClick={() => openContact(plan.code)}
                    className={`mt-5 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-black transition hover:-translate-y-0.5 ${plan.featured ? 'bg-gradient-to-r from-blue-600 to-cyan-400 text-white shadow-lg shadow-cyan-950/20' : 'bg-[#071a33] text-white hover:bg-blue-900'}`}
                  >
                    {plan.code === 'personalizado' ? 'Consultar esta opción' : 'Elegir este plan'} <ArrowRight className="h-4 w-4" />
                  </button>
                </article>
              );
            })}
          </div>

          <div className="mx-auto mt-8 max-w-[1120px] rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div>
              <h3 className="font-black text-[#071a33]">Incluido en todas las ediciones</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">Acceso desde el navegador, actualizaciones de la plataforma y soporte de uso según el plan contratado. Los valores mostrados son finales e incluyen IVA.</p>
            </div>
            <button
              type="button"
              onClick={() => openContact('por_definir')}
              className="mt-4 inline-flex shrink-0 items-center gap-2 text-sm font-black text-blue-700 transition hover:text-cyan-700 sm:mt-0"
            >
              Consultar antes de elegir <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-14 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_65px_rgba(15,23,42,0.07)]">
            <div className="border-b border-slate-200 px-6 py-6 sm:px-8">
              <h3 className="text-2xl font-black text-[#071a33]">Compara las ediciones</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">Revisa las diferencias principales antes de comunicarte con nosotros.</p>
            </div>
            <p className="border-b border-slate-100 bg-slate-50 px-6 py-3 text-xs font-semibold text-slate-500 sm:hidden">
              Desliza horizontalmente para comparar todas las ediciones.
            </p>
            <div className="landing-comparison-scroll overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-[#f8fafc]">
                    <th className="w-[28%] px-6 py-4 font-black text-[#071a33] sm:px-8">Función</th>
                    {pricingPlans.map(plan => (
                      <th key={plan.code} className={`px-4 py-4 text-center font-black ${plan.featured ? 'text-cyan-700' : 'text-[#071a33]'}`}>{plan.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {planComparisonRows.map((row, rowIndex) => (
                    <tr key={row.label} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                      <td className="border-t border-slate-100 px-6 py-4 font-bold text-slate-700 sm:px-8">{row.label}</td>
                      {row.values.map((value, valueIndex) => (
                        <td key={`${row.label}-${pricingPlans[valueIndex].code}`} className="border-t border-slate-100 px-4 py-4 text-center text-slate-600">
                          {value === true ? (
                            <CheckCircle2 className="mx-auto h-5 w-5 text-cyan-600" aria-label="Incluido" />
                          ) : value === false ? (
                            <span className="font-bold text-slate-300">—</span>
                          ) : (
                            <span className="font-semibold">{value}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-6 text-center text-xs leading-6 text-slate-500">
            Los precios publicados incluyen IVA. Cualquier servicio adicional se informará antes de contratar; en la edición Personalizada, el valor final se define mediante una propuesta previa.
          </p>
        </div>
      </section>

      <LandingBillingSection
        onContact={() => openContact('por_definir', 'facturacion_electronica')}
      />

      <LandingFaqSection onContact={() => openContact('por_definir', 'conocer_inventiq')} />

      <LandingContactSection
        initialPlan={contactPlan}
        initialInterest={contactInterest}
        billingCycle={billingCycle}
      />

      <footer className="bg-[#04152d] px-5 pt-14 text-white sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1220px]">
          <div className="grid gap-10 border-b border-white/10 pb-12 md:grid-cols-[1.25fr_0.75fr_0.9fr]">
            <div>
              <button type="button" onClick={scrollToTop} className="flex items-center gap-3 text-left">
                <InventiQIcon className="h-11 w-11 rounded-xl object-cover" />
                <div>
                  <p className="text-xl font-black tracking-[0.14em]">INVENTI<span className="text-cyan-300">Q</span></p>
                  <p className="mt-1 text-sm text-slate-400">Tu negocio, en orden.</p>
                </div>
              </button>
              <p className="mt-6 max-w-md text-sm leading-7 text-slate-400">
                Plataforma para gestionar ventas, inventario, compras, caja, clientes y reportes desde un solo lugar.
              </p>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Navegación</p>
              <div className="mt-5 grid gap-3 text-sm text-slate-400">
                <button type="button" onClick={() => scrollToSection('negocios')} className="w-fit text-left transition hover:text-cyan-300">Tipos de negocio</button>
                <button type="button" onClick={() => scrollToSection('funciones')} className="w-fit text-left transition hover:text-cyan-300">Funciones</button>
                <button type="button" onClick={() => scrollToSection('planes')} className="w-fit text-left transition hover:text-cyan-300">Planes</button>
                <button type="button" onClick={() => scrollToSection('preguntas')} className="w-fit text-left transition hover:text-cyan-300">Preguntas frecuentes</button>
              </div>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Contacto</p>
              <div className="mt-5 grid gap-3 text-sm text-slate-400">
                <a href="mailto:inventiqweb@gmail.com" className="w-fit transition hover:text-cyan-300">inventiqweb@gmail.com</a>
                <button type="button" onClick={() => openContact('por_definir')} className="w-fit text-left transition hover:text-cyan-300">Solicitar información</button>
                <button type="button" onClick={goToLogin} className="w-fit text-left transition hover:text-cyan-300">Acceso de clientes</button>
                <button type="button" onClick={() => scrollToSection('facturacion')} className="w-fit text-left transition hover:text-cyan-300">Facturación electrónica</button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 py-6 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
            <p>© {new Date().getFullYear()} InventIQ. Todos los derechos reservados.</p>
            <div className="flex flex-wrap gap-x-5 gap-y-3">
              <button type="button" onClick={() => setLegalDocument('privacy')} className="transition hover:text-cyan-300">Política de privacidad</button>
              <button type="button" onClick={() => setLegalDocument('terms')} className="transition hover:text-cyan-300">Términos y condiciones</button>
            </div>
          </div>
        </div>
      </footer>

      <LandingLegalModal type={legalDocument} onClose={() => setLegalDocument(null)} />

      <button
        type="button"
        onClick={scrollToTop}
        className={`landing-scroll-top fixed bottom-24 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200 bg-white text-cyan-700 shadow-[0_18px_45px_rgba(15,23,42,0.16)] transition sm:bottom-7 sm:right-7 ${showScrollTop ? 'is-visible' : ''}`}
        aria-label="Volver al inicio"
        title="Volver al inicio"
      >
        <ArrowUp className="h-5 w-5" />
      </button>

    </div>
  );
}
