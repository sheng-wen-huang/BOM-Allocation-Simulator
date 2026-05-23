import { Download } from 'lucide-react';
import { EXPORT_COLUMNS, bomTemplateResultsToRows, datedResultFilename, downloadXlsx } from '../utils/spreadsheet.js';

function formatPreviewRows(rows) {
  const widths = rows[0].map((_, columnIndex) =>
    Math.max(...rows.map((row) => String(row[columnIndex] ?? '').length)),
  );

  return rows.map((row) =>
    row.map((cell, columnIndex) => String(cell ?? '').padEnd(widths[columnIndex], ' ')).join(' | '),
  );
}

export default function Export({ bomRows, calculation, sourceLabel }) {
  const rows = bomTemplateResultsToRows(bomRows, calculation);
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
