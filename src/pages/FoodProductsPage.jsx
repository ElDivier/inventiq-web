import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  Coffee,
  Download,
  Edit,
  Package,
  Printer,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import ProductForm from '../components/ProductForm';
import FoodRecipeModal from '../components/FoodRecipeModal';
import ExcelImportPreviewModal from '../components/ExcelImportPreviewModal';
import { downloadProductExcelTemplate } from '../utils/excel';
import { getBusinessConfig } from '../config/businessTypes';
import { getProductVariantText } from '../utils/products';
import { printProductBarcodeLabel } from '../utils/barcode';

const DEFAULT_LABEL_WIDTH = 51;
const DEFAULT_LABEL_HEIGHT = 25;

const FOOD_EMPTY_FORM = {
  name: '',
  category: '',
  customCategory: '',
  price: '',
  cost: '',
  stock: '0',
  minStock: '0',
  sku: '',
  barcode: '',
  brand: '',
  size: '',
  color: '',
  description: '',
  batchNumber: '',
  entryDate: '',
  expirationDate: '',
  imageUrl: '',
  imageFile: null,
};

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function cleanCategoryLabel(category) {
  return String(category || 'Sin categoría')
    .replace(/^Menú -\s*/i, '')
    .replace(/^Insumos -\s*/i, '');
}

function isIngredientProduct(product) {
  const category = String(product.category || '').trim().toLowerCase();
  return category.startsWith('insumos -') || category.includes('insumos');
}

function isMenuProduct(product) {
  return !isIngredientProduct(product);
}

function getExpirationLabel(product, expirationText) {
  if (typeof expirationText !== 'function') return null;
  const result = expirationText(product);
  if (!result) return null;
  if (typeof result === 'string') return result;
  return result.label || null;
}

