import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import InventiQIcon from '../components/InventiQIcon';
import {
  lookupRestaurantEmployeeAccess,
  loginRestaurantEmployee,
} from '../utils/restaurantEmployeeAccess';
import { getRestaurantRolePreset } from '../utils/restaurantPermissions';

function roleTone(role) {
  return ({
    administrador: 'border-violet-200 bg-violet-50 text-violet-700',
    supervisor: 'border-blue-200 bg-blue-50 text-blue-700',
    cajero: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    mesero: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    cocina: 'border-amber-200 bg-amber-50 text-amber-700',
    barista: 'border-orange-200 bg-orange-50 text-orange-700',
  })[role] || 'border-slate-200 bg-slate-50 text-slate-700';
}

export default function EmployeeLoginPage({ onBackToAdmin, onBackToLanding, onAuthenticated }) {
  const [accessCode, setAccessCode] = useState('');
  const [password, setPassword] = useState('');
  const [business, setBusiness] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  const profiles = useMemo(() => Array.isArray(business?.profiles) ? business.profiles : [], [business]);
  const selected = useMemo(() => profiles.find((item) => item.id === selectedId) || null, [profiles, selectedId]);

  async function validateBusiness(event) {
    event.preventDefault();
    if (!accessCode.trim() || !password) {
      setNotice({ type: 'error', message: 'Ingresa el código del negocio y la contraseña de acceso.' });
      return;
    }

    setLoading(true);
    setNotice(null);
    try {
      const data = await lookupRestaurantEmployeeAccess({ accessCode, password });
      setBusiness(data);
      setSelectedId(data.profiles?.[0]?.id || '');
      setPin('');
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }

  async function loginEmployee(event) {
    event.preventDefault();
    if (!selectedId || !/^\d{4,6}$/.test(pin)) {
      setNotice({ type: 'error', message: 'Selecciona tu perfil e ingresa tu PIN de 4 a 6 números.' });
      return;
    }

    setLoading(true);
    setNotice(null);
    try {
      const authResult = await loginRestaurantEmployee({
        accessCode,
        password,
        profileId: selectedId,
        pin,
      });
      await onAuthenticated?.(authResult);
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }

  function restartAccess() {
    setBusiness(null);
    setSelectedId('');
    setPin('');
    setNotice(null);
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#031126] via-[#071f3f] to-cyan-600 p-4 text-slate-900">
      {onBackToLanding && (
        <button type="button" onClick={onBackToLanding} className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15 sm:left-7 sm:top-7">
          <ArrowLeft className="h-4 w-4" /> Volver al inicio
        </button>
      )}

      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-8 pt-14 lg:grid-cols-[1fr_460px] lg:pt-0">
        <section className="hidden text-white lg:block">
          <div className="mb-8 flex items-center gap-4">
            <InventiQIcon className="h-20 w-20 rounded-3xl object-cover shadow-xl" />
            <div>
              <h1 className="text-5xl font-black tracking-[0.08em]">INVENTI<span className="text-cyan-300">Q</span></h1>
              <p className="mt-2 text-lg text-cyan-100">Acceso operativo para restaurantes y cafeterías.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              <div className="flex items-start gap-3"><Building2 className="mt-0.5 h-6 w-6 text-cyan-200" /><div><h3 className="font-black">1. Identifica el negocio</h3><p className="mt-1 text-sm leading-6 text-cyan-50/90">Usa el código y la contraseña de acceso que te entrega el administrador.</p></div></div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              <div className="flex items-start gap-3"><UsersRound className="mt-0.5 h-6 w-6 text-cyan-200" /><div><h3 className="font-black">2. Selecciona tu perfil</h3><p className="mt-1 text-sm leading-6 text-cyan-50/90">Elige tu nombre dentro del equipo del negocio.</p></div></div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              <div className="flex items-start gap-3"><KeyRound className="mt-0.5 h-6 w-6 text-cyan-200" /><div><h3 className="font-black">3. Ingresa tu PIN</h3><p className="mt-1 text-sm leading-6 text-cyan-50/90">INVENTIQ abre únicamente las funciones habilitadas para tu rol.</p></div></div>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-7 shadow-2xl sm:p-9">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-cyan-50 text-cyan-700 shadow-sm"><UsersRound className="h-9 w-9" /></div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-700">Restaurante y Cafetería · Acceso del equipo</p>
            <h2 className="mt-2 text-3xl font-extrabold">{business ? business.storeName : 'Ingresar como empleado'}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{business ? 'Selecciona tu perfil e ingresa el PIN que te asignó el administrador.' : 'Acceso exclusivo para equipos de restaurantes y cafeterías. No necesitas el correo ni la contraseña del propietario.'}</p>
          </div>

          {notice && (
            <div className={`mb-5 rounded-2xl p-4 text-sm font-semibold ${notice.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{notice.message}</div>
          )}

          {!business ? (
            <form onSubmit={validateBusiness} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">Código del negocio</span>
                <div className="relative"><Building2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input autoFocus value={accessCode} onChange={(e) => setAccessCode(e.target.value)} className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-4 font-semibold outline-none focus:ring-2 focus:ring-cyan-100" placeholder="Ej: cland destino" autoComplete="organization" /></div>
                <p className="mt-1.5 text-xs font-semibold text-slate-400">El administrador puede configurarlo con el nombre del restaurante o un código corto.</p>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">Contraseña de acceso del equipo</span>
                <div className="relative"><LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-4 font-semibold outline-none focus:ring-2 focus:ring-cyan-100" placeholder="Contraseña del negocio" autoComplete="current-password" /></div>
              </label>
              <button type="submit" disabled={loading} className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 font-black text-white hover:from-blue-700 hover:to-cyan-600 disabled:opacity-50">{loading ? 'Validando...' : 'Continuar'}</button>
            </form>
          ) : (
            <form onSubmit={loginEmployee} className="space-y-5">
              <div className="rounded-3xl border border-cyan-100 bg-cyan-50 p-4">
                <div className="flex items-center gap-3"><BadgeCheck className="h-5 w-5 text-cyan-700" /><div><p className="font-black text-cyan-950">Negocio verificado</p><p className="text-xs font-semibold text-cyan-700">{business.businessTypeLabel || 'Negocio gastronómico'} · acceso de empleados</p></div></div>
              </div>

              {profiles.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-7 text-center">
                  <UsersRound className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 font-black text-slate-800">No hay perfiles activos</p>
                  <p className="mt-1 text-sm text-slate-500">El administrador debe crear integrantes desde Equipo y permisos.</p>
                </div>
              ) : (
                <div>
                  <p className="mb-3 text-sm font-black text-slate-700">¿Quién está usando este dispositivo?</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {profiles.map((profile) => {
                      const preset = getRestaurantRolePreset(profile.role);
                      const active = selectedId === profile.id;
                      return (
                        <button key={profile.id} type="button" onClick={() => { setSelectedId(profile.id); setPin(''); setNotice(null); }} className={`rounded-2xl border p-4 text-left transition ${active ? 'border-cyan-300 bg-cyan-50 ring-2 ring-cyan-100' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                          <div className="flex items-center gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${roleTone(profile.role)}`}><UserRound className="h-5 w-5" /></span><div className="min-w-0"><p className="truncate font-black text-slate-900">{profile.name}</p><p className="mt-0.5 text-xs font-bold text-slate-500">{preset.label}</p></div></div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selected && (
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700">PIN de {selected.name}</span>
                  <div className="relative"><KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input autoFocus inputMode="numeric" type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-4 text-lg font-black tracking-[0.32em] outline-none focus:ring-2 focus:ring-cyan-100" placeholder="••••" autoComplete="off" /></div>
                </label>
              )}

              <button type="submit" disabled={loading || !selected} className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 font-black text-white hover:from-blue-700 hover:to-cyan-600 disabled:opacity-50">{loading ? 'Abriendo turno...' : 'Entrar a mi turno'}</button>
              <button type="button" onClick={restartAccess} className="w-full rounded-2xl border border-slate-200 px-5 py-3 font-black text-slate-600 hover:bg-slate-50">Cambiar de negocio</button>
            </form>
          )}

          <div className="mt-6 border-t border-slate-100 pt-5">
            <button type="button" onClick={onBackToAdmin} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"><ShieldCheck className="h-4 w-4" /> Ingresar como administrador</button>
          </div>
        </section>
      </div>
    </div>
  );
}
