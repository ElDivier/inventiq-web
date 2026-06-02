import { Camera, Lock, ReceiptText, Save, Store } from 'lucide-react';
import { businessTypes } from '../config/businessTypes';
import Field from '../components/Field';
import StoreAvatar from '../components/StoreAvatar';
import PasswordSecurityHint from '../components/PasswordSecurityHint';

export default function SettingsPage({
  currentUser,
  settingsForm,
  setSettingsForm,
  saveSettings,
  settingsNotice,
  handleStoreLogo,
}) {
  return (
    <form onSubmit={saveSettings} className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <div className="space-y-5">
        {settingsNotice && (
          <div className={`rounded-2xl p-4 text-sm font-semibold ${settingsNotice.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {settingsNotice.message}
          </div>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-5 flex items-center gap-2 text-xl font-bold">
            <Store className="h-5 w-5 text-emerald-600" />
            Datos de la tienda
          </h3>

          <div className="space-y-4">
            <Field
              label="Nombre de la tienda"
              value={settingsForm.store}
              onChange={v => setSettingsForm({ ...settingsForm, store: v })}
              placeholder="Nombre de la tienda"
            />

            <Field
              label="Propietario / encargado"
              value={settingsForm.name}
              onChange={v => setSettingsForm({ ...settingsForm, name: v })}
              placeholder="Nombre del encargado"
            />

            <Field
              label="Ciudad"
              value={settingsForm.city}
              onChange={v => setSettingsForm({ ...settingsForm, city: v })}
              placeholder="Ciudad"
            />

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Tipo de negocio</span>
              <select
                value={settingsForm.businessType}
                disabled
                className="w-full cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500 outline-none"
              >
                {businessTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="RUC / Identificación del negocio"
                value={settingsForm.businessId}
                onChange={v => setSettingsForm({ ...settingsForm, businessId: v })}
                placeholder="Ej: 1000000001"
              />

              <Field
                label="Teléfono / WhatsApp"
                value={settingsForm.phone}
                onChange={v => setSettingsForm({ ...settingsForm, phone: v })}
                placeholder="Ej: 0999999999"
              />
            </div>

            <Field
              label="Dirección"
              value={settingsForm.address}
              onChange={v => setSettingsForm({ ...settingsForm, address: v })}
              placeholder="Dirección de la tienda"
            />

            <Field
              label="Correo comercial"
              type="email"
              value={settingsForm.commercialEmail}
              onChange={v => setSettingsForm({ ...settingsForm, commercialEmail: v })}
              placeholder="ventas@mitienda.com"
            />

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700"
            >
              <Save className="h-5 w-5" />
              Guardar cambios
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-5 flex items-center gap-2 text-xl font-bold">
            <Lock className="h-5 w-5 text-emerald-600" />
            Seguridad de cuenta
          </h3>

          <div className="space-y-4">
            <Field
              label="Correo de acceso"
              type="email"
              value={settingsForm.username}
              onChange={v => setSettingsForm({ ...settingsForm, username: v })}
              placeholder="correo@email.com"
            />

            <Field
              label="Contraseña actual"
              type="password"
              value={settingsForm.currentPassword}
              onChange={v => setSettingsForm({ ...settingsForm, currentPassword: v })}
              placeholder="Contraseña actual"
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Nueva contraseña"
                type="password"
                value={settingsForm.newPassword}
                onChange={v => setSettingsForm({ ...settingsForm, newPassword: v })}
                placeholder="Nueva contraseña"
              />

              <Field
                label="Confirmar nueva contraseña"
                type="password"
                value={settingsForm.confirmNewPassword}
                onChange={v => setSettingsForm({ ...settingsForm, confirmNewPassword: v })}
                placeholder="Repetir contraseña"
              />
            </div>

            <PasswordSecurityHint />

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700"
            >
              <Save className="h-5 w-5" />
              Guardar cambios
            </button>
          </div>
        </section>
      </div>

      <aside className="space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-5 flex items-center gap-2 text-xl font-bold">
            <Camera className="h-5 w-5 text-emerald-600" />
            Logo de la tienda
          </h3>

          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            {settingsForm.logoUrl ? (
              <div>
                <img
                  src={settingsForm.logoUrl}
                  alt="Logo de tienda"
                  className="mx-auto h-24 w-24 rounded-3xl object-cover shadow-sm"
                />
                <p className="mt-3 font-semibold text-slate-700">Logo cargado</p>
                <button
                  type="button"
                  onClick={() => setSettingsForm({ ...settingsForm, logoUrl: '', logoFile: null })}
                  className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Quitar logo
                </button>
              </div>
            ) : (
              <div>
                <div className="flex justify-center">
                  <StoreAvatar currentUser={currentUser} size="lg" />
                </div>
                <p className="mt-3 font-semibold text-slate-700">Logo de tienda</p>
                <p>Si no subes logo, se mostrará la inicial de la tienda o encargado.</p>
              </div>
            )}

            <input
              type="file"
              accept="image/*"
              onChange={e => handleStoreLogo(e.target.files?.[0])}
              className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
            />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-5 flex items-center gap-2 text-xl font-bold">
            <ReceiptText className="h-5 w-5 text-emerald-600" />
            Comprobante
          </h3>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Texto al pie del comprobante
            </span>
            <textarea
              value={settingsForm.receiptFooter}
              onChange={e => setSettingsForm({ ...settingsForm, receiptFooter: e.target.value })}
              className="min-h-20 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="Ej: Gracias por su compra."
            />
          </label>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-5 flex items-center gap-2 text-xl font-bold">
            <Lock className="h-5 w-5 text-emerald-600" />
            Privacidad y seguridad
          </h3>

          <div className="space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-800">
              <p className="font-bold text-emerald-900">Privacidad activa</p>
              <p className="mt-1">
                La información de esta tienda se mantiene separada de otros usuarios mediante políticas de seguridad en la base de datos.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 text-slate-700">
              <p className="font-bold text-slate-900">Datos protegidos por cuenta</p>
              <p className="mt-1">
                Tus productos, ventas, compras, clientes y proveedores solo pertenecen a tu usuario.
                InventiQ usa reglas de seguridad en Supabase para separar la información de cada tienda.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 p-4">
                <p className="font-bold text-slate-900">Contraseña segura</p>
                <p className="mt-1 text-slate-500">
                  Usa una contraseña única con mayúsculas, minúsculas, números y caracteres especiales.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-100 p-4">
                <p className="font-bold text-slate-900">Correo de recuperación</p>
                <p className="mt-1 text-slate-500">
                  Mantén actualizado tu correo de acceso para recuperar tu cuenta si olvidas la contraseña.
                </p>
              </div>
            </div>
          </div>
        </section>
      </aside>
    </form>
  );
}