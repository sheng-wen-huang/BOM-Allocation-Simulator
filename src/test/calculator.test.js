import { describe, expect, it } from 'vitest';
import { applyScenarioOverrides, calculateAllocation } from '../engine/calculator.js';
import { parseBomMatrix, parseInventoryMatrix } from '../engine/parser.js';
import { bomTemplateResultsToRows } from '../utils/spreadsheet.js';

function rows(bomMatrix, inventoryMatrix) {
  const bom = parseBomMatrix(bomMatrix);
  const inventory = parseInventoryMatrix(inventoryMatrix);
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
      [
        ['ParentSKU', 'ComponentSKU', 'QtyPerBOM', 'UDF01', 'UDF03'],
        ['KIT-A', 'COMP-1', 2, '', 100],
      ],
      [
        ['SKU', 'Qty'],
        ['COMP-1', 11],
      ],
    );

    const result = calculateAllocation(bomRows, inventoryRows);

    expect(resultBySku(result, 'KIT-A').availSoh).toBe(5);
  });

  it('uses the bottleneck across multiple components', () => {
    const [bomRows, inventoryRows] = rows(
      [
        ['ParentSKU', 'ComponentSKU', 'QtyPerBOM', 'UDF01', 'UDF03'],
        ['KIT-A', 'COMP-1', 2, '', 100],
        ['KIT-A', 'COMP-2', 3, '', 100],
      ],
      [
        ['SKU', 'Qty'],
        ['COMP-1', 20],
        ['COMP-2', 8],
      ],
    );

    const result = calculateAllocation(bomRows, inventoryRows);

    expect(resultBySku(result, 'KIT-A').availSoh).toBe(2);
    expect(resultBySku(result, 'KIT-A').bottleneck).toBe('COMP-2');
  });

  it('allocates same-tier shared components proportionally with floor truncation', () => {
    const [bomRows, inventoryRows] = rows(
      [
        ['ParentSKU', 'ComponentSKU', 'QtyPerBOM', 'UDF01', 'UDF03'],
        ['KIT-A', 'COMP-1', 1, '', 500],
        ['KIT-B', 'COMP-1', 3, '', 500],
      ],
      [
        ['SKU', 'Qty'],
        ['COMP-1', 10],
      ],
    );

    const result = calculateAllocation(bomRows, inventoryRows);

    expect(resultBySku(result, 'KIT-A').availSoh).toBe(2);
    expect(resultBySku(result, 'KIT-B').availSoh).toBe(2);
  });

  it('runs higher priority tiers before lower tiers', () => {
    const [bomRows, inventoryRows] = rows(
      [
        ['ParentSKU', 'ComponentSKU', 'QtyPerBOM', 'UDF01', 'UDF03'],
        ['HIGH', 'COMP-1', 2, '', 900],
        ['LOW', 'COMP-1', 2, '', 100],
      ],
      [
        ['SKU', 'Qty'],
        ['COMP-1', 7],
      ],
    );

    const result = calculateAllocation(bomRows, inventoryRows);

    expect(resultBySku(result, 'HIGH').availSoh).toBe(3);
    expect(resultBySku(result, 'LOW').availSoh).toBe(0);
  });

  it('caps fixed reservations at the theoretical maximum', () => {
    const [bomRows, inventoryRows] = rows(
      [
        ['ParentSKU', 'ComponentSKU', 'QtyPerBOM', 'UDF01', 'UDF03'],
        ['KIT-X', 'COMP-1', 2, 'X', 10],
        ['KIT-X', 'COMP-2', 1, 'X', 10],
      ],
      [
        ['SKU', 'Qty'],
        ['COMP-1', 9],
        ['COMP-2', 20],
      ],
    );

    const result = calculateAllocation(bomRows, inventoryRows);

    expect(resultBySku(result, 'KIT-X').availSoh).toBe(4);
    expect(result.details['KIT-X'].capped).toBe(true);
  });

  it('uses requested fixed reservation when inventory supports it', () => {
    const [bomRows, inventoryRows] = rows(
      [
        ['ParentSKU', 'ComponentSKU', 'QtyPerBOM', 'UDF01', 'UDF03'],
        ['KIT-X', 'COMP-1', 2, 'X', 3],
      ],
      [
        ['SKU', 'Qty'],
        ['COMP-1', 20],
      ],
    );

    const result = calculateAllocation(bomRows, inventoryRows);

    expect(resultBySku(result, 'KIT-X').availSoh).toBe(3);
  });

  it('reserves fixed BOMs sequentially by UDF03 desc then SKU asc', () => {
    const [bomRows, inventoryRows] = rows(
      [
        ['ParentSKU', 'ComponentSKU', 'QtyPerBOM', 'UDF01', 'UDF03'],
        ['KIT-B', 'COMP-1', 1, 'X', 8],
        ['KIT-A', 'COMP-1', 1, 'X', 8],
        ['KIT-C', 'COMP-1', 1, 'X', 3],
      ],
      [
        ['SKU', 'Qty'],
        ['COMP-1', 10],
      ],
    );

    const result = calculateAllocation(bomRows, inventoryRows);

    expect(resultBySku(result, 'KIT-A').availSoh).toBe(8);
    expect(resultBySku(result, 'KIT-B').availSoh).toBe(2);
    expect(resultBySku(result, 'KIT-C').availSoh).toBe(0);
    expect(result.remainingInventory['COMP-1']).toBe(0);
  });

  it('uses fixed reservations before waterfall allocation', () => {
    const [bomRows, inventoryRows] = rows(
      [
        ['ParentSKU', 'ComponentSKU', 'QtyPerBOM', 'UDF01', 'UDF03'],
        ['KIT-X', 'COMP-1', 1, 'X', 4],
        ['KIT-W', 'COMP-1', 1, '', 900],
      ],
      [
        ['SKU', 'Qty'],
        ['COMP-1', 5],
      ],
    );

    const result = calculateAllocation(bomRows, inventoryRows);

    expect(resultBySku(result, 'KIT-X').availSoh).toBe(4);
    expect(resultBySku(result, 'KIT-X').priorityScore).toBe(4);
    expect(resultBySku(result, 'KIT-W').availSoh).toBe(1);
  });

  it('assigns invalid or zero priority BOMs to zero without consuming inventory', () => {
    const [bomRows, inventoryRows] = rows(
      [
        ['ParentSKU', 'ComponentSKU', 'QtyPerBOM', 'UDF01', 'UDF03'],
        ['ZERO', 'COMP-1', 1, '', 0],
        ['BAD', 'COMP-1', 1, '', 1200],
        ['VALID', 'COMP-1', 1, '', 100],
      ],
      [
        ['SKU', 'Qty'],
        ['COMP-1', 5],
      ],
    );

    const result = calculateAllocation(bomRows, inventoryRows);

    expect(resultBySku(result, 'ZERO').availSoh).toBe(0);
    expect(resultBySku(result, 'BAD').availSoh).toBe(0);
    expect(resultBySku(result, 'VALID').availSoh).toBe(5);
  });

  it('applies inventory what-if overrides to aggregated SKU quantity', () => {
    const [bomRows, inventoryRows] = rows(
      [
        ['ParentSKU', 'ComponentSKU', 'QtyPerBOM', 'UDF01', 'UDF03'],
        ['KIT-A', 'COMP-1', 1, '', 100],
      ],
      [
        ['SKU', 'Qty'],
        ['COMP-1', 2],
        ['COMP-1', 3],
      ],
    );

    const adjusted = applyScenarioOverrides(bomRows, inventoryRows, {
      inventoryQty: { 'COMP-1': 7 },
    });
    const result = calculateAllocation(adjusted.bomRows, adjusted.inventoryRows);

    expect(adjusted.inventoryRows).toHaveLength(1);
    expect(resultBySku(result, 'KIT-A').availSoh).toBe(7);
  });

  it('parses the BOM template columns and preserves non-calculation fields', () => {
    const parsed = parseBomMatrix(
      [
        ['storerkey', 'sku', 'componentsku', 'sequence', 'bomonly', 'notes', 'qty', 'parentqty', 'udf01', 'udf02', 'udf03'],
        ['WH1', 'KIT-A', 'COMP-1', '10', 'N', 'Keep this', 2, 1, '', 'blue', 100],
      ],
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      storerkey: 'WH1',
      parentSku: 'KIT-A',
      componentSku: 'COMP-1',
      sequence: '10',
      bomonly: 'N',
      notes: 'Keep this',
      qtyPerBom: 2,
      parentqty: '1',
      udf02: 'blue',
      udf03: 100,
    });
  });

  it('accepts component inventory aliases from uploaded spreadsheets', () => {
    const parsed = parseInventoryMatrix([
      ['ComponentSKU', 'qty'],
      ['COMP-1', 12],
    ]);

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({ sku: 'COMP-1', qty: 12 });
  });

  it('accepts localized inventory aliases from uploaded spreadsheets', () => {
    const parsed = parseInventoryMatrix([
      ['產品編號', 'E208-EC倉'],
      ['COMP-2', 8],
    ]);

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({ sku: 'COMP-2', qty: 8 });
  });

  it('accepts inventory column names regardless of English casing', () => {
    const parsed = parseInventoryMatrix([
      ['componentsku', 'QTY'],
      ['COMP-3', 5],
    ]);

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({ sku: 'COMP-3', qty: 5 });
  });

  it('exports BOM template columns with what-if UDF01 and UDF03 values', () => {
    const [bomRows, inventoryRows] = rows(
      [
        ['storerkey', 'sku', 'componentsku', 'sequence', 'bomonly', 'notes', 'qty', 'parentqty', 'udf01', 'udf02', 'udf03'],
        ['WH1', 'KIT-X', 'COMP-1', '10', 'Y', 'Reserve', 2, 1, 'X', '', 10],
        ['WH1', 'KIT-P', 'COMP-1', '20', 'N', 'Priority', 1, 1, '', '', 500],
      ],
      [
        ['sku', 'qty'],
        ['COMP-1', 9],
      ],
    );
    const calculation = calculateAllocation(bomRows, inventoryRows);

    expect(bomTemplateResultsToRows(bomRows, calculation)).toEqual([
      ['WH1', 'KIT-X', 'COMP-1', '10', 'Y', 'Reserve', '2', '1', 'X', '', 4],
      ['WH1', 'KIT-P', 'COMP-1', '20', 'N', 'Priority', '1', '1', '', '', 500],
    ]);
  });
});
