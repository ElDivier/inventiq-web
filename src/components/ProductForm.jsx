import { useState } from 'react';
import { Camera, Plus } from 'lucide-react';
import Field from './Field';
import BarcodeScanner from './BarcodeScanner';
import { generateInternalBarcode } from '../utils/barcode';
import { isInternalStockCategory } from '../config/productTypes';
import {
  RESTAURANT_DIETARY_TAGS,
  RESTAURANT_MENU_STATUS,
  RESTAURANT_ORDER_CHANNELS,
  RESTAURANT_SERVICE_PERIODS,
  RESTAURANT_STATIONS,
  normalizeRestaurantProductMetadata,
} from '../utils/restaurantMenu';
import {
  CAFETERIA_MENU_STATUS,
  CAFETERIA_ORDER_CHANNELS,
  CAFETERIA_STATIONS,
  CAFETERIA_TEMPERATURES,
  normalizeCafeteriaProductMetadata,
} from '../utils/cafeteriaMenu';

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
  const businessType = businessConfig?.businessType || 'general';
  const isRestaurantBusiness = businessType === 'restaurante' || businessConfig?.label === 'Restaurante';
  const isCafeteriaBusiness = businessType === 'cafeteria' || businessConfig?.label === 'Cafetería';
  const isBakeryBusiness = businessType === 'panaderia' || businessConfig?.label === 'Panadería';
  const isFoodProductMode = businessConfig?.productMode === 'menu-inventory';
  const isFoodPreparationMode = (isRestaurantBusiness || isCafeteriaBusiness) && foodFormMode === 'preparacion';
  const isFoodIngredientMode = isFoodProductMode && foodFormMode === 'insumo';
  const isFoodMenuMode = isFoodProductMode && foodFormMode === 'menu';

  const modeText = getFormTexts({
    editingId,
    isFoodIngredientMode,
    isFoodMenuMode,
    isFoodPreparationMode,
    isRestaurantBusiness,
    isBakeryBusiness,
  });

  const categoryOptions = getCategoryOptions(
    productCategories,
    foodFormMode,
    isFoodProductMode,
    businessConfig?.defaultCategories,
    businessType
  );

  function generateProductBarcode() {
    const barcodeBusinessType = businessConfig?.label === 'Tienda de ropa'
      ? 'ropa'
      : businessType;
    const code = generateInternalBarcode(barcodeBusinessType);
    setForm({ ...form, sku: form.sku || code, barcode: code });
  }

  function updateField(field, value) {
    setForm({ ...form, [field]: value });
  }

  function updateProductMetadata(field, value) {
    const metadata = isRestaurantBusiness
      ? normalizeRestaurantProductMetadata(form.productMetadata)
      : isCafeteriaBusiness
        ? normalizeCafeteriaProductMetadata(form.productMetadata)
        : (form.productMetadata || {});

    setForm({
      ...form,
      productMetadata: {
        ...metadata,
        [field]: value,
      },
    });
  }

  return (
    <form onSubmit={saveProduct} className="iq-form-panel order-1 xl:order-2">
      <div className="mb-6 flex items-center justify-between">
        <div>
          {isFoodProductMode && (
            <span className={`mb-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${
              isFoodPreparationMode
                ? 'bg-violet-50 text-violet-700'
                : isFoodIngredientMode
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-cyan-50 text-cyan-800'
            }`}>
              {isFoodPreparationMode
                ? modeText.badgePreparation
                : isFoodIngredientMode
                  ? modeText.badgeIngredient
                  : modeText.badgeMenu}
            </span>
          )}
          <h3 className="text-xl font-bold">{modeText.title}</h3>
          <p className="text-sm text-slate-500">{modeText.subtitle}</p>
        </div>

        <button type="button" onClick={resetForm} className="rounded-xl p-2 hover:bg-slate-50" aria-label="Cerrar formulario">
          ×
        </button>
      </div>

      {notice && (
        <div className={`mb-4 rounded-2xl p-4 text-sm font-semibold ${notice.type === 'success' ? 'bg-cyan-50 text-cyan-800' : 'bg-red-50 text-red-700'}`}>
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
            className="iq-input"
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

        {isFoodPreparationMode ? (
          <PreparationFields form={form} updateField={updateField} />
        ) : isFoodIngredientMode ? (
          <IngredientFields
            form={form}
            updateField={updateField}
            isRestaurantBusiness={isRestaurantBusiness}
            isBakeryBusiness={isBakeryBusiness}
          />
        ) : isFoodMenuMode ? (
          <MenuFields
            form={form}
            updateField={updateField}
            isRestaurantBusiness={isRestaurantBusiness}
            isBakeryBusiness={isBakeryBusiness}
          />
        ) : (
          <StandardFields form={form} updateField={updateField} />
        )}

        {isRestaurantBusiness && isFoodMenuMode && (
          <RestaurantMenuSettings
            metadata={normalizeRestaurantProductMetadata(form.productMetadata)}
            updateMetadata={updateProductMetadata}
          />
        )}

        {isCafeteriaBusiness && isFoodMenuMode && (
          <CafeteriaMenuSettings
            metadata={normalizeCafeteriaProductMetadata(form.productMetadata)}
            updateMetadata={updateProductMetadata}
          />
        )}

        <Field
          label="Código / SKU"
          value={form.sku}
          onChange={value => updateField('sku', value)}
          placeholder={isFoodIngredientMode || isFoodPreparationMode ? 'Ej: COC-001' : 'Ej: MENU-001'}
        />

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <Field
            label="Código de barras"
            value={form.barcode}
            onChange={value => updateField('barcode', value)}
            placeholder="Escribe el código existente o genera uno nuevo"
          />

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" onClick={generateProductBarcode} className="iq-primary-button w-full">
              <Plus className="h-4 w-4" />
              Generar código
            </button>

            <button type="button" onClick={() => setScannerOpen(true)} className="iq-secondary-button w-full">
              <Camera className="h-4 w-4" />
              Escanear existente
            </button>
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Puedes generar un código interno para INVENTIQ o escribir/escanear el código que el ítem ya trae.
          </p>

          {scannerOpen && (
            <BarcodeScanner
              onScan={value => setForm({ ...form, barcode: value, sku: form.sku || value })}
              onClose={() => setScannerOpen(false)}
            />
          )}
        </div>

        {isFoodPreparationMode ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Estación responsable"
              value={form.brand}
              onChange={value => updateField('brand', value)}
              placeholder="Ej: Cocina, parrilla, cocina fría"
            />
            <Field
              label="Unidad de stock"
              value={form.stockUnit || form.size}
              onChange={value => setForm(prev => ({ ...prev, stockUnit: value, size: value }))}
              placeholder="Ej: kg, litro, porción, bandeja"
            />
          </div>
        ) : isFoodIngredientMode ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field
              label="Proveedor / marca"
              value={form.brand}
              onChange={value => updateField('brand', value)}
              placeholder={isRestaurantBusiness ? 'Ej: mercado, distribuidor, proveedor local' : isBakeryBusiness ? 'Ej: molino, distribuidor, proveedor local' : 'Ej: Proveedor local'}
            />
            <Field
              label={isBakeryBusiness ? 'Unidad de stock / presentación' : 'Unidad de stock'}
              value={form.stockUnit || form.size}
              onChange={value => setForm(prev => ({ ...prev, stockUnit: value, size: value }))}
              placeholder={isRestaurantBusiness ? 'Ej: kg, libra, litro, unidad, caja' : 'Ej: kg, g, litro, unidad, caja'}
            />
            <Field
              label={isBakeryBusiness ? 'Uso en producción' : 'Uso en cocina'}
              value={form.color}
              onChange={value => updateField('color', value)}
              placeholder={isRestaurantBusiness ? 'Ej: parrilla, guarnición, salsa, bebida' : 'Ej: masas, rellenos, decoración, empaque'}
            />
          </div>
        ) : isFoodMenuMode ? (
          isRestaurantBusiness ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Porción / presentación"
                value={form.size}
                onChange={value => updateField('size', value)}
                placeholder="Ej: personal, familiar, plato, combo"
              />
              <Field
                label="Variante / preparación"
                value={form.color}
                onChange={value => updateField('color', value)}
                placeholder="Ej: asado, frito, al jugo, vegetariano"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field
                label={isBakeryBusiness ? 'Línea de producción' : 'Marca / proveedor'}
                value={form.brand}
                onChange={value => updateField('brand', value)}
                placeholder={isBakeryBusiness ? 'Ej: Panadería, pastelería, galletería' : 'Ej: Casa, proveedor local'}
              />
              <Field
                label={isBakeryBusiness ? 'Presentación / tamaño' : 'Tamaño / presentación'}
                value={form.size}
                onChange={value => updateField('size', value)}
                placeholder={isBakeryBusiness ? 'Ej: unidad, paquete x6, pequeño, mediano' : 'Ej: 8oz, 12oz, porción, grande'}
              />
              <Field
                label={isBakeryBusiness ? 'Variante / sabor' : 'Variante / preparación'}
                value={form.color}
                onChange={value => updateField('color', value)}
                placeholder={isBakeryBusiness ? 'Ej: integral, chocolate, vainilla, sin azúcar' : 'Ej: Caliente, frío, sin azúcar'}
              />
            </div>
          )
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

        {(isFoodIngredientMode || isFoodPreparationMode || (isBakeryBusiness && isFoodMenuMode) || (!isFoodProductMode && businessConfig?.usesExpiration)) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field
              label="Lote"
              value={form.batchNumber}
              onChange={value => updateField('batchNumber', value)}
              placeholder="Ej: LOTE-001"
            />
            <Field
              label={isBakeryBusiness && isFoodMenuMode ? 'Fecha de elaboración' : 'Fecha de ingreso'}
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
            className="iq-input min-h-24 resize-y"
            placeholder={modeText.descriptionPlaceholder}
          />
        </label>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
          {form.imageUrl ? (
            <div className="space-y-3">
              <img src={form.imageUrl} alt="Vista previa" className="mx-auto h-32 w-32 rounded-2xl object-cover shadow-sm" />
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
              <p>PNG, JPG o WEBP. INVENTIQ optimiza la imagen automáticamente.</p>
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
          <button type="button" onClick={resetForm} className="iq-secondary-button">Cancelar</button>
          <button type="submit" className="iq-primary-button">{modeText.submitLabel}</button>
        </div>
      </div>
    </form>
  );
}

function MenuFields({ form, updateField, isRestaurantBusiness, isBakeryBusiness }) {
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
          label={isRestaurantBusiness ? 'Costo estimado del plato' : isBakeryBusiness ? 'Costo estimado de producción' : 'Costo estimado'}
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
          label={isRestaurantBusiness ? 'Disponibilidad física' : isBakeryBusiness ? 'Stock terminado actual' : 'Disponible actual'}
          type="number"
          min="0"
          value={form.stock}
          onChange={value => updateField('stock', value)}
          placeholder="0"
        />
        <Field
          label={isRestaurantBusiness ? 'Mínimo operativo' : isBakeryBusiness ? 'Stock mínimo terminado' : 'Mínimo disponible'}
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

function IngredientFields({ form, updateField, isRestaurantBusiness, isBakeryBusiness }) {
  return (
    <>
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-bold">Este ítem es de uso interno.</p>
        <p className="mt-1">
          {isRestaurantBusiness
            ? 'No se mostrará en el menú de ventas. Se utilizará para compras, inventario de cocina, recetas, costos y caducidad.'
            : isBakeryBusiness
              ? 'No necesita precio de venta. Se usará para controlar materias primas, empaques, costos y producción.'
              : 'No necesita precio de venta. Se usará para controlar stock, costos y caducidad.'}
        </p>
      </div>

      <Field
        label={isRestaurantBusiness ? 'Costo de compra del insumo' : isBakeryBusiness ? 'Costo de compra / reposición' : 'Costo de compra'}
        type="number"
        min="0"
        step="0.01"
        value={form.cost}
        onChange={value => updateField('cost', value)}
        placeholder="$ 0.00"
      />

      <div className="grid grid-cols-2 gap-3">
        <Field
          label={isRestaurantBusiness ? 'Stock actual en cocina' : isBakeryBusiness ? 'Stock actual disponible' : 'Stock actual del insumo'}
          type="number"
          min="0"
          step="0.001"
          value={form.stock}
          onChange={value => updateField('stock', value)}
          placeholder="0"
        />
        <Field
          label={isRestaurantBusiness ? 'Stock mínimo en cocina' : isBakeryBusiness ? 'Stock mínimo para producción' : 'Stock mínimo del insumo'}
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

function PreparationFields({ form, updateField }) {
  return (
    <>
      <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-800">
        <p className="font-bold">Preparación intermedia de cocina.</p>
        <p className="mt-1">No se vende directamente. Podrá utilizarse dentro de recetas de platos para controlar rendimiento y costo real.</p>
      </div>

      <Field
        label="Costo estimado por unidad de stock"
        type="number"
        min="0"
        step="0.01"
        value={form.cost}
        onChange={value => updateField('cost', value)}
        placeholder="$ 0.00"
      />

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Cantidad preparada disponible"
          type="number"
          min="0"
          step="0.001"
          value={form.stock}
          onChange={value => updateField('stock', value)}
          placeholder="0"
        />
        <Field
          label="Mínimo para operación"
          type="number"
          min="0"
          step="0.001"
          value={form.minStock}
          onChange={value => updateField('minStock', value)}
          placeholder="0"
        />
      </div>
    </>
  );
}


function CafeteriaMenuSettings({ metadata, updateMetadata }) {
  return (
    <section className="rounded-3xl border border-amber-100 bg-amber-50/60 p-4">
      <div>
        <p className="text-sm font-black text-amber-950">Configuración para barra</p>
        <p className="mt-1 text-xs text-amber-800">Define tamaños, leche, temperatura y extras que el cajero podrá elegir al tomar el pedido.</p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SelectField
          label="Estado en el menú"
          value={metadata.menuStatus}
          onChange={value => updateMetadata('menuStatus', value)}
          options={CAFETERIA_MENU_STATUS}
        />
        <SelectField
          label="Estación"
          value={metadata.station}
          onChange={value => updateMetadata('station', value)}
          options={CAFETERIA_STATIONS}
        />
        <Field
          label="Tiempo objetivo (min)"
          type="number"
          min="0"
          step="1"
          value={String(metadata.preparationMinutes || '')}
          onChange={value => updateMetadata('preparationMinutes', Number(value || 0))}
          placeholder="Ej: 4"
        />
      </div>

      <CheckboxGroup
        title="Canales disponibles"
        options={CAFETERIA_ORDER_CHANNELS}
        values={metadata.orderChannels}
        onChange={values => updateMetadata('orderChannels', values)}
      />

      <CheckboxGroup
        title="Temperaturas disponibles"
        options={CAFETERIA_TEMPERATURES}
        values={metadata.temperatures}
        onChange={values => updateMetadata('temperatures', values)}
      />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <OptionListEditor
          title="Tamaños"
          hint="Ej: Mediano +$0.00, Grande +$0.75"
          values={metadata.sizes}
          onChange={values => updateMetadata('sizes', values)}
        />
        <OptionListEditor
          title="Tipos de leche"
          hint="Ej: Entera +$0.00, Almendra +$0.60"
          values={metadata.milkOptions}
          onChange={values => updateMetadata('milkOptions', values)}
        />
        <OptionListEditor
          title="Jarabes / sabores"
          hint="Ej: Vainilla +$0.50"
          values={metadata.syrupOptions}
          onChange={values => updateMetadata('syrupOptions', values)}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-amber-100 bg-white p-4">
          <div>
            <p className="text-sm font-black text-slate-800">Permitir shot extra</p>
            <p className="text-xs text-slate-500">Se ofrecerá como opción rápida en caja.</p>
          </div>
          <input
            type="checkbox"
            checked={metadata.extraShotEnabled}
            onChange={event => updateMetadata('extraShotEnabled', event.target.checked)}
            className="h-5 w-5 rounded border-slate-300"
          />
        </label>
        <Field
          label="Precio del shot extra"
          type="number"
          min="0"
          step="0.01"
          value={String(metadata.extraShotPrice || '')}
          onChange={value => updateMetadata('extraShotPrice', Number(value || 0))}
          placeholder="$ 0.00"
        />
      </div>

      <div className="mt-4">
        <Field
          label="Nota base para barra"
          value={metadata.preparationNotes}
          onChange={value => updateMetadata('preparationNotes', value)}
          placeholder="Ej: servir con doble servilleta / mezclar antes de entregar"
        />
      </div>
    </section>
  );
}

function OptionListEditor({ title, hint, values, onChange }) {
  const [label, setLabel] = useState('');
  const [price, setPrice] = useState('');
  const list = Array.isArray(values) ? values : [];

  function addOption() {
    const cleanLabel = label.trim();
    if (!cleanLabel) return;
    onChange([
      ...list,
      {
        id: `${Date.now()}-${cleanLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        label: cleanLabel,
        priceDelta: Math.max(0, Number(price || 0) || 0),
      },
    ]);
    setLabel('');
    setPrice('');
  }

  return (
    <div className="rounded-2xl border border-amber-100 bg-white p-3">
      <p className="text-sm font-black text-slate-800">{title}</p>
      <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
      <div className="mt-3 grid grid-cols-[1fr_90px] gap-2">
        <input value={label} onChange={event => setLabel(event.target.value)} className="iq-input" placeholder="Nombre" />
        <input type="number" min="0" step="0.01" value={price} onChange={event => setPrice(event.target.value)} className="iq-input" placeholder="+$" />
      </div>
      <button type="button" onClick={addOption} className="mt-2 w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-800">Agregar opción</button>
      <div className="mt-3 flex flex-wrap gap-2">
        {list.length === 0 ? (
          <span className="text-xs text-slate-400">Sin opciones configuradas.</span>
        ) : list.map((item, index) => (
          <button
            key={item.id || `${item.label}-${index}`}
            type="button"
            onClick={() => onChange(list.filter((_, itemIndex) => itemIndex !== index))}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            title="Quitar opción"
          >
            {item.label}{Number(item.priceDelta || 0) > 0 ? ` +$${Number(item.priceDelta).toFixed(2)}` : ''} ×
          </button>
        ))}
      </div>
    </div>
  );
}

function RestaurantMenuSettings({ metadata, updateMetadata }) {
  return (
    <section className="rounded-3xl border border-cyan-100 bg-cyan-50/60 p-4">
      <div>
        <p className="text-sm font-black text-cyan-950">Disponibilidad y preparación</p>
        <p className="mt-1 text-xs text-cyan-800">Define dónde se prepara, cuándo se ofrece y en qué canales puede venderse.</p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SelectField
          label="Estado en el menú"
          value={metadata.menuStatus}
          onChange={value => updateMetadata('menuStatus', value)}
          options={RESTAURANT_MENU_STATUS}
        />
        <SelectField
          label="Estación de cocina"
          value={metadata.kitchenStation}
          onChange={value => updateMetadata('kitchenStation', value)}
          options={RESTAURANT_STATIONS}
        />
        <Field
          label="Tiempo estimado (min)"
          type="number"
          min="0"
          step="1"
          value={String(metadata.preparationMinutes || '')}
          onChange={value => updateMetadata('preparationMinutes', Number(value || 0))}
          placeholder="Ej: 15"
        />
      </div>

      <CheckboxGroup
        title="Horarios de servicio"
        options={RESTAURANT_SERVICE_PERIODS}
        values={metadata.servicePeriods}
        onChange={values => updateMetadata('servicePeriods', values)}
      />

      <CheckboxGroup
        title="Canales disponibles"
        options={RESTAURANT_ORDER_CHANNELS}
        values={metadata.orderChannels}
        onChange={values => updateMetadata('orderChannels', values)}
      />

      <CheckboxGroup
        title="Etiquetas opcionales"
        options={RESTAURANT_DIETARY_TAGS}
        values={metadata.dietaryTags}
        onChange={values => updateMetadata('dietaryTags', values)}
      />

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="Alérgenos / advertencias"
          value={metadata.allergens}
          onChange={value => updateMetadata('allergens', value)}
          placeholder="Ej: contiene lácteos, gluten y frutos secos"
        />
        <Field
          label="Nota para preparación"
          value={metadata.preparationNotes}
          onChange={value => updateMetadata('preparationNotes', value)}
          placeholder="Ej: servir con guarnición y salsa aparte"
        />
      </div>
    </section>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)} className="iq-input">
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function CheckboxGroup({ title, options, values, onChange }) {
  const selected = Array.isArray(values) ? values : [];

  function toggle(value) {
    const next = selected.includes(value)
      ? selected.filter(item => item !== value)
      : [...selected, value];
    onChange(next);
  }

  return (
    <div className="mt-4">
      <p className="mb-2 text-sm font-semibold text-slate-700">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(option => {
          const active = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggle(option.value)}
              className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                active
                  ? 'border-cyan-300 bg-cyan-700 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-200'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StandardFields({ form, updateField }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Precio de venta" type="number" min="0" step="0.01" value={form.price} onChange={value => updateField('price', value)} placeholder="$ 0.00" />
        <Field label="Costo (opcional)" type="number" min="0" step="0.01" value={form.cost} onChange={value => updateField('cost', value)} placeholder="Puede quedar vacío" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Stock actual" type="number" min="0" value={form.stock} onChange={value => updateField('stock', value)} placeholder="0" />
        <Field label="Stock mínimo" type="number" min="0" value={form.minStock} onChange={value => updateField('minStock', value)} placeholder="5" />
      </div>
    </>
  );
}

function getCategoryOptions(productCategories, foodFormMode, isFoodProductMode, defaultCategories = [], businessType = 'general') {
  const categories = Array.from(new Set([
    ...(Array.isArray(defaultCategories) ? defaultCategories : []),
    ...(Array.isArray(productCategories) ? productCategories : []),
  ].filter(Boolean)));

  if (!isFoodProductMode) return categories;

  if (['restaurante', 'cafeteria'].includes(businessType)) {
    const filtered = categories.filter(category => {
      const normalized = String(category || '').trim().toLowerCase();
      if (foodFormMode === 'preparacion') {
        return normalized.startsWith('preparaciones -') || normalized.startsWith('preparación -');
      }
      if (foodFormMode === 'insumo') {
        return isInternalStockCategory(category, businessType)
          && !normalized.startsWith('preparaciones -')
          && !normalized.startsWith('preparación -');
      }
      return !isInternalStockCategory(category, businessType);
    });
    return filtered.length > 0 ? filtered : categories;
  }

  const filtered = categories.filter(category => {
    const isInternal = isInternalStockCategory(category, businessType);
    return foodFormMode === 'insumo' ? isInternal : !isInternal;
  });

  return filtered.length > 0 ? filtered : categories;
}

function getFormTexts({ editingId, isFoodIngredientMode, isFoodMenuMode, isFoodPreparationMode, isRestaurantBusiness, isBakeryBusiness }) {
  if (isFoodPreparationMode) {
    return {
      badgePreparation: 'Preparación intermedia',
      badgeIngredient: 'Insumo de cocina',
      badgeMenu: isRestaurantBusiness ? 'Plato del menú' : 'Producto del menú',
      title: editingId ? 'Editar preparación intermedia' : 'Agregar preparación intermedia',
      subtitle: editingId
        ? 'Actualiza la preparación seleccionada.'
        : isRestaurantBusiness
          ? 'Registra salsas, fondos, guarniciones, aderezos o bases que se elaboran antes del servicio.'
          : 'Registra bases de café, cold brew, cremas, salsas o preparaciones que luego se usan en bebidas y alimentos.',
      nameLabel: 'Nombre de la preparación',
      namePlaceholder: isRestaurantBusiness ? 'Ej: Salsa de la casa, fondo de pollo, arroz preparado' : 'Ej: Cold brew concentrado, crema de vainilla, salsa de chocolate',
      categoryLabel: 'Categoría de preparación',
      categoryPlaceholder: 'Seleccionar tipo de preparación',
      newCategoryPlaceholder: isRestaurantBusiness ? 'Ej: Preparaciones - Encurtidos' : 'Ej: Preparaciones - Bases frías',
      descriptionLabel: 'Descripción / método de conservación',
      descriptionPlaceholder: isRestaurantBusiness ? 'Ej: rendimiento, conservación, responsable y uso en platos...' : 'Ej: rendimiento, conservación, vida útil y bebidas donde se utiliza...',
      submitLabel: editingId ? 'Actualizar preparación' : 'Guardar preparación',
    };
  }

  if (isFoodIngredientMode) {
    if (isBakeryBusiness) {
      return {
        badgeIngredient: 'Materia prima / insumo', badgeMenu: 'Producto terminado', badgePreparation: '',
        title: editingId ? 'Editar materia prima o insumo' : 'Agregar materia prima o insumo',
        subtitle: editingId ? 'Actualiza la información del ítem seleccionado.' : 'Registra materias primas, productos intermedios, empaques o insumos de operación.',
        nameLabel: 'Nombre de la materia prima o insumo',
        namePlaceholder: 'Ej: Harina de trigo, levadura, crema pastelera, caja mediana',
        categoryLabel: 'Tipo y categoría', categoryPlaceholder: 'Seleccionar materia prima, intermedio o empaque',
        newCategoryPlaceholder: 'Ej: Materia prima - Frutos secos',
        descriptionLabel: 'Descripción / condiciones de almacenamiento',
        descriptionPlaceholder: 'Ej: proveedor, uso, conservación, presentación de compra...',
        submitLabel: editingId ? 'Actualizar ítem' : 'Guardar materia prima o insumo',
      };
    }

    return {
      badgeIngredient: 'Insumo o empaque', badgeMenu: isRestaurantBusiness ? 'Plato del menú' : 'Producto del menú', badgePreparation: '',
      title: editingId ? 'Editar insumo o empaque' : 'Agregar insumo o empaque',
      subtitle: editingId ? 'Actualiza el ítem seleccionado.' : isRestaurantBusiness ? 'Registra materia prima, bebida interna, empaque o insumo de operación.' : 'Registra una materia prima o producto interno de cocina.',
      nameLabel: 'Nombre del insumo o empaque',
      namePlaceholder: isRestaurantBusiness ? 'Ej: Pollo, arroz, tomate, aceite, envase para llevar' : 'Ej: Leche 1L, café en grano, vasos 12oz',
      categoryLabel: 'Categoría interna', categoryPlaceholder: 'Seleccionar categoría de insumo o empaque',
      newCategoryPlaceholder: isRestaurantBusiness ? 'Ej: Empaques - Salsas' : 'Ej: Insumos - Lácteos',
      descriptionLabel: 'Descripción / notas de almacenamiento',
      descriptionPlaceholder: isRestaurantBusiness ? 'Ej: proveedor, almacenamiento, rendimiento, fecha de compra...' : 'Ej: proveedor, uso, condiciones de almacenamiento...',
      submitLabel: editingId ? 'Actualizar ítem' : 'Guardar insumo o empaque',
    };
  }

  if (isFoodMenuMode) {
    if (isBakeryBusiness) {
      return {
        badgeIngredient: 'Materia prima / insumo', badgeMenu: 'Producto terminado', badgePreparation: '',
        title: editingId ? 'Editar producto terminado' : 'Agregar producto terminado',
        subtitle: editingId ? 'Actualiza el producto listo para la venta.' : 'Registra panes, tortas, galletas, bocaditos, postres u otros productos terminados.',
        nameLabel: 'Nombre del producto terminado', namePlaceholder: 'Ej: Pan de sal, torta de chocolate, galleta integral',
        categoryLabel: 'Categoría del producto terminado', categoryPlaceholder: 'Seleccionar categoría de producto terminado',
        newCategoryPlaceholder: 'Ej: Producto terminado - Panes integrales',
        descriptionLabel: 'Descripción del producto',
        descriptionPlaceholder: 'Ej: presentación, sabor, tamaño, conservación, ingredientes destacados...',
        submitLabel: editingId ? 'Actualizar producto terminado' : 'Guardar producto terminado',
      };
    }

    return {
      badgeIngredient: 'Insumo de cocina', badgeMenu: isRestaurantBusiness ? 'Plato del menú' : 'Producto del menú', badgePreparation: '',
      title: editingId ? (isRestaurantBusiness ? 'Editar plato del menú' : 'Editar producto del menú') : (isRestaurantBusiness ? 'Agregar plato al menú' : 'Agregar producto al menú'),
      subtitle: editingId ? (isRestaurantBusiness ? 'Actualiza el plato o bebida seleccionada.' : 'Actualiza el producto que vendes al cliente.') : (isRestaurantBusiness ? 'Registra platos, bebidas, entradas, postres o combos con su disponibilidad operativa.' : 'Registra una bebida, plato, postre o combo para vender.'),
      nameLabel: isRestaurantBusiness ? 'Nombre del plato o bebida' : 'Nombre del producto del menú',
      namePlaceholder: isRestaurantBusiness ? 'Ej: Almuerzo ejecutivo, hamburguesa, jugo natural' : 'Ej: Capuchino, cheesecake, sanduche, combo desayuno',
      categoryLabel: 'Categoría del menú', categoryPlaceholder: 'Seleccionar categoría del menú',
      newCategoryPlaceholder: isRestaurantBusiness ? 'Ej: Menú - Parrilla' : 'Ej: Menú - Café caliente',
      descriptionLabel: isRestaurantBusiness ? 'Descripción para el menú' : 'Descripción del producto del menú',
      descriptionPlaceholder: isRestaurantBusiness ? 'Ej: ingredientes principales, acompañantes y presentación para el cliente...' : 'Ej: ingredientes visibles, tamaño, preparación...',
      submitLabel: editingId ? (isRestaurantBusiness ? 'Actualizar plato' : 'Actualizar producto del menú') : (isRestaurantBusiness ? 'Guardar plato' : 'Guardar producto del menú'),
    };
  }

  return {
    badgeIngredient: 'Insumo de cocina', badgeMenu: 'Producto del menú', badgePreparation: '',
    title: editingId ? 'Editar producto' : 'Agregar nuevo producto',
    subtitle: editingId ? 'Actualiza la información del producto seleccionado.' : 'Registra un producto nuevo en el inventario.',
    nameLabel: 'Nombre del producto', namePlaceholder: 'Ej: Arroz 1kg',
    categoryLabel: 'Categoría', categoryPlaceholder: 'Seleccionar categoría',
    newCategoryPlaceholder: 'Ej: Mascotas', descriptionLabel: 'Descripción',
    descriptionPlaceholder: 'Descripción del producto...', submitLabel: editingId ? 'Actualizar producto' : 'Guardar producto',
  };
}
