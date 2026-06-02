import { useEffect, useState } from 'react';
import { Edit, Package, Plus, Printer, Trash2 } from 'lucide-react';
import { MAX_LABELS_WITHOUT_CONFIRM } from '../config/constants';
import { getProductVariantText } from '../utils/products';
import {
  printProductBarcodeLabel,
  printSelectedBarcodeLabels,
} from '../utils/barcode';

export default function ProductTable({
  businessConfig,
  products,
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
}) {
  const [selectedLabelIds, setSelectedLabelIds] = useState([]);
  const [labelColumns, setLabelColumns] = useState('2');
  const [labelCopies, setLabelCopies] = useState('1');
  const [currentPage, setCurrentPage] = useState(1);

  const productsPerPage = 15;
  const totalPages = Math.max(Math.ceil(filtered.length / productsPerPage), 1);
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * productsPerPage;
  const paginatedProducts = filtered.slice(startIndex, startIndex + productsPerPage);
  const selectedProducts = filtered.filter(product => selectedLabelIds.includes(product.id));
  const allVisibleSelected = paginatedProducts.length > 0 && paginatedProducts.every(product => selectedLabelIds.includes(product.id));

  useEffect(() => {
    setCurrentPage(1);
  }, [category, filtered.length]);

  function toggleLabelProduct(productId) {
    setSelectedLabelIds(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  }

  function toggleAllVisibleProducts() {
    if (allVisibleSelected) {
      setSelectedLabelIds(prev => prev.filter(id => !paginatedProducts.some(product => product.id === id)));
      return;
    }

    setSelectedLabelIds(prev => Array.from(new Set([...prev, ...paginatedProducts.map(product => product.id)])));
  }

  function printSelectedLabels() {
    const totalLabels = selectedProducts.length * Math.max(Number(labelCopies || 1), 1);

    if (
      totalLabels > MAX_LABELS_WITHOUT_CONFIRM &&
      !window.confirm(`Vas a generar ${totalLabels} etiquetas. Esto puede tardar y abrir una impresión pesada. ¿Deseas continuar?`)
    ) {
      return;
    }

    printSelectedBarcodeLabels(selectedProducts, {
      columns: Number(labelColumns || 2),
      copies: Number(labelCopies || 1),
      labelWidth: 44,
      labelHeight: 33,
    });
  }

  return (
    <div className="order-2 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm xl:order-1">
      <div className="border-b border-slate-100 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-xl font-bold text-slate-800">
              <Package className="h-5 w-5 text-emerald-600" />
              Lista de productos
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Selecciona productos y genera etiquetas por columnas.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 xl:w-[520px]">
            <select
              value={labelColumns}
              onChange={e => setLabelColumns(e.target.value)}
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-200"
            >
              <option value="1">1 columna</option>
              <option value="2">2 columnas</option>
              <option value="3">3 columnas</option>
            </select>

            <input
              type="number"
              min="1"
              value={labelCopies}
              onChange={e => setLabelCopies(e.target.value)}
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="Copias"
            />

            <button
              type="button"
              onClick={toggleAllVisibleProducts}
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              {allVisibleSelected ? 'Quitar página' : 'Seleccionar página'}
            </button>

            <button
              type="button"
              onClick={printSelectedLabels}
              className="rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"
            >
              <Printer className="mr-1 inline h-4 w-4" />
              Imprimir {selectedProducts.length}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr]">
        <aside className="border-b border-slate-100 p-4 lg:border-b-0 lg:border-r">
          <h4 className="mb-4 font-semibold">Categorías</h4>

          <div className="space-y-2">
            {categories.map(cat => {
              const count = cat === 'Todas'
                ? products.length
                : products.filter(p => p.category === cat).length;
              const selected = category === cat;

              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm ${
                    selected ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50'
                  }`}
                >
                  <span>{cat}</span>
                  <span className="rounded-full bg-white px-2 py-1 text-xs text-slate-500 shadow-sm">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <button className="mt-6 w-full rounded-2xl border border-slate-200 px-4 py-3 font-medium hover:bg-slate-50">
            <Plus className="mr-2 inline h-4 w-4" />
            Nueva categoría
          </button>
        </aside>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-5 py-4">Etiq.</th>
                <th className="px-5 py-4">Producto</th>
                <th className="px-5 py-4">Categoría</th>
                <th className="px-5 py-4">Precio</th>
                <th className="px-5 py-4">Stock</th>
                <th className="px-5 py-4">Estado</th>
                <th className="px-5 py-4">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedProducts.map(product => {
                const s = statusText(product);
                const exp = expirationText ? expirationText(product) : null;
                const isDeleting = pendingDeleteId === product.id;

                return (
                  <tr key={product.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <input
                        type="checkbox"
                        checked={selectedLabelIds.includes(product.id)}
                        onChange={() => toggleLabelProduct(product.id)}
                        className="h-4 w-4"
                      />
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            loading="lazy"
                            className="h-12 w-12 rounded-xl object-cover shadow-sm"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl">
                            📦
                          </div>
                        )}

                        <div>
                          <p className="font-bold text-slate-900">{product.name}</p>
                          <p className="text-xs text-slate-500">
                            SKU: {product.sku}{product.barcode ? ` · Barra: ${product.barcode}` : ''}
                          </p>

                          {businessConfig?.productExtraFields && (
                            <p className="text-xs font-semibold text-emerald-700">
                              {getProductVariantText(product) || 'Sin variante'}
                            </p>
                          )}

                          {businessConfig?.usesExpiration && product.expirationDate && (
                            <p className={`text-xs ${exp?.color}`}>
                              Caduca: {product.expirationDate} · {exp?.label}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-slate-600">{product.category}</td>
                    <td className="px-5 py-4 font-medium">${Number(product.price || 0).toFixed(2)}</td>

                    <td className="px-5 py-4">
                      <p className="font-bold">{product.stock}</p>
                      <p className={`text-xs ${s.color}`}>{s.label}</p>
                    </td>

                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.badge}`}>
                        {product.status}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      {isDeleting ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => deleteProduct(product.id)}
                            className="rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-white hover:bg-red-600"
                          >
                            Confirmar
                          </button>

                          <button
                            onClick={() => setPendingDeleteId(null)}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => printProductBarcodeLabel(product)}
                            className="rounded-xl border border-emerald-100 p-2 text-emerald-600 hover:bg-emerald-50"
                            title="Imprimir código"
                          >
                            <Printer className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => editProduct(product)}
                            className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50"
                          >
                            <Edit className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => setPendingDeleteId(product.id)}
                            className="rounded-xl border border-red-100 p-2 text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-500 lg:flex-row lg:items-center lg:justify-between">
            <span>
              Mostrando {filtered.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + productsPerPage, filtered.length)} de {filtered.length} filtrados · Total {products.length} productos · Seleccionados para etiquetas: {selectedProducts.length}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage(page => Math.max(page - 1, 1))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>

              <span className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                Página {safePage} de {totalPages}
              </span>

              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage(page => Math.min(page + 1, totalPages))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}