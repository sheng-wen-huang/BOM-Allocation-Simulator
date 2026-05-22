import { Download } from 'lucide-react';
import { bomTemplateResultsToRows, datedResultFilename, downloadXlsx } from '../utils/spreadsheet.js';
import { BOM_COLUMNS } from '../engine/parser.js';

export default function Export({ bomRows, calculation, sourceLabel }) {
  const rows = bomTemplateResultsToRows(bomRows, calculation);
  const preview = [BOM_COLUMNS, ...rows];
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
            <code key={`${line.join('|')}-${index}`}>{line.join(' | ')}</code>
          ))}
        </div>
      </section>
    </div>
  );
}
