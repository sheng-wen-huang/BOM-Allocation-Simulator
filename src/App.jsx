import { useCallback, useMemo, useRef, useState } from 'react';
import { BarChart3, Download, FlaskConical, UploadCloud } from 'lucide-react';
import Upload from './components/Upload.jsx';
import Dashboard from './components/Dashboard.jsx';
import WhatIf from './components/WhatIf.jsx';
import Export from './components/Export.jsx';
import { parseBomMatrix, parseInventoryMatrix } from './engine/parser.js';
import { calculateAllocation, applyScenarioOverrides } from './engine/calculator.js';

const tabs = [
  { id: 'upload', label: 'Upload & Preview', icon: UploadCloud },
  { id: 'dashboard', label: 'Results Dashboard', icon: BarChart3 },
  { id: 'whatif', label: 'What-If Simulator', icon: FlaskConical },
  { id: 'export', label: 'Export', icon: Download },
];

function makeEmptyFileState(label) {
  return { label, rows: [], errors: [], count: 0, status: 'empty', fileName: '' };
}

function makeEmptyScenarioState() {
  return { filter: '', inventoryQty: {}, priority: {}, fixedMode: {}, comparison: [] };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [bomState, setBomState] = useState(makeEmptyFileState('BOM Structure'));
  const [inventoryState, setInventoryState] = useState(makeEmptyFileState('Inventory'));
  const [calculation, setCalculation] = useState(null);
  const [whatIfState, setWhatIfState] = useState(makeEmptyScenarioState);
  const [whatIfCalculation, setWhatIfCalculation] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState('');
  const workerRef = useRef(null);
  const requestIdRef = useRef(0);

  const canRun = bomState.status === 'valid' && inventoryState.status === 'valid';

  const worker = useMemo(() => {
    if (typeof Worker === 'undefined') return null;
    const instance = new Worker(new URL('./engine/worker.js', import.meta.url), { type: 'module' });
    workerRef.current = instance;
    return instance;
  }, []);

  const runInWorker = useCallback(
    (message) =>
      new Promise((resolve, reject) => {
        if (!worker) {
          try {
            if (message.type === 'what-if') {
              const adjusted = applyScenarioOverrides(message.bomRows, message.inventoryRows, message.overrides);
              resolve(calculateAllocation(adjusted.bomRows, adjusted.inventoryRows));
            } else {
              resolve(calculateAllocation(message.bomRows, message.inventoryRows));
            }
          } catch (error) {
            reject(error);
          }
          return;
        }

        const id = requestIdRef.current + 1;
        requestIdRef.current = id;

        const onMessage = (event) => {
          if (event.data.id !== id) return;
          worker.removeEventListener('message', onMessage);
          if (event.data.ok) resolve(event.data.payload);
          else reject(new Error(event.data.error));
        };

        worker.addEventListener('message', onMessage);
        worker.postMessage({ ...message, id });
      }),
    [worker],
  );

  const handleBomText = useCallback((source, fileName = '') => {
    const parsed = source.error
      ? { rows: [], errors: [`BOM Structure: ${source.error}`], count: 0 }
      : parseBomMatrix(source.matrix || []);
    setBomState({
      label: 'BOM Structure',
      ...parsed,
      status: parsed.errors.length ? 'invalid' : 'valid',
      fileName,
    });
    setCalculation(null);
    setWhatIfState(makeEmptyScenarioState());
    setWhatIfCalculation(null);
    setRunError('');
    setActiveTab('upload');
  }, []);

  const handleInventoryText = useCallback((source, fileName = '') => {
    const parsed = source.error
      ? { rows: [], errors: [`Inventory: ${source.error}`], count: 0 }
      : parseInventoryMatrix(source.matrix || []);
    setInventoryState({
      label: 'Inventory',
      ...parsed,
      status: parsed.errors.length ? 'invalid' : 'valid',
      fileName,
    });
    setCalculation(null);
    setWhatIfState(makeEmptyScenarioState());
    setWhatIfCalculation(null);
    setRunError('');
    setActiveTab('upload');
  }, []);

  const runCalculation = useCallback(async () => {
    if (!canRun) return;
    setIsRunning(true);
    setRunError('');
    try {
      const payload = await runInWorker({
        type: 'calculate',
        bomRows: bomState.rows,
        inventoryRows: inventoryState.rows,
      });
      setCalculation(payload);
      setWhatIfState(makeEmptyScenarioState());
      setWhatIfCalculation(null);
      setActiveTab('dashboard');
    } catch (error) {
      setRunError(error.message);
    } finally {
      setIsRunning(false);
    }
  }, [bomState.rows, canRun, inventoryState.rows, runInWorker]);

  const runWhatIf = useCallback(
    (overrides) =>
      runInWorker({
        type: 'what-if',
        bomRows: bomState.rows,
        inventoryRows: inventoryState.rows,
        overrides,
      }),
    [bomState.rows, inventoryState.rows, runInWorker],
  );

  const currentTab = calculation ? activeTab : activeTab === 'upload' ? activeTab : 'upload';
  const exportCalculation = whatIfCalculation || calculation;
  const exportSourceLabel = whatIfCalculation ? 'Latest What-If result' : 'Baseline result';

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Waterfall Priority Engine</p>
          <h1>BOM Allocation Simulator</h1>
        </div>
        <nav className="tabs" aria-label="Application tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const disabled = tab.id !== 'upload' && !calculation;
            return (
              <button
                key={tab.id}
                type="button"
                className={`tab-button ${currentTab === tab.id ? 'active' : ''}`}
                onClick={() => !disabled && setActiveTab(tab.id)}
                disabled={disabled}
                title={disabled ? 'Run calculation first' : tab.label}
              >
                <Icon size={17} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      <main>
        {currentTab === 'upload' && (
          <Upload
            bomState={bomState}
            inventoryState={inventoryState}
            onBomText={handleBomText}
            onInventoryText={handleInventoryText}
            onRun={runCalculation}
            canRun={canRun}
            isRunning={isRunning}
            runError={runError}
          />
        )}
        {currentTab === 'dashboard' && calculation && <Dashboard calculation={calculation} />}
        {currentTab === 'whatif' && calculation && (
          <WhatIf
            bomRows={bomState.rows}
            inventoryRows={inventoryState.rows}
            baseline={calculation}
            scenario={whatIfState}
            onScenarioChange={setWhatIfState}
            onScenarioResult={setWhatIfCalculation}
            onRunWhatIf={runWhatIf}
          />
        )}
        {currentTab === 'export' && calculation && (
          <Export bomRows={bomState.rows} calculation={exportCalculation} sourceLabel={exportSourceLabel} />
        )}
      </main>
    </div>
  );
}
