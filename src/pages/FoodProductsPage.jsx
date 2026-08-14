import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  ChefHat,
  Clock3,
  Coffee,
  Download,
  Edit,
  Layers3,
  Package,
  Printer,
  Search,
  Trash2,
  Upload,
  UtensilsCrossed,
  Wheat,
} from 'lucide-react';
import ProductForm from '../components/ProductForm';
import FoodRecipeModal from '../components/FoodRecipeModal';
import ExcelImportPreviewModal from '../components/ExcelImportPreviewModal';
import { downloadProductExcelTemplate } from '../utils/excel';
import { getBusinessConfig } from '../config/businessTypes';
import { getProductVariantText } from '../utils/products';
import { printProductBarcodeLabel } from '../utils/barcode';
import { cleanOperationalCategoryLabel, isInternalStockCategory } from '../config/productTypes';
import {
  getRestaurantChannelLabels,
  getRestaurantProductRole,
  getRestaurantServiceLabels,
  getRestaurantStationLabel,
  getRestaurantStatusMeta,
  normalizeRestaurantProductMetadata,
} from '../utils/restaurantMenu';
import {
  getCafeteriaMenuStatusLabel,
  getCafeteriaStationLabel,
  normalizeCafeteriaProductMetadata,
} from '../utils/cafeteriaMenu';
import { isCafeteriaPreparation } from '../utils/cafeteriaRecipes';

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
  stockUnit: '',
  productMetadata: {},
};

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function cleanCategoryLabel(category) {
  return cleanOperationalCategoryLabel(category);
}

function isIngredientProduct(product, businessType) {
  if (businessType === 'restaurante') {
    return getRestaurantProductRole(product) === 'supply';
  }
  return isInternalStockCategory(product?.category, businessType);
}

function isPreparationProduct(product, businessType) {
  if (businessType === 'restaurante') return getRestaurantProductRole(product) === 'preparation';
  if (businessType === 'cafeteria') return isCafeteriaPreparation(product);
  return false;
}

