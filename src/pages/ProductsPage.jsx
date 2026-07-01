import React from 'react';
import { supabase } from '../supabaseClient';
import { getBusinessConfig } from '../config/businessTypes';
import { downloadProductExcelTemplate } from '../utils/excel';
import Metric from '../components/Metric';
import ProductTable from '../components/ProductTable';
import ProductForm from '../components/ProductForm';
import ExcelImportPreviewModal from '../components/ExcelImportPreviewModal';
import Benefit from '../components/Benefit';
import {
  Package,
  Boxes,
  ShoppingCart,
  CalendarDays,
  DollarSign,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
} from 'lucide-react';

export default function ProductsPage({
  currentUser,
  setEditingId,
  setNotice,
  products,
  setProducts,
  search,
  setSearch,
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
  const businessType = currentUser?.businessType || 'general';
  const businessConfig = getBusinessConfig(businessType);
  const expiringProducts = businessConfig.usesExpiration ? products.filter(product => {
    const exp = expirationText ? expirationText(product) : null;
    return exp && ['Por vencer', 'Vence pronto'].includes(exp.label);
  }) : [];

  return (
    <>
      <section className={`mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 ${businessConfig.usesExpiration ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
        <Metric icon={Package} label="Total productos" value={totalProducts} note="activos" color="emerald" />
        <Metric icon={Boxes} label="Stock bajo" value={lowStock} note="productos" color="amber" />
        <Metric icon={ShoppingCart} label="Sin stock" value={noStock} note="productos" color="red" />
        {businessConfig.usesExpiration && <Metric icon={CalendarDays} label="Por vencer" value={expiringProducts.length} note="productos" color="amber" />}
        <Metric icon={DollarSign} label="Valor total inventario" value={`$${inventoryValue.toFixed(2)}`} note="valor aproximado" color="blue" />
      </section>

      {productsLoading && <div className="mb-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Cargando productos desde Supabase...</div>}

      <section className="mb-5 rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-extrabold text-emerald-900"><Upload className="h-5 w-5" /> Importar productos desde Excel</h3>
            <p className="mt-1 text-sm text-emerald-800">Carga un archivo .xlsx o .csv con columnas como producto, categoría, precio, stock, marca, talla, color, SKU y código de barras. El costo es opcional. Para inventarios grandes, InventiQ importa por bloques de 200 productos para evitar fallos.</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => downloadProductExcelTemplate(businessType)} className="rounded-2xl border border-emerald-200 bg-white px-5 py-3 text-center text-sm font-bold text-emerald-700 hover:bg-emerald-50">
              <Download className="mr-2 inline h-4 w-4" />Descargar formato
            </button>
            <label className="cursor-pointer rounded-2xl bg-emerald-600 px-5 py-3 text-center text-sm font-bold text-white hover:bg-emerald-700">
              Seleccionar Excel
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) importProductsFromExcel(file); e.target.value = ''; }} />
            </label>
          </div>
        </div>
      </section>

      {excelImportPreview && <ExcelImportPreviewModal preview={excelImportPreview} progress={excelImportProgress} onConfirm={confirmExcelImport} onCancel={cancelExcelImport} />}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
        <ProductTable
  businessConfig={businessConfig}
  products={products}
  search={search}
  setSearch={setSearch}
  filtered={filtered}
  categories={categories}
  category={category}
  setCategory={setCategory}
  deleteProduct={deleteProduct}
  editProduct={editProduct}
  pendingDeleteId={pendingDeleteId}
  setPendingDeleteId={setPendingDeleteId}
  statusText={statusText}
  expirationText={expirationText}
  onCreateCategory={categoryName => {
    const cleanName = String(categoryName || '').trim();

    if (!cleanName) {
      return;
    }

    setCustomProductCategories(prev =>
      Array.from(new Set([...prev, cleanName]))
    );

    setCategory(cleanName);

    setForm(prev => ({
      ...prev,
      category: cleanName,
      customCategory: '',
    }));

    setEditingId(null);

    setNotice({
      type: 'success',
      message: `Categoría "${cleanName}" creada. Ya puedes seleccionarla en el formulario.`,
    });
  }}
  onRenameCategory={async (oldName, newName) => {
    const cleanOldName = String(oldName || '').trim();
    const cleanNewName = String(newName || '').trim();

    if (!currentUser?.id) {
      setNotice({
        type: 'error',
        message: 'No existe una sesión activa.',
      });
      return false;
    }

    if (!cleanOldName || !cleanNewName || cleanOldName === cleanNewName) {
      return false;
    }

    try {
      const { error } = await supabase
        .from('products')
        .update({
          category: cleanNewName,
        })
        .eq('category', cleanOldName)
        .eq('user_id', currentUser.id);

      if (error) {
        throw error;
      }

      if (setProducts) {
        setProducts(prevProducts =>
          prevProducts.map(product =>
            product.category === cleanOldName
              ? { ...product, category: cleanNewName }
              : product
          )
        );
      }

      setCustomProductCategories(prev =>
        Array.from(
          new Set(
            [...prev.map(cat => (cat === cleanOldName ? cleanNewName : cat)), cleanNewName]
              .filter(Boolean)
          )
        ).filter(cat => cat !== cleanOldName)
      );

      if (category === cleanOldName && setCategory) {
        setCategory(cleanNewName);
      }

      setForm(prev => ({
        ...prev,
        category: prev.category === cleanOldName ? cleanNewName : prev.category,
        customCategory: prev.customCategory === cleanOldName ? cleanNewName : prev.customCategory,
      }));

      setNotice({
        type: 'success',
        message: `Categoría "${cleanOldName}" actualizada a "${cleanNewName}". Los productos se mantienen en la nueva categoría.`,
      });

      return true;
    } catch (error) {
      console.error('Error al actualizar categoría:', error);

      setNotice({
        type: 'error',
        message: `No se pudo actualizar la categoría: ${error.message}`,
      });

      return false;
    }
  }}
  onDeleteCategory={categoryName => {
    const cleanName = String(categoryName || '').trim();

    if (!cleanName) {
      return;
    }

    setCustomProductCategories(prev =>
      prev.filter(cat => cat !== cleanName)
    );

    setNotice({
      type: 'success',
      message: `Categoría "${cleanName}" eliminada.`,
    });
  }}
/>
        <ProductForm businessConfig={businessConfig} form={form} setForm={setForm} saveProduct={saveProduct} resetForm={resetForm} editingId={editingId} notice={notice} productCategories={productCategories} handleProductImage={handleProductImage} />
      </section>

      <section className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
        <h3 className="mb-4 text-lg font-bold text-emerald-900">¿Por qué usar InventiQ?</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Benefit icon={Package} title="Controla tu inventario" text="en tiempo real" />
          <Benefit icon={AlertTriangle} title="Evita pérdidas" text="por falta de stock" />
          <Benefit icon={CheckCircle2} title="Ahorra tiempo" text="en tus procesos" />
          <Benefit icon={BarChart3} title="Toma mejores decisiones" text="con datos claros" />
        </div>
      </section>
    </>
  );
}
