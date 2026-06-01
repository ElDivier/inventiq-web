export function exportToCSV(filename, rows) {
  if (!rows || rows.length === 0) {
    alert('No existen datos para exportar.');
    return;
  }

  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(';'),
    ...rows.map(row => headers.map(header => {
      const value = row[header] ?? '';
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(';')),
  ];

  const csv = csvLines.join(String.fromCharCode(10));
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}