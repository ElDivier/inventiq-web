export function getBarcodePrefix(businessType = 'general') {
  const prefixes = {
    ropa: 'ROP',
    general: 'INV',
    cafeteria: 'CAF',
    ferreteria: 'FER',
    taller: 'TAL',
    otro: 'INV',
  };

  return prefixes[businessType] || 'INV';
}

export function generateInternalBarcode(businessType = 'general') {
  const prefix = getBarcodePrefix(businessType);
  const timePart = String(Date.now()).slice(-6);
  const randomPart = String(Math.floor(Math.random() * 999)).padStart(3, '0');

  return `${prefix}${timePart}${randomPart}`;
}

export function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildBarcodeLabelHtml(productsToPrint, options = {}) {
  const columns = Number(options.columns || 2);
  const copies = Math.max(Number(options.copies || 1), 1);
  const labelWidth = Number(options.labelWidth || 44);
  const labelHeight = Number(options.labelHeight || 33);
  const pageWidth = labelWidth * columns;
  const labels = [];

  for (let i = 0; i < copies; i += 1) {
    productsToPrint.forEach(product => {
      const code = String(product?.barcode || product?.sku || '').trim();
      if (!code) return;
      labels.push({ code });
    });
  }

  const pages = [];

  for (let i = 0; i < labels.length; i += columns) {
    pages.push(labels.slice(i, i + columns));
  }

  const pageBlocks = pages.map(row => {
    const cells = Array.from({ length: columns }).map((_, index) => {
      const item = row[index];

      if (!item) return '<div class="label empty"></div>';

      const safeCode = escapeHtml(item.code);

      return `
        <div class="label">
          <div class="inner">
            <svg class="barcode" data-code="${safeCode}"></svg>
            <div class="code">${safeCode}</div>
          </div>
        </div>
      `;
    }).join('');

    return `<section class="page">${cells}</section>`;
  }).join('');

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Etiquetas INVENTIQ</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
        <style>
          @page { size: ${pageWidth}mm ${labelHeight}mm; margin: 0; }
          * { box-sizing: border-box; }
          body { margin: 0; padding: 0; background: white; font-family: Arial, sans-serif; }
          .page { width: ${pageWidth}mm; height: ${labelHeight}mm; display: grid; grid-template-columns: repeat(${columns}, ${labelWidth}mm); page-break-after: always; break-after: page; }
          .label { width: ${labelWidth}mm; height: ${labelHeight}mm; display: flex; align-items: center; justify-content: center; padding: 2mm; overflow: hidden; }
          .label.empty { background: white; }
          .inner { width: 100%; text-align: center; }
          svg { width: ${Math.max(labelWidth - 4, 20)}mm; max-height: ${Math.max(labelHeight - 12, 12)}mm; }
          .code { margin-top: 1mm; font-size: 9px; font-weight: 700; letter-spacing: 0.4px; }
          .no-print { margin: 10px; text-align: center; }
          .no-print button { background: linear-gradient(105deg, #126bfa 0%, #0ea5e9 54%, #12d6c5 100%); color: white; border: 0; border-radius: 10px; padding: 10px 14px; font-weight: 700; cursor: pointer; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        ${pageBlocks}
        <div class="no-print"><button onclick="window.print()">Imprimir etiquetas</button></div>
        <script>
          document.querySelectorAll('.barcode').forEach(svg => {
            JsBarcode(svg, svg.dataset.code, {
              format: 'CODE128',
              displayValue: false,
              margin: 0,
              width: 1.35,
              height: 48
            });
          });
          window.onload = () => setTimeout(() => window.print(), 400);
        </script>
      </body>
    </html>
  `;
}

export function openPrintWindow(html) {
  const printWindow = window.open('', '_blank', 'width=700,height=500');

  if (!printWindow) {
    alert('Permite ventanas emergentes para imprimir las etiquetas.');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

export function printProductBarcodeLabel(product) {
  const code = String(product?.barcode || product?.sku || '').trim();

  if (!code) {
    alert('Este producto no tiene código de barras ni SKU para imprimir.');
    return;
  }

  openPrintWindow(buildBarcodeLabelHtml([product], {
    columns: 1,
    copies: 1,
    labelWidth: 51,
    labelHeight: 25,
  }));
}

export function printSelectedBarcodeLabels(productsToPrint, options = {}) {
  const validProducts = productsToPrint.filter(product => String(product?.barcode || product?.sku || '').trim());

  if (validProducts.length === 0) {
    alert('Selecciona al menos un producto con código de barras o SKU.');
    return;
  }

  openPrintWindow(buildBarcodeLabelHtml(validProducts, options));
}