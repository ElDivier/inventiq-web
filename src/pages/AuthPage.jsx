import { useState } from 'react';
import {
  Package,
  ShoppingCart,
  BarChart3,
} from 'lucide-react';
import Field from '../components/Field';
import InventiQIcon from '../components/InventiQIcon';
import PasswordSecurityHint from '../components/PasswordSecurityHint';
export default function AuthPage({ authMode, setAuthMode, loginForm, setLoginForm, registerForm, setRegisterForm, authNotice, setAuthNotice, login, register, resetEmail, setResetEmail, resetPassword, resetPasswordForm, setResetPasswordForm, updateRecoveredPassword }) {
  const isLogin = authMode === 'login';
  const isReset = authMode === 'reset';
  const isUpdatePassword = authMode === 'update-password';
  const [privacyOpen, setPrivacyOpen] = useState(false);

  function switchMode(mode) {
    setAuthMode(mode);
    setAuthNotice(null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-teal-800 to-emerald-500 p-4 text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_440px]">
        <section className="hidden text-white lg:block">
          <div className="mb-8 flex items-center gap-4">
            <InventiQIcon className="h-20 w-20 rounded-3xl object-cover shadow-xl" />
            <div>
              <h1 className="text-5xl font-extrabold">InventiQ</h1>
              <p className="mt-2 text-lg text-emerald-100">Gestión inteligente de inventarios para tiendas.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-white/10 p-5 backdrop-blur"><Package className="mb-3 h-7 w-7 text-emerald-200" /><h3 className="font-bold">Inventario</h3><p className="mt-2 text-sm text-emerald-50">Controla productos, stock y alertas.</p></div>
            <div className="rounded-3xl bg-white/10 p-5 backdrop-blur"><ShoppingCart className="mb-3 h-7 w-7 text-emerald-200" /><h3 className="font-bold">Ventas</h3><p className="mt-2 text-sm text-emerald-50">Registra ventas y descuenta stock.</p></div>
            <div className="rounded-3xl bg-white/10 p-5 backdrop-blur"><BarChart3 className="mb-3 h-7 w-7 text-emerald-200" /><h3 className="font-bold">Reportes</h3><p className="mt-2 text-sm text-emerald-50">Analiza rotación, utilidad y compras.</p></div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-7 shadow-2xl sm:p-9">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex justify-center">
              <InventiQIcon className="h-24 w-24 rounded-3xl object-cover shadow-lg" />
            </div>
            <h2 className="text-3xl font-extrabold">{isUpdatePassword ? 'Crear nueva contraseña' : isReset ? 'Recuperar contraseña' : isLogin ? 'Iniciar sesión' : 'Crear cuenta'}</h2>
            <p className="mt-2 text-sm text-slate-500">{isUpdatePassword ? 'Ingresa una nueva contraseña para recuperar el acceso.' : isReset ? 'Ingresa tu correo y te enviaremos un enlace de recuperación.' : isLogin ? 'Ingresa para acceder al panel de tu tienda.' : 'Registra tu tienda para usar InventiQ.'}</p>
          </div>

          {authNotice && (
            <div className={`mb-5 rounded-2xl p-4 text-sm font-semibold ${authNotice.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {authNotice.message}
            </div>
          )}

          {isUpdatePassword ? (
            <form onSubmit={updateRecoveredPassword} className="space-y-4">
              <Field label="Nueva contraseña" type="password" value={resetPasswordForm.password} onChange={v => setResetPasswordForm({ ...resetPasswordForm, password: v })} placeholder="Mínimo 8 caracteres" />
              <Field label="Confirmar nueva contraseña" type="password" value={resetPasswordForm.confirmPassword} onChange={v => setResetPasswordForm({ ...resetPasswordForm, confirmPassword: v })} placeholder="Repetir contraseña" />
              <PasswordSecurityHint />
              <button type="submit" className="w-full rounded-2xl bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800">Actualizar contraseña</button>
              <button type="button" onClick={() => switchMode('login')} className="w-full rounded-2xl border border-slate-200 px-5 py-3 font-bold text-slate-600 hover:bg-slate-50">Volver al login</button>
              <p className="rounded-2xl bg-slate-50 p-3 text-center text-xs text-slate-500">Después de actualizarla, vuelve a iniciar sesión con tu nueva contraseña.</p>
            </form>
          ) : isReset ? (
            <form onSubmit={resetPassword} className="space-y-4">
              <Field label="Correo electrónico" type="email" value={resetEmail} onChange={setResetEmail} placeholder="Ej: tienda@email.com" />
              <button type="submit" className="w-full rounded-2xl bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800">Enviar enlace de recuperación</button>
              <button type="button" onClick={() => switchMode('login')} className="w-full rounded-2xl border border-slate-200 px-5 py-3 font-bold text-slate-600 hover:bg-slate-50">Volver al login</button>
              <p className="rounded-2xl bg-slate-50 p-3 text-center text-xs text-slate-500">El correo puede tardar unos minutos. Revisa también la carpeta de spam.</p>
            </form>
          ) : isLogin ? (
            <form onSubmit={login} className="space-y-4">
              <Field label="Correo electrónico" type="email" value={loginForm.username} onChange={v => setLoginForm({ ...loginForm, username: v })} placeholder="Ej: tienda@email.com" />
              <Field label="Contraseña" type="password" value={loginForm.password} onChange={v => setLoginForm({ ...loginForm, password: v })} placeholder="Tu contraseña" />
              <button type="submit" className="w-full rounded-2xl bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800">Ingresar</button>
              <button type="button" onClick={() => { setResetEmail(loginForm.username || ''); switchMode('reset'); }} className="w-full rounded-2xl border border-transparent px-5 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50">¿Olvidaste tu contraseña?</button>
              <p className="rounded-2xl bg-slate-50 p-3 text-center text-xs text-slate-500">El registro público está desactivado. Las cuentas son creadas por el administrador de InventiQ.</p>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                El registro público está desactivado. Solicita al administrador de InventiQ la creación de tu cuenta.
              </div>
              <button type="button" onClick={() => switchMode('login')} className="w-full rounded-2xl border border-slate-200 px-5 py-3 font-bold text-slate-600 hover:bg-slate-50">Volver al login</button>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-slate-500">
            <button type="button" onClick={() => setPrivacyOpen(true)} className="text-emerald-700 hover:underline">Política de privacidad</button>
            <span>·</span>
            <span>InventiQ protege la información por cuenta.</span>
          </div>
        </section>
      </div>

      {privacyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-extrabold text-slate-900">Política de privacidad</h3>
                <p className="text-sm text-slate-500">Resumen simple para usuarios de InventiQ.</p>
              </div>
              <button type="button" onClick={() => setPrivacyOpen(false)} className="rounded-xl px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50">Cerrar</button>
            </div>
            <div className="space-y-4 text-sm leading-6 text-slate-600">
              <p><strong>Datos que se registran:</strong> productos, inventario, ventas, compras, clientes, proveedores y datos generales de la tienda.</p>
              <p><strong>Uso de la información:</strong> la información se usa para control interno, reportes, comprobantes, inventario, facturación referencial y administración del negocio.</p>
              <p><strong>Separación por cuenta:</strong> cada usuario accede únicamente a la información registrada en su propia cuenta mediante reglas de seguridad en la base de datos.</p>
              <p><strong>Responsabilidad del usuario:</strong> no compartas tu contraseña y registra datos de clientes solo cuando sean necesarios para ventas, facturación o control interno.</p>
              <p><strong>Recuperación de acceso:</strong> usa un correo real para poder restablecer tu contraseña si pierdes el acceso.</p>
            </div>
            <button type="button" onClick={() => setPrivacyOpen(false)} className="mt-5 w-full rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700">Entendido</button>
          </div>
        </div>
      )}
    </div>
  );
}