export default function FoodProductsPage({
  currentUser,
  setEditingId,
  setNotice,
  products,
  setProducts,
  filtered,
  categories,
  productCategories,
  customProductCategories,
  setCustomProductCategories,
  category,
  setCategory,
  form,
  setForm,
  saveProduct,
  resetForm,
  editProduct,
  editingId,
  notice,
  deleteProduct,
  pendingDeleteId,
  setPendingDeleteId,
  statusText,
  expirationText,
  totalProducts,
  lowStock,
  noStock,
  inventoryValue,
  handleProductImage,
  productsLoading,
  importProductsFromExcel,
  excelImportPreview,
  confirmExcelImport,
  cancelExcelImport,
  excelImportProgress,
}) {
  const [view, setView] = useState('menu');
  const [search, setSearch] = useState('');
  const [foodCategory, setFoodCategory] = useState('Todas');
  const [foodFormMode, setFoodFormMode] = useState('menu');
  const [recipeProduct, setRecipeProduct] = useState(null);
  const formRef = useRef(null);

  const businessType = currentUser?.businessType || 'cafeteria';
  const businessConfig = getBusinessConfig(businessType);

  const menuProducts = useMemo(
    () => products.filter(isMenuProduct),
    [products]
  );

  const ingredientProducts = useMemo(
    () => products.filter(isIngredientProduct),
    [products]
  );

  const activeProducts = view === 'insumos' ? ingredientProducts : menuProducts;

  const activeCategories = useMemo(() => {
    const unique = Array.from(new Set(
      activeProducts
        .map(product => product.category)
        .filter(Boolean)
    ));

    return ['Todas', ...unique];
  }, [activeProducts]);

  const visibleProducts = useMemo(() => {
    const text = search.trim().toLowerCase();

    return activeProducts.filter(product => {
      const matchCategory = foodCategory === 'Todas' || product.category === foodCategory;
      const matchSearch = !text || [
        product.name,
        product.category,
        product.sku,
        product.barcode,
        product.brand,
        product.size,
        product.color,
        product.description,
      ].some(value => String(value || '').toLowerCase().includes(text));

      return matchCategory && matchSearch;
    });
  }, [activeProducts, foodCategory, search]);

  const expiringProducts = useMemo(() => {
    if (!businessConfig.usesExpiration) return [];
    return products.filter(product => {
      const label = getExpirationLabel(product, expirationText);
      return ['Por vencer', 'Vence pronto'].includes(label);
    });
  }, [businessConfig.usesExpiration, products, expirationText]);

  function selectView(nextView) {
    setView(nextView);
    setFoodCategory('Todas');
    setPendingDeleteId(null);
  }

  function focusProductForm() {
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  function handleEditProduct(product) {
    setFoodFormMode(isIngredientProduct(product) ? 'insumo' : 'menu');
    editProduct(product);
    focusProductForm();
  }

  function prepareMenuForm() {
    setEditingId(null);
    setNotice(null);
    setPendingDeleteId(null);
    setFoodFormMode('menu');
    setView('menu');
    setForm({
      ...FOOD_EMPTY_FORM,
      category: 'Menú - Café caliente',
      minStock: '0',
    });
    focusProductForm();
  }

  function prepareIngredientForm() {
    setEditingId(null);
    setNotice(null);
    setPendingDeleteId(null);
    setFoodFormMode('insumo');
    setView('insumos');
    setForm({
      ...FOOD_EMPTY_FORM,
      category: 'Insumos - Café',
      minStock: '3',
    });
    focusProductForm();
  }

  function printLabel(product) {
    printProductBarcodeLabel(product, {
      labelWidth: DEFAULT_LABEL_WIDTH,
      labelHeight: DEFAULT_LABEL_HEIGHT,
    });
  }

  function openRecipe(product) {
    setRecipeProduct(product);
  }

  function handleRecipeChange(productId, recipeEnabled) {
    if (typeof setProducts !== 'function') return;

    setProducts(prevProducts =>
      prevProducts.map(product =>
        product.id === productId
          ? { ...product, recipeEnabled, recipe_enabled: recipeEnabled }
          : product
      )
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <FoodMetric icon={Package} title="Total ítems" value={products.length} detail="menú e insumos" tone="emerald" />
        <FoodMetric icon={Coffee} title="Menú" value={menuProducts.length} detail="productos de venta" tone="amber" />
        <FoodMetric icon={Package} title="Insumos" value={ingredientProducts.length} detail="uso interno" tone="blue" />
        <FoodMetric icon={AlertTriangle} title="Stock bajo" value={lowStock} detail="ítems" tone="red" />
        <FoodMetric icon={CalendarDays} title="Por vencer" value={expiringProducts.length} detail="perecibles" tone="amber" />
      </section>

      {productsLoading && (
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          Cargando menú e insumos desde Supabase...
        </div>
      )}

      <section className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-5 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-amber-600">Cafetería / restaurante</p>
            <h3 className="mt-1 text-2xl font-black text-slate-900">Menú e insumos</h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Administra por separado los productos que vendes al cliente y los insumos que usas en cocina.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-3xl border border-white/80 bg-white/80 p-2 shadow-sm">
            <FoodViewButton
              title="Menú"
              detail={`${menuProducts.length} productos`}
              active={view === 'menu'}
              onClick={() => selectView('menu')}
            />
            <FoodViewButton
              title="Insumos"
              detail={`${ingredientProducts.length} insumos`}
              active={view === 'insumos'}
              onClick={() => selectView('insumos')}
            />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-extrabold text-emerald-900">
              <Upload className="h-5 w-5" /> Importar menú e insumos desde Excel
            </h3>
            <p className="mt-1 text-sm text-emerald-800">
              Usa categorías como Menú - Café caliente, Menú - Postres, Insumos - Lácteos o Insumos - Desechables.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => downloadProductExcelTemplate(businessType)}
              className="rounded-2xl border border-emerald-200 bg-white px-5 py-3 text-center text-sm font-bold text-emerald-700 hover:bg-emerald-50"
            >
              <Download className="mr-2 inline h-4 w-4" /> Descargar formato
            </button>
            <label className="cursor-pointer rounded-2xl bg-emerald-600 px-5 py-3 text-center text-sm font-bold text-white hover:bg-emerald-700">
              Seleccionar Excel
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) importProductsFromExcel(file);
                  event.target.value = '';
                }}
              />
            </label>
          </div>
        </div>
      </section>

      {excelImportPreview && (
        <ExcelImportPreviewModal
          preview={excelImportPreview}
          progress={excelImportProgress}
          onConfirm={confirmExcelImport}
          onCancel={cancelExcelImport}
        />
      )}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  {view === 'menu' ? 'Productos del menú' : 'Insumos de cocina'}
                </h3>
                <p className="text-sm text-slate-500">
                  {view === 'menu'
                    ? 'Productos que se venden al cliente en la caja rápida.'
                    : 'Materias primas, materiales y productos internos.'}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={prepareMenuForm}
                  className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 hover:bg-emerald-100"
                >
                  Agregar al menú
                </button>
                <button
                  type="button"
                  onClick={prepareIngredientForm}
                  className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-black text-amber-700 hover:bg-amber-100"
                >
                  Agregar insumo
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_260px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder={view === 'menu' ? 'Buscar producto del menú...' : 'Buscar insumo...'}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <select
                value={foodCategory}
                onChange={event => setFoodCategory(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-emerald-100"
              >
                {activeCategories.map(item => (
                  <option key={item} value={item}>{item === 'Todas' ? 'Todas las categorías' : item}</option>
                ))}
              </select>
            </div>
          </div>

          {view === 'menu' ? (
            <MenuGrid
              products={visibleProducts}
              pendingDeleteId={pendingDeleteId}
              setPendingDeleteId={setPendingDeleteId}
              editProduct={handleEditProduct}
              deleteProduct={deleteProduct}
              printLabel={printLabel}
              openRecipe={openRecipe}
            />
          ) : (
            <IngredientsList
              products={visibleProducts}
              pendingDeleteId={pendingDeleteId}
              setPendingDeleteId={setPendingDeleteId}
              editProduct={handleEditProduct}
              deleteProduct={deleteProduct}
              printLabel={printLabel}
              expirationText={expirationText}
            />
          )}
        </div>

        <div ref={formRef}>
          <ProductForm
            businessConfig={businessConfig}
            form={form}
            setForm={setForm}
            saveProduct={saveProduct}
            resetForm={resetForm}
            editingId={editingId}
            notice={notice}
            productCategories={productCategories}
            handleProductImage={handleProductImage}
            foodFormMode={foodFormMode}
          />
        </div>
      </section>

      {recipeProduct && (
        <FoodRecipeModal
          currentUser={currentUser}
          menuProduct={recipeProduct}
          ingredients={ingredientProducts}
          onClose={() => setRecipeProduct(null)}
          onRecipeChange={handleRecipeChange}
        />
      )}
    </div>
  );
}

