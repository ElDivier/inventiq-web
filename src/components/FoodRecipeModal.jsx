import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Loader2, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '../supabaseClient';

function formatQuantity(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export default function FoodRecipeModal({
  currentUser,
  menuProduct,
  ingredients,
  onClose,
  onRecipeChange,
}) {
  const [recipeItems, setRecipeItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState({
    ingredientProductId: '',
    quantity: '',
    unit: '',
    notes: '',
  });

  const ingredientById = useMemo(() => {
    return new Map((ingredients || []).map(item => [String(item.id), item]));
  }, [ingredients]);

  const availableIngredients = useMemo(() => {
    const usedIds = new Set(recipeItems.map(item => String(item.ingredient_product_id)));
    return (ingredients || []).filter(item => !usedIds.has(String(item.id)));
  }, [ingredients, recipeItems]);

  useEffect(() => {
    if (!currentUser?.id || !menuProduct?.id) return;
    loadRecipeItems();
  }, [currentUser?.id, menuProduct?.id]);

  async function loadRecipeItems() {
    try {
      setLoading(true);
      setNotice(null);

      const { data, error } = await supabase
        .from('product_recipes')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('menu_product_id', menuProduct.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setRecipeItems(data || []);
    } catch (error) {
      console.error('Error cargando receta:', error);
      setNotice({ type: 'error', message: `No se pudo cargar la receta: ${error.message}` });
    } finally {
      setLoading(false);
    }
  }

  async function updateRecipeEnabled(enabled) {
    if (!currentUser?.id || !menuProduct?.id) return;

    const { error } = await supabase
      .from('products')
      .update({ recipe_enabled: enabled })
      .eq('id', menuProduct.id)
      .eq('user_id', currentUser.id);

    if (error) {
      console.error('Error actualizando recipe_enabled:', error);
      return;
    }

    if (typeof onRecipeChange === 'function') {
      onRecipeChange(menuProduct.id, enabled);
    }
  }

  async function addIngredientToRecipe(event) {
    event.preventDefault();

    if (!form.ingredientProductId) {
      setNotice({ type: 'error', message: 'Selecciona un insumo para la receta.' });
      return;
    }

    const quantity = Number(form.quantity || 0);
    if (Number.isNaN(quantity) || quantity <= 0) {
      setNotice({ type: 'error', message: 'Ingresa una cantidad mayor a 0.' });
      return;
    }

    try {
      setSaving(true);
      setNotice(null);

      const payload = {
        user_id: currentUser.id,
        menu_product_id: menuProduct.id,
        ingredient_product_id: form.ingredientProductId,
        quantity,
        unit: form.unit.trim(),
        notes: form.notes.trim(),
      };

      const { data, error } = await supabase
        .from('product_recipes')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      const nextItems = [...recipeItems, data];
      setRecipeItems(nextItems);
      setForm({ ingredientProductId: '', quantity: '', unit: '', notes: '' });
      setNotice({ type: 'success', message: 'Insumo agregado a la receta.' });

      if (nextItems.length > 0) {
        await updateRecipeEnabled(true);
      }
    } catch (error) {
      console.error('Error agregando insumo a receta:', error);
      setNotice({ type: 'error', message: `No se pudo agregar el insumo: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function removeRecipeItem(itemId) {
    try {
      setSaving(true);
      setNotice(null);

      const { error } = await supabase
        .from('product_recipes')
        .delete()
        .eq('id', itemId)
        .eq('user_id', currentUser.id);

      if (error) throw error;

      const nextItems = recipeItems.filter(item => item.id !== itemId);
      setRecipeItems(nextItems);
      setNotice({ type: 'success', message: 'Insumo eliminado de la receta.' });

      if (nextItems.length === 0) {
        await updateRecipeEnabled(false);
      }
    } catch (error) {
      console.error('Error eliminando insumo de receta:', error);
      setNotice({ type: 'error', message: `No se pudo eliminar el insumo: ${error.message}` });
    } finally {
      setSaving(false);
    }
  }

  if (!menuProduct) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <p className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-emerald-600">
              <BookOpen className="h-4 w-4" /> Receta del producto
            </p>
            <h3 className="mt-1 text-2xl font-black text-slate-900">{menuProduct.name}</h3>
            <p className="mt-1 text-sm text-slate-500">
              Agrega los insumos necesarios para preparar este producto del menú.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-94px)] overflow-y-auto p-5">
          {notice && (
            <div className={`mb-4 rounded-2xl p-4 text-sm font-semibold ${notice.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {notice.message}
            </div>
          )}

          <form onSubmit={addIngredientToRecipe} className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
            <h4 className="mb-3 text-sm font-black uppercase tracking-wide text-emerald-800">
              Agregar insumo a la receta
            </h4>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_0.5fr_0.5fr_1fr_auto] lg:items-end">
              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Insumo</span>
                <select
                  value={form.ingredientProductId}
                  onChange={event => setForm(prev => ({ ...prev, ingredientProductId: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  <option value="">Seleccionar insumo</option>
                  {availableIngredients.map(ingredient => (
                    <option key={ingredient.id} value={ingredient.id}>
                      {ingredient.name} · Stock: {ingredient.stock}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Cantidad</span>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.quantity}
                  onChange={event => setForm(prev => ({ ...prev, quantity: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="0"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Unidad</span>
                <input
                  value={form.unit}
                  onChange={event => setForm(prev => ({ ...prev, unit: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="g, ml, und"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Nota</span>
                <input
                  value={form.notes}
                  onChange={event => setForm(prev => ({ ...prev, notes: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="Opcional"
                />
              </label>

              <button
                type="submit"
                disabled={saving || availableIngredients.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Agregar
              </button>
            </div>
          </form>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-4">
              <h4 className="text-sm font-black uppercase tracking-wide text-slate-500">
                Insumos de la receta
              </h4>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-8 text-sm font-semibold text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando receta...
              </div>
            ) : recipeItems.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Todavía no hay insumos en esta receta.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recipeItems.map(item => {
                  const ingredient = ingredientById.get(String(item.ingredient_product_id));

                  return (
                    <div key={item.id} className="grid gap-3 p-4 md:grid-cols-[1.2fr_0.6fr_1fr_auto] md:items-center">
                      <div>
                        <p className="font-black text-slate-900">{ingredient?.name || 'Insumo no encontrado'}</p>
                        <p className="text-xs text-slate-400">{ingredient?.category || 'Sin categoría'}</p>
                      </div>

                      <div className="text-sm font-black text-emerald-700">
                        {formatQuantity(item.quantity)} {item.unit || ''}
                      </div>

                      <div className="text-sm text-slate-500">
                        {item.notes || 'Sin notas'}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeRecipeItem(item.id)}
                        disabled={saving}
                        className="rounded-xl border border-red-100 p-2 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Eliminar de la receta"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="font-bold">Receta activa para control de insumos.</p>
            <p className="mt-1">Al vender este producto del menú, InventiQ descontará automáticamente las cantidades indicadas de cada insumo.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
