function escapeCsv(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function resultsToCsv(results) {
  const header = ['ParentSKU', 'PriorityScore', 'AvailSOH', 'Mode', 'Bottleneck'];
  const lines = results.map((row) =>
    [row.parentSku, row.priorityScore, row.availSoh, row.mode, row.bottleneck].map(escapeCsv).join(','),
  );
  return [header.join(','), ...lines].join('\n');
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
