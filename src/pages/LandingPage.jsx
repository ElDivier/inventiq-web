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
  PlayCircle,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  TrendingUp,
  Truck,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import InventiQIcon from '../components/InventiQIcon';
import LandingContactSection from '../components/LandingContactSection';
import LandingFaqSection from '../components/LandingFaqSection';
import LandingLegalModal from '../components/LandingLegalModal';
import LandingHowItWorksSection from '../components/LandingHowItWorksSection';

const landingSections = [
  { label: 'Funciones', id: 'funciones', available: true },
  { label: 'Tipos de negocio', id: 'negocios', available: true },
  { label: 'Cómo funciona', id: 'como-funciona', available: true },
  { label: 'Planes', id: 'planes', available: true },
  { label: 'Preguntas frecuentes', id: 'preguntas', available: true },
  { label: 'Contacto', id: 'contacto', available: true },
];

const previewKpis = [
  { label: 'Ventas hoy', value: '$1.250', trend: '+12%', icon: CircleDollarSign, tone: 'blue' },
  { label: 'Pedidos', value: '18', trend: '+6%', icon: ShoppingCart, tone: 'cyan' },
  { label: 'Productos', value: '542', trend: 'Activos', icon: Package, tone: 'violet' },
  { label: 'Stock bajo', value: '8', trend: 'Revisar', icon: Boxes, tone: 'amber' },
];

const chartBars = [38, 58, 46, 72, 54, 82, 69, 92];


const businessOptions = [
  {
    title: 'Tienda general / minimarket',
    description: 'Controla productos, ventas rápidas, existencias y fechas de caducidad desde una sola operación.',
    details: ['Stock y caducidad', 'Ventas y caja', 'Clientes frecuentes'],
    icon: Store,
    tone: 'blue',
  },
  {
    title: 'Ropa y boutiques',
    description: 'Organiza cada prenda por marca, talla y color, sin perder de vista el movimiento diario de caja.',
    details: ['Tallas y colores', 'Marcas y categorías', 'Caja diaria'],
    icon: Package,
    tone: 'violet',
  },
  {
    title: 'Ferreterías y repuestos',
    description: 'Administra medidas, modelos, códigos y marcas para encontrar cada producto con rapidez.',
    details: ['Medidas y modelos', 'Códigos de producto', 'Proveedores'],
    icon: Boxes,
    tone: 'amber',
  },
  {
    title: 'Talleres y servicios',
    description: 'Mantén ordenados repuestos, servicios, clientes y movimientos de caja en una misma plataforma.',
    details: ['Repuestos', 'Servicios y ventas', 'Clientes'],
    icon: ClipboardList,
    tone: 'slate',
  },
  {
    title: 'Cafeterías',
    description: 'Gestiona menú, insumos, recetas y ventas para llevar con una vista diseñada para atención rápida.',
    details: ['Menú e insumos', 'Recetas', 'Caja rápida'],
    icon: Coffee,
    tone: 'cyan',
  },
  {
    title: 'Restaurantes',
    description: 'Conecta mesas, comandas, recetas, inventario de cocina y diferentes canales de venta.',
    details: ['Mesas y comandas', 'Recetas e ingredientes', 'Delivery y para llevar'],
    icon: ReceiptText,
    tone: 'emerald',
  },
];

const platformFeatures = [
  {
    title: 'Ventas y comprobantes',
    description: 'Registra cada venta y consulta su historial sin depender de cuadernos o archivos separados.',
    icon: ShoppingCart,
    tone: 'blue',
  },
  {
    title: 'Inventario actualizado',
    description: 'Conoce las existencias disponibles y revisa los movimientos de entrada y salida.',
    icon: Boxes,
    tone: 'cyan',
  },
  {
    title: 'Caja y gastos',
    description: 'Controla ingresos, egresos y cierres para comprender mejor el dinero del negocio.',
    icon: WalletCards,
    tone: 'violet',
  },
  {
    title: 'Compras y proveedores',
    description: 'Registra abastecimientos, incrementa stock y conserva la información de tus proveedores.',
    icon: Truck,
    tone: 'amber',
  },
  {
    title: 'Clientes organizados',
    description: 'Guarda datos importantes y consulta el historial relacionado con cada cliente.',
    icon: Users,
    tone: 'emerald',
  },
  {
    title: 'Importación desde Excel',
    description: 'Agiliza la carga inicial de productos mediante una vista previa antes de guardar.',
    icon: ClipboardList,
    tone: 'green',
  },
  {
    title: 'Alertas de inventario',
    description: 'Detecta productos con stock bajo para planificar compras antes de quedarte sin existencias.',
    icon: Bell,
    tone: 'red',
  },
  {
    title: 'Reportes para decidir',
    description: 'Revisa ventas, productos destacados, utilidad estimada y comportamiento del negocio.',
    icon: BarChart3,
    tone: 'indigo',
  },
];


