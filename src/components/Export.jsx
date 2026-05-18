import { Download } from 'lucide-react';
import { bomTemplateResultsToCsv, datedResultFilename, downloadCsv } from '../utils/csv.js';

export default function Export({ bomRows, calculation, sourceLabel }) {
  const csvText = bomTemplateResultsToCsv(bomRows, calculation);
  const preview = csvText.split('\n').slice(0, 11);
  const filename = datedResultFilename();

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Export Results</h2>
            <p>{filename} - {sourceLabel}</p>
          </div>
          <button type="button" className="primary-button" onClick={() => downloadCsv(filename, csvText)}>
            <Download size={16} /> Download CSV
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