function isMenuProduct(product, businessType) {
  if (businessType === 'restaurante') {
    return getRestaurantProductRole(product) === 'menu';
  }
  return !isIngredientProduct(product, businessType);
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
  productCategories,
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
  expirationText,
  lowStock,
  handleProductImage,
  productsLoading,
  importProductsFromExcel,
  excelImportPreview,
  confirmExcelImport,
  cancelExcelImport,
  excelImportProgress,
  setActive,
}) {
  const [view, setView] = useState('menu');
  const [search, setSearch] = useState('');
  const [foodCategory, setFoodCategory] = useState('Todas');
  const [foodFormMode, setFoodFormMode] = useState('menu');
  const [recipeProduct, setRecipeProduct] = useState(null);
  const formRef = useRef(null);

  const businessType = currentUser?.businessType || 'cafeteria';
  const businessConfig = getBusinessConfig(businessType);
  const pageText = getFoodProductsPageTexts(businessType, businessConfig);
  const isRestaurant = businessType === 'restaurante';
  const isCafeteria = businessType === 'cafeteria';

  const menuProducts = useMemo(
    () => products.filter(product => isMenuProduct(product, businessType)),
    [products, businessType]
  );

  const preparationProducts = useMemo(
    () => products.filter(product => isPreparationProduct(product, businessType)),
    [products, businessType]
  );

  const ingredientProducts = useMemo(
    () => products.filter(product => isIngredientProduct(product, businessType)),
    [products, businessType]
  );

  const recipeInputs = useMemo(
    () => (isRestaurant || isCafeteria) ? [...preparationProducts, ...ingredientProducts] : ingredientProducts,
    [ingredientProducts, isRestaurant, isCafeteria, preparationProducts]
  );

  const activeProducts = view === 'preparaciones'
    ? preparationProducts
    : view === 'insumos'
      ? ingredientProducts
      : menuProducts;

  const activeCategories = useMemo(() => {
    const unique = Array.from(new Set(activeProducts.map(product => product.category).filter(Boolean)));
    return ['Todas', ...unique];
  }, [activeProducts]);

  const visibleProducts = useMemo(() => {
    const text = search.trim().toLowerCase();

    return activeProducts.filter(product => {
      const matchCategory = foodCategory === 'Todas' || product.category === foodCategory;
      const metadata = product.productMetadata || {};
      const matchSearch = !text || [
        product.name,
        product.category,
        product.sku,
        product.barcode,
        product.brand,
        product.size,
        product.color,
        product.description,
        metadata.kitchenStation,
        metadata.menuStatus,
        metadata.allergens,
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

  const pausedMenuProducts = useMemo(() => {
    if (isRestaurant) return menuProducts.filter(product => getRestaurantStatusMeta(product).value === 'paused');
    if (isCafeteria) return menuProducts.filter(product => normalizeCafeteriaProductMetadata(product.productMetadata).menuStatus === 'paused');
    return [];
  }, [isRestaurant, isCafeteria, menuProducts]);

  function selectView(nextView) {
    setView(nextView);
    setFoodCategory('Todas');
    setPendingDeleteId(null);
  }

  function focusProductForm() {
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  function getProductFormMode(product) {
    if (isPreparationProduct(product, businessType)) return 'preparacion';
    if (isIngredientProduct(product, businessType)) return 'insumo';
    return 'menu';
  }

  function handleEditProduct(product) {
    const mode = getProductFormMode(product);
    setFoodFormMode(mode);
    setView(mode === 'preparacion' ? 'preparaciones' : mode === 'insumo' ? 'insumos' : 'menu');
    editProduct(product);
    focusProductForm();
  }

  function prepareForm(mode) {
    setEditingId(null);
    setNotice(null);
    setPendingDeleteId(null);
    setFoodFormMode(mode);
    setView(mode === 'preparacion' ? 'preparaciones' : mode === 'insumo' ? 'insumos' : 'menu');

    const defaults = mode === 'preparacion'
      ? { category: pageText.defaultPreparationCategory, minStock: '0', stockUnit: 'porción' }
      : mode === 'insumo'
        ? { category: pageText.defaultIngredientCategory, minStock: '3', stockUnit: 'kg' }
        : {
            category: pageText.defaultMenuCategory,
            minStock: '0',
            productMetadata: isRestaurant
              ? normalizeRestaurantProductMetadata({})
              : isCafeteria
                ? normalizeCafeteriaProductMetadata({})
                : {},
          };

    setForm({ ...FOOD_EMPTY_FORM, ...defaults });
    focusProductForm();
  }

  function printLabel(product) {
    printProductBarcodeLabel(product);
  }

  function handleRecipeChange(productId, recipeEnabled) {
    if (typeof setProducts !== 'function') return;
    setProducts(prevProducts => prevProducts.map(product => (
      product.id === productId
        ? { ...product, recipeEnabled, recipe_enabled: recipeEnabled }
        : product
    )));
  }

  function openProductRecipe(product) {
    if (isRestaurant) {
      sessionStorage.setItem('inventiq_restaurant_recipe_product_id', String(product.id));
      setActive?.('Recetas');
      return;
    }
    if (isCafeteria) {
      sessionStorage.setItem('inventiq_cafeteria_recipe_product_id', String(product.id));
      setActive?.('Recetas');
      return;
    }
    setRecipeProduct(product);
  }

  const MainProductIcon = businessType === 'panaderia'
    ? Wheat
    : isRestaurant
      ? UtensilsCrossed
      : Coffee;

  const viewButtons = (isRestaurant || isCafeteria)
    ? [
        { id: 'menu', title: pageText.menuTabTitle, detail: `${menuProducts.length} ${pageText.menuTabDetail}` },
        { id: 'preparaciones', title: pageText.preparationTabTitle, detail: `${preparationProducts.length} ${pageText.preparationTabDetail}` },
        { id: 'insumos', title: pageText.ingredientTabTitle, detail: `${ingredientProducts.length} ${pageText.ingredientTabDetail}` },
      ]
    : [
        { id: 'menu', title: pageText.menuTabTitle, detail: `${menuProducts.length} ${pageText.menuTabDetail}` },
        { id: 'insumos', title: pageText.ingredientTabTitle, detail: `${ingredientProducts.length} ${pageText.ingredientTabDetail}` },
      ];

  return (
    <div className="space-y-6">
      <section className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${isRestaurant ? 'xl:grid-cols-6' : 'xl:grid-cols-5'}`}>
        <FoodMetric icon={Package} title="Total ítems" value={products.length} detail={pageText.totalDetail} tone="cyan" />
        <FoodMetric icon={MainProductIcon} title={pageText.menuMetricTitle} value={menuProducts.length} detail={pageText.menuMetricDetail} tone="amber" />
        {isRestaurant && (
          <FoodMetric icon={Layers3} title="Preparaciones" value={preparationProducts.length} detail="bases internas" tone="violet" />
        )}
        <FoodMetric icon={Package} title={pageText.ingredientMetricTitle} value={ingredientProducts.length} detail={pageText.ingredientMetricDetail} tone="blue" />
        <FoodMetric icon={AlertTriangle} title="Stock bajo" value={lowStock} detail={pageText.lowStockDetail} tone="red" />
        <FoodMetric
          icon={isRestaurant ? Clock3 : CalendarDays}
          title={(isRestaurant || isCafeteria) ? 'Menú pausado' : 'Por vencer'}
          value={(isRestaurant || isCafeteria) ? pausedMenuProducts.length : expiringProducts.length}
          detail={(isRestaurant || isCafeteria) ? 'no visibles en caja' : 'perecibles'}
          tone="slate"
        />
      </section>

      {productsLoading && (
        <div className="rounded-2xl bg-cyan-50 p-4 text-sm font-semibold text-cyan-800">
          {pageText.loadingText}
        </div>
      )}

      <section className="iq-module-hero iq-module-hero-food">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-amber-600">{pageText.kicker}</p>
            <h3 className="mt-1 text-2xl font-black text-slate-900">{pageText.title}</h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">{pageText.description}</p>
          </div>

          <div className={`grid gap-2 rounded-3xl border border-white/80 bg-white/80 p-2 shadow-sm ${isRestaurant ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'}`}>
            {viewButtons.map(button => (
              <FoodViewButton
                key={button.id}
                title={button.title}
                detail={button.detail}
                active={view === button.id}
                onClick={() => selectView(button.id)}
              />
            ))}
          </div>
        </div>
      </section>

      {(isRestaurant || isCafeteria) && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <WorkflowStep number="01" title="Menú" text={isRestaurant ? 'Platos y bebidas que el cliente puede ordenar.' : 'Bebidas y alimentos que se venden en Caja rápida.'} />
            <WorkflowStep number="02" title="Preparaciones" text={isRestaurant ? 'Salsas, fondos y bases elaboradas antes del servicio.' : 'Cold brew, cremas, salsas y bases preparadas con anticipación.'} />
            <WorkflowStep number="03" title="Insumos y empaques" text={isRestaurant ? 'Materias primas y materiales que sostienen la operación.' : 'Café, leches, jarabes, vasos y demás materiales de operación.'} />
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-cyan-100 bg-cyan-50 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-extrabold text-cyan-950">
              <Upload className="h-5 w-5" /> {pageText.importTitle}
            </h3>
            <p className="mt-1 text-sm text-cyan-900">{pageText.importDescription}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => downloadProductExcelTemplate(businessType)}
              className="rounded-2xl border border-cyan-200 bg-white px-5 py-3 text-center text-sm font-bold text-cyan-800 hover:bg-cyan-50"
            >
              <Download className="mr-2 inline h-4 w-4" /> Descargar formato
            </button>
            <label className="cursor-pointer rounded-2xl bg-cyan-700 px-5 py-3 text-center text-sm font-bold text-white hover:bg-cyan-800">
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
          <div className="iq-operation-card p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900">{getViewTitle(view, pageText)}</h3>
                <p className="text-sm text-slate-500">{getViewDescription(view, pageText)}</p>
              </div>

              <div className={`grid gap-2 ${(isRestaurant || isCafeteria) ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                <button type="button" onClick={() => prepareForm('menu')} className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-800 hover:bg-cyan-100">
                  {pageText.addMenuButton}
                </button>
                {(isRestaurant || isCafeteria) && (
                  <button type="button" onClick={() => prepareForm('preparacion')} className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-black text-violet-700 hover:bg-violet-100">
                    Agregar preparación
                  </button>
                )}
                <button type="button" onClick={() => prepareForm('insumo')} className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-black text-amber-700 hover:bg-amber-100">
                  {pageText.addIngredientButton}
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_260px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder={getSearchPlaceholder(view, pageText)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-cyan-300 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                />
              </div>

              <select
                value={foodCategory}
                onChange={event => setFoodCategory(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-cyan-100"
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
              pageText={pageText}
              pendingDeleteId={pendingDeleteId}
              setPendingDeleteId={setPendingDeleteId}
              editProduct={handleEditProduct}
              deleteProduct={deleteProduct}
              printLabel={printLabel}
              openRecipe={openProductRecipe}
              showRecipeButton={pageText.showRecipeButton}
              productIcon={MainProductIcon}
              isRestaurant={isRestaurant}
              isCafeteria={isCafeteria}
            />
          ) : (
            <InternalItemsList
              products={visibleProducts}
              pageText={pageText}
              view={view}
              pendingDeleteId={pendingDeleteId}
              setPendingDeleteId={setPendingDeleteId}
              editProduct={handleEditProduct}
              deleteProduct={deleteProduct}
              printLabel={printLabel}
              expirationText={expirationText}
              openRecipe={openProductRecipe}
              showRecipeButton={(isRestaurant || isCafeteria) && view === 'preparaciones'}
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

      {recipeProduct && !isRestaurant && !isCafeteria && (
        <FoodRecipeModal
          currentUser={currentUser}
          menuProduct={recipeProduct}
          ingredients={recipeInputs}
          onClose={() => setRecipeProduct(null)}
          onRecipeChange={handleRecipeChange}
        />
      )}
    </div>
  );
}

function MenuGrid({ products, pageText, pendingDeleteId, setPendingDeleteId, editProduct, deleteProduct, printLabel, openRecipe, showRecipeButton = true, productIcon: ProductIcon = Coffee, isRestaurant = false, isCafeteria = false }) {
  if (products.length === 0) {
    return <EmptyFoodState title={pageText.emptyMenuTitle} text={pageText.emptyMenuText} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {products.map(product => {
        const isPendingDelete = pendingDeleteId === product.id;
        const metadata = isRestaurant ? normalizeRestaurantProductMetadata(product.productMetadata) : null;
        const statusMeta = isRestaurant ? getRestaurantStatusMeta(product) : null;
        const cafeMetadata = isCafeteria ? normalizeCafeteriaProductMetadata(product.productMetadata) : null;
        const station = metadata ? getRestaurantStationLabel(metadata.kitchenStation) : '';
        const serviceLabels = metadata ? getRestaurantServiceLabels(metadata.servicePeriods) : [];
        const channelLabels = metadata ? getRestaurantChannelLabels(metadata.orderChannels) : [];
        const cafeStatusLabel = cafeMetadata ? getCafeteriaMenuStatusLabel(cafeMetadata.menuStatus) : '';
        const cafeStation = cafeMetadata ? getCafeteriaStationLabel(cafeMetadata.station) : '';

        return (
          <div key={product.id} className="iq-menu-product-card p-4">
            <div className="flex items-start gap-3">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="h-16 w-16 rounded-2xl object-cover ring-1 ring-slate-100" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                  <ProductIcon className="h-7 w-7" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-black text-slate-900">{product.name}</p>
                <p className="mt-1 text-xs font-bold text-slate-400">{cleanCategoryLabel(product.category)}</p>
                {getProductVariantText(product) && <p className="mt-1 text-xs text-slate-400">{getProductVariantText(product)}</p>}
              </div>
            </div>

            {isRestaurant && (
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-slate-600">
                  <span className="block font-black text-slate-800">{station}</span>
                  <span>{metadata.preparationMinutes > 0 ? `${metadata.preparationMinutes} min` : 'Sin tiempo definido'}</span>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-slate-600">
                  <span className="block font-black text-slate-800">{serviceLabels.join(', ') || 'Todo el día'}</span>
                  <span className="line-clamp-1">{channelLabels.join(', ') || 'Todos los canales'}</span>
                </div>
              </div>
            )}

            {isCafeteria && cafeMetadata && (
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-slate-600">
                  <span className="block font-black text-slate-800">{cafeStation}</span>
                  <span>{cafeMetadata.preparationMinutes > 0 ? `${cafeMetadata.preparationMinutes} min` : 'Preparación rápida'}</span>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-slate-600">
                  <span className="block font-black text-slate-800">{cafeMetadata.sizes.length} tamaño(s)</span>
                  <span>{cafeMetadata.milkOptions.length} leche(s) · {cafeMetadata.syrupOptions.length} sabor(es)</span>
                </div>
              </div>
            )}

            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-2xl font-black text-cyan-800">{formatMoney(product.price)}</p>
                <p className="text-xs text-slate-400">Existencia: {product.stock}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${
                isRestaurant
                  ? statusMeta.value === 'available'
                    ? 'bg-cyan-50 text-cyan-800'
                    : statusMeta.value === 'paused'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-amber-50 text-amber-700'
                  : isCafeteria
                    ? cafeMetadata.menuStatus === 'available'
                      ? 'bg-cyan-50 text-cyan-800'
                      : cafeMetadata.menuStatus === 'paused'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-amber-50 text-amber-700'
                    : Number(product.stock || 0) > 0
                      ? 'bg-cyan-50 text-cyan-800'
                      : 'bg-red-50 text-red-700'
              }`}>
                {isRestaurant ? statusMeta.label : isCafeteria ? cafeStatusLabel : Number(product.stock || 0) > 0 ? 'Disponible' : 'Sin stock'}
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
              showRecipeButton={showRecipeButton}
            />
          </div>
        );
      })}
    </div>
  );
}

function InternalItemsList({ products, pageText, view, pendingDeleteId, setPendingDeleteId, editProduct, deleteProduct, printLabel, expirationText, openRecipe = null, showRecipeButton = false }) {
  if (products.length === 0) {
    return (
      <EmptyFoodState
        title={view === 'preparaciones' ? pageText.emptyPreparationTitle : pageText.emptyIngredientTitle}
        text={view === 'preparaciones' ? pageText.emptyPreparationText : pageText.emptyIngredientText}
      />
    );
  }

  return (
    <div className="iq-operation-card overflow-hidden">
      <div className="hidden bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 lg:grid lg:grid-cols-[1.3fr_0.9fr_0.7fr_0.7fr_0.8fr_140px] lg:gap-3">
        <span>{view === 'preparaciones' ? 'Preparación' : pageText.ingredientColumnTitle}</span>
        <span>Categoría</span>
        <span>Costo</span>
        <span>Existencia</span>
        <span>Caducidad</span>
        <span className="text-right">Acciones</span>
      </div>

      <div className="divide-y divide-slate-100">
        {products.map(product => {
          const isPendingDelete = pendingDeleteId === product.id;
          const expirationLabel = getExpirationLabel(product, expirationText) || 'Sin fecha';

          return (
            <div key={product.id} className="grid grid-cols-1 gap-3 px-4 py-4 lg:grid-cols-[1.3fr_0.9fr_0.7fr_0.7fr_0.8fr_140px] lg:items-center">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${view === 'preparaciones' ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'}`}>
                  {view === 'preparaciones' ? <ChefHat className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-900">{product.name}</p>
                  <p className="truncate text-xs text-slate-400">{product.stockUnit || product.size || 'Sin unidad'} · {product.sku || 'Sin SKU'}</p>
                </div>
              </div>
              <div className="text-sm font-bold text-slate-600">{cleanCategoryLabel(product.category)}</div>
              <div className="text-sm font-black text-slate-800">{formatMoney(product.cost)}</div>
              <div className="text-sm text-slate-600">{product.stock} {product.stockUnit || product.size || ''}</div>
              <div className="text-sm text-slate-500">{expirationLabel}</div>
              <FoodCardActions
                product={product}
                isPendingDelete={isPendingDelete}
                setPendingDeleteId={setPendingDeleteId}
                editProduct={editProduct}
                deleteProduct={deleteProduct}
                printLabel={printLabel}
                openRecipe={openRecipe}
                showRecipeButton={showRecipeButton}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FoodCardActions({ product, isPendingDelete, setPendingDeleteId, editProduct, deleteProduct, printLabel, openRecipe = null, showRecipeButton = false }) {
  return (
    <div className="mt-4 flex items-center justify-end gap-2 lg:mt-0">
      {isPendingDelete ? (
        <>
          <button type="button" onClick={() => deleteProduct(product.id)} className="iq-action-danger iq-action-danger-solid">Sí</button>
          <button type="button" onClick={() => setPendingDeleteId(null)} className="iq-action-neutral">No</button>
        </>
      ) : (
        <>
          {showRecipeButton && (
            <button type="button" onClick={() => openRecipe?.(product)} className="iq-action-icon" title="Configurar receta">
              <BookOpen className="h-4 w-4" />
            </button>
          )}
          <button type="button" onClick={() => printLabel(product)} className="iq-action-icon" title="Imprimir etiqueta">
            <Printer className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => editProduct(product)} className="iq-action-icon" title="Editar">
            <Edit className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setPendingDeleteId(product.id)} className="iq-action-icon iq-action-icon-danger" title="Eliminar">
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}

function getFoodProductsPageTexts(businessType, businessConfig = {}) {
  const isBakery = businessType === 'panaderia' || businessConfig?.label === 'Panadería';
  const isRestaurant = businessType === 'restaurante' || businessConfig?.label === 'Restaurante';

  if (isBakery) {
    return {
      kicker: 'Panadería', title: 'Productos terminados y materias primas',
      description: 'Organiza por separado lo que produces y vendes, las materias primas, los productos intermedios y los empaques que sostienen la operación diaria.',
      totalDetail: 'productos e insumos', menuMetricTitle: 'Terminados', menuMetricDetail: 'listos para vender',
      ingredientMetricTitle: 'Materias primas', ingredientMetricDetail: 'insumos y empaques', lowStockDetail: 'ítems críticos',
      loadingText: 'Cargando productos y materias primas desde Supabase...',
      menuTabTitle: 'Productos terminados', menuTabDetail: 'productos', ingredientTabTitle: 'Materias primas e insumos', ingredientTabDetail: 'ítems internos',
      preparationTabTitle: '', preparationTabDetail: '',
      importTitle: 'Importar productos y materias primas desde Excel',
      importDescription: 'Usa categorías como Producto terminado - Panes, Materia prima - Harinas, Producto intermedio - Masas o Empaque - Cajas.',
      menuListTitle: 'Productos terminados', ingredientsListTitle: 'Materias primas, intermedios y empaques', preparationListTitle: '',
      menuListDescription: 'Panes, tortas, galletas, bocaditos y demás productos listos para la venta.',
      ingredientsListDescription: 'Ingredientes, masas, rellenos, fundas, cajas y otros elementos usados en producción.', preparationListDescription: '',
      addMenuButton: 'Agregar producto terminado', addIngredientButton: 'Agregar materia prima o insumo', ingredientColumnTitle: 'Materia prima / insumo',
      defaultMenuCategory: 'Producto terminado - Panes', defaultPreparationCategory: '', defaultIngredientCategory: 'Materia prima - Harinas',
      searchMenuPlaceholder: 'Buscar pan, torta, galleta o producto terminado...', searchPreparationPlaceholder: '', searchIngredientPlaceholder: 'Buscar materia prima, intermedio o empaque...',
      emptyMenuTitle: 'No hay productos terminados', emptyMenuText: 'Agrega panes, tortas, galletas, postres o bocaditos listos para vender.',
      emptyPreparationTitle: '', emptyPreparationText: '', emptyIngredientTitle: 'No hay materias primas ni insumos',
      emptyIngredientText: 'Agrega harina, azúcar, levadura, huevos, grasas, rellenos, fundas o cajas.', showRecipeButton: false,
    };
  }

  if (isRestaurant) {
    return {
      kicker: 'Restaurante', title: 'Menú, preparaciones e inventario de cocina',
      description: 'Estructura el catálogo gastronómico por función: lo que vendes, lo que preparas previamente y los insumos que sostienen cada servicio.',
      totalDetail: 'catálogo gastronómico', menuMetricTitle: 'Menú', menuMetricDetail: 'platos y bebidas',
      ingredientMetricTitle: 'Insumos', ingredientMetricDetail: 'materias primas y empaques', lowStockDetail: 'ítems críticos',
      loadingText: 'Cargando menú, preparaciones e inventario desde Supabase...',
      menuTabTitle: 'Menú', menuTabDetail: 'platos', preparationTabTitle: 'Preparaciones', preparationTabDetail: 'bases', ingredientTabTitle: 'Insumos y empaques', ingredientTabDetail: 'ítems',
      importTitle: 'Importar catálogo gastronómico desde Excel',
      importDescription: 'Clasifica cada fila como Menú, Preparaciones, Insumos o Empaques para evitar que los artículos internos aparezcan en ventas.',
      menuListTitle: 'Platos y bebidas del menú', preparationListTitle: 'Preparaciones intermedias', ingredientsListTitle: 'Insumos y empaques',
      menuListDescription: 'Productos que el cliente puede pedir en local, para llevar o delivery.',
      preparationListDescription: 'Salsas, fondos, guarniciones, aderezos y bases que se elaboran antes del servicio.',
      ingredientsListDescription: 'Materias primas, bebidas internas y empaques que no se venden directamente.',
      addMenuButton: 'Agregar al menú', addIngredientButton: 'Agregar insumo o empaque', ingredientColumnTitle: 'Insumo / empaque',
      defaultMenuCategory: 'Menú - Platos fuertes', defaultPreparationCategory: 'Preparaciones - Salsas', defaultIngredientCategory: 'Insumos - Carnes',
      searchMenuPlaceholder: 'Buscar plato, bebida o combo...', searchPreparationPlaceholder: 'Buscar salsa, fondo, guarnición o base...', searchIngredientPlaceholder: 'Buscar materia prima o empaque...',
      emptyMenuTitle: 'No hay platos en el menú', emptyMenuText: 'Agrega platos, bebidas, entradas, postres o combos para vender.',
      emptyPreparationTitle: 'No hay preparaciones intermedias', emptyPreparationText: 'Agrega salsas, fondos, aderezos, guarniciones o bases que se elaboran antes del servicio.',
      emptyIngredientTitle: 'No hay insumos ni empaques', emptyIngredientText: 'Agrega carnes, vegetales, bebidas internas, envases, fundas o servilletas.',
      showRecipeButton: true,
    };
  }

  return {
    kicker: 'Cafetería', title: 'Menú, preparaciones e insumos',
    description: 'Organiza bebidas, alimentos, bases internas e insumos; configura variantes y conecta cada producto con su receta y costo real.',
    totalDetail: 'catálogo de cafetería', menuMetricTitle: 'Menú', menuMetricDetail: 'productos de venta', ingredientMetricTitle: 'Insumos', ingredientMetricDetail: 'uso interno', lowStockDetail: 'ítems',
    loadingText: 'Cargando menú, preparaciones e insumos desde Supabase...',
    menuTabTitle: 'Menú', menuTabDetail: 'productos', ingredientTabTitle: 'Insumos y empaques', ingredientTabDetail: 'ítems', preparationTabTitle: 'Preparaciones', preparationTabDetail: 'bases',
    importTitle: 'Importar menú e insumos desde Excel', importDescription: 'Usa categorías como Menú - Café caliente, Preparaciones - Bases de café, Insumos - Lácteos o Empaques - Vasos y tapas.',
    menuListTitle: 'Productos del menú', ingredientsListTitle: 'Insumos y empaques', preparationListTitle: 'Preparaciones internas',
    menuListDescription: 'Bebidas y alimentos disponibles en caja rápida, con variantes y estación de preparación.', ingredientsListDescription: 'Café, leches, jarabes, vasos, tapas y materiales internos.', preparationListDescription: 'Cold brew, cremas, salsas y bases que se elaboran antes de atender pedidos.',
    addMenuButton: 'Agregar al menú', addIngredientButton: 'Agregar insumo o empaque', ingredientColumnTitle: 'Insumo / empaque',
    defaultMenuCategory: 'Menú - Café caliente', defaultPreparationCategory: 'Preparaciones - Bases de café', defaultIngredientCategory: 'Insumos - Café',
    searchMenuPlaceholder: 'Buscar producto del menú...', searchPreparationPlaceholder: 'Buscar cold brew, crema, salsa o base...', searchIngredientPlaceholder: 'Buscar insumo o empaque...',
    emptyMenuTitle: 'No hay productos del menú', emptyMenuText: 'Agrega productos como capuchino, latte, postres, sanduches o combos.',
    emptyPreparationTitle: 'No hay preparaciones internas', emptyPreparationText: 'Agrega bases de café, cremas, salsas o preparaciones que se reutilizan en bebidas y alimentos.', emptyIngredientTitle: 'No hay insumos registrados', emptyIngredientText: 'Agrega insumos como café, leche, azúcar, vasos, tapas o servilletas.',
    showRecipeButton: true,
  };
}

function getViewTitle(view, pageText) {
  if (view === 'preparaciones') return pageText.preparationListTitle;
  if (view === 'insumos') return pageText.ingredientsListTitle;
  return pageText.menuListTitle;
}

function getViewDescription(view, pageText) {
  if (view === 'preparaciones') return pageText.preparationListDescription;
  if (view === 'insumos') return pageText.ingredientsListDescription;
  return pageText.menuListDescription;
}

function getSearchPlaceholder(view, pageText) {
  if (view === 'preparaciones') return pageText.searchPreparationPlaceholder;
  if (view === 'insumos') return pageText.searchIngredientPlaceholder;
  return pageText.searchMenuPlaceholder;
}

function WorkflowStep({ number, title, text }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white">{number}</span>
      <div>
        <p className="font-black text-slate-900">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{text}</p>
      </div>
    </div>
  );
}

function FoodViewButton({ title, detail, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-5 py-4 text-center transition ${active ? 'bg-cyan-700 text-white shadow-sm shadow-cyan-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
    >
      <span className="block text-sm font-black">{title}</span>
      <span className={`mt-1 block text-xs font-bold ${active ? 'text-cyan-50' : 'text-slate-400'}`}>{detail}</span>
    </button>
  );
}

function FoodMetric({ icon: Icon, title, value, detail, tone }) {
  const tones = {
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <div className="iq-operation-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{detail}</p>
        </div>
        <div className={`rounded-2xl border p-3 ${tones[tone] || tones.cyan}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function EmptyFoodState({ title, text }) {
  return (
    <div className="iq-empty-state p-10">
      <Package className="mx-auto h-10 w-10 text-slate-300" />
      <h4 className="mt-3 text-lg font-black text-slate-700">{title}</h4>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
    </div>
  );
}
