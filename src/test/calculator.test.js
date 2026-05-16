import { describe, expect, it } from 'vitest';
import { applyScenarioOverrides, calculateAllocation } from '../engine/calculator.js';
import { parseBomCsv, parseInventoryCsv } from '../engine/parser.js';

function rows(bomCsv, inventoryCsv) {
  const bom = parseBomCsv(bomCsv);
  const inventory = parseInventoryCsv(inventoryCsv);
  expect(bom.errors).toEqual([]);
  expect(inventory.errors).toEqual([]);
  return [bom.rows, inventory.rows];
}

function resultBySku(result, parentSku) {
  return result.results.find((row) => row.parentSku === parentSku);
}

describe('calculateAllocation', () => {
  it('calculates a single BOM with one component', () => {
    const [bomRows, inventoryRows] = rows(
      ['ParentSKU,ComponentSKU,QtyPerBOM,UDF01,UDF03', 'KIT-A,COMP-1,2,,100'].join('\n'),
      ['SKU,Qty', 'COMP-1,11'].join('\n'),
    );

    const result = calculateAllocation(bomRows, inventoryRows);

    expect(resultBySku(result, 'KIT-A').availSoh).toBe(5);
  });

  it('uses the bottleneck across multiple components', () => {
    const [bomRows, inventoryRows] = rows(
      [
        'ParentSKU,ComponentSKU,QtyPerBOM,UDF01,UDF03',
        'KIT-A,COMP-1,2,,100',
        'KIT-A,COMP-2,3,,100',
      ].join('\n'),
      ['SKU,Qty', 'COMP-1,20', 'COMP-2,8'].join('\n'),
    );

    const result = calculateAllocation(bomRows, inventoryRows);

    expect(resultBySku(result, 'KIT-A').availSoh).toBe(2);
    expect(resultBySku(result, 'KIT-A').bottleneck).toBe('COMP-2');
  });

  it('allocates same-tier shared components proportionally with floor truncation', () => {
    const [bomRows, inventoryRows] = rows(
      [
        'ParentSKU,ComponentSKU,QtyPerBOM,UDF01,UDF03',
        'KIT-A,COMP-1,1,,500',
        'KIT-B,COMP-1,3,,500',
      ].join('\n'),
      ['SKU,Qty', 'COMP-1,10'].join('\n'),
    );

    const result = calculateAllocation(bomRows, inventoryRows);

    expect(resultBySku(result, 'KIT-A').availSoh).toBe(2);
    expect(resultBySku(result, 'KIT-B').availSoh).toBe(2);
  });

  it('runs higher priority tiers before lower tiers', () => {
    const [bomRows, inventoryRows] = rows(
      [
        'ParentSKU,ComponentSKU,QtyPerBOM,UDF01,UDF03',
        'HIGH,COMP-1,2,,900',
        'LOW,COMP-1,2,,100',
      ].join('\n'),
      ['SKU,Qty', 'COMP-1,7'].join('\n'),
    );

    const result = calculateAllocation(bomRows, inventoryRows);

    expect(resultBySku(result, 'HIGH').availSoh).toBe(3);
    expect(resultBySku(result, 'LOW').availSoh).toBe(0);
  });

  it('caps fixed reservations at the theoretical maximum', () => {
    const [bomRows, inventoryRows] = rows(
      [
        'ParentSKU,ComponentSKU,QtyPerBOM,UDF01,UDF03',
        'KIT-X,COMP-1,2,X,10',
        'KIT-X,COMP-2,1,X,10',
      ].join('\n'),
      ['SKU,Qty', 'COMP-1,9', 'COMP-2,20'].join('\n'),
    );

    const result = calculateAllocation(bomRows, inventoryRows);

    expect(resultBySku(result, 'KIT-X').availSoh).toBe(4);
    expect(result.details['KIT-X'].capped).toBe(true);
  });

  it('uses requested fixed reservation when inventory supports it', () => {
    const [bomRows, inventoryRows] = rows(
      ['ParentSKU,ComponentSKU,QtyPerBOM,UDF01,UDF03', 'KIT-X,COMP-1,2,X,3'].join('\n'),
      ['SKU,Qty', 'COMP-1,20'].join('\n'),
    );

    const result = calculateAllocation(bomRows, inventoryRows);

    expect(resultBySku(result, 'KIT-X').availSoh).toBe(3);
  });

  it('assigns invalid or zero priority BOMs to zero without consuming inventory', () => {
    const [bomRows, inventoryRows] = rows(
      [
        'ParentSKU,ComponentSKU,QtyPerBOM,UDF01,UDF03',
        'ZERO,COMP-1,1,,0',
        'BAD,COMP-1,1,,1200',
        'VALID,COMP-1,1,,100',
      ].join('\n'),
      ['SKU,Qty', 'COMP-1,5'].join('\n'),
    );

    const result = calculateAllocation(bomRows, inventoryRows);

    expect(resultBySku(result, 'ZERO').availSoh).toBe(0);
    expect(resultBySku(result, 'BAD').availSoh).toBe(0);
    expect(resultBySku(result, 'VALID').availSoh).toBe(5);
  });

  it('parses quoted fields containing commas', () => {
    const parsed = parseBomCsv(
      ['ParentSKU,ComponentSKU,QtyPerBOM,UDF01,UDF03', '"KIT, A","COMP, 1",2,,100'].join('\n'),
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0].parentSku).toBe('KIT, A');
    expect(parsed.rows[0].componentSku).toBe('COMP, 1');
  });

  it('applies inventory what-if overrides to aggregated SKU quantity', () => {
    const [bomRows, inventoryRows] = rows(
      ['ParentSKU,ComponentSKU,QtyPerBOM,UDF01,UDF03', 'KIT-A,COMP-1,1,,100'].join('\n'),
      ['SKU,Qty', 'COMP-1,2', 'COMP-1,3'].join('\n'),
    );

    const adjusted = applyScenarioOverrides(bomRows, inventoryRows, {
      inventoryQty: { 'COMP-1': 7 },
    });
    const result = calculateAllocation(adjusted.bomRows, adjusted.inventoryRows);

    expect(adjusted.inventoryRows).toHaveLength(1);
    expect(resultBySku(result, 'KIT-A').availSoh).toBe(7);
  });
});
