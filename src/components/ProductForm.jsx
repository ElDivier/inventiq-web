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
  foodFormMode = 'menu',
}) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const isNewCategory = form.category === '__new__';
  const extraLabels = businessConfig?.extraLabels || {};
  const isRestaurantBusiness = businessConfig?.label === 'Restaurante';
  const isFoodProductMode = businessConfig?.productMode === 'menu-inventory';
  const isFoodIngredientMode = isFoodProductMode && foodFormMode === 'insumo';
  const isFoodMenuMode = isFoodProductMode && foodFormMode !== 'insumo';

  const modeText = getFormTexts({
    editingId,
    isFoodProductMode,
    isFoodIngredientMode,
    isFoodMenuMode,
    isRestaurantBusiness,
  });

  const categoryOptions = getCategoryOptions(
    productCategories,
    foodFormMode,
    isFoodProductMode,
    businessConfig?.defaultCategories
  );

  function generateProductBarcode() {
    const businessType = businessConfig?.label === 'Tienda de ropa'
      ? 'ropa'
      : isRestaurantBusiness
        ? 'restaurante'
        : 'general';
    const code = generateInternalBarcode(businessType);
    setForm({ ...form, sku: form.sku || code, barcode: code });
  }

  function updateField(field, value) {
    setForm({ ...form, [field]: value });
  }

  return (
    <form onSubmit={saveProduct} className="order-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:order-2">
      <div className="mb-6 flex items-center justify-between">
        <div>
          {isFoodProductMode && (
            <span className={`mb-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${isFoodIngredientMode ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {isFoodIngredientMode ? modeText.badgeIngredient : modeText.badgeMenu}
            </span>
          )}
          <h3 className="text-xl font-bold">{modeText.title}</h3>
          <p className="text-sm text-slate-500">{modeText.subtitle}</p>
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
          label={modeText.nameLabel}
          value={form.name}
          onChange={value => updateField('name', value)}
          placeholder={modeText.namePlaceholder}
        />

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">{modeText.categoryLabel}</span>
          <select
            value={form.category}
            onChange={event => updateField('category', event.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200"
          >
            <option value="">{modeText.categoryPlaceholder}</option>
            {categoryOptions.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
            <option value="__new__">+ Crear nueva categoría</option>
          </select>
        </label>

        {isNewCategory && (
          <Field
            label="Nueva categoría"
            value={form.customCategory}
            onChange={value => updateField('customCategory', value)}
            placeholder={modeText.newCategoryPlaceholder}
          />
        )}

        {isFoodIngredientMode ? (
          <IngredientFields form={form} updateField={updateField} isRestaurantBusiness={isRestaurantBusiness} />
        ) : isFoodMenuMode ? (
          <MenuFields form={form} updateField={updateField} isRestaurantBusiness={isRestaurantBusiness} />
        ) : (
          <StandardFields form={form} updateField={updateField} />
        )}

        <Field
          label="Código / SKU"
          value={form.sku}
          onChange={value => updateField('sku', value)}
          placeholder={isFoodIngredientMode ? 'Ej: INS-001' : 'Ej: PROD001'}
        />

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <Field
            label="Código de barras"
            value={form.barcode}
            onChange={value => updateField('barcode', value)}
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
            Puedes generar un código interno para InventiQ o escribir/escanear el código que el ítem ya trae.
          </p>

          {scannerOpen && (
            <BarcodeScanner
              onScan={value => setForm({ ...form, barcode: value, sku: form.sku || value })}
              onClose={() => setScannerOpen(false)}
            />
          )}
        </div>

        {isFoodIngredientMode ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field
              label="Proveedor / marca"
              value={form.brand}
              onChange={value => updateField('brand', value)}
              placeholder={isRestaurantBusiness ? 'Ej: proveedor de carnes, mercado, distribuidor' : 'Ej: Proveedor local, Supermaxi'}
            />

            <Field
              label="Unidad / presentación"
              value={form.size}
              onChange={value => updateField('size', value)}
              placeholder={isRestaurantBusiness ? 'Ej: kg, libra, caja, paquete, litro' : 'Ej: 1L, kg, caja, paquete'}
            />

            <Field
              label="Uso en cocina"
              value={form.color}
              onChange={value => updateField('color', value)}
              placeholder={isRestaurantBusiness ? 'Ej: plato fuerte, guarnición, salsa, bebida' : 'Ej: Bebidas calientes, postres'}
            />
          </div>
        ) : isFoodMenuMode ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field
              label={isRestaurantBusiness ? 'Área / línea' : 'Marca / proveedor'}
              value={form.brand}
              onChange={value => updateField('brand', value)}
              placeholder={isRestaurantBusiness ? 'Ej: Cocina, parrilla, bar, postres' : 'Ej: Casa, proveedor local'}
            />

            <Field
              label={isRestaurantBusiness ? 'Porción / presentación' : 'Tamaño / presentación'}
              value={form.size}
              onChange={value => updateField('size', value)}
              placeholder={isRestaurantBusiness ? 'Ej: personal, familiar, 1 plato, combo' : 'Ej: 8oz, 12oz, porción, grande'}
            />

            <Field
              label={isRestaurantBusiness ? 'Tipo / preparación' : 'Variante / preparación'}
              value={form.color}
              onChange={value => updateField('color', value)}
              placeholder={isRestaurantBusiness ? 'Ej: asado, frito, al jugo, vegetariano' : 'Ej: Caliente, frío, sin azúcar'}
            />
          </div>
        ) : businessConfig?.productExtraFields && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field
              label={extraLabels.brand?.label || 'Marca'}
              value={form.brand}
              onChange={value => updateField('brand', value)}
              placeholder={extraLabels.brand?.placeholder || 'Ej: Marca'}
            />

            <Field
              label={extraLabels.size?.label || 'Talla / medida'}
              value={form.size}
              onChange={value => updateField('size', value)}
              placeholder={extraLabels.size?.placeholder || 'Ej: M / 32 / 1/2'}
            />

            <Field
              label={extraLabels.color?.label || 'Color / modelo'}
              value={form.color}
              onChange={value => updateField('color', value)}
              placeholder={extraLabels.color?.placeholder || 'Ej: Negro'}
            />
          </div>
        )}

        {(isFoodIngredientMode || (!isFoodProductMode && businessConfig?.usesExpiration)) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field
              label="Lote"
              value={form.batchNumber}
              onChange={value => updateField('batchNumber', value)}
              placeholder="Ej: LOTE-001"
            />

            <Field
              label="Fecha de ingreso"
              type="date"
              value={form.entryDate}
              onChange={value => updateField('entryDate', value)}
            />

            <Field
              label="Fecha de caducidad"
              type="date"
              value={form.expirationDate}
              onChange={value => updateField('expirationDate', value)}
            />
          </div>
        )}

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">{modeText.descriptionLabel}</span>
          <textarea
            value={form.description}
            onChange={event => updateField('description', event.target.value)}
            className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200"
            placeholder={modeText.descriptionPlaceholder}
          />
        </label>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
          {form.imageUrl ? (
            <div className="space-y-3">
              <img
                src={form.imageUrl}
                alt="Vista previa"
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
            onChange={event => handleProductImage(event.target.files?.[0])}
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
            {modeText.submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

function MenuFields({ form, updateField, isRestaurantBusiness }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Precio de venta"
          type="number"
          min="0"
          step="0.01"
          value={form.price}
          onChange={value => updateField('price', value)}
          placeholder="$ 0.00"
        />

        <Field
          label={isRestaurantBusiness ? 'Costo estimado del plato' : 'Costo estimado'}
          type="number"
          min="0"
          step="0.01"
          value={form.cost}
          onChange={value => updateField('cost', value)}
          placeholder={isRestaurantBusiness ? 'Costo de preparación' : 'Costo aproximado'}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label={isRestaurantBusiness ? 'Disponible para vender' : 'Disponible actual'}
          type="number"
          min="0"
          value={form.stock}
          onChange={value => updateField('stock', value)}
          placeholder="0"
        />

        <Field
          label={isRestaurantBusiness ? 'Mínimo operativo' : 'Mínimo disponible'}
          type="number"
          min="0"
          value={form.minStock}
          onChange={value => updateField('minStock', value)}
          placeholder="0"
        />
      </div>
    </>
  );
}

function IngredientFields({ form, updateField, isRestaurantBusiness }) {
  return (
    <>
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-bold">Este ítem es un insumo interno.</p>
        <p className="mt-1">
          {isRestaurantBusiness
            ? 'No necesita precio de venta. Se usará para stock de cocina, costos por receta y caducidad.'
            : 'No necesita precio de venta. Se usará para controlar stock, costos y caducidad.'}
        </p>
      </div>

      <Field
        label={isRestaurantBusiness ? 'Costo de compra del insumo' : 'Costo de compra'}
        type="number"
        min="0"
        step="0.01"
        value={form.cost}
        onChange={value => updateField('cost', value)}
        placeholder="$ 0.00"
      />

      <div className="grid grid-cols-2 gap-3">
        <Field
          label={isRestaurantBusiness ? 'Stock actual en cocina' : 'Stock actual del insumo'}
          type="number"
          min="0"
          step="0.001"
          value={form.stock}
          onChange={value => updateField('stock', value)}
          placeholder="0"
        />

        <Field
          label={isRestaurantBusiness ? 'Stock mínimo en cocina' : 'Stock mínimo del insumo'}
          type="number"
          min="0"
          step="0.001"
          value={form.minStock}
          onChange={value => updateField('minStock', value)}
          placeholder="3"
        />
      </div>
    </>
  );
}

function StandardFields({ form, updateField }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Precio de venta"
          type="number"
          min="0"
          step="0.01"
          value={form.price}
          onChange={value => updateField('price', value)}
          placeholder="$ 0.00"
        />

        <Field
          label="Costo (opcional)"
          type="number"
          min="0"
          step="0.01"
          value={form.cost}
          onChange={value => updateField('cost', value)}
          placeholder="Puede quedar vacío"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Stock actual"
          type="number"
          min="0"
          value={form.stock}
          onChange={value => updateField('stock', value)}
          placeholder="0"
        />

        <Field
          label="Stock mínimo"
          type="number"
          min="0"
          value={form.minStock}
          onChange={value => updateField('minStock', value)}
          placeholder="5"
        />
      </div>
    </>
  );
}

function getCategoryOptions(productCategories, foodFormMode, isFoodProductMode, defaultCategories = []) {
  const categories = Array.from(new Set([
    ...(Array.isArray(defaultCategories) ? defaultCategories : []),
    ...(Array.isArray(productCategories) ? productCategories : []),
  ].filter(Boolean)));

  if (!isFoodProductMode) return categories;

  const filtered = categories.filter(category => {
    const text = String(category || '').toLowerCase();
    if (foodFormMode === 'insumo') return text.includes('insumos');
    return !text.includes('insumos');
  });

  return filtered.length > 0 ? filtered : categories;
}

function getFormTexts({ editingId, isFoodProductMode, isFoodIngredientMode, isFoodMenuMode, isRestaurantBusiness }) {
  if (isFoodIngredientMode) {
    return {
      badgeIngredient: 'Insumo de cocina',
      badgeMenu: isRestaurantBusiness ? 'Plato del menú' : 'Producto del menú',
      title: editingId ? 'Editar insumo' : 'Agregar insumo',
      subtitle: editingId
        ? 'Actualiza el insumo seleccionado.'
        : isRestaurantBusiness
          ? 'Registra materia prima, bebidas, empaques o insumos de cocina.'
          : 'Registra una materia prima o producto interno de cocina.',
      nameLabel: 'Nombre del insumo',
      namePlaceholder: isRestaurantBusiness
        ? 'Ej: Pollo, arroz, tomate, aceite, servilletas'
        : 'Ej: Leche 1L, café en grano, vasos 12oz',
      categoryLabel: 'Categoría del insumo',
      categoryPlaceholder: 'Seleccionar categoría de insumo',
      newCategoryPlaceholder: isRestaurantBusiness ? 'Ej: Insumos - Carnes' : 'Ej: Insumos - Lácteos',
      descriptionLabel: 'Descripción / notas del insumo',
      descriptionPlaceholder: isRestaurantBusiness
        ? 'Ej: proveedor, almacenamiento, rendimiento, fecha de compra...'
        : 'Ej: proveedor, uso, condiciones de almacenamiento...',
      submitLabel: editingId ? 'Actualizar insumo' : 'Guardar insumo',
    };
  }

  if (isFoodMenuMode) {
    return {
      badgeIngredient: 'Insumo de cocina',
      badgeMenu: isRestaurantBusiness ? 'Plato del menú' : 'Producto del menú',
      title: editingId
        ? isRestaurantBusiness ? 'Editar plato del menú' : 'Editar producto del menú'
        : isRestaurantBusiness ? 'Agregar plato al menú' : 'Agregar producto al menú',
      subtitle: editingId
        ? isRestaurantBusiness ? 'Actualiza el plato o bebida seleccionada.' : 'Actualiza el producto que vendes al cliente.'
        : isRestaurantBusiness ? 'Registra platos, bebidas, entradas, postres o combos para vender.' : 'Registra una bebida, plato, postre o combo para vender.',
      nameLabel: isRestaurantBusiness ? 'Nombre del plato o bebida' : 'Nombre del producto del menú',
      namePlaceholder: isRestaurantBusiness
        ? 'Ej: Almuerzo ejecutivo, hamburguesa, jugo natural'
        : 'Ej: Capuchino, cheesecake, sanduche, combo desayuno',
      categoryLabel: 'Categoría del menú',
      categoryPlaceholder: 'Seleccionar categoría del menú',
      newCategoryPlaceholder: isRestaurantBusiness ? 'Ej: Menú - Platos fuertes' : 'Ej: Menú - Café caliente',
      descriptionLabel: isRestaurantBusiness ? 'Descripción del plato' : 'Descripción del producto del menú',
      descriptionPlaceholder: isRestaurantBusiness
        ? 'Ej: ingredientes principales, acompañantes, porción, preparación...'
        : 'Ej: ingredientes visibles, tamaño, preparación...',
      submitLabel: editingId
        ? isRestaurantBusiness ? 'Actualizar plato' : 'Actualizar producto del menú'
        : isRestaurantBusiness ? 'Guardar plato' : 'Guardar producto del menú',
    };
  }

  return {
    badgeIngredient: 'Insumo de cocina',
    badgeMenu: 'Producto del menú',
    title: editingId ? 'Editar producto' : 'Agregar nuevo producto',
    subtitle: editingId ? 'Actualiza la información del producto seleccionado.' : 'Registra un producto nuevo en el inventario.',
    nameLabel: 'Nombre del producto',
    namePlaceholder: 'Ej: Arroz 1kg',
    categoryLabel: 'Categoría',
    categoryPlaceholder: 'Seleccionar categoría',
    newCategoryPlaceholder: 'Ej: Mascotas',
    descriptionLabel: 'Descripción',
    descriptionPlaceholder: 'Descripción del producto...',
    submitLabel: editingId ? 'Actualizar producto' : 'Guardar producto',
  };
}
