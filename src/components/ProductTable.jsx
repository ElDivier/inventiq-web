import { useEffect, useMemo, useState } from 'react';
import { Edit, Package, Plus, Printer, Search, Trash2 } from 'lucide-react';
import { MAX_LABELS_WITHOUT_CONFIRM } from '../config/constants';
import { getProductVariantText } from '../utils/products';
import {
  printProductBarcodeLabel,
  printSelectedBarcodeLabels,
} from '../utils/barcode';

const PRODUCTS_PER_PAGE = 15;
const CATEGORIES_PER_PAGE = 15;
const DEFAULT_LABEL_WIDTH = 51;
const DEFAULT_LABEL_HEIGHT = 25;

function normalizeText(value) {
  return String(value || '').trim();
}

function formatMoney(value) {
  const number = Number(value || 0);
  return `$${number.toFixed(2)}`;
}

function looksLikeBarcodeSearch(value) {
  const text = String(value || '').trim();
  if (text.length < 4) return false;
  if (text.includes(' ')) return false;
  return /\d/.test(text) && /^[a-zA-Z0-9._-]+$/.test(text);
}

function productMatchesTableSearch(product, searchText) {
  const text = String(searchText || '').trim().toLowerCase();

  if (!text) return true;

  if (looksLikeBarcodeSearch(text)) {
    return (
      String(product.barcode || '').trim().toLowerCase() === text ||
      String(product.sku || '').trim().toLowerCase() === text
    );
  }

  return [
    product.name,
    product.sku,
    product.barcode,
    product.brand,
    product.size,
    product.color,
    product.category,
  ].some(value => String(value || '').toLowerCase().includes(text));
}

function getStockBadge(product, statusText) {
  const result = typeof statusText === 'function' ? statusText(product) : null;

  if (typeof result === 'string') {
    return {
      label: result,
      className: 'bg-slate-100 text-slate-700',
    };
  }

  if (result?.className) {
    return {
      label: result.label || product.status || 'Sin estado',
      className: result.className,
    };
  }

  if (result?.color) {
    return {
      label: result.label || product.status || 'Sin estado',
      className: result.color,
    };
  }

  if (Number(product.stock || 0) <= 0) {
    return {
      label: 'Sin stock',
      className: 'bg-red-50 text-red-700',
    };
  }

  if (Number(product.stock || 0) <= Number(product.minStock || 0)) {
    return {
      label: 'Stock bajo',
      className: 'bg-amber-50 text-amber-700',
    };
  }

  return {
    label: product.status || 'Activo',
    className: 'bg-cyan-50 text-cyan-800',
  };
}

function getExpirationBadge(product, expirationText) {
  if (typeof expirationText !== 'function') return null;
  const result = expirationText(product);

  if (!result) return null;

  if (typeof result === 'string') {
    return {
      label: result,
      className: 'bg-slate-100 text-slate-700',
    };
  }

  return {
    label: result.label || '',
    className: result.className || result.color || 'bg-slate-100 text-slate-700',
  };
}

