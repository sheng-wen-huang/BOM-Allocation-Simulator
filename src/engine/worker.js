import { calculateAllocation, applyScenarioOverrides } from './calculator.js';

self.onmessage = (event) => {
  const { id, type, bomRows, inventoryRows, overrides } = event.data;

  try {
    const adjusted = type === 'what-if' ? applyScenarioOverrides(bomRows, inventoryRows, overrides) : null;
    const payload =
      type === 'what-if'
        ? calculateAllocation(adjusted.bomRows, adjusted.inventoryRows)
        : calculateAllocation(bomRows, inventoryRows);
    self.postMessage({ id, ok: true, payload });
  } catch (error) {
    self.postMessage({ id, ok: false, error: error.message });
  }
};
