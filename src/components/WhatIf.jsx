import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';

function uniqueParents(bomRows) {
  const map = new Map();
  bomRows.forEach((row) => {
    if (!map.has(row.parentSku)) {
      map.set(row.parentSku, {
        parentSku: row.parentSku,
        priority: row.udf03 ?? 0,
        fixed: row.udf01?.trim().toUpperCase() === 'X',
      });
    }
  });
  return Array.from(map.values()).sort((a, b) => a.parentSku.localeCompare(b.parentSku));
}

function aggregateInventory(inventoryRows) {
  const map = new Map();
  inventoryRows.forEach((row) => map.set(row.sku, (map.get(row.sku) || 0) + row.qty));
  return Array.from(map.entries())
    .map(([sku, qty]) => ({ sku, qty }))
    .sort((a, b) => a.sku.localeCompare(b.sku));
}

export default function WhatIf({ bomRows, inventoryRows, baseline, scenario, onScenarioChange, onScenarioResult, onRunWhatIf }) {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');
  const { filter, inventoryQty, priority, fixedMode, comparison } = scenario;

  const inventory = useMemo(() => aggregateInventory(inventoryRows), [inventoryRows]);
  const parents = useMemo(() => uniqueParents(bomRows), [bomRows]);
  const normalizedFilter = filter.trim().toLowerCase();

  const visibleInventory = inventory.filter((row) => row.sku.toLowerCase().includes(normalizedFilter)).slice(0, 80);
  const visibleParents = parents.filter((row) => row.parentSku.toLowerCase().includes(normalizedFilter)).slice(0, 80);

  function updateScenario(patch, clearResult = false) {
    onScenarioChange((current) => ({ ...current, ...patch }));
    if (clearResult) onScenarioResult(null);
  }

  async function runScenario() {
    setIsRunning(true);
    setError('');
    try {
      const result = await onRunWhatIf({ inventoryQty, priority, fixedMode });
      const baselineMap = new Map(baseline.results.map((row) => [row.parentSku, row]));
      const comparisonRows = result.results
        .map((row) => {
          const before = baselineMap.get(row.parentSku)?.availSoh || 0;
          return { ...row, beforeAvailSoh: before, afterAvailSoh: row.availSoh, delta: row.availSoh - before };
        })
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.parentSku.localeCompare(b.parentSku));
      updateScenario({ comparison: comparisonRows });
      onScenarioResult(result);
    } catch (scenarioError) {
      setError(scenarioError.message);
    } finally {
      setIsRunning(false);
    }
  }

  function resetAll() {
    updateScenario({ inventoryQty: {}, priority: {}, fixedMode: {}, comparison: [] });
    onScenarioResult(null);
    setError('');
  }

  return (
    <div className="whatif-layout">
      <aside className="scenario-panel">
        <div className="panel-header compact">
          <div>
            <h2>Scenario</h2>
            <p>Adjust inventory, priority, and fixed reservation mode</p>
          </div>
        </div>
        <input
          className="search-input full"
          value={filter}
          onChange={(event) => updateScenario({ filter: event.target.value })}
          placeholder="Filter SKU or ParentSKU"
        />

        <h3>Inventory Adjustments</h3>
        <div className="adjustment-list">
          {visibleInventory.map((row) => {
            const changed = Object.prototype.hasOwnProperty.call(inventoryQty, row.sku);
            return (
              <label className={`adjustment-row ${changed ? 'changed' : ''}`} key={row.sku}>
                <span>{row.sku}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={changed ? inventoryQty[row.sku] : row.qty}
                  onChange={(event) =>
                    updateScenario(
                      { inventoryQty: { ...inventoryQty, [row.sku]: Number(event.target.value) }, comparison: [] },
                      true,
                    )
                  }
                />
              </label>
            );
          })}
        </div>

        <h3>Priority & UDF01</h3>
        <div className="adjustment-list">
          {visibleParents.map((row) => {
            const priorityChanged = Object.prototype.hasOwnProperty.call(priority, row.parentSku);
            const fixedChanged = Object.prototype.hasOwnProperty.call(fixedMode, row.parentSku);
            const fixed = fixedChanged ? fixedMode[row.parentSku] : row.fixed;
            return (
              <div className={`parent-adjustment ${priorityChanged || fixedChanged ? 'changed' : ''}`} key={row.parentSku}>
                <label>
                  <span>{row.parentSku}</span>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    step="1"
                    value={priorityChanged ? priority[row.parentSku] : row.priority}
                    onChange={(event) =>
                      updateScenario(
                        { priority: { ...priority, [row.parentSku]: Number(event.target.value) }, comparison: [] },
                        true,
                      )
                    }
                  />
                </label>
                <label className="switch-row">
                  <input
                    type="checkbox"
                    checked={fixed}
                    onChange={(event) =>
                      updateScenario(
                        { fixedMode: { ...fixedMode, [row.parentSku]: event.target.checked }, comparison: [] },
                        true,
                      )
                    }
                  />
                  UDF01=X
                </label>
              </div>
            );
          })}
        </div>

        <div className="action-row">
          <button type="button" className="primary-button" onClick={runScenario} disabled={isRunning}>
            <SlidersHorizontal size={16} /> {isRunning ? 'Running...' : 'Run What-If'}
          </button>
          <button type="button" className="ghost-button" onClick={resetAll}>
            <RotateCcw size={16} /> Reset All
          </button>
        </div>
        {error && <p className="inline-error">{error}</p>}
      </aside>

      <section className="panel comparison-panel">
        <div className="panel-header">
          <div>
            <h2>Before / After Comparison</h2>
            <p>Rows sorted by largest absolute delta</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ParentSKU</th>
                <th>Priority</th>
                <th>Before AvailSOH</th>
                <th>After AvailSOH</th>
                <th>Delta</th>
                <th>Mode</th>
              </tr>
            </thead>
            <tbody>
              {comparison.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-cell">
                    Run a what-if scenario to compare results.
                  </td>
                </tr>
              ) : (
                comparison.map((row) => (
                  <tr key={row.parentSku} className={row.delta > 0 ? 'delta-up-row' : row.delta < 0 ? 'delta-down-row' : ''}>
                    <td>{row.parentSku}</td>
                    <td>{row.priorityScore}</td>
                    <td>{row.beforeAvailSoh}</td>
                    <td>{row.afterAvailSoh}</td>
                    <td className={row.delta > 0 ? 'delta-up' : row.delta < 0 ? 'delta-down' : 'muted'}>
                      {row.delta > 0 ? `+${row.delta}` : row.delta < 0 ? row.delta : '-'}
                    </td>
                    <td>{row.mode}</td>
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
