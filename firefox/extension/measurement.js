/** MIT licensed. Print calculation adapted from Sewlore calculations.js. */
const unitFactors = Object.freeze({ mm: 1, cm: 10, in: 25.4 });

export function parseNumber(text, name, { positive = false } = {}) {
  const clean = String(text).trim();
  // Decimal syntax only: no hexadecimal, Infinity or partially parsed values.
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(clean)) {
    throw new RangeError(`${name}: enter a decimal number, using a dot.`);
  }
  const value = Number(clean);
  if (!Number.isFinite(value) || value < 0 || (positive && value === 0)) {
    throw new RangeError(`${name}: enter a finite ${positive ? 'positive' : 'non-negative'} number.`);
  }
  // Reject a nonzero decimal that has rounded all the way to zero.
  const mantissa = clean.split(/[eE]/)[0];
  if (value === 0 && /[1-9]/.test(mantissa)) {
    throw new RangeError(`${name}: this number is too small to represent.`);
  }
  return Object.is(value, -0) ? 0 : value;
}

export function convertLength(value, fromUnit, toUnit) {
  if (!Object.hasOwn(unitFactors, fromUnit) || !Object.hasOwn(unitFactors, toUnit)) {
    throw new RangeError('Choose mm, cm or in.');
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RangeError('Length must be a finite non-negative number.');
  }
  const result = value * (unitFactors[fromUnit] / unitFactors[toUnit]);
  if (!Number.isFinite(result) || (value > 0 && result === 0)) {
    throw new RangeError('The conversion is outside the representable numeric range.');
  }
  return Object.is(result, -0) ? 0 : result;
}

export function calculatePrintScale({ target, measuredX, measuredY, tolerancePercent = 0.5 }) {
  for (const [name, value] of Object.entries({ target, measuredX, measuredY })) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new RangeError(`${name} must be a finite positive number.`);
    }
  }
  if (typeof tolerancePercent !== 'number' || !Number.isFinite(tolerancePercent) || tolerancePercent < 0) {
    throw new RangeError('Threshold must be a finite non-negative number.');
  }
  const xErrorPercent = ((measuredX - target) / target) * 100;
  const yErrorPercent = ((measuredY - target) / target) * 100;
  const differencePercentagePoints = Math.abs(xErrorPercent - yErrorPercent);
  const xScalePercent = (measuredX / target) * 100;
  const yScalePercent = (measuredY / target) * 100;
  if (![xScalePercent, yScalePercent, xErrorPercent, yErrorPercent, differencePercentagePoints].every(Number.isFinite)) {
    throw new RangeError('The measurement range is too large. Recheck the lengths.');
  }
  const roundingSlack = 64 * Number.EPSILON * Math.max(100, xScalePercent, yScalePercent, tolerancePercent);
  return {
    xScalePercent, yScalePercent, xErrorPercent, yErrorPercent,
    differencePercentagePoints,
    nonUniform: differencePercentagePoints > tolerancePercent + roundingSlack,
    withinTolerance: Math.abs(xErrorPercent) <= tolerancePercent + roundingSlack && Math.abs(yErrorPercent) <= tolerancePercent + roundingSlack,
    tolerancePercent,
  };
}

export function formatNumber(value, { signed = false } = {}) {
  if (!Number.isFinite(value)) throw new RangeError('Result is not finite.');
  if (value === 0) return '0';
  // Significant figures avoid falsely displaying small, nonzero results as 0.
  const abs = Math.abs(value);
  const text = abs < 1e-4 || abs >= 1e9 ? value.toExponential(7) : String(Number(value.toPrecision(9)));
  return signed && value > 0 ? `+${text}` : text;
}

/** Quote every field and neutralise formula-like user text in spreadsheet imports. */
export function csvCell(value) {
  let text = String(value ?? '');
  if (typeof value !== 'number' && (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(fields) {
  return fields.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function conversionCsv({ label, value, unit, results }) {
  return toCsv([
    ['record_type', 'label', 'entered_value', 'entered_unit', 'mm', 'cm', 'in'],
    ['length_conversion', label, value, unit, results.mm, results.cm, results.in],
  ]);
}

export function printCsv({ label, unit, target, measuredX, measuredY, result }) {
  return toCsv([
    ['record_type', 'label', 'unit', 'target', 'measured_x', 'measured_y', 'x_error_percent', 'y_error_percent', 'axis_gap_percentage_points', 'chosen_axis_threshold_percent', 'chosen_gap_threshold_percentage_points', 'both_axes_within_chosen_threshold', 'axis_gap_exceeds_chosen_threshold'],
    ['print_square_check', label, unit, target, measuredX, measuredY, result.xErrorPercent, result.yErrorPercent, result.differencePercentagePoints, result.tolerancePercent, result.tolerancePercent, result.withinTolerance, result.nonUniform],
  ]);
}
