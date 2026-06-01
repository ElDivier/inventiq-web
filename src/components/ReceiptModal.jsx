import StoreAvatar from './StoreAvatar';

function getAvatarLetter(user) {
  const source = String(user?.store || user?.name || user?.email || 'InventiQ').trim();
  return source.charAt(0).toUpperCase() || 'I';
}

function printReceiptDocument(sale, currentUser) {
  const isInvoice = sale.invoiceEnabled;
  const receiptItems = sale.items?.length > 0
    ? sale.items
    : [
      {
        product: sale.product,
        quantity: sale.quantity,
        price: sale.subtotal / Math.max(sale.quantity || 1, 1),
        subtotal: sale.subtotal,
      },
    ];

  const itemRows = receiptItems.map(item => `
    <tr>
      <td><strong>${item.product}</strong></td>
      <td>${item.quantity}</td>
      <td>$${Number(item.price || 0).toFixed(2)}</td>
      <td><strong>$${Number(item.subtotal || 0).toFixed(2)}</strong></td>
    </tr>
  `).join('');

  const logoBlock = currentUser.logoUrl
    ? `<img src="${currentUser.logoUrl}" alt="Logo" class="logo" />`
    : `<div class="avatar">${getAvatarLetter(currentUser)}</div>`;

  const invoiceBlock = isInvoice
    ? `
      <div class="box">
        <p class="label">Datos de facturación</p>
        <p><strong>Razón social:</strong> ${sale.invoiceName || sale.customer || 'No registrado'}</p>
        <p><strong>Cédula/RUC:</strong> ${sale.invoiceIdentification || 'No registrado'}</p>
        <p><strong>Dirección:</strong> ${sale.invoiceAddress || 'No registrada'}</p>
        <p><strong>Correo:</strong> ${sale.invoiceEmail || 'No registrado'}</p>
      </div>
    `
    : `
      <div class="box">
        <p class="label">Cliente</p>
        <p><strong>Consumidor final</strong></p>
      </div>
    `;

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${sale.code} - InventiQ</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 24px; font-family: Arial, sans-serif; color: #0f172a; background: #fff; }
          .receipt { max-width: 760px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 18px; overflow: hidden; }
          .header { padding: 24px; background: #ecfdf5; display: flex; gap: 16px; align-items: center; }
          .logo, .avatar { width: 72px; height: 72px; border-radius: 18px; object-fit: cover; }
          .avatar { display: flex; align-items: center; justify-content: center; background: #a855f7; color: white; font-size: 32px; font-weight: 800; }
          h1 { margin: 0; font-size: 28px; }
          p { margin: 4px 0; font-size: 14px; }
          .content { padding: 24px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
          .box { border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; }
          .label { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: .04em; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th { background: #f8fafc; color: #475569; font-size: 12px; text-align: left; padding: 12px; border-bottom: 1px solid #e2e8f0; }
          td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
          .totals { margin-top: 18px; margin-left: auto; max-width: 320px; background: #f8fafc; border-radius: 14px; padding: 16px; }
          .line { display: flex; justify-content: space-between; margin: 8px 0; }
          .total { border-top: 1px solid #cbd5e1; padding-top: 12px; font-size: 20px; font-weight: 800; }
          .footer { text-align: center; color: #64748b; margin-top: 24px; font-size: 12px; }
          .no-print { text-align: center; margin: 18px 0; }
          .no-print button { background: #059669; color: white; border: 0; border-radius: 12px; padding: 12px 18px; font-weight: 700; cursor: pointer; }
          @media print {
            body { padding: 0; }
            .receipt { border: none; border-radius: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            ${logoBlock}
            <div>
              <h1>${currentUser.store || 'Mi Tienda'}</h1>
              <p><strong>Atendido por:</strong> ${currentUser.name || ''}</p>
              <p><strong>Ciudad:</strong> ${currentUser.city || ''}</p>
              ${currentUser.businessId ? `<p><strong>RUC/ID:</strong> ${currentUser.businessId}</p>` : ''}
              ${currentUser.address ? `<p><strong>Dirección:</strong> ${currentUser.address}</p>` : ''}
              ${currentUser.phone ? `<p><strong>Teléfono:</strong> ${currentUser.phone}</p>` : ''}
              ${currentUser.commercialEmail ? `<p><strong>Correo:</strong> ${currentUser.commercialEmail}</p>` : ''}
            </div>
          </div>
          <div class="content">
            <div class="grid">
              <div class="box">
                <p class="label">${isInvoice ? 'Factura / comprobante' : 'Comprobante de venta'}</p>
                <p><strong>Código:</strong> ${sale.code}</p>
                <p><strong>Fecha:</strong> ${sale.date}</p>
                <p><strong>Estado:</strong> ${sale.status}</p>
                <p><strong>Pago:</strong> ${sale.paymentMethod}</p>
              </div>
              ${invoiceBlock}
            </div>
            <table>
              <thead>
                <tr><th>Producto</th><th>Cantidad</th><th>P. Unitario</th><th>Total</th></tr>
              </thead>
              <tbody>
                ${itemRows}
              </tbody>
            </table>
            <div class="totals">
              <div class="line"><span>Subtotal</span><strong>$${sale.subtotal.toFixed(2)}</strong></div>
              <div class="line"><span>Descuento</span><strong>-$${sale.discount.toFixed(2)}</strong></div>
              <div class="line total"><span>Total</span><span>$${sale.total.toFixed(2)}</span></div>
            </div>
            <div class="footer">
              <p>${currentUser.receiptFooter || 'Gracias por su compra.'}</p>
              <p>Documento generado por InventiQ. Comprobante referencial para control interno.</p>
            </div>
          </div>
        </div>
        <div class="no-print"><button onclick="window.print()">Imprimir / guardar PDF</button></div>
        <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=900,height=700');

  if (!printWindow) {
    alert('Permite ventanas emergentes para imprimir el comprobante.');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

export default function ReceiptModal({ sale, currentUser, onClose }) {
  const isInvoice = sale.invoiceEnabled;
  const receiptItems = sale.items?.length > 0
    ? sale.items
    : [
      {
        product: sale.product,
        quantity: sale.quantity,
        price: sale.subtotal / Math.max(sale.quantity || 1, 1),
        subtotal: sale.subtotal,
      },
    ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900">{isInvoice ? 'Factura / comprobante' : 'Comprobante de venta'}</h3>
            <p className="text-sm text-slate-500">{sale.code} · {sale.date}</p>
          </div>
          <button onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50">Cerrar</button>
        </div>

        <div className="p-6" id="receipt-print-area">
          <div className="mb-6 rounded-3xl bg-emerald-50 p-5">
            <div className="mb-3 flex items-center gap-3">
              <StoreAvatar currentUser={currentUser} size="lg" />
              <h2 className="text-2xl font-extrabold text-emerald-900">{currentUser.store}</h2>
            </div>
            <p className="text-sm text-emerald-800">Atendido por: {currentUser.name}</p>
            <p className="text-sm text-emerald-800">Ciudad: {currentUser.city}</p>
            {currentUser.businessId && <p className="text-sm text-emerald-800">RUC/ID: {currentUser.businessId}</p>}
            {currentUser.address && <p className="text-sm text-emerald-800">Dirección: {currentUser.address}</p>}
            {currentUser.phone && <p className="text-sm text-emerald-800">Teléfono: {currentUser.phone}</p>}
            {currentUser.commercialEmail && <p className="text-sm text-emerald-800">Correo: {currentUser.commercialEmail}</p>}
          </div>

          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 p-4">
              <p className="text-xs font-bold uppercase text-slate-400">Comprobante</p>
              <p className="mt-1 font-bold text-slate-900">{sale.code}</p>
              <p className="text-sm text-slate-500">Estado: {sale.status}</p>
              <p className="text-sm text-slate-500">Pago: {sale.paymentMethod}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 p-4">
              <p className="text-xs font-bold uppercase text-slate-400">Cliente</p>
              <p className="mt-1 font-bold text-slate-900">{sale.customer || 'Consumidor final'}</p>
              {isInvoice ? (
                <div className="mt-1 text-sm text-slate-500">
                  <p>Cédula/RUC: {sale.invoiceIdentification || 'No registrado'}</p>
                  <p>Dirección: {sale.invoiceAddress || 'No registrada'}</p>
                  <p>Correo: {sale.invoiceEmail || 'No registrado'}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Venta a consumidor final</p>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Cant.</th>
                  <th className="px-4 py-3">P. Unit.</th>
                  <th className="px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {receiptItems.map((item, index) => (
                  <tr key={`${item.productId || item.product}-${index}`}>
                    <td className="px-4 py-4 font-bold text-slate-900">{item.product}</td>
                    <td className="px-4 py-4">{item.quantity}</td>
                    <td className="px-4 py-4">${Number(item.price || 0).toFixed(2)}</td>
                    <td className="px-4 py-4 font-bold">${Number(item.subtotal || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 rounded-2xl bg-slate-50 p-5">
            <div className="flex justify-between text-sm text-slate-600"><span>Subtotal</span><strong>${sale.subtotal.toFixed(2)}</strong></div>
            <div className="mt-2 flex justify-between text-sm text-slate-600"><span>Descuento</span><strong>-${sale.discount.toFixed(2)}</strong></div>
            <div className="mt-3 border-t border-slate-200 pt-3">
              <div className="flex justify-between text-lg font-extrabold text-slate-900"><span>Total</span><span>${sale.total.toFixed(2)}</span></div>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">{currentUser.receiptFooter || 'Gracias por su compra.'}</p>
          <p className="mt-2 text-center text-xs text-slate-400">Documento generado por InventiQ. Comprobante referencial para control interno.</p>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 p-5 sm:flex-row sm:justify-end">
          <button onClick={onClose} className="rounded-2xl border border-slate-200 px-5 py-3 font-bold text-slate-600 hover:bg-slate-50">Cerrar</button>
          <button onClick={() => printReceiptDocument(sale, currentUser)} className="rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700">Imprimir / guardar PDF</button>
        </div>
      </div>
    </div>
  );
}