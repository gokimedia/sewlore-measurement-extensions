import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNumber, convertLength, calculatePrintScale, formatNumber, csvCell, conversionCsv, printCsv } from '../extension/measurement.js';
import { calculatePrintScale as existingCore } from './fixtures/upstream-calculations.js';

const close = (a, b, epsilon = 1e-10) => assert.ok(Math.abs(a - b) <= epsilon * Math.max(1, Math.abs(b)), `${a} != ${b}`);

test('mm, cm and international inch conversions agree with defined ratios', () => {
  close(convertLength(1, 'in', 'mm'), 25.4);
  close(convertLength(2.54, 'cm', 'in'), 1);
  close(convertLength(25.4, 'mm', 'cm'), 2.54);
  close(convertLength(100, 'mm', 'in'), 100 / 25.4);
  for (const from of ['mm', 'cm', 'in']) for (const to of ['mm', 'cm', 'in']) {
    for (const value of [0, 0.001, 10, 10000]) close(convertLength(convertLength(value, from, to), to, from), value);
  }
});

test('conversion rejects invalid units, negative input, overflow and total underflow', () => {
  for (const value of [-1, Infinity, NaN, '10', undefined]) assert.throws(() => convertLength(value, 'mm', 'cm'), RangeError);
  assert.throws(() => convertLength(1, 'm', 'cm'), /Choose/);
  assert.throws(() => convertLength(Number.MAX_VALUE, 'in', 'mm'), /range/);
  assert.throws(() => convertLength(Number.MIN_VALUE, 'mm', 'in'), /range/);
  assert.equal(convertLength(Number.MAX_VALUE, 'mm', 'mm'), Number.MAX_VALUE);
  // Ratio-first arithmetic avoids an unnecessary intermediate overflow.
  assert.ok(Number.isFinite(convertLength(Number.MAX_VALUE / 3, 'in', 'cm')));
});

test('number parsing handles decimal and exponent syntax and rejects partial or unsafe input', () => {
  for (const [text, value] of [[' 2.54 ', 2.54], ['.5', .5], ['1e2', 100], ['+1', 1], ['-0', 0], ['0e-9999', 0]]) assert.equal(parseNumber(text, 'Value'), value);
  for (const text of ['', ' ', '0x10', '10cm', '1,5', 'NaN', 'Infinity', '-1', '1e999', '1e-9999', '.0001e-9999']) assert.throws(() => parseNumber(text, 'Value'), RangeError);
  assert.throws(() => parseNumber('0', 'Target', { positive: true }), /positive/);
  assert.equal(parseNumber('5e-324', 'Value'), Number.MIN_VALUE);
});

test('original tested print core and extension calculations remain equivalent', () => {
  for (const input of [
    { target: 100, measuredX: 99.5, measuredY: 100, tolerancePercent: .5 },
    { target: 100, measuredX: 99.6, measuredY: 100.4, tolerancePercent: .5 },
    { target: 10, measuredX: 9.8, measuredY: 9.8, tolerancePercent: .5 },
    { target: .001, measuredX: .001001, measuredY: .00099, tolerancePercent: 0 },
  ]) assert.deepEqual(calculatePrintScale(input), existingCore(input));
});

test('oppositely signed passing axes can still exceed the gap threshold', () => {
  const result = calculatePrintScale({ target: 100, measuredX: 99.6, measuredY: 100.4, tolerancePercent: .5 });
  close(result.xErrorPercent, -.4); close(result.yErrorPercent, .4); close(result.differencePercentagePoints, .8);
  assert.equal(result.withinTolerance, true); assert.equal(result.nonUniform, true);
});

test('equal undersized axes fail axis limits without a non-uniform flag', () => {
  const result = calculatePrintScale({ target: 100, measuredX: 98, measuredY: 98, tolerancePercent: .5 });
  assert.equal(result.withinTolerance, false); assert.equal(result.nonUniform, false);
  close(result.differencePercentagePoints, 0); close(result.xErrorPercent, -2);
});

