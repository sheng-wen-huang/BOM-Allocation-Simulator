import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { readXlsxMatrix, XLSX_LIMITS } from '../utils/spreadsheet.js';

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

describe('spreadsheet utilities', () => {
  it('reads the first worksheet from an xlsx file into a matrix', async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('BOM');
    worksheet.addRow(['sku', 'componentsku', 'qty']);
    worksheet.addRow(['KIT-A', 'COMP-1', 2]);

    const buffer = await workbook.xlsx.writeBuffer();
    const matrix = await readXlsxMatrix({
      arrayBuffer: async () => toArrayBuffer(buffer),
    });

    expect(matrix).toEqual([
      ['sku', 'componentsku', 'qty'],
      ['KIT-A', 'COMP-1', 2],
    ]);
  });

  it('rejects worksheets that exceed the column limit', async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('BOM');
    worksheet.addRow(Array.from({ length: XLSX_LIMITS.maxColumns + 1 }, (_, index) => `column-${index + 1}`));

    const buffer = await workbook.xlsx.writeBuffer();

    await expect(
      readXlsxMatrix({
        arrayBuffer: async () => toArrayBuffer(buffer),
      }),
    ).rejects.toThrow('column limit');
  });
});
