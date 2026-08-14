import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, LockKeyhole, RefreshCw, ShieldCheck, UserRound, UsersRound, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { fetchRestaurantStaff, verifyRestaurantStaffPin } from '../utils/restaurantStaff';
import { getRestaurantRolePreset } from '../utils/restaurantPermissions';

export default function RestaurantOperatorSwitcher({ open, ownerUser, currentOperator, onClose, onOperatorChange }) {
  const [staff, setStaff] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [pin, setPin] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [mode, setMode] = useState('staff');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  const activeStaff = useMemo(() => staff.filter((item) => item.isActive), [staff]);

  const loadStaff = useCallback(async () => {
    if (!ownerUser?.id) return;
    setLoading(true);
    try {
      const rows = await fetchRestaurantStaff(ownerUser.id);
      setStaff(rows);
      setSelectedId((current) => current || rows.find((item) => item.isActive)?.id || '');
    } catch (error) {
      setNotice({ type: 'error', message: `No se pudo cargar el equipo: ${error.message}` });
    } finally {
      setLoading(false);
    }
  }, [ownerUser?.id]);

  useEffect(() => {
    if (!open) return;
    setPin('');
    setOwnerPassword('');
    setNotice(null);
    setMode(currentOperator ? 'staff' : 'staff');
    loadStaff();
  }, [open, currentOperator, loadStaff]);

  if (!open) return null;

  async function activateStaff(event) {
    event.preventDefault();
    if (!selectedId || !pin) {
      setNotice({ type: 'error', message: 'Selecciona un operador e ingresa su PIN.' });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const operator = await verifyRestaurantStaffPin(selectedId, pin);
      onOperatorChange(operator);
      onClose();
    } catch (error) {
      setNotice({ type: 'error', message: error.message || 'PIN incorrecto.' });
    } finally {
      setLoading(false);
    }
  }

  async function activateOwner(event) {
    event.preventDefault();
    if (!currentOperator) {
      onOperatorChange(null);
      onClose();
      return;
    }
    if (!ownerPassword) {
      setNotice({ type: 'error', message: 'Ingresa la contraseña de la cuenta para volver a Administrador.' });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: ownerUser.email,
        password: ownerPassword,
      });
      if (error) throw new Error('La contraseña de administrador no es correcta.');
      onOperatorChange(null);
      onClose();
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[30px] bg-white p-5 shadow-2xl sm:rounded-[30px] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">Control de turno</p>
            <h3 className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-950"><UsersRound className="h-6 w-6" /> Cambiar operador</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">Cada integrante entra con su PIN y ve únicamente los módulos habilitados para su perfil.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X className="h-5 w-5" /></button>
        </div>

        {notice && <div className={`mt-4 rounded-2xl border p-3 text-sm font-bold ${notice.type === 'error' ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>{notice.message}</div>}

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
          <button type="button" onClick={() => { setMode('staff'); setNotice(null); }} className={`rounded-xl px-3 py-2.5 text-sm font-black ${mode === 'staff' ? 'bg-white text-cyan-800 shadow-sm' : 'text-slate-500'}`}><UserRound className="mr-1.5 inline h-4 w-4" /> Equipo</button>
          <button type="button" onClick={() => { setMode('owner'); setNotice(null); }} className={`rounded-xl px-3 py-2.5 text-sm font-black ${mode === 'owner' ? 'bg-white text-cyan-800 shadow-sm' : 'text-slate-500'}`}><ShieldCheck className="mr-1.5 inline h-4 w-4" /> Administrador</button>
        </div>

        {mode === 'staff' ? (
          <form onSubmit={activateStaff} className="mt-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black text-slate-700">Selecciona quién inicia el turno</p>
              <button type="button" onClick={loadStaff} disabled={loading} className="inline-flex items-center gap-1.5 text-xs font-black text-cyan-700"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar</button>
            </div>

            {activeStaff.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-7 text-center">
                <KeyRound className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 font-black text-slate-800">No hay perfiles activos</p>
                <p className="mt-1 text-sm text-slate-500">Entra como Administrador y crea integrantes desde Equipo y permisos.</p>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {activeStaff.map((member) => {
                  const selected = selectedId === member.id;
                  const preset = getRestaurantRolePreset(member.role);
                  return (
                    <button type="button" key={member.id} onClick={() => { setSelectedId(member.id); setPin(''); }} className={`rounded-2xl border p-4 text-left transition ${selected ? 'border-cyan-300 bg-cyan-50 ring-2 ring-cyan-100' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                      <p className="font-black text-slate-900">{member.name}</p>
                      <p className="mt-1 text-xs font-bold text-cyan-700">{preset.label}</p>
                    </button>
                  );
                })}
              </div>
            )}

            {activeStaff.length > 0 && (
              <label className="block"><span className="mb-2 block text-sm font-black text-slate-700">PIN</span><div className="relative"><LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input autoFocus inputMode="numeric" type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-4 text-lg font-black tracking-[0.35em] outline-none focus:ring-2 focus:ring-cyan-100" placeholder="••••" /></div></label>
            )}

            <button type="submit" disabled={loading || activeStaff.length === 0} className="w-full rounded-2xl bg-cyan-700 px-5 py-3 font-black text-white hover:bg-cyan-800 disabled:opacity-40">Entrar al turno</button>
          </form>
        ) : (
          <form onSubmit={activateOwner} className="mt-5 space-y-4">
            <div className="rounded-3xl border border-cyan-100 bg-cyan-50 p-5 text-cyan-950">
              <p className="font-black">Administrador / propietario</p>
              <p className="mt-1 text-sm leading-6 text-cyan-800">Tiene acceso completo a configuración, costos, reportes, anulaciones y permisos del equipo.</p>
            </div>
            {currentOperator && <label className="block"><span className="mb-2 block text-sm font-black text-slate-700">Contraseña de la cuenta</span><input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-cyan-100" placeholder="Contraseña de INVENTIQ" /></label>}
            <button type="submit" disabled={loading} className="w-full rounded-2xl bg-slate-950 px-5 py-3 font-black text-white hover:bg-slate-900 disabled:opacity-40">Usar modo Administrador</button>
          </form>
        )}
      </div>
    </div>
  );
}