test('exact boundary tolerates representation rounding but a meaningful excess fails', () => {
  const boundary = calculatePrintScale({ target: 100, measuredX: 100.5, measuredY: 100, tolerancePercent: .5 });
  assert.equal(boundary.withinTolerance, true); assert.equal(boundary.nonUniform, false);
  const excess = calculatePrintScale({ target: 100, measuredX: 100.500001, measuredY: 100, tolerancePercent: .5 });
  assert.equal(excess.withinTolerance, false); assert.equal(excess.nonUniform, true);
  const perfect = calculatePrintScale({ target: 100, measuredX: 100, measuredY: 100, tolerancePercent: 0 });
  assert.equal(perfect.withinTolerance, true); assert.equal(perfect.nonUniform, false);
});

test('print comparison is invariant under all common-unit conversions', () => {
  const base = { target: 100, measuredX: 99.5, measuredY: 100.3, tolerancePercent: .5 };
  const result = calculatePrintScale(base);
  for (const unit of ['cm', 'in']) {
    const converted = { ...base };
    for (const key of ['target', 'measuredX', 'measuredY']) converted[key] = convertLength(base[key], 'mm', unit);
    const actual = calculatePrintScale(converted);
    for (const key of ['xErrorPercent', 'yErrorPercent', 'differencePercentagePoints']) close(actual[key], result[key]);
    assert.equal(actual.nonUniform, result.nonUniform); assert.equal(actual.withinTolerance, result.withinTolerance);
  }
});

test('print comparison rejects zero, negative, non-finite and overflow ranges', () => {
  for (const key of ['target', 'measuredX', 'measuredY']) for (const value of [0, -1, NaN, Infinity, '100']) {
    assert.throws(() => calculatePrintScale({ target: 100, measuredX: 100, measuredY: 100, [key]: value }), RangeError);
  }
  for (const value of [-1, NaN, Infinity, '0.5']) assert.throws(() => calculatePrintScale({ target: 100, measuredX: 100, measuredY: 100, tolerancePercent: value }), RangeError);
  assert.throws(() => calculatePrintScale({ target: Number.MIN_VALUE, measuredX: 1, measuredY: 1 }), /range/);
});

test('formatting preserves small nonzero values and the direction of error', () => {
  assert.equal(formatNumber(0), '0'); assert.equal(formatNumber(-0), '0');
  assert.equal(formatNumber(.4, { signed: true }), '+0.4');
  assert.equal(formatNumber(-.4, { signed: true }), '-0.4');
  assert.notEqual(formatNumber(1e-9), '0'); assert.notEqual(formatNumber(-1e-9), '0');
  assert.throws(() => formatNumber(Infinity), RangeError);
});

test('CSV quoting handles labels, embedded line breaks, commas and formula prefixes', () => {
  assert.equal(csvCell('Cotton, "blue"'), '"Cotton, ""blue"""');
  assert.equal(csvCell('line one\r\nline two'), '"line one\r\nline two"');
  for (const label of ['=1+1', '+SUM(A1)', '-1+2', '@SUM(A1)', '  =2', '\tformula', '\rformula', '\nformula', '\uFEFF=2']) {
    assert.ok(csvCell(label).startsWith('"\''));
  }
  assert.equal(csvCell(-2), '"-2"');
  const converted = conversionCsv({ label: '=HYPERLINK("x")', value: 1, unit: 'in', results: { mm: 25.4, cm: 2.54, in: 1 } });
  assert.ok(converted.includes('"\'=HYPERLINK(""x"")"')); assert.ok(converted.endsWith('\r\n'));
});

test('export keeps raw numbers, both distinct flags, common unit and chosen thresholds', () => {
  const result = calculatePrintScale({ target: 100, measuredX: 99.6, measuredY: 100.4, tolerancePercent: .5 });
  const csv = printCsv({ label: 'Sample A', unit: 'mm', target: 100, measuredX: 99.6, measuredY: 100.4, result });
  assert.ok(csv.includes('"axis_gap_percentage_points"'));
  assert.ok(csv.includes('"chosen_gap_threshold_percentage_points"'));
  assert.ok(csv.includes('"mm","100","99.6","100.4"'));
  assert.ok(csv.endsWith('"0.5","0.5","true","true"\r\n'));
});
