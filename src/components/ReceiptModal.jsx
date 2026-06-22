import React from 'react';

function formatMoney(value) {
  const number = Number(value || 0);
  return `$${number.toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return new Date().toLocaleString('es-EC');

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString('es-EC', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getSaleItems(sale) {
  if (Array.isArray(sale?.items) && sale.items.length > 0) {
    return sale.items;
  }

  return [{
    product: sale?.product || 'Producto',
    quantity: Number(sale?.quantity || 1),
    price: Number(sale?.total || 0) / Math.max(Number(sale?.quantity || 1), 1),
    subtotal: Number(sale?.total || 0),
  }];
}

export default function ReceiptModal({ sale, currentUser, onClose }) {
  if (!sale) return null;

  const items = getSaleItems(sale);
  const subtotal = Number(sale.subtotal ?? sale.total ?? 0);
  const discount = Number(sale.discount || 0);
  const total = Number(sale.total || 0);
  const storeName = currentUser?.store || sale.storeName || 'InventiQ';
  const footer = currentUser?.receiptFooter || 'Gracias por su compra.';

  function printReceipt() {
    window.print();
  }

  return (
    <div className="receipt-modal-overlay no-print">
      <style>{`
        .receipt-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(15, 23, 42, 0.55);
          padding: 16px;
        }

        .receipt-modal-card {
          width: min(420px, 100%);
          max-height: 92vh;
          overflow: auto;
          border-radius: 24px;
          background: #ffffff;
          box-shadow: 0 25px 70px rgba(15, 23, 42, 0.28);
        }

        .receipt-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-bottom: 1px solid #e2e8f0;
          padding: 16px 18px;
        }

        .receipt-modal-title {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
          color: #064e3b;
        }

        .receipt-modal-actions {
          display: flex;
          gap: 8px;
          padding: 14px 18px 18px;
        }

        .receipt-button {
          flex: 1;
          border: 0;
          border-radius: 14px;
          padding: 12px 14px;
          font-weight: 800;
          cursor: pointer;
        }

        .receipt-button-print {
          background: #059669;
          color: #ffffff;
        }

        .receipt-button-close {
          background: #f1f5f9;
          color: #334155;
        }

        .receipt-preview-wrap {
          display: flex;
          justify-content: center;
          background: #f8fafc;
          padding: 18px;
        }

        #thermal-receipt-80mm {
          width: 72mm;
          min-height: auto;
          background: #ffffff;
          color: #111827;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 11px;
          line-height: 1.25;
          padding: 3mm 4mm;
          box-sizing: border-box;
        }

        .receipt-logo {
          display: block;
          max-width: 42mm;
          max-height: 20mm;
          object-fit: contain;
          margin: 0 auto 5px;
        }

        .receipt-center { text-align: center; }
        .receipt-store { font-size: 16px; font-weight: 900; text-transform: uppercase; }
        .receipt-small { font-size: 10px; }
        .receipt-muted { color: #475569; }
        .receipt-line { border-top: 1px dashed #111827; margin: 7px 0; }

        .receipt-row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }

        .receipt-row strong { font-weight: 800; }

        .receipt-item {
          margin-bottom: 6px;
        }

        .receipt-item-name {
          font-weight: 800;
          word-break: break-word;
        }

        .receipt-item-detail {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          font-size: 10.5px;
        }

        .receipt-total {
          font-size: 16px;
          font-weight: 900;
        }

        .receipt-footer {
          margin-top: 8px;
          text-align: center;
          font-size: 10px;
        }

        @page {
          size: 80mm auto;
          margin: 0;
        }

        @media print {
          html, body {
            width: 80mm;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          body * {
            visibility: hidden !important;
          }

          #thermal-receipt-80mm,
          #thermal-receipt-80mm * {
            visibility: visible !important;
          }

          #thermal-receipt-80mm {
            position: absolute;
            left: 0;
            top: 0;
            width: 72mm !important;
            padding: 3mm 4mm !important;
            box-shadow: none !important;
          }

          .no-print {
            background: transparent !important;
          }
        }
      `}</style>

      <div className="receipt-modal-card no-print">
        <div className="receipt-modal-header no-print">
          <h3 className="receipt-modal-title">Comprobante</h3>
          <button type="button" onClick={onClose} className="receipt-button receipt-button-close" style={{ flex: '0 0 auto', padding: '8px 12px' }}>
            ✕
          </button>
        </div>

        <div className="receipt-preview-wrap">
          <div id="thermal-receipt-80mm">
            {currentUser?.logoUrl && (
              <img src={currentUser.logoUrl} alt={storeName} className="receipt-logo" />
            )}

            <div className="receipt-center">
              <div className="receipt-store">{storeName}</div>
              {currentUser?.businessId && <div className="receipt-small">RUC/C.I.: {currentUser.businessId}</div>}
              {currentUser?.address && <div className="receipt-small">{currentUser.address}</div>}
              {currentUser?.phone && <div className="receipt-small">Tel: {currentUser.phone}</div>}
              {currentUser?.commercialEmail && <div className="receipt-small">{currentUser.commercialEmail}</div>}
            </div>

            <div className="receipt-line" />

            <div className="receipt-row receipt-small">
              <span>Comprobante:</span>
              <strong>{sale.code || sale.id || 'Venta'}</strong>
            </div>
            <div className="receipt-row receipt-small">
              <span>Fecha:</span>
              <strong>{formatDate(sale.createdAt || sale.created_at || sale.date)}</strong>
            </div>
            <div className="receipt-row receipt-small">
              <span>Cliente:</span>
              <strong>{sale.customer || sale.invoiceName || 'Consumidor final'}</strong>
            </div>
            <div className="receipt-row receipt-small">
              <span>Pago:</span>
              <strong>{sale.paymentMethod || sale.payment_method || 'Efectivo'}</strong>
            </div>

            {sale.invoiceEnabled && (
              <>
                <div className="receipt-line" />
                <div className="receipt-small"><strong>Datos de factura</strong></div>
                {sale.invoiceName && <div className="receipt-small">Nombre: {sale.invoiceName}</div>}
                {sale.invoiceIdentification && <div className="receipt-small">Identificación: {sale.invoiceIdentification}</div>}
                {sale.invoiceAddress && <div className="receipt-small">Dirección: {sale.invoiceAddress}</div>}
                {sale.invoiceEmail && <div className="receipt-small">Correo: {sale.invoiceEmail}</div>}
              </>
            )}

            <div className="receipt-line" />

            <div className="receipt-row receipt-small">
              <strong>Producto</strong>
              <strong>Total</strong>
            </div>

            <div className="receipt-line" />

            {items.map((item, index) => {
              const quantity = Number(item.quantity || 1);
              const price = Number(item.price || item.unitPrice || 0);
              const itemSubtotal = Number(item.subtotal ?? (price * quantity));

              return (
                <div key={`${item.productId || item.id || index}`} className="receipt-item">
                  <div className="receipt-item-name">{item.product || item.name || 'Producto'}</div>
                  <div className="receipt-item-detail">
                    <span>{quantity} x {formatMoney(price)}</span>
                    <strong>{formatMoney(itemSubtotal)}</strong>
                  </div>
                </div>
              );
            })}

            <div className="receipt-line" />

            <div className="receipt-row">
              <span>Subtotal</span>
              <strong>{formatMoney(subtotal)}</strong>
            </div>
            <div className="receipt-row">
              <span>Descuento</span>
              <strong>{formatMoney(discount)}</strong>
            </div>
            <div className="receipt-row receipt-total">
              <span>TOTAL</span>
              <span>{formatMoney(total)}</span>
            </div>

            {sale.status === 'Anulada' && (
              <>
                <div className="receipt-line" />
                <div className="receipt-center receipt-total">VENTA ANULADA</div>
              </>
            )}

            <div className="receipt-line" />
            <div className="receipt-footer">
              {footer}
              <br />
              <span className="receipt-muted">Comprobante generado por InventiQ</span>
            </div>
          </div>
        </div>

        <div className="receipt-modal-actions no-print">
          <button type="button" onClick={printReceipt} className="receipt-button receipt-button-print">
            Imprimir
          </button>
          <button type="button" onClick={onClose} className="receipt-button receipt-button-close">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
