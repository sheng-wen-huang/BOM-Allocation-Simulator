import { CheckCircle2, Download, FileUp, Play, XCircle } from 'lucide-react';
import { sampleBomCsv, sampleInventoryCsv } from '../engine/parser.js';

function readFile(file, callback) {
  const reader = new FileReader();
  reader.onload = () => callback(String(reader.result || ''), file.name);
  reader.readAsText(file);
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function DropZone({ title, state, onText, sampleFilename, sampleText }) {
  const valid = state.status === 'valid';
  const invalid = state.status === 'invalid';

  return (
    <section className={`drop-zone ${valid ? 'valid' : ''} ${invalid ? 'invalid' : ''}`}>
      <div
        className="drop-target"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files?.[0];
          if (file) readFile(file, onText);
        }}
      >
        <FileUp size={30} />
        <div>
          <h2>{title}</h2>
          <p>{state.fileName || 'Drop CSV here or choose a file'}</p>
        </div>
        <label className="secondary-button">
          Choose CSV
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) readFile(file, onText);
              event.currentTarget.value = '';
            }}
          />
        </label>
      </div>

      <div className="status-row">
        {valid && (
          <span className="status good">
            <CheckCircle2 size={17} /> {state.count} rows validated
          </span>
        )}
        {invalid && (
          <span className="status bad">
            <XCircle size={17} /> {state.errors.length} validation issue(s)
          </span>
        )}
        {state.status === 'empty' && <span className="muted">Waiting for upload</span>}
        <button type="button" className="ghost-button" onClick={() => downloadText(sampleFilename, sampleText)}>
          <Download size={16} /> Sample CSV
        </button>
      </div>

      {invalid && (
        <ul className="error-list">
          {state.errors.slice(0, 6).map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Upload({
  bomState,
  inventoryState,
  onBomText,
  onInventoryText,
  onRun,
  canRun,
  isRunning,
  runError,
}) {
  const previewRows = bomState.rows.slice(0, 20);

  return (
    <div className="page-grid">
      <div className="upload-grid">
        <DropZone
          title="BOM Structure"
          state={bomState}
          onText={onBomText}
          sampleFilename="BOM_Structure_sample.csv"
          sampleText={sampleBomCsv}
        />
        <DropZone
          title="Inventory"
          state={inventoryState}
          onText={onInventoryText}
          sampleFilename="Inventory_sample.csv"
          sampleText={sampleInventoryCsv}
        />
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>BOM Preview</h2>
            <p>First 20 uploaded BOM rows</p>
          </div>
          <button type="button" className="primary-button" onClick={onRun} disabled={!canRun || isRunning}>
            <Play size={16} /> {isRunning ? 'Running...' : 'Run Calculation'}
          </button>
        </div>
        {runError && <p className="inline-error">{runError}</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ParentSKU</th>
                <th>ComponentSKU</th>
                <th>QtyPerBOM</th>
                <th>UDF01</th>
                <th>UDF03</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-cell">
                    Upload a valid BOM Structure CSV to preview data.
                  </td>
                </tr>
              ) : (
                previewRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.parentSku}</td>
                    <td>{row.componentSku}</td>
                    <td>{row.qtyPerBom}</td>
                    <td>{row.udf01}</td>
                    <td>{row.udf03 ?? ''}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
