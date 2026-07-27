import { useState } from 'react';
import {
  Download,
  DollarSign,
  ClipboardList,
  TrendingUp,
  Percent,
  BarChart3,
} from 'lucide-react';
import Field from '../components/Field';
import Metric from '../components/Metric';
import { exportToCSV } from '../utils/csv';
import {
  getPeriodRange,
  isRecordInPeriod,
  formatPeriodDate,
} from '../utils/dates';

export default function CashPage({ sales = [], purchases = [] }) {
  const [closePeriod, setClosePeriod] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [cashCounted, setCashCounted] = useState('');
  const [cashNote, setCashNote] = useState('');

  const safeSales = Array.isArray(sales) ? sales : [];
  const safePurchases = Array.isArray(purchases) ? purchases : [];
  const periodRange = getPeriodRange(closePeriod, customStart, customEnd);

  const completedSales = safeSales.filter(sale => sale.status !== 'Anulada');
  const cancelledSales = safeSales.filter(sale => sale.status === 'Anulada');
  const periodSales = completedSales.filter(sale => isRecordInPeriod(sale, periodRange));
  const periodCancelledSales = cancelledSales.filter(sale => isRecordInPeriod(sale, periodRange));
  const periodPurchases = safePurchases.filter(purchase => isRecordInPeriod(purchase, periodRange));

  const periodSalesTotal = periodSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const periodPurchasesTotal = periodPurchases.reduce((sum, purchase) => sum + Number(purchase.total || 0), 0);
  const periodProfit = periodSales.reduce((sum, sale) => sum + Number(sale.profit || 0), 0);
  const periodDiscount = periodSales.reduce((sum, sale) => sum + Number(sale.discount || 0), 0);
  const periodUnits = periodSales.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);
  const periodBalance = periodSalesTotal - periodPurchasesTotal;

  const cashExpected = periodSales
    .filter(sale => sale.paymentMethod === 'Efectivo')
    .reduce((sum, sale) => sum + Number(sale.total || 0), 0);

  const cashDifference = cashCounted === '' ? 0 : Number(cashCounted || 0) - cashExpected;

  const paymentSummary = periodSales.reduce((acc, sale) => {
    const method = sale.paymentMethod || 'Sin método';
    acc[method] = (acc[method] || 0) + Number(sale.total || 0);
    return acc;
  }, {});

  const closeLabel = `${formatPeriodDate(periodRange.start)} al ${formatPeriodDate(periodRange.end)}`;

  function exportCashCut() {
    const rows = [
      { Concepto: 'Periodo', Valor: closeLabel },
      { Concepto: 'Ventas completadas', Valor: periodSales.length },
      { Concepto: 'Ventas anuladas', Valor: periodCancelledSales.length },
      { Concepto: 'Unidades vendidas', Valor: periodUnits },
      { Concepto: 'Total vendido', Valor: periodSalesTotal.toFixed(2) },
      { Concepto: 'Compras registradas', Valor: periodPurchasesTotal.toFixed(2) },
      { Concepto: 'Balance ventas - compras', Valor: periodBalance.toFixed(2) },
      { Concepto: 'Utilidad estimada', Valor: periodProfit.toFixed(2) },
      { Concepto: 'Descuentos aplicados', Valor: periodDiscount.toFixed(2) },
      { Concepto: 'Efectivo esperado', Valor: cashExpected.toFixed(2) },
      { Concepto: 'Efectivo contado', Valor: cashCounted === '' ? '' : Number(cashCounted || 0).toFixed(2) },
      { Concepto: 'Diferencia de caja', Valor: cashCounted === '' ? '' : cashDifference.toFixed(2) },
      { Concepto: 'Observacion del cierre', Valor: cashNote || '' },
      ...Object.entries(paymentSummary).map(([method, value]) => ({
        Concepto: `Pago - ${method}`,
        Valor: Number(value || 0).toFixed(2),
      })),
    ];

    exportToCSV(`inventiq_cierre_${closePeriod}.csv`, rows);
  }

  const periodOptions = [
    ['today', 'Hoy'],
    ['week', '7 días'],
    ['15days', '15 días'],
    ['month', 'Este mes'],
    ['previousMonth', 'Mes anterior'],
    ['custom', 'Personalizado'],
  ];

  return (
    <div className="space-y-5">
      <section className="iq-module-hero iq-module-hero-finance">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900">Cierres y cortes por periodo</h3>
            <p className="text-sm text-slate-500">Controla ventas, compras, descuentos, utilidad y métodos de pago por periodo.</p>
            <p className="mt-2 text-sm font-bold text-cyan-800">Periodo seleccionado: {closeLabel}</p>
          </div>

          <button
            type="button"
            onClick={exportCashCut}
            className="iq-action-primary"
          >
            <Download className="mr-2 inline h-4 w-4" />
            Exportar cierre
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {periodOptions.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setClosePeriod(value)}
              className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
                closePeriod === value
                  ? 'bg-cyan-700 text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {closePeriod === 'custom' && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Desde" type="date" value={customStart} onChange={setCustomStart} />
            <Field label="Hasta" type="date" value={customEnd} onChange={setCustomEnd} />
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric icon={DollarSign} label="Ventas del periodo" value={`$${periodSalesTotal.toFixed(2)}`} note={`${periodSales.length} venta(s)`} color="emerald" />
        <Metric icon={ClipboardList} label="Compras del periodo" value={`$${periodPurchasesTotal.toFixed(2)}`} note={`${periodPurchases.length} compra(s)`} color="amber" />
        <Metric icon={TrendingUp} label="Utilidad estimada" value={`$${periodProfit.toFixed(2)}`} note="periodo" color="blue" />
        <Metric icon={Percent} label="Descuentos" value={`$${periodDiscount.toFixed(2)}`} note={`${periodCancelledSales.length} anulada(s)`} color="red" />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="iq-operation-card p-6">
          <p className="text-sm font-bold text-slate-700">Cierre de efectivo</p>
          <p className="mt-2 text-sm text-slate-500">Compara el efectivo esperado contra el efectivo contado físicamente.</p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">Efectivo esperado</p>
              <p className="text-2xl font-extrabold text-slate-900">${cashExpected.toFixed(2)}</p>
            </div>

            <Field
              label="Efectivo contado"
              type="number"
              min="0"
              step="0.01"
              value={cashCounted}
              onChange={setCashCounted}
              placeholder="0.00"
            />
          </div>

          {cashCounted !== '' && (
            <p className={`mt-3 rounded-2xl p-4 text-sm font-bold ${
              cashDifference === 0
                ? 'bg-cyan-50 text-cyan-800'
                : cashDifference > 0
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-red-50 text-red-700'
            }`}>
              Diferencia de caja: ${cashDifference.toFixed(2)}
            </p>
          )}

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Observación del cierre</span>
            <textarea
              value={cashNote}
              onChange={e => setCashNote(e.target.value)}
              className="min-h-20 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-200"
              placeholder="Ej: faltante por cambio, sobrante, retiro de efectivo..."
            />
          </label>
        </div>

        <div className="iq-operation-card p-6">
          <p className="text-sm font-bold text-slate-700">Balance ventas - compras</p>
          <p className={`mt-2 text-4xl font-extrabold ${periodBalance >= 0 ? 'text-cyan-800' : 'text-red-600'}`}>
            ${periodBalance.toFixed(2)}
          </p>
          <p className="mt-2 text-sm text-slate-500">Unidades vendidas: {periodUnits}</p>
        </div>

        <div className="iq-operation-card p-6">
          <p className="mb-4 text-sm font-bold text-slate-700">Métodos de pago</p>

          {Object.keys(paymentSummary).length === 0 && (
            <p className="text-sm text-slate-500">Sin ventas en este periodo.</p>
          )}

          <div className="space-y-3">
            {Object.entries(paymentSummary).map(([method, value]) => (
              <div key={method} className="flex justify-between rounded-2xl bg-slate-50 p-4 text-sm">
                <span>{method}</span>
                <strong>${Number(value || 0).toFixed(2)}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="iq-operation-card p-6">
          <p className="mb-4 text-sm font-bold text-slate-700">Resumen del periodo</p>

          <div className="space-y-3">
            <div className="flex justify-between rounded-2xl bg-slate-50 p-4 text-sm">
              <span>Ventas completadas</span>
              <strong>{periodSales.length}</strong>
            </div>

            <div className="flex justify-between rounded-2xl bg-slate-50 p-4 text-sm">
              <span>Ventas anuladas</span>
              <strong>{periodCancelledSales.length}</strong>
            </div>

            <div className="flex justify-between rounded-2xl bg-slate-50 p-4 text-sm">
              <span>Compras registradas</span>
              <strong>{periodPurchases.length}</strong>
            </div>

            <div className="flex justify-between rounded-2xl bg-slate-50 p-4 text-sm">
              <span>Unidades vendidas</span>
              <strong>{periodUnits}</strong>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}