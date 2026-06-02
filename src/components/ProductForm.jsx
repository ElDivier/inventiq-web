import { useState } from 'react';
import { Camera, Plus } from 'lucide-react';
import Field from './Field';
import BarcodeScanner from './BarcodeScanner';
import { generateInternalBarcode } from '../utils/barcode';

export default function ProductForm({
  businessConfig,
  form,
  setForm,
  saveProduct,
  resetForm,
  editingId,
  notice,
  productCategories,
  handleProductImage,
}) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const isNewCategory = form.category === '__new__';
  const extraLabels = businessConfig?.extraLabels || {};

  function generateProductBarcode() {
    const businessType = businessConfig?.label === 'Tienda de ropa' ? 'ropa' : 'general';
    const code = generateInternalBarcode(businessType);
    setForm({ ...form, sku: form.sku || code, barcode: code });
  }

  return (
    <form onSubmit={saveProduct} className="order-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:order-2">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">
            {editingId ? 'Editar producto' : 'Agregar nuevo producto'}
          </h3>
          <p className="text-sm text-slate-500">
            {editingId ? 'Actualiza la información del producto seleccionado.' : 'Registra un producto nuevo en el inventario.'}
          </p>
        </div>

        <button type="button" onClick={resetForm} className="rounded-xl p-2 hover:bg-slate-50">
          ×
        </button>
      </div>

      {notice && (
        <div className={`mb-4 rounded-2xl p-4 text-sm font-semibold ${notice.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {notice.message}
        </div>
      )}

      <div className="space-y-4">
        <Field
          label="Nombre del producto"
          value={form.name}
          onChange={v => setForm({ ...form, name: v })}
          placeholder={businessConfig?.productNamePlaceholder || 'Ej: Arroz 1kg'}
        />

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Categoría</span>
          <select
            value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200"
          >
            <option value="">Seleccionar categoría</option>
            {productCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
            <option value="__new__">+ Crear nueva categoría</option>
          </select>
        </label>

        {isNewCategory && (
          <Field
            label="Nueva categoría"
            value={form.customCategory}
            onChange={v => setForm({ ...form, customCategory: v })}
            placeholder={businessConfig?.categoryPlaceholder || 'Ej: Mascotas'}
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Precio de venta"
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={v => setForm({ ...form, price: v })}
            placeholder="$ 0.00"
          />

          <Field
            label="Costo (opcional)"
            type="number"
            min="0"
            step="0.01"
            value={form.cost}
            onChange={v => setForm({ ...form, cost: v })}
            placeholder="Puede quedar vacío"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Stock actual"
            type="number"
            min="0"
            value={form.stock}
            onChange={v => setForm({ ...form, stock: v })}
            placeholder="0"
          />

          <Field
            label="Stock mínimo"
            type="number"
            min="0"
            value={form.minStock}
            onChange={v => setForm({ ...form, minStock: v })}
            placeholder="5"
          />
        </div>

        <Field
          label="Código / SKU"
          value={form.sku}
          onChange={v => setForm({ ...form, sku: v })}
          placeholder="Ej: PROD001"
        />

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <Field
            label="Código de barras"
            value={form.barcode}
            onChange={v => setForm({ ...form, barcode: v })}
            placeholder="Escribe el código existente o genera uno nuevo"
          />

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={generateProductBarcode}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Generar código
            </button>

            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
            >
              <Camera className="h-4 w-4" />
              Escanear existente
            </button>
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Puedes generar un código interno para InventiQ o escribir/escanear el código que el producto ya trae.
          </p>

          {scannerOpen && (
            <BarcodeScanner
              onScan={value => setForm({ ...form, barcode: value, sku: form.sku || value })}
              onClose={() => setScannerOpen(false)}
            />
          )}
        </div>

        {businessConfig?.productExtraFields && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field
              label={extraLabels.brand?.label || 'Marca'}
              value={form.brand}
              onChange={v => setForm({ ...form, brand: v })}
              placeholder={extraLabels.brand?.placeholder || 'Ej: Marca'}
            />

            <Field
              label={extraLabels.size?.label || 'Talla / medida'}
              value={form.size}
              onChange={v => setForm({ ...form, size: v })}
              placeholder={extraLabels.size?.placeholder || 'Ej: M / 32 / 1/2'}
            />

            <Field
              label={extraLabels.color?.label || 'Color / modelo'}
              value={form.color}
              onChange={v => setForm({ ...form, color: v })}
              placeholder={extraLabels.color?.placeholder || 'Ej: Negro'}
            />
          </div>
        )}

        {businessConfig?.usesExpiration && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field
              label="Lote"
              value={form.batchNumber}
              onChange={v => setForm({ ...form, batchNumber: v })}
              placeholder="Ej: LOTE-001"
            />

            <Field
              label="Fecha de ingreso"
              type="date"
              value={form.entryDate}
              onChange={v => setForm({ ...form, entryDate: v })}
            />

            <Field
              label="Fecha de caducidad"
              type="date"
              value={form.expirationDate}
              onChange={v => setForm({ ...form, expirationDate: v })}
            />
          </div>
        )}

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Descripción</span>
          <textarea
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200"
            placeholder="Descripción del producto..."
          />
        </label>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
          {form.imageUrl ? (
            <div className="space-y-3">
              <img
                src={form.imageUrl}
                alt="Vista previa del producto"
                className="mx-auto h-32 w-32 rounded-2xl object-cover shadow-sm"
              />

              <button
                type="button"
                onClick={() => setForm({ ...form, imageUrl: '', imageFile: null })}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Quitar imagen
              </button>
            </div>
          ) : (
            <div>
              <p className="font-semibold text-slate-700">Subir imagen</p>
              <p>PNG, JPG o WEBP. InventiQ optimiza la imagen automáticamente.</p>
            </div>
          )}

          <input
            type="file"
            accept="image/*"
            onChange={e => handleProductImage(e.target.files?.[0])}
            className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={resetForm}
            className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold hover:bg-slate-50"
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700"
          >
            {editingId ? 'Actualizar producto' : 'Guardar producto'}
          </button>
        </div>
      </div>
    </form>
  );
}