function MenuGrid({ products, pendingDeleteId, setPendingDeleteId, editProduct, deleteProduct, printLabel, openRecipe }) {
  if (products.length === 0) {
    return (
      <EmptyFoodState
        title="No hay productos del menú"
        text="Agrega productos como capuchino, latte, postres, sanduches o combos."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {products.map(product => {
        const isPendingDelete = pendingDeleteId === product.id;

        return (
          <div key={product.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start gap-3">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="h-16 w-16 rounded-2xl object-cover ring-1 ring-slate-100" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                  <Coffee className="h-7 w-7" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-black text-slate-900">{product.name}</p>
                <p className="mt-1 text-xs font-bold text-slate-400">{cleanCategoryLabel(product.category)}</p>
                {getProductVariantText(product) && (
                  <p className="mt-1 text-xs text-slate-400">{getProductVariantText(product)}</p>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-2xl font-black text-emerald-700">{formatMoney(product.price)}</p>
                <p className="text-xs text-slate-400">Existencia: {product.stock}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${Number(product.stock || 0) > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {Number(product.stock || 0) > 0 ? 'Disponible' : 'Sin stock'}
              </span>
            </div>

            <FoodCardActions
              product={product}
              isPendingDelete={isPendingDelete}
              setPendingDeleteId={setPendingDeleteId}
              editProduct={editProduct}
              deleteProduct={deleteProduct}
              printLabel={printLabel}
              openRecipe={openRecipe}
              showRecipeButton
            />
          </div>
        );
      })}
    </div>
  );
}

function IngredientsList({ products, pendingDeleteId, setPendingDeleteId, editProduct, deleteProduct, printLabel, expirationText }) {
  if (products.length === 0) {
    return (
      <EmptyFoodState
        title="No hay insumos registrados"
        text="Agrega insumos como café, leche, azúcar, vasos, tapas o servilletas."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="hidden bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 lg:grid lg:grid-cols-[1.3fr_0.9fr_0.7fr_0.7fr_0.8fr_140px] lg:gap-3">
        <span>Insumo</span>
        <span>Categoría</span>
        <span>Costo</span>
        <span>Existencia</span>
        <span>Caducidad</span>
        <span className="text-right">Acciones</span>
      </div>

      <div className="divide-y divide-slate-100">
        {products.map(product => {
          const isPendingDelete = pendingDeleteId === product.id;
          const expirationLabel = getExpirationLabel(product, expirationText) || 'Sin caducidad';

          return (
            <div key={product.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1.3fr_0.9fr_0.7fr_0.7fr_0.8fr_140px] lg:items-center lg:gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">{product.name}</p>
                <p className="mt-1 text-xs text-slate-400">{product.sku || 'Sin SKU'} {product.barcode ? `· ${product.barcode}` : ''}</p>
                {getProductVariantText(product) && (
                  <p className="mt-1 text-xs text-slate-400">{getProductVariantText(product)}</p>
                )}
              </div>

              <div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                  {cleanCategoryLabel(product.category)}
                </span>
              </div>

              <div className="text-sm font-bold text-slate-700">{formatMoney(product.cost)}</div>

              <div className="text-sm text-slate-600">
                <span className="font-black text-slate-900">{product.stock}</span>
                <span className="text-slate-400"> / mín. {product.minStock}</span>
              </div>

              <div className="text-sm font-bold text-slate-500">{expirationLabel}</div>

              <FoodCardActions
                product={product}
                isPendingDelete={isPendingDelete}
                setPendingDeleteId={setPendingDeleteId}
                editProduct={editProduct}
                deleteProduct={deleteProduct}
                printLabel={printLabel}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FoodCardActions({ product, isPendingDelete, setPendingDeleteId, editProduct, deleteProduct, printLabel, openRecipe, showRecipeButton = false }) {
  return (
    <div className="mt-4 flex items-center justify-end gap-2 lg:mt-0">
      {isPendingDelete ? (
        <>
          <button
            type="button"
            onClick={() => deleteProduct(product.id)}
            className="rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white hover:bg-red-700"
          >
            Sí
          </button>
          <button
            type="button"
            onClick={() => setPendingDeleteId(null)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
          >
            No
          </button>
        </>
      ) : (
        <>
          {showRecipeButton && (
            <button
              type="button"
              onClick={() => openRecipe?.(product)}
              className="rounded-xl border border-amber-100 p-2 text-amber-600 hover:bg-amber-50"
              title="Configurar receta"
            >
              <BookOpen className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => printLabel(product)}
            className="rounded-xl border border-emerald-100 p-2 text-emerald-600 hover:bg-emerald-50"
            title="Imprimir etiqueta"
          >
            <Printer className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editProduct(product)}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-emerald-600"
            title="Editar"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setPendingDeleteId(product.id)}
            className="rounded-xl border border-red-100 p-2 text-red-400 hover:bg-red-50 hover:text-red-600"
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}

function FoodViewButton({ title, detail, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-5 py-4 text-center transition ${active ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
    >
      <span className="block text-sm font-black">{title}</span>
      <span className={`mt-1 block text-xs font-bold ${active ? 'text-emerald-50' : 'text-slate-400'}`}>{detail}</span>
    </button>
  );
}

function FoodMetric({ icon: Icon, title, value, detail, tone }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    red: 'bg-red-50 text-red-600 border-red-100',
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{detail}</p>
        </div>
        <div className={`rounded-2xl border p-3 ${tones[tone] || tones.emerald}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function EmptyFoodState({ title, text }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
      <Package className="mx-auto h-10 w-10 text-slate-300" />
      <h4 className="mt-3 text-lg font-black text-slate-700">{title}</h4>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
    </div>
  );
}
