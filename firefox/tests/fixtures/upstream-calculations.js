/** Pure measurement calculations. All lengths in each call must use the same unit. */
function positiveFinite(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite number greater than zero.`);
  }
}

export function calculateStretch({ original, stretched, released }) {
  positiveFinite(original, 'Original length');
  positiveFinite(stretched, 'Stretched length');
  positiveFinite(released, 'Released length');
  if (stretched < original) throw new RangeError('Stretched length cannot be less than original length.');
  const extension = stretched - original;
  const residualExtension = released - original;
  const result = {
    stretchPercent: (extension / original) * 100,
    residualGrowthPercent: (residualExtension / original) * 100,
    recoveredExtensionPercent: extension === 0 ? null : ((stretched - released) / extension) * 100,
    extension,
    residualExtension,
    unusualReleasedLength: released < original || released > stretched,
  };
  if (![result.stretchPercent, result.residualGrowthPercent, result.recoveredExtensionPercent ?? 0].every(Number.isFinite)) {
    throw new RangeError('The measurement range is too large. Recheck the lengths.');
  }
  return result;
}

export function calculatePrintScale({ target, measuredX, measuredY, tolerancePercent = 0.5 }) {
  positiveFinite(target, 'Target side');
  positiveFinite(measuredX, 'Measured width');
  positiveFinite(measuredY, 'Measured height');
  if (typeof tolerancePercent !== 'number' || !Number.isFinite(tolerancePercent) || tolerancePercent < 0) {
    throw new RangeError('Tolerance must be a finite non-negative number.');
  }
  const xErrorPercent = ((measuredX - target) / target) * 100;
  const yErrorPercent = ((measuredY - target) / target) * 100;
  const differencePercentagePoints = Math.abs(xErrorPercent - yErrorPercent);
  // Permit floating point rounding at the exact threshold, without rounding away meaningful error.
  const xScalePercent = (measuredX / target) * 100;
  const yScalePercent = (measuredY / target) * 100;
  if (![xScalePercent, yScalePercent, xErrorPercent, yErrorPercent, differencePercentagePoints].every(Number.isFinite)) {
    throw new RangeError('The measurement range is too large. Recheck the lengths.');
  }
  const roundingSlack = 64 * Number.EPSILON * Math.max(100, xScalePercent, yScalePercent, tolerancePercent);
  return {
    xScalePercent,
    yScalePercent,
    xErrorPercent,
    yErrorPercent,
    differencePercentagePoints,
    nonUniform: differencePercentagePoints > tolerancePercent + roundingSlack,
    withinTolerance: Math.abs(xErrorPercent) <= tolerancePercent + roundingSlack && Math.abs(yErrorPercent) <= tolerancePercent + roundingSlack,
    tolerancePercent,
  };
}

export function convertLength(value, fromUnit, toUnit) {
  if (!['cm', 'in'].includes(fromUnit) || !['cm', 'in'].includes(toUnit)) throw new RangeError('Use cm or in.');
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new RangeError('Length must be finite.');
  return fromUnit === toUnit ? value : fromUnit === 'cm' ? value / 2.54 : value * 2.54;
}

/** Prevent CSV formula execution when a user-entered label is opened in spreadsheet software. */
export function csvCell(value) {
  let text = String(value ?? '');
  if (typeof value !== 'number' && (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