const pricingPlans = [
  {
    code: 'negocio',
    name: 'Negocio',
    monthlyPrice: 29.99,
    annualPrice: 329.90,
    annualEquivalent: 27.49,
    description: 'La edición completa para administrar la operación diaria de comercios y servicios.',
    audience: 'Tiendas, boutiques, minimarkets, ferreterías, talleres y otros negocios comerciales.',
    icon: Boxes,
    tone: 'cyan',
    featured: true,
    features: [
      '1 negocio y 1 cuenta administradora',
      'Ventas, productos e inventario',
      'Compras y proveedores',
      'Caja diaria y gastos fijos',
      'Clientes y alertas de stock',
      'Importación y exportación desde Excel',
      'Reportes de ventas, costos y utilidad',
    ],
  },
  {
    code: 'gastronomico',
    name: 'Gastronomía',
    monthlyPrice: 39.99,
    annualPrice: 439.90,
    annualEquivalent: 36.66,
    description: 'Una edición especializada para controlar la operación de cafeterías y restaurantes.',
    audience: 'Cafeterías, restaurantes y negocios que trabajan con menú, insumos, mesas o comandas.',
    icon: Coffee,
    tone: 'violet',
    features: [
      'Todo lo incluido en InventIQ Negocio',
      'Menú, platos, recetas e ingredientes',
      'Descuento automático de insumos',
      'Mesas, comandas y órdenes',
      'Ventas para llevar y delivery',
      'Control de costos gastronómicos',
      'Reportes adaptados a alimentos y bebidas',
    ],
  },
  {
    code: 'personalizado',
    name: 'Personalizado',
    monthlyPrice: 49.99,
    annualPrice: 549.90,
    annualEquivalent: 45.83,
    pricePrefix: 'Desde',
    description: 'Para negocios que necesitan implementación, migración o configuraciones fuera del alcance estándar.',
    audience: 'Operaciones con procesos particulares, carga inicial compleja, reportes especiales o acompañamiento adicional.',
    icon: Sparkles,
    tone: 'navy',
    features: [
      'Edición Comercio o Gastronomía',
      'Revisión previa de requerimientos',
      'Migración o depuración de información',
      'Campos y configuraciones adicionales',
      'Reportes especiales según alcance',
      'Capacitación o acompañamiento adicional',
      'Propuesta técnica y económica antes de iniciar',
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
  { label: 'Mesas, comandas y órdenes', values: [false, true, 'Según actividad'] },
  { label: 'Configuración', values: ['Estándar', 'Especializada', 'A medida'] },
  { label: 'Soporte', values: ['Estándar', 'Especializado', 'Según propuesta'] },
];

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
    <div className="relative mx-auto w-full max-w-[680px] lg:mr-0">
      <div className="landing-float absolute -left-10 top-20 hidden h-24 w-24 rounded-full bg-cyan-400/20 blur-2xl sm:block" />
      <div className="landing-float-delayed absolute -right-6 bottom-16 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="relative rounded-[2rem] border border-white/20 bg-white/10 p-2 shadow-[0_32px_90px_rgba(0,0,0,0.48)] backdrop-blur-xl sm:p-3">
        <div className="overflow-hidden rounded-[1.55rem] border border-slate-200/80 bg-[#f7f9fd]">
          <div className="flex h-10 items-center justify-between border-b border-slate-200 bg-white px-4">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </div>
            <div className="hidden rounded-lg bg-slate-100 px-3 py-1.5 text-[8px] font-semibold text-slate-500 sm:block">
              inventiq.app / panel
            </div>
            <Bell className="h-3.5 w-3.5 text-slate-500" />
          </div>

          <img
            src="/landing-dashboard.png"
            alt="Panel principal de InventIQ en computadora"
            className="block h-auto w-full"
          />
        </div>
      </div>

      <div className="absolute -bottom-8 -right-1 w-[118px] overflow-hidden rounded-[1.55rem] border-[5px] border-[#071a33] bg-white p-1.5 shadow-[0_22px_55px_rgba(0,0,0,0.45)] sm:-bottom-12 sm:right-5 sm:w-[150px] lg:w-[175px]">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-200" />
        <div className="overflow-hidden rounded-[1rem] border border-slate-200 bg-[#f5f8fc]">
          <img
            src="/landing-mobile.png"
            alt="Vista móvil de InventIQ"
            className="block h-auto w-full"
          />
        </div>
      </div>
    </div>
  );
}

