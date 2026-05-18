import { BOM_COLUMNS } from '../engine/parser.js';

function escapeCsv(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function resultsToCsv(results) {
  const header = ['SKU', 'Priority', 'AvailSOH', 'Mode', 'Bottleneck'];
  const lines = results.map((row) =>
    [row.parentSku, row.priorityScore, row.availSoh, row.mode, row.bottleneck].map(escapeCsv).join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

export function bomTemplateResultsToCsv(bomRows, calculation) {
  const resultByParent = new Map((calculation?.results || []).map((row) => [row.parentSku, row]));
  const lines = bomRows.map((row) => {
    const result = resultByParent.get(row.parentSku);
    const isFixed = result?.mode === 'X';
    const udf03 = isFixed ? result?.availSoh : result?.priorityScore;
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
    ]
      .map(escapeCsv)
      .join(',');
  });
  return [BOM_COLUMNS.join(','), ...lines].join('\n');
}

export function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function datedResultFilename(date = new Date()) {
  return `BOM_Allocation_Result_${date.toISOString().slice(0, 10)}.csv`;
}
