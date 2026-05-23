export const XLSX_LIMITS = {
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxRows: 10000,
  maxColumns: 50,
  maxZipEntries: 20000,
  maxUncompressedBytes: 120 * 1024 * 1024,
  maxCompressionRatio: 80,
};

export const EXPORT_COLUMNS = [
  'Storerkey',
  'Sku',
  'ComponentSku',
  'Sequence',
  'BomOnly',
  'Notes',
  'Qty',
  'ParentQty',
  'UDF01',
  'UDF02',
  'UDF03',
];

function cellToValue(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== 'object') return value;
  if (Object.prototype.hasOwnProperty.call(value, 'result')) return cellToValue(value.result);
  if (Object.prototype.hasOwnProperty.call(value, 'text')) return cellToValue(value.text);
  if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('');
  return String(value);
}

function isZipMagic(bytes) {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function findEocdOffset(bytes) {
  const minOffset = Math.max(0, bytes.length - 22 - 65535);
  for (let index = bytes.length - 22; index >= minOffset; index -= 1) {
    if (
      bytes[index] === 0x50 &&
      bytes[index + 1] === 0x4b &&
      bytes[index + 2] === 0x05 &&
      bytes[index + 3] === 0x06
    ) {
      return index;
    }
  }
  return -1;
}

function inspectZipSafety(arrayBuffer, fallbackCompressedBytes = 0) {
  const bytes = new Uint8Array(arrayBuffer);
  if (!isZipMagic(bytes)) {
    throw new Error('Invalid XLSX format: file is not a ZIP container.');
  }

  const view = new DataView(arrayBuffer);
  const eocdOffset = findEocdOffset(bytes);
  if (eocdOffset < 0) {
    throw new Error('Invalid XLSX format: end-of-central-directory record not found.');
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);

  if (totalEntries === 0xffff || centralDirectoryOffset === 0xffffffff) {
    throw new Error('ZIP64 XLSX files are not supported.');
  }

  if (totalEntries > XLSX_LIMITS.maxZipEntries) {
    throw new Error(`XLSX contains too many archive entries (${XLSX_LIMITS.maxZipEntries} max).`);
  }

  let offset = centralDirectoryOffset;
  let totalCompressed = 0;
  let totalUncompressed = 0;

  for (let entryIndex = 0; entryIndex < totalEntries; entryIndex += 1) {
    if (offset + 46 > view.byteLength) {
      throw new Error('Invalid XLSX format: central directory record is truncated.');
    }

    const signature = view.getUint32(offset, true);
    if (signature !== 0x02014b50) {
      throw new Error('Invalid XLSX format: central directory signature mismatch.');
    }

    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);

    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new Error('ZIP64 XLSX entries are not supported.');
    }

    totalCompressed += compressedSize;
    totalUncompressed += uncompressedSize;

    if (totalUncompressed > XLSX_LIMITS.maxUncompressedBytes) {
      throw new Error('XLSX uncompressed content is too large.');
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  const compressedBytes = totalCompressed > 0 ? totalCompressed : (fallbackCompressedBytes || 0);
  if (compressedBytes > 0) {
    const ratio = totalUncompressed / compressedBytes;
    if (ratio > XLSX_LIMITS.maxCompressionRatio) {
      throw new Error('XLSX compression ratio is too high.');
    }
  }
}

export async function readXlsxMatrix(file) {
  const buffer = await file.arrayBuffer();
  inspectZipSafety(buffer, file.size || 0);

  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  if (worksheet.actualRowCount > XLSX_LIMITS.maxRows) {
    throw new Error(`XLSX row count exceeds the ${XLSX_LIMITS.maxRows.toLocaleString()} row limit.`);
  }

  if (worksheet.actualColumnCount > XLSX_LIMITS.maxColumns) {
    throw new Error(`XLSX column count exceeds the ${XLSX_LIMITS.maxColumns.toLocaleString()} column limit.`);
  }

  const matrix = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = [];
    for (let column = 1; column <= row.cellCount; column += 1) {
      values.push(cellToValue(row.getCell(column).value));
    }
    if (values.some((value) => String(value ?? '').trim() !== '')) {
      matrix.push(values);
    }
  });
  return matrix;
}

export function bomTemplateResultsToRows(bomRows, calculation) {
  const resultByParent = new Map((calculation?.results || []).map((row) => [row.parentSku, row]));
  return bomRows.map((row) => {
    const result = resultByParent.get(row.parentSku);
    const isFixed = result?.mode === 'X';
    const udf03 = result?.priorityScore;
    return [
      row.storerkey,
      row.parentSku,
      row.componentSku,
      row.sequence,
      row.bomonly,
      row.notes,
      row.raw?.qty ?? row.qtyPerBom,
      row.parentqty,
      isFixed ? 'X' : '',
      row.udf02,
      udf03 ?? '',
    ];
  });
}

async function downloadWorkbookXlsx(filename, sheetName, headers, rows) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(row));

  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.columns = headers.map((header, index) => {
    const maxLength = Math.max(
      header.length,
      ...rows.map((row) => String(row[index] ?? '').length),
    );
    return { width: Math.min(Math.max(maxLength + 2, 10), 32) };
  });
  worksheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadXlsx(filename, rows) {
  return downloadWorkbookXlsx(filename, 'BOM Allocation Result', EXPORT_COLUMNS, rows);
}

export function downloadTemplateXlsx(filename, sheetName, headers, rows) {
  return downloadWorkbookXlsx(filename, sheetName, headers, rows);
}

export function datedResultFilename(date = new Date()) {
  return `BOM_Allocation_Result_${date.toISOString().slice(0, 10)}.xlsx`;
}
