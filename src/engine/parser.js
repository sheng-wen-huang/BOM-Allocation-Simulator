const REQUIRED_BOM_COLUMNS = ['ParentSKU', 'ComponentSKU', 'QtyPerBOM'];
const REQUIRED_INVENTORY_COLUMNS = ['SKU', 'Qty'];

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((value) => value.trim() !== '')) rows.push(row);

  if (inQuotes) {
    throw new Error('CSV contains an unclosed quoted field.');
  }

  return rows;
}

function makeHeaderMap(header) {
  const map = new Map();
  header.forEach((column, index) => {
    map.set(column.trim(), index);
  });
  return map;
}

function getCell(row, headerMap, column) {
  const index = headerMap.get(column);
  return index === undefined ? '' : String(row[index] ?? '').trim();
}

function assertColumns(headerMap, requiredColumns, fileLabel) {
  const missing = requiredColumns.filter((column) => !headerMap.has(column));
  if (missing.length > 0) {
    return [`${fileLabel}: missing required column(s): ${missing.join(', ')}`];
  }
  return [];
}

function parseNumber(value) {
  if (value === '') return Number.NaN;
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

export function parseBomCsv(text) {
  const errors = [];
  let matrix = [];

  try {
    matrix = parseCsv(text);
  } catch (error) {
    return { rows: [], errors: [error.message], count: 0 };
  }

  if (matrix.length === 0) {
    return { rows: [], errors: ['BOM Structure: CSV is empty.'], count: 0 };
  }

  const headerMap = makeHeaderMap(matrix[0]);
  errors.push(...assertColumns(headerMap, REQUIRED_BOM_COLUMNS, 'BOM Structure'));
  if (errors.length > 0) return { rows: [], errors, count: 0 };

  const rows = [];
  matrix.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const parentSku = getCell(row, headerMap, 'ParentSKU');
    const componentSku = getCell(row, headerMap, 'ComponentSKU');
    const qtyPerBomRaw = getCell(row, headerMap, 'QtyPerBOM');
    const qtyPerBom = parseNumber(qtyPerBomRaw);
    const udf01 = getCell(row, headerMap, 'UDF01');
    const udf03Raw = getCell(row, headerMap, 'UDF03');
    const udf03 = parseNumber(udf03Raw);

    if (!parentSku) errors.push(`BOM Structure row ${rowNumber}: ParentSKU is required.`);
    if (!componentSku) errors.push(`BOM Structure row ${rowNumber}: ComponentSKU is required.`);
    if (!Number.isFinite(qtyPerBom) || qtyPerBom <= 0) {
      errors.push(`BOM Structure row ${rowNumber}: QtyPerBOM must be greater than 0.`);
    }

    rows.push({
      id: `${parentSku || 'row'}-${componentSku || rowNumber}-${rowNumber}`,
      rowNumber,
      parentSku,
      componentSku,
      qtyPerBom,
      udf01,
      udf03: Number.isFinite(udf03) ? udf03 : null,
      raw: {
        ParentSKU: parentSku,
        ComponentSKU: componentSku,
        QtyPerBOM: qtyPerBomRaw,
        UDF01: udf01,
        UDF03: udf03Raw,
      },
    });
  });

  return { rows: errors.length ? [] : rows, errors, count: rows.length };
}

export function parseInventoryCsv(text) {
  const errors = [];
  let matrix = [];

  try {
    matrix = parseCsv(text);
  } catch (error) {
    return { rows: [], errors: [error.message], count: 0 };
  }

  if (matrix.length === 0) {
    return { rows: [], errors: ['Inventory: CSV is empty.'], count: 0 };
  }

  const headerMap = makeHeaderMap(matrix[0]);
  errors.push(...assertColumns(headerMap, REQUIRED_INVENTORY_COLUMNS, 'Inventory'));
  if (errors.length > 0) return { rows: [], errors, count: 0 };

  const rows = [];
  matrix.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const sku = getCell(row, headerMap, 'SKU');
    const qtyRaw = getCell(row, headerMap, 'Qty');
    const qty = parseNumber(qtyRaw);

    if (!sku) errors.push(`Inventory row ${rowNumber}: SKU is required.`);
    if (!Number.isFinite(qty) || qty < 0) {
      errors.push(`Inventory row ${rowNumber}: Qty must be zero or greater.`);
    }

    rows.push({
      id: `${sku || 'row'}-${rowNumber}`,
      rowNumber,
      sku,
      qty,
      raw: { SKU: sku, Qty: qtyRaw },
    });
  });

  return { rows: errors.length ? [] : rows, errors, count: rows.length };
}

export const sampleBomCsv = [
  'ParentSKU,ComponentSKU,QtyPerBOM,UDF01,UDF03',
  'KIT-A,COMP-1,2,,900',
  'KIT-A,COMP-2,1,,900',
  'KIT-B,COMP-1,1,,600',
  'KIT-B,COMP-3,3,,600',
  'KIT-C,COMP-2,2,X,8',
  'KIT-C,COMP-4,1,X,8',
  'KIT-D,COMP-1,1,,0',
].join('\n');

export const sampleInventoryCsv = [
  'SKU,Qty',
  'COMP-1,100',
  'COMP-2,30',
  'COMP-3,42',
  'COMP-4,20',
].join('\n');
