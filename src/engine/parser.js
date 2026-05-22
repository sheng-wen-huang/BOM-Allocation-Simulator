export const BOM_COLUMNS = [
  'storerkey',
  'sku',
  'componentsku',
  'sequence',
  'bomonly',
  'notes',
  'qty',
  'parentqty',
  'udf01',
  'udf02',
  'udf03',
];

const BOM_COLUMN_ALIASES = {
  storerkey: ['storerkey'],
  sku: ['sku', 'parentsku'],
  componentsku: ['componentsku'],
  sequence: ['sequence'],
  bomonly: ['bomonly'],
  notes: ['notes'],
  qty: ['qty', 'qtyperbom'],
  parentqty: ['parentqty'],
  udf01: ['udf01'],
  udf02: ['udf02'],
  udf03: ['udf03'],
};

const INVENTORY_COLUMN_ALIASES = {
  sku: ['sku', 'componentsku', '產品編號'],
  qty: ['qty', 'e208-ec倉'],
};

const REQUIRED_BOM_COLUMNS = ['sku', 'componentsku', 'qty'];
const REQUIRED_INVENTORY_COLUMNS = ['sku', 'qty'];

function makeHeaderMap(header) {
  const map = new Map();
  header.forEach((column, index) => {
    map.set(String(column ?? '').trim().toLowerCase(), index);
  });
  return map;
}

function getCell(row, headerMap, aliases) {
  const index = aliases.map((column) => headerMap.get(column.toLowerCase())).find((value) => value !== undefined);
  return index === undefined ? '' : String(row[index] ?? '').trim();
}

function assertColumns(headerMap, requiredColumns, aliases, fileLabel) {
  const missing = requiredColumns.filter((column) => !aliases[column].some((alias) => headerMap.has(alias)));
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

export function parseBomMatrix(matrix) {
  const errors = [];

  if (matrix.length === 0) {
    return { rows: [], errors: ['BOM Structure: spreadsheet is empty.'], count: 0 };
  }

  const headerMap = makeHeaderMap(matrix[0]);
  errors.push(...assertColumns(headerMap, REQUIRED_BOM_COLUMNS, BOM_COLUMN_ALIASES, 'BOM Structure'));
  if (errors.length > 0) return { rows: [], errors, count: 0 };

  const rows = [];
  matrix.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const storerkey = getCell(row, headerMap, BOM_COLUMN_ALIASES.storerkey);
    const parentSku = getCell(row, headerMap, BOM_COLUMN_ALIASES.sku);
    const componentSku = getCell(row, headerMap, BOM_COLUMN_ALIASES.componentsku);
    const sequence = getCell(row, headerMap, BOM_COLUMN_ALIASES.sequence);
    const bomonly = getCell(row, headerMap, BOM_COLUMN_ALIASES.bomonly);
    const notes = getCell(row, headerMap, BOM_COLUMN_ALIASES.notes);
    const qtyPerBomRaw = getCell(row, headerMap, BOM_COLUMN_ALIASES.qty);
    const qtyPerBom = parseNumber(qtyPerBomRaw);
    const parentqty = getCell(row, headerMap, BOM_COLUMN_ALIASES.parentqty);
    const udf01 = getCell(row, headerMap, BOM_COLUMN_ALIASES.udf01);
    const udf02 = getCell(row, headerMap, BOM_COLUMN_ALIASES.udf02);
    const udf03Raw = getCell(row, headerMap, BOM_COLUMN_ALIASES.udf03);
    const udf03 = parseNumber(udf03Raw);

    if (!parentSku) errors.push(`BOM Structure row ${rowNumber}: sku is required.`);
    if (!componentSku) errors.push(`BOM Structure row ${rowNumber}: componentsku is required.`);
    if (!Number.isFinite(qtyPerBom) || qtyPerBom <= 0) {
      errors.push(`BOM Structure row ${rowNumber}: qty must be greater than 0.`);
    }

    rows.push({
      id: `${parentSku || 'row'}-${componentSku || rowNumber}-${rowNumber}`,
      rowNumber,
      storerkey,
      parentSku,
      componentSku,
      sequence,
      bomonly,
      notes,
      qtyPerBom,
      parentqty,
      udf01,
      udf02,
      udf03: Number.isFinite(udf03) ? udf03 : null,
      raw: {
        storerkey,
        sku: parentSku,
        componentsku: componentSku,
        sequence,
        bomonly,
        notes,
        qty: qtyPerBomRaw,
        parentqty,
        udf01,
        udf02,
        udf03: udf03Raw,
      },
    });
  });

  return { rows: errors.length ? [] : rows, errors, count: rows.length };
}

export function parseInventoryMatrix(matrix) {
  const errors = [];

  if (matrix.length === 0) {
    return { rows: [], errors: ['Inventory: spreadsheet is empty.'], count: 0 };
  }

  const headerMap = makeHeaderMap(matrix[0]);
  errors.push(...assertColumns(headerMap, REQUIRED_INVENTORY_COLUMNS, INVENTORY_COLUMN_ALIASES, 'Inventory'));
  if (errors.length > 0) return { rows: [], errors, count: 0 };

  const rows = [];
  matrix.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const sku = getCell(row, headerMap, INVENTORY_COLUMN_ALIASES.sku);
    const qtyRaw = getCell(row, headerMap, INVENTORY_COLUMN_ALIASES.qty);
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
      raw: { sku, qty: qtyRaw },
    });
  });

  return { rows: errors.length ? [] : rows, errors, count: rows.length };
}

export const sampleBomRows = [
  ['WH1', 'KIT-A', 'COMP-1', '10', 'N', '', 2, 1, '', '', 900],
  ['WH1', 'KIT-A', 'COMP-2', '20', 'N', '', 1, 1, '', '', 900],
  ['WH1', 'KIT-B', 'COMP-1', '10', 'N', '', 1, 1, '', '', 600],
  ['WH1', 'KIT-B', 'COMP-3', '20', 'N', '', 3, 1, '', '', 600],
  ['WH1', 'KIT-C', 'COMP-2', '10', 'Y', 'Fixed reserve', 2, 1, 'X', '', 8],
  ['WH1', 'KIT-C', 'COMP-4', '20', 'Y', 'Fixed reserve', 1, 1, 'X', '', 8],
  ['WH1', 'KIT-D', 'COMP-1', '10', 'N', '', 1, 1, '', '', 0],
];

export const INVENTORY_COLUMNS = ['ComponentSKU', 'qty'];

export const sampleInventoryRows = [
  ['COMP-1', 100],
  ['COMP-2', 30],
  ['COMP-3', 42],
  ['COMP-4', 20],
];
