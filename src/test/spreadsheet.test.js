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
        size: buffer.byteLength,
      }),
    ).rejects.toThrow('column limit');
  });

  it('rejects files that are not ZIP containers', async () => {
    const payload = new Uint8Array([0x58, 0x4c, 0x53, 0x58]).buffer;
    await expect(
      readXlsxMatrix({
        arrayBuffer: async () => payload,
        size: payload.byteLength,
      }),
    ).rejects.toThrow('not a ZIP container');
  });

  it('rejects ZIP files with extreme compression ratios', async () => {
    const fileName = new TextEncoder().encode('a.txt');
    const nameLength = fileName.length;
    const localHeaderLength = 30 + nameLength;
    const centralHeaderLength = 46 + nameLength;
    const totalLength = localHeaderLength + centralHeaderLength + 22;
    const bytes = new Uint8Array(totalLength);
    const view = new DataView(bytes.buffer);

    // Local file header
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(26, nameLength, true);
    bytes.set(fileName, 30);

    // Central directory header
    const centralOffset = localHeaderLength;
    view.setUint32(centralOffset, 0x02014b50, true);
    view.setUint32(centralOffset + 20, 1, true); // compressed size
    view.setUint32(centralOffset + 24, 5000, true); // uncompressed size
    view.setUint16(centralOffset + 28, nameLength, true);
    bytes.set(fileName, centralOffset + 46);

    // EOCD
    const eocdOffset = localHeaderLength + centralHeaderLength;
    view.setUint32(eocdOffset, 0x06054b50, true);
    view.setUint16(eocdOffset + 8, 1, true); // total entries on this disk
    view.setUint16(eocdOffset + 10, 1, true); // total entries
    view.setUint32(eocdOffset + 12, centralHeaderLength, true); // central directory size
    view.setUint32(eocdOffset + 16, centralOffset, true); // central directory offset

    await expect(
      readXlsxMatrix({
        arrayBuffer: async () => bytes.buffer,
        size: bytes.byteLength,
      }),
    ).rejects.toThrow('compression ratio is too high');
  });
});