export default function LandingPage({ currentUser, onNavigate }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [phaseNotice, setPhaseNotice] = useState('');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [contactPlan, setContactPlan] = useState('por_definir');
  const [legalDocument, setLegalDocument] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    if (!phaseNotice) return undefined;
    const timer = window.setTimeout(() => setPhaseNotice(''), 2800);
    return () => window.clearTimeout(timer);
  }, [phaseNotice]);

  useEffect(() => {
    function handleScroll() {
      setShowScrollTop(window.scrollY > 720);
    }

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll('[data-landing-reveal]'));
    if (!elements.length || !('IntersectionObserver' in window)) {
      elements.forEach(element => element.classList.add('is-visible'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12 },
    );

    elements.forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  function showUpcomingSection(section) {
    setMobileMenuOpen(false);
    setPhaseNotice(`La sección “${section}” se incorporará en las siguientes fases.`);
  }

  function handleSectionNavigation(section) {
    setMobileMenuOpen(false);
    if (section.available) {
      scrollToSection(section.id);
      return;
    }
    showUpcomingSection(section.label);
  }

  function goToLogin() {
    setMobileMenuOpen(false);
    onNavigate(currentUser ? '/app' : '/iniciar-sesion');
  }

  function openContact(planCode = 'por_definir') {
    setMobileMenuOpen(false);
    setContactPlan(planCode);
    window.requestAnimationFrame(() => scrollToSection('contacto'));
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <section id="inicio" className="landing-hero relative isolate min-h-[760px] overflow-hidden bg-[#04152d] text-white lg:min-h-screen">
        <div className="landing-grid absolute inset-0 opacity-35" />
        <div className="absolute -left-40 top-24 h-[440px] w-[440px] rounded-full bg-blue-600/20 blur-[110px]" />
        <div className="absolute right-[-150px] top-[-80px] h-[520px] w-[520px] rounded-full bg-cyan-400/15 blur-[120px]" />
        <div className="absolute bottom-[-180px] left-[38%] h-[420px] w-[420px] rounded-full bg-blue-500/15 blur-[120px]" />

        <header className="relative z-30 border-b border-white/10 bg-[#04152d]/70 backdrop-blur-xl">
          <nav className="mx-auto flex h-20 max-w-[1450px] items-center justify-between gap-6 px-5 sm:px-8 lg:px-12">
            <button type="button" onClick={scrollToTop} className="flex shrink-0 items-center gap-3 text-left" aria-label="Ir al inicio">
              <InventiQIcon className="h-11 w-11 rounded-xl object-cover shadow-lg shadow-cyan-950/30 sm:h-12 sm:w-12" />
              <div>
                <div className="text-xl font-black tracking-[0.13em] sm:text-2xl">INVENTI<span className="text-cyan-300">Q</span></div>
                <div className="text-[10px] font-medium tracking-wide text-slate-300 sm:text-xs">Gestión inteligente</div>
              </div>
            </button>

            <div className="hidden items-center gap-7 text-sm font-semibold text-slate-300 xl:flex">
              <button type="button" onClick={scrollToTop} className="relative py-3 text-white after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-cyan-300">Inicio</button>
              {landingSections.map(section => (
                <button key={section.id} type="button" onClick={() => handleSectionNavigation(section)} className="py-3 transition hover:text-white">
                  {section.label}
                </button>
              ))}
            </div>

            <div className="hidden items-center gap-3 lg:flex">
              <button type="button" onClick={goToLogin} className="rounded-xl px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10 hover:text-white">
                {currentUser ? 'Ir al panel' : 'Iniciar sesión'}
              </button>
              <button type="button" onClick={() => openContact('por_definir')} className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-400 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-950/30 transition hover:-translate-y-0.5 hover:shadow-cyan-500/20">
                Solicitar demostración
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(open => !open)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white lg:hidden"
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </nav>

          {mobileMenuOpen && (
            <div className="border-t border-white/10 bg-[#061a35] px-5 py-5 lg:hidden">
              <div className="mx-auto grid max-w-[1450px] gap-2">
                <button type="button" onClick={() => { scrollToTop(); setMobileMenuOpen(false); }} className="rounded-xl bg-white/10 px-4 py-3 text-left font-bold text-white">Inicio</button>
                {landingSections.map(section => (
                  <button key={section.id} type="button" onClick={() => handleSectionNavigation(section)} className="rounded-xl px-4 py-3 text-left font-semibold text-slate-300 hover:bg-white/5 hover:text-white">
                    {section.label}
                  </button>
                ))}
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button type="button" onClick={goToLogin} className="rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-white">
                    {currentUser ? 'Ir al panel' : 'Iniciar sesión'}
                  </button>
                  <button type="button" onClick={() => openContact('por_definir')} className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-400 px-4 py-3 text-sm font-black text-white">
                    Demostración
                  </button>
                </div>
              </div>
            </div>
          )}
        </header>

        <div className="relative z-10 mx-auto grid max-w-[1450px] items-center gap-14 px-5 pb-32 pt-16 sm:px-8 sm:pt-20 lg:grid-cols-[0.88fr_1.12fr] lg:gap-12 lg:px-12 lg:pb-28 lg:pt-20 xl:gap-20">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-bold text-cyan-200 backdrop-blur">
              <Sparkles className="h-4 w-4" /> Gestión creada para negocios reales
            </div>

            <h1 className="text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.65rem] xl:text-[4.15rem]">
              Controla tu negocio.<br />
              Vende mejor.<br />
              Decide con <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">información real.</span>
            </h1>

            <p className="mt-7 max-w-xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              InventIQ reúne ventas, inventario, caja, compras, clientes y reportes en una plataforma adaptada a la forma en que trabaja tu negocio.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => openContact('por_definir')}
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-400 px-6 py-4 text-sm font-black text-white shadow-[0_16px_40px_rgba(6,182,212,0.2)] transition hover:-translate-y-0.5"
              >
                Solicitar demostración <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('planes')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-6 py-4 text-sm font-black text-white backdrop-blur transition hover:bg-white/10"
              >
                <PlayCircle className="h-4 w-4 text-cyan-300" /> Ver planes
              </button>
            </div>

            <div className="mt-9 flex max-w-2xl flex-wrap items-center gap-x-5 gap-y-3 text-sm text-slate-300 sm:gap-x-6">
              {[
                ['Fácil de usar', CheckCircle2],
                ['Datos en tiempo real', TrendingUp],
                ['Información protegida', ShieldCheck],
              ].map(([label, Icon]) => (
                <div key={label} className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-300/10 text-cyan-300"><Icon className="h-4 w-4" /></span>
                  <span className="font-semibold">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <DashboardPreview />
        </div>

        <div className="absolute inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#031126]/80 backdrop-blur-xl">
          <div className="mx-auto grid max-w-[1450px] gap-4 px-5 py-5 text-slate-300 sm:grid-cols-3 sm:px-8 lg:px-12">
            {[
              ['Adaptable', 'Configuración según tu tipo de negocio', Sparkles],
              ['Centralizado', 'Toda la operación en una sola plataforma', Boxes],
              ['Acompañamiento', 'Soporte humano para comenzar', Users],
            ].map(([title, description, Icon]) => (
              <div key={title} className="flex items-center gap-3 rounded-xl px-2 py-1">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-300"><Icon className="h-5 w-5" /></span>
                <div>
                  <p className="text-sm font-black text-white">{title}</p>
                  <p className="text-xs text-slate-400">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="negocios" className="scroll-mt-6 bg-white px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto max-w-[1320px]">
          <div data-landing-reveal className="landing-reveal mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
              <Sparkles className="h-4 w-4" /> Tipos de negocio
            </span>
            <h2 className="mt-5 text-3xl font-black tracking-tight text-[#071a33] sm:text-4xl lg:text-5xl">
              Una plataforma que cambia según la forma en que trabajas
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              InventIQ conserva una base sencilla de usar y adapta campos, categorías y herramientas a las necesidades de cada actividad.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {businessOptions.map(({ title, description, details, icon: Icon, tone }, index) => (
              <article
                key={title}
                data-landing-reveal
                className="landing-reveal landing-business-card group relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_12px_38px_rgba(15,23,42,0.06)] sm:p-7"
                style={{ transitionDelay: `${Math.min(index * 55, 260)}ms` }}
              >
                <div className={`landing-business-glow landing-business-glow-${tone}`} />
                <div className="relative z-10">
                  <div className={`landing-icon-tile landing-icon-${tone}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-6 text-xl font-black text-[#071a33]">{title}</h3>
                  <p className="mt-3 min-h-[84px] leading-7 text-slate-600">{description}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {details.map(detail => (
                      <span key={detail} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
                        {detail}
                      </span>
                    ))}
                  </div>
                  <div className="mt-6 flex items-center gap-2 text-sm font-black text-blue-700">
                    Perfil adaptado <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div data-landing-reveal className="landing-reveal mt-6 overflow-hidden rounded-[1.75rem] bg-[#071a33] p-7 text-white shadow-[0_20px_60px_rgba(7,26,51,0.2)] sm:p-9">
            <div className="grid items-center gap-7 md:grid-cols-[1fr_auto]">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-300">
                  <ClipboardList className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="text-xl font-black sm:text-2xl">¿Tu actividad no aparece en la lista?</h3>
                  <p className="mt-2 max-w-3xl leading-7 text-slate-300">
                    El perfil “Otro negocio” conserva las funciones comerciales principales y permite configurar productos, categorías e información según tu operación.
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => openContact('por_definir')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-400 px-5 py-3.5 text-sm font-black text-white transition hover:-translate-y-0.5">
                Cuéntanos sobre tu negocio <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="funciones" className="scroll-mt-6 bg-[#f5f8fc] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto max-w-[1320px]">
          <div className="grid items-end gap-8 lg:grid-cols-[1fr_0.72fr]">
            <div data-landing-reveal className="landing-reveal max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                <Boxes className="h-4 w-4" /> Funciones principales
              </span>
              <h2 className="mt-5 text-3xl font-black tracking-tight text-[#071a33] sm:text-4xl lg:text-5xl">
                La información del negocio, organizada en un solo lugar
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                Cada módulo se conecta con los demás para reducir tareas repetitivas y ofrecer una visión más clara de la operación diaria.
              </p>
            </div>

            <div data-landing-reveal className="landing-reveal rounded-[1.5rem] border border-cyan-100 bg-white p-5 shadow-[0_14px_45px_rgba(14,116,144,0.08)]">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600"><ShieldCheck className="h-5 w-5" /></span>
                <div>
                  <p className="font-black text-[#071a33]">Información centralizada</p>
                  <p className="text-sm leading-6 text-slate-500">Menos archivos separados y más control sobre lo que ocurre.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {platformFeatures.map(({ title, description, icon: Icon, tone }, index) => (
              <article
                key={title}
                data-landing-reveal
                className="landing-reveal landing-feature-card group rounded-[1.55rem] border border-slate-200 bg-white p-6 shadow-[0_10px_32px_rgba(15,23,42,0.05)]"
                style={{ transitionDelay: `${Math.min(index * 45, 260)}ms` }}
              >
                <div className={`landing-feature-icon landing-feature-icon-${tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-black text-[#071a33]">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
              </article>
            ))}
          </div>

          <div data-landing-reveal className="landing-reveal mt-10 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.07)] sm:p-8 lg:p-10">
            <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <span className="text-xs font-black uppercase tracking-[0.18em] text-cyan-600">Operación conectada</span>
                <h3 className="mt-3 text-2xl font-black text-[#071a33] sm:text-3xl">Una venta puede actualizar inventario, caja y reportes.</h3>
                <p className="mt-4 leading-7 text-slate-600">
                  InventIQ está pensado para que la información registrada en un módulo sea útil en el resto del sistema y facilite el seguimiento diario.
                </p>
                <button type="button" onClick={goToLogin} className="group mt-6 inline-flex items-center gap-2 rounded-xl bg-[#071a33] px-5 py-3.5 text-sm font-black text-white transition hover:bg-blue-900">
                  {currentUser ? 'Abrir mi panel' : 'Acceso de clientes'} <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['1', 'Registra', 'ventas, compras y movimientos'],
                  ['2', 'Actualiza', 'inventario y caja'],
                  ['3', 'Analiza', 'reportes y productos destacados'],
                  ['4', 'Decide', 'con información más clara'],
                ].map(([number, title, description]) => (
                  <div key={number} className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-400 text-xs font-black text-white">{number}</span>
                    <p className="mt-3 font-black text-[#071a33]">{title}</p>
                    <p className="mt-1 text-sm text-slate-500">{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>


      <LandingHowItWorksSection
        onDemo={() => openContact('por_definir')}
        onPlans={() => scrollToSection('planes')}
      />


      <section id="planes" className="scroll-mt-6 bg-white px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto max-w-[1320px]">
          <div data-landing-reveal className="landing-reveal mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
              <CircleDollarSign className="h-4 w-4" /> Ediciones y precios
            </span>
            <h2 className="mt-5 text-3xl font-black tracking-tight text-[#071a33] sm:text-4xl lg:text-5xl">
              Elige la edición que mejor se adapta a tu negocio
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              InventIQ Negocio y Gastronomía están listas para trabajar. La opción Personalizada cubre migraciones, configuraciones y necesidades especiales.
            </p>
          </div>

          <div data-landing-reveal className="landing-reveal mx-auto mt-9 flex w-fit items-center rounded-2xl border border-slate-200 bg-slate-50 p-1.5 shadow-sm">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`rounded-xl px-5 py-3 text-sm font-black transition ${billingCycle === 'monthly' ? 'bg-[#071a33] text-white shadow-md' : 'text-slate-600 hover:text-[#071a33]'}`}
            >
              Pago mensual
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`rounded-xl px-5 py-3 text-sm font-black transition ${billingCycle === 'annual' ? 'bg-gradient-to-r from-blue-600 to-cyan-400 text-white shadow-md' : 'text-slate-600 hover:text-[#071a33]'}`}
            >
              Pago anual <span className="hidden sm:inline">· 1 mensualidad incluida</span>
            </button>
          </div>

          <div className="mx-auto mt-12 grid max-w-[1120px] gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pricingPlans.map((plan, index) => {
              const Icon = plan.icon;
              const displayedPrice = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
              const displayedPeriod = billingCycle === 'annual' ? '/año' : '/mes';

              return (
                <article
                  key={plan.code}
                  data-landing-reveal
                  className={`landing-reveal landing-pricing-card relative flex h-full flex-col rounded-[1.8rem] border p-6 sm:p-7 ${plan.featured ? 'border-cyan-300 bg-[#071a33] text-white shadow-[0_26px_70px_rgba(7,26,51,0.24)]' : 'border-slate-200 bg-white shadow-[0_14px_45px_rgba(15,23,42,0.07)]'}`}
                  style={{ transitionDelay: `${Math.min(index * 55, 220)}ms` }}
                >
                  {plan.featured && (
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white shadow-lg">
                      Más recomendado
                    </span>
                  )}

                  <div className={`landing-plan-icon landing-plan-icon-${plan.tone}`}>
                    <Icon className="h-5 w-5" />
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
                      <span className={`text-4xl font-black tracking-tight ${plan.featured ? 'text-white' : 'text-[#071a33]'}`}>{displayedPrice.toFixed(2)}</span>
                      <span className={`pb-1 text-sm font-bold ${plan.featured ? 'text-slate-400' : 'text-slate-500'}`}>{displayedPeriod}</span>
                    </div>
                  </div>

                  {billingCycle === 'annual' ? (
                    <p className={`mt-2 text-xs font-bold ${plan.featured ? 'text-cyan-300' : 'text-cyan-700'}`}>
                      {plan.code === 'personalizado'
                        ? `Valor referencial equivalente a $${plan.annualEquivalent.toFixed(2)} al mes`
                        : `Equivale a $${plan.annualEquivalent.toFixed(2)} al mes`}
                    </p>
                  ) : (
                    <p className={`mt-2 text-xs ${plan.featured ? 'text-slate-400' : 'text-slate-500'}`}>
                      {plan.code === 'personalizado'
                        ? 'El valor final depende del alcance aprobado.'
                        : 'Modalidad mensual sin compromiso anual.'}
                    </p>
                  )}

                  <div className={`my-6 h-px ${plan.featured ? 'bg-white/10' : 'bg-slate-200'}`} />

                  <ul className="flex-1 space-y-3">
                    {plan.features.map(feature => (
                      <li key={feature} className={`flex items-start gap-2.5 text-sm leading-6 ${plan.featured ? 'text-slate-200' : 'text-slate-600'}`}>
                        <CheckCircle2 className={`mt-1 h-4 w-4 shrink-0 ${plan.featured ? 'text-cyan-300' : 'text-cyan-600'}`} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <p className={`mt-6 rounded-xl px-3 py-3 text-xs leading-5 ${plan.featured ? 'bg-white/5 text-slate-300' : 'bg-slate-50 text-slate-500'}`}>
                    {plan.audience}
                  </p>

                  <button
                    type="button"
                    onClick={() => openContact(plan.code)}
                    className={`mt-5 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-black transition hover:-translate-y-0.5 ${plan.featured ? 'bg-gradient-to-r from-blue-600 to-cyan-400 text-white shadow-lg shadow-cyan-950/20' : 'bg-[#071a33] text-white hover:bg-blue-900'}`}
                  >
                    {plan.code === 'personalizado' ? 'Solicitar propuesta' : 'Solicitar esta edición'} <ArrowRight className="h-4 w-4" />
                  </button>
                </article>
              );
            })}
          </div>

          <div data-landing-reveal className="landing-reveal mt-8 rounded-[1.8rem] border border-cyan-100 bg-gradient-to-r from-cyan-50 to-blue-50 p-6 sm:p-8">
            <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto]">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-cyan-600 shadow-sm">
                  <ReceiptText className="h-6 w-6" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-black text-[#071a33] sm:text-2xl">Facturación electrónica integrada</h3>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-amber-700">Próximamente</span>
                  </div>
                  <p className="mt-2 max-w-3xl leading-7 text-slate-600">
                    Se incorporará como complemento cuando la conexión con el SRI esté terminada, probada y disponible para producción. Su precio se definirá según el alcance y el volumen de comprobantes.
                  </p>
                </div>
              </div>
              <span className="rounded-xl border border-cyan-200 bg-white px-5 py-3 text-center text-sm font-black text-cyan-700">No incluida todavía</span>
            </div>
          </div>

          <div data-landing-reveal className="landing-reveal mt-14 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_65px_rgba(15,23,42,0.08)]">
            <div className="border-b border-slate-200 px-6 py-6 sm:px-8">
              <h3 className="text-2xl font-black text-[#071a33]">Compara las ediciones</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">Una comparación clara de las dos ediciones estándar y la alternativa personalizada.</p>
            </div>
            <div className="overflow-x-auto">
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
        </div>
      </section>

      <section className="bg-[#f5f8fc] px-5 py-20 sm:px-8 lg:px-12 lg:py-24">
        <div className="mx-auto max-w-[1320px]">
          <div data-landing-reveal className="landing-reveal overflow-hidden rounded-[2.1rem] bg-[#071a33] p-7 text-white shadow-[0_26px_80px_rgba(7,26,51,0.24)] sm:p-10 lg:p-12">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                  <Sparkles className="h-4 w-4" /> InventIQ personalizado
                </span>
                <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">Implementación y personalización cuando tu negocio lo necesita</h2>
                <p className="mt-5 leading-8 text-slate-300">
                  Las ediciones estándar cubren la operación habitual. La migración de datos, capacitación adicional, reportes especiales y cambios específicos se revisan y cotizan por separado.
                </p>
                <button
                  type="button"
                  onClick={() => openContact('personalizado')}
                  className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-400 px-6 py-4 text-sm font-black text-white transition hover:-translate-y-0.5"
                >
                  Solicitar una propuesta <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  ['Según alcance', 'Implementación inicial', 'Carga, migración, depuración y configuración de la información del negocio.'],
                  ['Pago único', 'Personalización', 'Campos, categorías, reportes o ajustes operativos adicionales.'],
                  ['Cotización previa', 'Módulo especial', 'Integraciones, módulos nuevos o desarrollos exclusivos.'],
                ].map(([price, title, description]) => (
                  <article key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                    <p className="text-xs font-black uppercase tracking-wide text-cyan-300">{price}</p>
                    <h3 className="mt-3 text-lg font-black text-white">{title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <p data-landing-reveal className="landing-reveal mt-6 text-center text-xs leading-6 text-slate-500">
            Los precios corresponden a la propuesta comercial inicial. En InventIQ Personalizado, la suscripción parte del valor indicado y la implementación o desarrollo adicional se cotiza por separado. Los impuestos aplicables se informarán antes de contratar.
          </p>
        </div>
      </section>

      <LandingFaqSection onContact={() => openContact('por_definir')} />

      <LandingContactSection initialPlan={contactPlan} billingCycle={billingCycle} />

      <footer className="bg-[#04152d] px-5 pt-16 text-white sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="grid gap-10 border-b border-white/10 pb-12 sm:grid-cols-2 lg:grid-cols-[1.25fr_0.8fr_0.8fr_1fr]">
            <div>
              <button type="button" onClick={scrollToTop} className="flex items-center gap-3 text-left">
                <InventiQIcon className="h-12 w-12 rounded-xl object-cover" />
                <div>
                  <p className="text-xl font-black tracking-[0.14em]">INVENTI<span className="text-cyan-300">Q</span></p>
                  <p className="mt-1 text-sm text-slate-400">Gestión inteligente para tu negocio.</p>
                </div>
              </button>
              <p className="mt-6 max-w-sm text-sm leading-7 text-slate-400">
                Ventas, inventario, caja, compras, clientes y reportes en una plataforma que se adapta a diferentes tipos de negocio.
              </p>
              <a href="mailto:inventiqweb@gmail.com" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-cyan-300 transition hover:text-white">
                inventiqweb@gmail.com <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-white">Explora</p>
              <div className="mt-5 grid gap-3 text-sm text-slate-400">
                <button type="button" onClick={() => scrollToSection('funciones')} className="w-fit text-left transition hover:text-cyan-300">Funciones</button>
                <button type="button" onClick={() => scrollToSection('negocios')} className="w-fit text-left transition hover:text-cyan-300">Tipos de negocio</button>
                <button type="button" onClick={() => scrollToSection('como-funciona')} className="w-fit text-left transition hover:text-cyan-300">Cómo funciona</button>
                <button type="button" onClick={() => scrollToSection('planes')} className="w-fit text-left transition hover:text-cyan-300">Ediciones y precios</button>
                <button type="button" onClick={() => scrollToSection('preguntas')} className="w-fit text-left transition hover:text-cyan-300">Preguntas frecuentes</button>
              </div>
            </div>

            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-white">InventIQ</p>
              <div className="mt-5 grid gap-3 text-sm text-slate-400">
                <button type="button" onClick={goToLogin} className="w-fit text-left transition hover:text-cyan-300">Acceso de clientes</button>
                <button type="button" onClick={() => openContact('por_definir')} className="w-fit text-left transition hover:text-cyan-300">Solicitar demostración</button>
                <button type="button" onClick={() => openContact('personalizado')} className="w-fit text-left transition hover:text-cyan-300">Personalizaciones</button>
                <span className="w-fit text-left text-slate-500">Facturación SRI · Próximamente</span>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-cyan-300">Empieza por una demostración</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Revisa la plataforma con un ejemplo adaptado a tu actividad antes de escoger un plan.
              </p>
              <button type="button" onClick={() => openContact('por_definir')} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-400 px-4 py-3 text-sm font-black text-white transition hover:-translate-y-0.5">
                Solicitar demostración <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 py-6 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
            <p>© {new Date().getFullYear()} InventIQ. Todos los derechos reservados.</p>
            <div className="flex flex-wrap gap-x-5 gap-y-3">
              <button type="button" onClick={() => setLegalDocument('privacy')} className="transition hover:text-cyan-300">Política de privacidad</button>
              <button type="button" onClick={() => setLegalDocument('terms')} className="transition hover:text-cyan-300">Términos y condiciones</button>
              <span>Documentos preliminares</span>
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

      {phaseNotice && (
        <div className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-cyan-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-2xl" role="status">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-cyan-600"><Sparkles className="h-4 w-4" /></span>
            <p>{phaseNotice}</p>
          </div>
        </div>
      )}
    </div>
  );
}