export default function ProductTable({
  businessConfig,
  products,
  search = '',
  setSearch,
  filtered,
  categories,
  category,
  setCategory,
  deleteProduct,
  editProduct,
  pendingDeleteId,
  setPendingDeleteId,
  statusText,
  expirationText,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [categoryPage, setCategoryPage] = useState(1);
  const [categorySearch, setCategorySearch] = useState('');
  const [tableSearch, setTableSearch] = useState(search || '');
  const [selectedLabelIds, setSelectedLabelIds] = useState([]);
  const [labelColumns, setLabelColumns] = useState('2');
  const [labelCopies, setLabelCopies] = useState('1');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [categoryNotice, setCategoryNotice] = useState(null);

  const isFoodProductMode = businessConfig?.productMode === 'menu-inventory';
  const tableTitle = isFoodProductMode ? 'Menú e insumos' : 'Productos';
  const itemWord = isFoodProductMode ? 'ítem' : 'producto';
  const itemWordPlural = isFoodProductMode ? 'ítems' : 'productos';
  const productColumnLabel = isFoodProductMode ? 'Ítem' : 'Producto';
  const stockColumnLabel = isFoodProductMode ? 'Existencia' : 'Stock';
  const categoryExample = isFoodProductMode ? 'Ej: Menú - Café caliente' : 'Ej: Mujer - Blusas';
  const emptyTitle = isFoodProductMode ? 'No hay menú ni insumos para mostrar' : '{emptyTitle}';
  const emptyDescription = isFoodProductMode
    ? 'Cambia la categoría o importa menú e insumos desde Excel.'
    : '{emptyDescription}';

  const tableFilteredProducts = useMemo(() => {
    return filtered.filter(product => productMatchesTableSearch(product, tableSearch));
  }, [filtered, tableSearch]);

  const totalProducts = tableFilteredProducts.length;
  const totalPages = Math.max(Math.ceil(totalProducts / PRODUCTS_PER_PAGE), 1);
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * PRODUCTS_PER_PAGE;
  const paginatedProducts = tableFilteredProducts.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);

  const allCategories = useMemo(() => {
    const cleanCategories = (categories || [])
      .map(item => normalizeText(item))
      .filter(Boolean);

    const unique = Array.from(new Set(['Todas', ...cleanCategories]));
    return unique;
  }, [categories]);

  const normalCategories = useMemo(
    () => allCategories.filter(item => item !== 'Todas'),
    [allCategories]
  );

  const searchedCategories = useMemo(() => {
    const text = categorySearch.trim().toLowerCase();
    if (!text) return normalCategories;

    return normalCategories.filter(item =>
      item.toLowerCase().includes(text)
    );
  }, [normalCategories, categorySearch]);

  const totalCategoryPages = Math.max(
    Math.ceil(searchedCategories.length / CATEGORIES_PER_PAGE),
    1
  );

  const safeCategoryPage = Math.min(categoryPage, totalCategoryPages);
  const categoryStartIndex = (safeCategoryPage - 1) * CATEGORIES_PER_PAGE;
  const paginatedCategories = searchedCategories.slice(
    categoryStartIndex,
    categoryStartIndex + CATEGORIES_PER_PAGE
  );

  const selectedProducts = useMemo(() => {
    const selectedSet = new Set(selectedLabelIds.map(String));
    return products.filter(product => selectedSet.has(String(product.id)));
  }, [products, selectedLabelIds]);

  const allPageProductsSelected =
    paginatedProducts.length > 0 &&
    paginatedProducts.every(product => selectedLabelIds.includes(product.id));

  useEffect(() => {
    setCurrentPage(1);
  }, [category, tableSearch, tableFilteredProducts.length]);

  useEffect(() => {
    setTableSearch(search || '');
  }, [search]);

  function handleTableSearchChange(value) {
    setTableSearch(value);

    if (typeof setSearch === 'function') {
      setSearch(value);
    }
  }

  useEffect(() => {
    setCategoryPage(1);
  }, [categorySearch, searchedCategories.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (categoryPage > totalCategoryPages) {
      setCategoryPage(totalCategoryPages);
    }
  }, [categoryPage, totalCategoryPages]);

  function getCategoryCount(categoryName) {
    if (categoryName === 'Todas') return products.length;
    return products.filter(product => product.category === categoryName).length;
  }

  function selectCategory(categoryName) {
    setCategory(categoryName);
    setPendingDeleteId(null);
  }

  function toggleSelectedLabel(productId) {
    setSelectedLabelIds(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  }

  function togglePageSelection() {
    const pageIds = paginatedProducts.map(product => product.id);

    if (allPageProductsSelected) {
      setSelectedLabelIds(prev => prev.filter(id => !pageIds.includes(id)));
      return;
    }

    setSelectedLabelIds(prev => Array.from(new Set([...prev, ...pageIds])));
  }

  function clearSelectedLabels() {
    setSelectedLabelIds([]);
  }

  function printOneLabel(product) {
    printProductBarcodeLabel(product, {
      labelWidth: DEFAULT_LABEL_WIDTH,
      labelHeight: DEFAULT_LABEL_HEIGHT,
    });
  }

  function printSelectedLabels() {
    if (selectedProducts.length === 0) return;

    const copies = Number(labelCopies || 1);
    const totalLabels = selectedProducts.length * copies;

    if (
      totalLabels > MAX_LABELS_WITHOUT_CONFIRM &&
      !window.confirm(`Vas a imprimir ${totalLabels} etiquetas. ¿Deseas continuar?`)
    ) {
      return;
    }

    printSelectedBarcodeLabels(selectedProducts, {
      columns: Number(labelColumns || 2),
      copies,
      labelWidth: DEFAULT_LABEL_WIDTH,
      labelHeight: DEFAULT_LABEL_HEIGHT,
    });
  }

  function startCreateCategory() {
    setCreatingCategory(true);
    setNewCategory('');
    setCategoryNotice(null);
  }

  function cancelCreateCategory() {
    setCreatingCategory(false);
    setNewCategory('');
    setCategoryNotice(null);
  }

  function saveNewCategory() {
    const cleanName = normalizeText(newCategory);

    if (!cleanName) {
      setCategoryNotice({ type: 'error', message: 'Escribe el nombre de la categoría.' });
      return;
    }

    if (allCategories.includes(cleanName)) {
      setCategoryNotice({ type: 'error', message: 'Esa categoría ya existe.' });
      return;
    }

    if (typeof onCreateCategory === 'function') {
      onCreateCategory(cleanName);
    }

    setCreatingCategory(false);
    setNewCategory('');
    setCategoryNotice({ type: 'success', message: `Categoría "${cleanName}" creada.` });
  }

  function startRenameCategory(categoryName) {
    if (categoryName === 'Todas') return;
    setEditingCategory(categoryName);
    setEditingCategoryName(categoryName);
    setCategoryNotice(null);
  }

  function cancelRenameCategory() {
    setEditingCategory(null);
    setEditingCategoryName('');
    setCategoryNotice(null);
  }

  async function saveRenameCategory() {
    const oldName = normalizeText(editingCategory);
    const newName = normalizeText(editingCategoryName);

    if (!oldName || !newName) {
      setCategoryNotice({ type: 'error', message: 'Escribe el nuevo nombre de la categoría.' });
      return;
    }

    if (oldName === newName) {
      cancelRenameCategory();
      return;
    }

    if (allCategories.includes(newName)) {
      setCategoryNotice({ type: 'error', message: 'Ya existe una categoría con ese nombre.' });
      return;
    }

    if (typeof onRenameCategory !== 'function') {
      setCategoryNotice({ type: 'error', message: 'No se encontró la función para renombrar categorías.' });
      return;
    }

    const ok = await onRenameCategory(oldName, newName);

    if (ok !== false) {
      setEditingCategory(null);
      setEditingCategoryName('');
      setCategoryNotice({ type: 'success', message: `Categoría actualizada a "${newName}".` });
    }
  }

  function removeCategory(categoryName) {
    const cleanName = normalizeText(categoryName);
    const count = getCategoryCount(cleanName);

    if (!cleanName || cleanName === 'Todas') return;

    if (count > 0) {
      setCategoryNotice({
        type: 'error',
        message: `No puedes eliminar "${cleanName}" porque tiene ${count} ${itemWordPlural}. Primero cambia esos ${itemWordPlural} a otra categoría.`,
      });
      return;
    }

    if (!window.confirm(`¿Eliminar la categoría "${cleanName}"?`)) return;

    if (typeof onDeleteCategory === 'function') {
      onDeleteCategory(cleanName);
    }

    if (category === cleanName) {
      setCategory('Todas');
    }

    setCategoryNotice({ type: 'success', message: `Categoría "${cleanName}" eliminada.` });
  }

  return (
    <section className="iq-catalog-panel">
      <div className="iq-catalog-header">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-extrabold text-slate-900">
            <Package className="h-5 w-5 text-cyan-700" /> {tableTitle}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Mostrando {totalProducts === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + PRODUCTS_PER_PAGE, totalProducts)} de {totalProducts} {itemWordPlural}.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(260px,380px)_auto_auto_auto] lg:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Buscar</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={tableSearch}
                onChange={event => handleTableSearchChange(event.target.value)}
                onFocus={event => event.target.select()}
                className="iq-input py-2 pl-9 pr-16 text-sm font-semibold"
                placeholder="Nombre, SKU o código..."
              />
              {tableSearch && (
                <button
                  type="button"
                  onClick={() => handleTableSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-2 py-1 text-xs font-black text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  ×
                </button>
              )}
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Columnas</span>
            <select
              value={labelColumns}
              onChange={event => setLabelColumns(event.target.value)}
              className="iq-input px-3 py-2 text-sm font-semibold"
            >
              <option value="1">1 columna</option>
              <option value="2">2 columnas</option>
              <option value="3">3 columnas</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Copias</span>
            <input
              type="number"
              min="1"
              value={labelCopies}
              onChange={event => setLabelCopies(event.target.value)}
              className="iq-input px-3 py-2 text-sm font-semibold"
            />
          </label>

          <button
            type="button"
            onClick={printSelectedLabels}
            disabled={selectedProducts.length === 0}
            className="iq-primary-button disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Printer className="mr-2 inline h-4 w-4" />
            Imprimir {selectedProducts.length || ''}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-0 xl:grid-cols-[280px_1fr]">
        <aside className="iq-catalog-sidebar">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">Categorías</h4>
              <p className="text-xs text-slate-400">
                {normalCategories.length} categoría(s)
              </p>
            </div>
            <button
              type="button"
              onClick={startCreateCategory}
              className="rounded-xl bg-cyan-700 p-2 text-white hover:bg-cyan-800"
              title="Crear categoría"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <input
            value={categorySearch}
            onChange={event => setCategorySearch(event.target.value)}
            placeholder="Buscar categoría..."
            className="iq-input mb-3 px-3 py-2 text-sm"
          />

          {categoryNotice && (
            <div className={`mb-3 rounded-2xl p-3 text-xs font-semibold ${categoryNotice.type === 'success' ? 'bg-cyan-50 text-cyan-800' : 'bg-red-50 text-red-700'}`}>
              {categoryNotice.message}
            </div>
          )}

          {creatingCategory && (
            <div className="mb-4 rounded-2xl border border-cyan-100 bg-cyan-50 p-3">
              <label className="block text-xs font-bold uppercase tracking-wide text-cyan-900">
                Nueva categoría
              </label>
              <input
                value={newCategory}
                onChange={event => setNewCategory(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') saveNewCategory();
                  if (event.key === 'Escape') cancelCreateCategory();
                }}
                className="mt-2 w-full rounded-xl border border-cyan-100 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-200"
                placeholder={categoryExample}
                autoFocus
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={saveNewCategory}
                  className="iq-action-primary flex-1"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={cancelCreateCategory}
                  className="iq-action-secondary flex-1"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <CategoryButton
              categoryName="Todas"
              count={getCategoryCount('Todas')}
              active={category === 'Todas'}
              onSelect={() => selectCategory('Todas')}
            />

            {paginatedCategories.map(categoryName => {
              const count = getCategoryCount(categoryName);
              const isEditing = editingCategory === categoryName;

              if (isEditing) {
                return (
                  <div key={categoryName} className="rounded-2xl border border-cyan-100 bg-cyan-50 p-3">
                    <input
                      value={editingCategoryName}
                      onChange={event => setEditingCategoryName(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') saveRenameCategory();
                        if (event.key === 'Escape') cancelRenameCategory();
                      }}
                      className="w-full rounded-xl border border-cyan-100 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-cyan-200"
                      autoFocus
                    />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={saveRenameCategory}
                        className="iq-action-primary"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={cancelRenameCategory}
                        className="iq-action-secondary"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={categoryName} className="group flex items-center gap-2">
                  <CategoryButton
                    categoryName={categoryName}
                    count={count}
                    active={category === categoryName}
                    onSelect={() => selectCategory(categoryName)}
                  />
                  <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:transition group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => startRenameCategory(categoryName)}
                      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-cyan-700"
                      title="Renombrar categoría"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCategory(categoryName)}
                      className="rounded-xl border border-red-100 bg-white p-2 text-red-400 hover:bg-red-50 hover:text-red-600"
                      title="Eliminar categoría"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {searchedCategories.length === 0 && (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
              No se encontraron categorías.
            </div>
          )}

          {searchedCategories.length > CATEGORIES_PER_PAGE && (
            <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <button
                type="button"
                disabled={safeCategoryPage <= 1}
                onClick={() => setCategoryPage(page => Math.max(page - 1, 1))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-bold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>

              <span className="font-bold text-slate-700">
                {safeCategoryPage} / {totalCategoryPages}
              </span>

              <button
                type="button"
                disabled={safeCategoryPage >= totalCategoryPages}
                onClick={() => setCategoryPage(page => Math.min(page + 1, totalCategoryPages))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-bold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          )}
        </aside>

        <div className="iq-catalog-content">
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={allPageProductsSelected}
                onChange={togglePageSelection}
                className="h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-500"
              />
              Seleccionar {itemWordPlural} de esta página
            </label>

            {selectedProducts.length > 0 && (
              <button
                type="button"
                onClick={clearSelectedLabels}
                className="text-sm font-bold text-slate-500 hover:text-slate-700"
              >
                Limpiar selección ({selectedProducts.length})
              </button>
            )}
          </div>

          {paginatedProducts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center">
              <Package className="mx-auto h-10 w-10 text-slate-300" />
              <h4 className="mt-3 text-lg font-bold text-slate-700">{emptyTitle}</h4>
              <p className="mt-1 text-sm text-slate-500">
                {emptyDescription}
              </p>
            </div>
          ) : (
            <div className="iq-table-shell">
              <div className="iq-table-head hidden lg:grid lg:grid-cols-[36px_1.5fr_1fr_0.7fr_0.7fr_0.7fr_140px] lg:gap-3">
                <span />
                <span>{productColumnLabel}</span>
                <span>Categoría</span>
                <span>Precio</span>
                <span>{stockColumnLabel}</span>
                <span>Estado</span>
                <span className="text-right">Acciones</span>
              </div>

              <div className="divide-y divide-slate-100">
                {paginatedProducts.map(product => {
                  const stockBadge = getStockBadge(product, statusText);
                  const expirationBadge = businessConfig?.usesExpiration ? getExpirationBadge(product, expirationText) : null;
                  const variantText = getProductVariantText(product);
                  const isPendingDelete = pendingDeleteId === product.id;
                  const isSelected = selectedLabelIds.includes(product.id);

                  return (
                    <div key={product.id} className="iq-table-row grid gap-3 lg:grid-cols-[36px_1.5fr_1fr_0.7fr_0.7fr_0.7fr_140px] lg:items-center">
                      <div className="flex items-center lg:block">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectedLabel(product.id)}
                          className="h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-500"
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-start gap-3">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="h-12 w-12 rounded-2xl object-cover ring-1 ring-slate-100"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-900">{product.name}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {product.sku || 'Sin SKU'} {product.barcode ? `· ${product.barcode}` : ''}
                            </p>
                            {variantText && (
                              <p className="mt-1 text-xs text-slate-400">{variantText}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                          {product.category || 'Sin categoría'}
                        </span>
                      </div>

                      <div className="text-sm font-bold text-slate-800">
                        {formatMoney(product.price)}
                      </div>

                      <div className="text-sm text-slate-600">
                        <span className="font-bold text-slate-900">{product.stock}</span>
                        <span className="text-slate-400"> / mín. {product.minStock}</span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${stockBadge.className}`}>
                          {stockBadge.label}
                        </span>
                        {expirationBadge?.label && (
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${expirationBadge.className}`}>
                            {expirationBadge.label}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-start gap-2 lg:justify-end">
                        {isPendingDelete ? (
                          <>
                            <button
                              type="button"
                              onClick={() => deleteProduct(product.id)}
                              className="iq-action-danger iq-action-danger-solid"
                            >
                              Sí
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDeleteId(null)}
                              className="iq-action-neutral"
                            >
                              No
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => printOneLabel(product)}
                              className="iq-action-icon"
                              title="Imprimir etiqueta"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => editProduct(product)}
                              className="iq-action-icon"
                              title="Editar producto"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDeleteId(product.id)}
                              className="iq-action-icon iq-action-icon-danger"
                              title="Eliminar producto"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {totalProducts > PRODUCTS_PER_PAGE && (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Mostrando {startIndex + 1}-{Math.min(startIndex + PRODUCTS_PER_PAGE, totalProducts)} de {totalProducts} {itemWordPlural}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage(page => Math.max(page - 1, 1))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700">
                  Página {safeCurrentPage} de {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage(page => Math.min(page + 1, totalPages))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CategoryButton({ categoryName, count, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl px-3 py-2 text-left text-sm font-bold transition ${
        active
          ? 'bg-cyan-700 text-white shadow-sm shadow-cyan-100'
          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
      }`}
    >
      <span className="truncate">{categoryName}</span>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${active ? 'bg-white/20 text-white' : 'bg-white text-slate-500'}`}>
        {count}
      </span>
    </button>
  );
}