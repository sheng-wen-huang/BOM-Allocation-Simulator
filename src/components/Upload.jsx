import { CheckCircle2, Download, FileUp, Play, XCircle } from 'lucide-react';
import { BOM_COLUMNS, INVENTORY_COLUMNS, sampleBomRows, sampleInventoryRows } from '../engine/parser.js';
import { downloadTemplateXlsx, readXlsxMatrix, XLSX_LIMITS } from '../utils/spreadsheet.js';

async function readFile(file, callback) {
  try {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      callback({ error: 'Only .xlsx files are supported.' }, file.name);
      return;
    }

    if (file.size > XLSX_LIMITS.maxFileSizeBytes) {
      const maxSizeMb = XLSX_LIMITS.maxFileSizeBytes / 1024 / 1024;
      callback({ error: `XLSX file size must be ${maxSizeMb} MB or less.` }, file.name);
      return;
    }

    callback({ matrix: await readXlsxMatrix(file) }, file.name);
  } catch (error) {
    callback({ error: error.message }, file.name);
  }
}

function DropZone({ title, state, onText, sampleFilename, sampleSheetName, sampleHeaders, sampleRows }) {
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
          <p>{state.fileName || 'Drop XLSX here, or choose a file'}</p>
        </div>
        <label className="secondary-button">
          Choose File
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
        <button
          type="button"
          className="ghost-button"
          onClick={() => downloadTemplateXlsx(sampleFilename, sampleSheetName, sampleHeaders, sampleRows)}
        >
          <Download size={16} /> Template XLSX
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
  const bomPreviewRows = bomState.rows;
  const inventoryPreviewRows = inventoryState.rows;

  return (
    <div className="page-grid">
      <div className="upload-grid">
        <DropZone
          title="BOM Structure"
          state={bomState}
          onText={onBomText}
          sampleFilename="BOM_Structure_template.xlsx"
          sampleSheetName="BOM Structure"
          sampleHeaders={BOM_COLUMNS}
          sampleRows={sampleBomRows}
        />
        <DropZone
          title="Inventory"
          state={inventoryState}
          onText={onInventoryText}
          sampleFilename="Inventory_template.xlsx"
          sampleSheetName="Inventory"
          sampleHeaders={INVENTORY_COLUMNS}
          sampleRows={sampleInventoryRows}
        />
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>BOM Preview</h2>
            <p>All uploaded BOM rows</p>
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
                {BOM_COLUMNS.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bomPreviewRows.length === 0 ? (
                <tr>
                  <td colSpan={BOM_COLUMNS.length} className="empty-cell">
                    Upload a valid BOM Structure XLSX to preview data.
                  </td>
                </tr>
              ) : (
                bomPreviewRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.storerkey}</td>
                    <td>{row.parentSku}</td>
                    <td>{row.componentSku}</td>
                    <td>{row.sequence}</td>
                    <td>{row.bomonly}</td>
                    <td>{row.notes}</td>
                    <td>{row.raw?.qty ?? row.qtyPerBom}</td>
                    <td>{row.parentqty}</td>
                    <td>{row.udf01}</td>
                    <td>{row.udf02}</td>
                    <td>{row.udf03 ?? ''}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Inventory Preview</h2>
            <p>All uploaded inventory rows</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ComponentSKU</th>
                <th>qty</th>
              </tr>
            </thead>
            <tbody>
              {inventoryPreviewRows.length === 0 ? (
                <tr>
                  <td colSpan="2" className="empty-cell">
                    Upload a valid Inventory XLSX to preview data.
                  </td>
                </tr>
              ) : (
                inventoryPreviewRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.sku}</td>
                    <td>{row.raw?.qty ?? row.qty}</td>
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
