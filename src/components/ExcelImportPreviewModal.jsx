import { getProductVariantText } from '../utils/products';

export default function ExcelImportPreviewModal({ preview, progress, onConfirm, onCancel }) {
  const sampleProducts = preview.products.slice(0, 8);

  return (
    <div className="iq-modal-overlay">
      <div className="iq-modal-card max-h-[90vh] w-full max-w-5xl overflow-y-auto">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900">Vista previa de importación</h3>
            <p className="mt-1 text-sm text-slate-500">Archivo: {preview.fileName}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50"
          >
            Cerrar
          </button>
        </div>

        <div className="space-y-5 p-5">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Filas leídas</p>
              <p className="text-3xl font-extrabold text-slate-900">{preview.totalRows}</p>
            </div>

            <div className="rounded-2xl bg-cyan-50 p-4">
              <p className="text-xs font-bold uppercase text-cyan-800">Listos para importar</p>
              <p className="text-3xl font-extrabold text-cyan-950">{preview.products.length}</p>
            </div>

            <div className="rounded-2xl bg-amber-50 p-4">
              <p className="text-xs font-bold uppercase text-amber-700">Omitidos / con error</p>
              <p className="text-3xl font-extrabold text-amber-900">{preview.skippedRows.length}</p>
            </div>
          </section>

          {preview.skippedRows.length > 0 && (
            <section className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="font-bold text-amber-900">Filas que no se importarán</p>
              <div className="mt-2 max-h-32 overflow-y-auto text-sm text-amber-800">
                {preview.skippedRows.slice(0, 20).map((row, index) => (
                  <p key={`${row}-${index}`}>• {row}</p>
                ))}
                {preview.skippedRows.length > 20 && (
                  <p>• Y {preview.skippedRows.length - 20} error(es) más...</p>
                )}
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <p className="font-bold text-slate-900">Primeros productos detectados</p>
              <p className="text-xs text-slate-500">
                Revisa que los datos estén correctos antes de guardar en Supabase.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-white text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3">Precio</th>
                    <th className="px-4 py-3">Costo opcional</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Variante</th>
                    <th className="px-4 py-3">Código</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {sampleProducts.map((product, index) => (
                    <tr key={`${product.sku}-${index}`}>
                      <td className="px-4 py-3 font-bold text-slate-900">{product.name}</td>
                      <td className="px-4 py-3 text-slate-600">{product.category}</td>
                      <td className="px-4 py-3">${Number(product.price || 0).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        {Number(product.cost || 0) > 0
                          ? `$${Number(product.cost || 0).toFixed(2)}`
                          : 'No registrado'}
                      </td>
                      <td className="px-4 py-3">{product.stock}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {getProductVariantText(product) || 'Sin variante'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {product.barcode || product.sku}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {progress && (
            <section className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
              <div className="flex items-center justify-between text-sm font-bold text-cyan-900">
                <span>Importando bloque {progress.batch} de {progress.batches}</span>
                <span>{progress.imported} / {progress.total}</span>
              </div>

              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-cyan-700 transition-all"
                  style={{
                    width: `${Math.round((progress.imported / Math.max(progress.total, 1)) * 100)}%`,
                  }}
                />
              </div>
            </section>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={Boolean(progress)}
              onClick={onCancel}
              className="rounded-2xl border border-slate-200 px-5 py-3 font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={Boolean(progress)}
              onClick={onConfirm}
              className="rounded-2xl bg-cyan-700 px-5 py-3 font-bold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {progress ? 'Importando...' : `Importar ${preview.products.length} producto(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}