import { parseNumber, convertLength, calculatePrintScale, formatNumber, conversionCsv, printCsv } from './measurement.js';

export function downloadCsv(csv, filename, doc = document) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  doc.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revocation after the browser has begun processing the user-requested download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderRows(doc, output, title, rows) {
  output.replaceChildren();
  const heading = doc.createElement('h3');
  heading.textContent = title;
  const table = doc.createElement('table');
  table.setAttribute('aria-label', title);
  const body = doc.createElement('tbody');
  for (const [label, value] of rows) {
    const row = doc.createElement('tr');
    const name = doc.createElement('th');
    name.scope = 'row';
    name.textContent = label;
    const cell = doc.createElement('td');
    cell.textContent = value;
    row.append(name, cell);
    body.append(row);
  }
  table.append(body);
  output.append(heading, table);
  output.hidden = false;
}

export function initialisePopup(doc, save = (csv, filename) => downloadCsv(csv, filename, doc)) {
  const get = (id) => doc.getElementById(id);
  const value = (id) => get(id).value;
  let conversion = null;
  let printRecord = null;
  const forms = [
    ['conversion-form', 'conversion-output', 'conversion-error', 'export-conversion', () => { conversion = null; }],
    ['print-form', 'print-output', 'print-error', 'export-print', () => { printRecord = null; }],
  ];
  for (const [form, output, error, exportButton, clear] of forms) {
    const invalidate = () => {
      clear(); get(output).hidden = true; get(error).hidden = true; get(exportButton).disabled = true;
    };
    get(form).addEventListener('input', invalidate);
    get(form).addEventListener('change', invalidate);
  }
  function switchTool(tool) {
    const convert = tool === 'convert';
    get('convert-section').hidden = !convert;
    get('print-section').hidden = convert;
    get('show-convert').setAttribute('aria-pressed', String(convert));
    get('show-print').setAttribute('aria-pressed', String(!convert));
    get(convert ? 'convert-heading' : 'print-heading').setAttribute('tabindex', '-1');
    get(convert ? 'convert-heading' : 'print-heading').focus();
  }
  get('show-convert').addEventListener('click', () => switchTool('convert'));
  get('show-print').addEventListener('click', () => switchTool('print'));
  get('conversion-form').addEventListener('submit', (event) => {
    event.preventDefault(); conversion = null; get('export-conversion').disabled = true;
    get('conversion-output').hidden = true; get('conversion-error').hidden = true;
    try {
      const length = parseNumber(value('length'), 'Length');
      const unit = value('from-unit');
      const results = Object.fromEntries(['mm', 'cm', 'in'].map((u) => [u, convertLength(length, unit, u)]));
      conversion = { label: value('conversion-label'), value: length, unit, results };
      renderRows(doc, get('conversion-output'), 'Equivalent lengths', Object.entries(results).map(([u, v]) => [u, formatNumber(v)]));
      get('export-conversion').disabled = false;
    } catch (error) {
      get('conversion-error').textContent = error.message; get('conversion-error').hidden = false;
    }
  });
  get('print-form').addEventListener('submit', (event) => {
    event.preventDefault(); printRecord = null; get('export-print').disabled = true;
    get('print-output').hidden = true; get('print-error').hidden = true;
    try {
      const target = parseNumber(value('target'), 'Target side', { positive: true });
      const measuredX = parseNumber(value('measured-x'), 'Measured X', { positive: true });
      const measuredY = parseNumber(value('measured-y'), 'Measured Y', { positive: true });
      const tolerancePercent = parseNumber(value('threshold'), 'Threshold');
      const result = calculatePrintScale({ target, measuredX, measuredY, tolerancePercent });
      printRecord = { label: value('print-label'), unit: value('print-unit'), target, measuredX, measuredY, result };
      const output = get('print-output');
      renderRows(doc, output, 'Print measurement comparison', [
        ['Signed X error', `${formatNumber(result.xErrorPercent, { signed: true })}%`],
        ['Signed Y error', `${formatNumber(result.yErrorPercent, { signed: true })}%`],
        ['Axis gap', `${formatNumber(result.differencePercentagePoints)} pp`],
      ]);
      for (const text of [
        `Both axes within ${formatNumber(tolerancePercent)}%: ${result.withinTolerance ? 'Yes' : 'No'}`,
        `Axis gap exceeds ${formatNumber(tolerancePercent)} pp: ${result.nonUniform ? 'Yes' : 'No'}`,
      ]) {
        const flag = doc.createElement('p'); flag.className = 'flag'; flag.textContent = text; output.append(flag);
      }
      get('export-print').disabled = false;
    } catch (error) {
      get('print-error').textContent = error.message; get('print-error').hidden = false;
    }
  });
  get('export-conversion').addEventListener('click', () => { if (conversion) save(conversionCsv(conversion), 'sewlore-length-conversion.csv'); });
  get('export-print').addEventListener('click', () => { if (printRecord) save(printCsv(printRecord), 'sewlore-print-check.csv'); });
}

if (typeof document !== 'undefined') initialisePopup(document);
