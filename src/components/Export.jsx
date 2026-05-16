import { Download } from 'lucide-react';
import { datedResultFilename, downloadCsv, resultsToCsv } from '../utils/csv.js';

export default function Export({ results }) {
  const csvText = resultsToCsv(results);
  const preview = csvText.split('\n').slice(0, 11);
  const filename = datedResultFilename();

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Export Results</h2>
            <p>{filename}</p>
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
