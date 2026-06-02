import { UserPlus } from 'lucide-react';
import { businessTypes } from '../config/businessTypes';
import Field from '../components/Field';
import PasswordSecurityHint from '../components/PasswordSecurityHint';

export default function AdminPage({ form, setForm, notice, createClientAccount }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
      <form onSubmit={createClientAccount} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h3 className="flex items-center gap-2 text-xl font-extrabold text-slate-900">
            <UserPlus className="h-5 w-5 text-emerald-600" />
            Crear cuenta de cliente
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Desde aquí se crean las cuentas de las tiendas. El registro público queda desactivado para clientes.
          </p>
        </div>

        {notice && (
          <div className={`mb-4 rounded-2xl p-4 text-sm font-semibold ${notice.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {notice.message}
          </div>
        )}

        <div className="space-y-4">
          <Field
            label="Nombre del encargado"
            value={form.name}
            onChange={v => setForm({ ...form, name: v })}
            placeholder="Ej: Ana Rodríguez"
          />

          <Field
            label="Nombre de la tienda"
            value={form.store}
            onChange={v => setForm({ ...form, store: v })}
            placeholder="Ej: Gallito Store"
          />

          <Field
            label="Ciudad"
            value={form.city}
            onChange={v => setForm({ ...form, city: v })}
            placeholder="Ej: Ibarra"
          />

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Tipo de negocio</span>
            <select
              value={form.businessType}
              onChange={e => setForm({ ...form, businessType: e.target.value })}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200"
            >
              {businessTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <Field
            label="Correo del cliente"
            type="email"
            value={form.email}
            onChange={v => setForm({ ...form, email: v })}
            placeholder="Ej: cliente@email.com"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Contraseña temporal"
              type="password"
              value={form.password}
              onChange={v => setForm({ ...form, password: v })}
              placeholder="Contraseña"
            />

            <Field
              label="Confirmar"
              type="password"
              value={form.confirmPassword}
              onChange={v => setForm({ ...form, confirmPassword: v })}
              placeholder="Repetir"
            />
          </div>

          <PasswordSecurityHint />

          <button
            type="submit"
            className="w-full rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700"
          >
            Crear cuenta
          </button>
        </div>
      </form>

      <section className="rounded-3xl border border-amber-100 bg-amber-50 p-6 shadow-sm">
        <h3 className="text-xl font-extrabold text-amber-900">Importante</h3>
        <div className="mt-4 space-y-3 text-sm leading-6 text-amber-900">
          <p>El cliente ya no podrá registrarse por su cuenta desde el login.</p>
          <p>La cuenta se crea con una contraseña temporal. Luego el cliente puede cambiarla desde Configuración o usar recuperación de contraseña.</p>
          <p>Para máxima seguridad, más adelante conviene mover esta creación a una función segura de Supabase, para que el panel no dependa de registro público.</p>
        </div>
      </section>
    </div>
  );
}