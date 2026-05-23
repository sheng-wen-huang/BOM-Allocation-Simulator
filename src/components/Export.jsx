import { Download } from 'lucide-react';
import { EXPORT_COLUMNS, bomTemplateResultsToRows, datedResultFilename, downloadXlsx } from '../utils/spreadsheet.js';

function orderRows(rows, orderedParentSkus) {
  if (!orderedParentSkus || orderedParentSkus.length === 0) return rows;

  const orderMap = new Map(orderedParentSkus.map((sku, index) => [sku, index]));
  return [...rows].sort((left, right) => {
    const leftOrder = orderMap.get(left[1]);
    const rightOrder = orderMap.get(right[1]);
    if (leftOrder === undefined && rightOrder === undefined) return String(left[1]).localeCompare(String(right[1]));
    if (leftOrder === undefined) return 1;
    if (rightOrder === undefined) return -1;
    return leftOrder - rightOrder;
  });
}

function formatPreviewRows(rows) {
  const widths = rows[0].map((_, index) => Math.max(...rows.map((row) => String(row[index] ?? '').length)));
  return rows.map((row) => row.map((cell, index) => String(cell ?? '').padEnd(widths[index], ' ')).join(' | '));
}

export default function Export({ bomRows, calculation, sourceLabel, orderedParentSkus }) {
  const rows = orderRows(bomTemplateResultsToRows(bomRows, calculation), orderedParentSkus);
  const preview = formatPreviewRows([EXPORT_COLUMNS, ...rows]);
  const filename = datedResultFilename();

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Export Results</h2>
            <p>{filename} - {sourceLabel}</p>
          </div>
          <button type="button" className="primary-button" onClick={() => downloadXlsx(filename, rows)}>
            <Download size={16} /> Download XLSX
          </button>
        </div>
        <div className="export-preview">
          {preview.map((line, index) => (
            <code key={`${line}-${index}`}>{line}</code>
          ))}
        </div>
      </section>
    </div>
  );
}
