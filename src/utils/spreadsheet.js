export const XLSX_LIMITS = {
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxRows: 10000,
  maxColumns: 50,
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

export async function readXlsxMatrix(file) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
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
