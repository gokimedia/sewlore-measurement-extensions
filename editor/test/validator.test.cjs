'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { INPUT_COLUMNS, TEMPLATE, MAX_CHARACTERS, MAX_RECORDS, parseCsv, validateCsv } = require('../src/validator.cjs');

function csvRow(overrides = {}) {
  const values = {
    sample_id: 'invented-demo', before_unit: 'cm', after_unit: 'cm',
    before_length: '20', before_width: '10', after_length: '19', after_width: '9.5',
    care_method: 'synthetic worked example', rectangle_assumption: 'yes', notes: 'Not a physical test',
    ...overrides,
  };
  return INPUT_COLUMNS.map(field => {
    const value = String(values[field]);
    return /[,"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  }).join(',');
}
function approximately(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} differs from ${expected}`);
}
function lineOf(text, offset) {
  return text.slice(0, offset).split(/\r\n|\r|\n/).length;
}

test('a real worked example yields 5%, 5% and 9.75%, not a summed area', () => {
  const result = validateCsv(TEMPLATE + csvRow());
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.records.length, 1);
  approximately(result.records[0].lengthChangePercent, 5);
  approximately(result.records[0].widthChangePercent, 5);
  approximately(result.records[0].rectangularAreaChangePercent, 9.75);
});

test('an expanded sample has signed negative change and no assumed area', () => {
  const result = validateCsv(TEMPLATE + csvRow({ after_length: '21', after_width: '10.5', rectangle_assumption: '' }));
  assert.equal(result.diagnostics.length, 0);
  approximately(result.records[0].lengthChangePercent, -5);
  approximately(result.records[0].widthChangePercent, -5);
  assert.equal(result.records[0].rectangularAreaChangePercent, null);
  assert.equal(result.records[0].rectangle_assumption, 'no');
});

test('quoted commas, escaped quotes and newlines are preserved, with physical offsets after them', () => {
  const multilineRow = csvRow({ sample_id: 'demo, one', notes: 'Line one\nLine "two"' });
  const invalidRow = csvRow({ sample_id: 'bad-after-multiline', after_width: '0' });
  const text = TEMPLATE + multilineRow + '\n' + invalidRow + '\n';
  const parsed = parseCsv(text);
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.rows[1].cells[0].value, 'demo, one');
  assert.equal(parsed.rows[1].cells[9].value, 'Line one\nLine "two"');
  const result = validateCsv(text);
  assert.equal(result.records.length, 1);
  assert.equal(result.rejectedRecords, 1);
  const problem = result.diagnostics.find(issue => issue.field === 'after_width');
  assert.equal(lineOf(text, problem.start), 4);
  assert.equal(problem.recordNumber, 3);
  assert.equal(text.slice(problem.start, problem.end), '0');
});

test('LF, CRLF, CR, BOM and a final line without a newline are handled', () => {
  for (const eol of ['\n', '\r\n', '\r']) {
    const text = '\uFEFF' + TEMPLATE.trimEnd() + eol + eol + csvRow({ before_length: '0' });
    const result = validateCsv(text);
    assert.equal(result.headerValid, true);
    assert.equal(result.rejectedRecords, 1);
    assert.equal(result.diagnostics.length, 1);
    assert.equal(lineOf(text, result.diagnostics[0].start), 3);
    assert.equal(text.slice(result.diagnostics[0].start, result.diagnostics[0].end), '0');
  }
});

test('a quoted numeric cell keeps its exact diagnostic range', () => {
  const text = TEMPLATE + csvRow().replace(',19,', ',"0",');
  const problem = validateCsv(text).diagnostics[0];
  assert.equal(problem.field, 'after_length');
  assert.equal(text.slice(problem.start, problem.end), '"0"');
});

test('bad CSV structure cancels all calculations instead of accepting a parsed prefix', () => {
  for (const broken of ['"not closed', 'bare"quote', '"closed" extra']) {
    const text = TEMPLATE + csvRow() + '\n' + broken;
    const result = validateCsv(text);
    assert.equal(result.structureValid, false);
    assert.equal(result.records.length, 0);
    assert.equal(result.diagnostics[0].code, 'csv-structure');
    assert.equal(lineOf(text, result.diagnostics[0].start), 3);
  }
});

test('empty and wrong headers are rejected, but equivalent CSV quoting is accepted', () => {
  for (const input of ['', 'sample_id,unit,value\na,cm,10', TEMPLATE.replace('notes', 'Notes')]) {
    const result = validateCsv(input);
    assert.equal(result.headerValid, false);
    assert.equal(result.records.length, 0);
    assert.equal(result.diagnostics[0].code, 'header');
  }
  const result = validateCsv(INPUT_COLUMNS.map(field => `"${field}"`).join(',') + '\n' + csvRow());
  assert.equal(result.headerValid, true);
  assert.equal(result.records.length, 1);
});

test('extra cells and missing cells reject only those records', () => {
  const result = validateCsv(TEMPLATE + csvRow() + ',extra\n' + csvRow().split(',').slice(0, 9).join(',') + '\n' + csvRow());
  assert.equal(result.records.length, 1);
  assert.equal(result.rejectedRecords, 2);
  assert.deepEqual(result.diagnostics.map(problem => problem.code), ['columns', 'columns']);
});

test('partly empty records are diagnosed; entirely empty lines are ignored', () => {
  const result = validateCsv(TEMPLATE + '\n' + ',,,,,,,,,\n' + csvRow());
  assert.equal(result.records.length, 1);
  assert.equal(result.rejectedRecords, 1);
  assert.ok(result.diagnostics.some(problem => problem.field === 'sample_id'));
  assert.ok(result.diagnostics.some(problem => problem.field === 'care_method'));
  assert.ok(result.diagnostics.some(problem => problem.field === 'before_length'));
});

test('all unit domains are supported; mixed units and inherited-object names are rejected', () => {
  for (const unit of ['cm', 'mm', 'in', ' CM ', 'In']) {
    const result = validateCsv(TEMPLATE + csvRow({ before_unit: unit, after_unit: unit }));
    assert.equal(result.diagnostics.length, 0);
    approximately(result.records[0].lengthChangePercent, 5);
  }
  const mixed = validateCsv(TEMPLATE + csvRow({ after_unit: 'mm' }));
  assert.equal(mixed.records.length, 0);
  assert.equal(mixed.diagnostics[0].code, 'unit-match');
  assert.equal(mixed.diagnostics[0].field, 'after_unit');
  for (const unit of ['inch', 'm', 'constructor', '__proto__', 'toString']) {
    const result = validateCsv(TEMPLATE + csvRow({ before_unit: unit }));
    assert.equal(result.records.length, 0);
    assert.ok(result.diagnostics.some(problem => problem.code === 'unit'));
  }
});

test('numeric grammar rejects text, formulas, non-finite values, zero and decimal underflow', () => {
  for (const reading of ['', '0', '-1', 'NaN', 'Infinity', '1e309', '1e-324', '20 cm', '1,000', '0x10', '=1+2', '1_000', '−1']) {
    const result = validateCsv(TEMPLATE + csvRow({ before_length: reading }));
    assert.equal(result.records.length, 0, reading);
    assert.ok(result.diagnostics.some(problem => problem.field === 'before_length'), reading);
  }
});

test('decimal notation supports explicit positive signs, fractions and scientific exponents', () => {
  const result = validateCsv(TEMPLATE + csvRow({ before_length: ' +2e1 ', before_width: '10.', after_length: '1.9E+1', after_width: '.95e1' }));
  assert.equal(result.diagnostics.length, 0);
  approximately(result.records[0].lengthChangePercent, 5);
});

test('converted lengths, comparison ratios and requested area reject overflow or underflow', () => {
  const cases = [
    { before_unit: 'in', after_unit: 'in', before_length: '1e308' },
    { before_unit: 'mm', after_unit: 'mm', before_length: '1e308', after_length: '1e-300' },
    { before_unit: 'mm', after_unit: 'mm', before_length: '1e-300', after_length: '1e308' },
    { before_unit: 'mm', after_unit: 'mm', before_length: '1', before_width: '1', after_length: '1e200', after_width: '1e200' },
    { before_unit: 'mm', after_unit: 'mm', before_length: '1', before_width: '1', after_length: '1e-200', after_width: '1e-200' },
  ];
  for (const overrides of cases) {
    const result = validateCsv(TEMPLATE + csvRow(overrides));
    assert.equal(result.records.length, 0);
    assert.equal(result.rejectedRecords, 1);
    assert.ok(result.diagnostics.some(problem => ['numeric-range', 'calculation'].includes(problem.code)));
  }
  const withoutArea = validateCsv(TEMPLATE + csvRow({ before_unit: 'mm', after_unit: 'mm', before_length: '1', before_width: '1', after_length: '1e200', after_width: '1e200', rectangle_assumption: 'no' }));
  assert.equal(withoutArea.diagnostics.length, 0);
  assert.equal(withoutArea.records[0].rectangularAreaChangePercent, null);
});

test('area requires the documented yes/no/blank domain', () => {
  for (const value of ['YES', ' yes ', 'no', '']) {
    const result = validateCsv(TEMPLATE + csvRow({ rectangle_assumption: value }));
    assert.equal(result.diagnostics.length, 0);
  }
  for (const value of ['true', '1', 'rectangle', 'perhaps']) {
    const result = validateCsv(TEMPLATE + csvRow({ rectangle_assumption: value }));
    assert.equal(result.records.length, 0);
    assert.equal(result.diagnostics[0].code, 'rectangle');
  }
});

test('missing IDs and procedures are flagged at their cells; free notes remain literal', () => {
  const result = validateCsv(TEMPLATE + csvRow({ sample_id: ' ', care_method: '' }));
  assert.deepEqual(result.diagnostics.map(problem => problem.field), ['sample_id', 'care_method']);
  const literal = validateCsv(TEMPLATE + csvRow({ notes: '=HYPERLINK("invented","literal text")' }));
  assert.equal(literal.records.length, 1);
  assert.equal(literal.records[0].notes, '=HYPERLINK("invented","literal text")');
});

test('document limits fail explicitly; exactly the allowed record count is accepted', () => {
  const tooLong = validateCsv('x'.repeat(MAX_CHARACTERS + 1));
  assert.equal(tooLong.structureValid, false);
  assert.equal(tooLong.diagnostics[0].code, 'csv-limit');
  const exactlyRecords = validateCsv(TEMPLATE + '\n'.repeat(MAX_RECORDS));
  assert.equal(exactlyRecords.diagnostics.length, 0);
  const tooMany = validateCsv(TEMPLATE + '\n'.repeat(MAX_RECORDS + 1));
  assert.equal(tooMany.structureValid, false);
  assert.equal(tooMany.diagnostics[0].code, 'csv-limit');
});

test('UTF-16 offsets remain correct when earlier cells contain non-ASCII characters', () => {
  const text = TEMPLATE + csvRow({ sample_id: '🧵 ölçüm', after_width: '0' });
  const problem = validateCsv(text).diagnostics[0];
  assert.equal(problem.start, text.indexOf(',0,') + 1);
  assert.equal(text.slice(problem.start, problem.end), '0');
});
