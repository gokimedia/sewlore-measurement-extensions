'use strict';

// Copyright (c) 2026 Sewlore. MIT License.
// Schema and numeric conventions adapted from Sewlore's MIT fabric-care validator.
const INPUT_COLUMNS = Object.freeze([
  'sample_id', 'before_unit', 'after_unit', 'before_length', 'before_width',
  'after_length', 'after_width', 'care_method', 'rectangle_assumption', 'notes',
]);
const UNIT_MM = Object.freeze({ mm: 1, cm: 10, in: 25.4 });
const DECIMAL = /^\+?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:e[+-]?[0-9]+)?$/i;
const MAX_CHARACTERS = 1_000_000;
const MAX_RECORDS = 20_000;
const TEMPLATE = `${INPUT_COLUMNS.join(',')}\n`;

function issue(code, field, message, start, end, recordNumber = 0) {
  return { code, field, message, start, end: Math.max(start, end), recordNumber };
}

/** Strict comma-separated CSV. Offsets refer to the original UTF-16 document. */
function parseCsv(text) {
  const rows = [];
  let cursor = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let rowStart = cursor;
  let fieldStart = cursor;
  let value = '';
  let cells = [];
  let state = 'start';
  function finishField(end) {
    cells.push({ value, start: fieldStart, end });
    value = '';
    state = 'start';
  }
  function finishRow(end) {
    rows.push({ cells, start: rowStart, end });
    cells = [];
  }
  while (cursor < text.length) {
    const character = text[cursor];
    if (state === 'quoted') {
      if (character === '"') {
        if (text[cursor + 1] === '"') {
          value += '"';
          cursor += 2;
        } else {
          state = 'afterQuote';
          cursor++;
        }
      } else {
        value += character;
        cursor++;
      }
      continue;
    }
    if (character === ',') {
      finishField(cursor);
      cursor++;
      fieldStart = cursor;
      continue;
    }
    if (character === '\r' || character === '\n') {
      finishField(cursor);
      finishRow(cursor);
      if (rows.length > MAX_RECORDS + 1) {
        return { rows: [], errors: [issue('csv-limit', 'CSV', `Use at most ${MAX_RECORDS} data records, including empty lines.`, rowStart, cursor)] };
      }
      cursor += character === '\r' && text[cursor + 1] === '\n' ? 2 : 1;
      rowStart = cursor;
      fieldStart = cursor;
      continue;
    }
    if (state === 'afterQuote') {
      return { rows: [], errors: [issue('csv-structure', 'CSV', 'After a closing quote, use a comma or a line ending.', cursor, cursor + 1)] };
    }
    if (character === '"') {
      if (state !== 'start') {
        return { rows: [], errors: [issue('csv-structure', 'CSV', 'Quote the whole cell when it contains a double quote.', cursor, cursor + 1)] };
      }
      state = 'quoted';
    } else {
      value += character;
      state = 'unquoted';
    }
    cursor++;
  }
  if (state === 'quoted') {
    return { rows: [], errors: [issue('csv-structure', 'CSV', 'This quoted cell has no closing quote.', fieldStart, text.length)] };
  }
  if (cells.length || value.length || state === 'afterQuote' || rowStart < text.length) {
    finishField(text.length);
    finishRow(text.length);
  }
  if (rows.length > MAX_RECORDS + 1) {
    return { rows: [], errors: [issue('csv-limit', 'CSV', `Use at most ${MAX_RECORDS} data records, including empty lines.`, rowStart, text.length)] };
  }
  return { rows, errors: [] };
}

function positiveNumber(text) {
  const trimmed = text.trim();
  if (!DECIMAL.test(trimmed)) {
    throw new RangeError('Use a decimal number without unit text or thousands separators.');
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError('The reading must be finite and greater than zero.');
  }
  return value;
}

function calculateChanges(beforeLength, beforeWidth, afterLength, afterWidth, rectangle) {
  const lengthRatio = afterLength / beforeLength;
  const widthRatio = afterWidth / beforeWidth;
  if (![lengthRatio, widthRatio].every(value => Number.isFinite(value) && value > 0)) {
    throw new RangeError('These magnitudes cannot be compared reliably.');
  }
  const lengthChangePercent = (1 - lengthRatio) * 100;
  const widthChangePercent = (1 - widthRatio) * 100;
  if (![lengthChangePercent, widthChangePercent].every(Number.isFinite)) {
    throw new RangeError('The axis change is outside the supported numeric range.');
  }
  let rectangularAreaChangePercent = null;
  if (rectangle) {
    const areaRatio = lengthRatio * widthRatio;
    rectangularAreaChangePercent = (1 - areaRatio) * 100;
    if (!Number.isFinite(rectangularAreaChangePercent) || areaRatio <= 0) {
      throw new RangeError('The requested rectangular area change cannot be represented reliably.');
    }
  }
  return { lengthChangePercent, widthChangePercent, rectangularAreaChangePercent };
}

/** Parse the whole CSV before validating individual records. No partial structure recovery. */
function validateCsv(text) {
  if (typeof text !== 'string') throw new TypeError('Provide CSV as text.');
  if (text.length > MAX_CHARACTERS) {
    return { records: [], diagnostics: [issue('csv-limit', 'CSV', 'Use a CSV of at most one million characters.', 0, 0)], rejectedRecords: 0, structureValid: false, headerValid: false };
  }
  const parsed = parseCsv(text);
  if (parsed.errors.length) {
    return { records: [], diagnostics: parsed.errors, rejectedRecords: 0, structureValid: false, headerValid: false };
  }
  const header = parsed.rows[0];
  if (!header || header.cells.length !== INPUT_COLUMNS.length || !header.cells.every((cell, index) => cell.value === INPUT_COLUMNS[index])) {
    return { records: [], diagnostics: [issue('header', 'header', 'Use the supplied ten-column header exactly, once and in its supplied order.', header?.start ?? 0, header?.end ?? 0, 1)], rejectedRecords: 0, structureValid: true, headerValid: false };
  }
  const records = [];
  const diagnostics = [];
  let rejectedRecords = 0;
  for (let index = 1; index < parsed.rows.length; index++) {
    const row = parsed.rows[index];
    if (row.cells.length === 1 && row.start === row.end && row.cells[0].value === '') continue;
    const recordNumber = index + 1;
    if (row.cells.length !== INPUT_COLUMNS.length) {
      diagnostics.push(issue('columns', 'columns', `Expected ten cells; found ${row.cells.length}.`, row.start, row.end, recordNumber));
      rejectedRecords++;
      continue;
    }
    const cells = Object.fromEntries(INPUT_COLUMNS.map((field, fieldIndex) => [field, row.cells[fieldIndex]]));
    const values = Object.fromEntries(INPUT_COLUMNS.map(field => [field, cells[field].value]));
    const previousIssues = diagnostics.length;
    function report(code, field, message) {
      const cell = cells[field];
      diagnostics.push(issue(code, field, message, cell.start, cell.end, recordNumber));
    }
    for (const field of ['sample_id', 'care_method']) {
      values[field] = values[field].trim();
      if (!values[field]) report('required', field, 'Record this value before comparing the sample.');
    }
    for (const field of ['before_unit', 'after_unit']) {
      values[field] = values[field].trim().toLowerCase();
      if (!Object.hasOwn(UNIT_MM, values[field])) report('unit', field, 'Use cm, mm or in.');
    }
    if (Object.hasOwn(UNIT_MM, values.before_unit) && Object.hasOwn(UNIT_MM, values.after_unit) && values.before_unit !== values.after_unit) {
      report('unit-match', 'after_unit', 'Before and after units must match. Convert the readings first.');
    }
    const assumption = values.rectangle_assumption.trim().toLowerCase();
    if (!['', 'yes', 'no'].includes(assumption)) {
      report('rectangle', 'rectangle_assumption', 'Use yes only for actual rectangles; use no or leave blank otherwise.');
    }
    values.rectangle_assumption = assumption === 'yes' ? 'yes' : 'no';
    const millimetres = {};
    for (const field of ['before_length', 'before_width', 'after_length', 'after_width']) {
      try {
        values[field] = positiveNumber(values[field]);
        const unit = field.startsWith('before_') ? values.before_unit : values.after_unit;
        if (Object.hasOwn(UNIT_MM, unit)) {
          millimetres[field] = values[field] * UNIT_MM[unit];
          if (!Number.isFinite(millimetres[field]) || millimetres[field] <= 0) {
            report('numeric-range', field, 'The converted length is outside the supported numeric range.');
          }
        }
      } catch (error) {
        report('number', field, error.message);
      }
    }
    if (diagnostics.length !== previousIssues) {
      rejectedRecords++;
      continue;
    }
    try {
      const changes = calculateChanges(millimetres.before_length, millimetres.before_width, millimetres.after_length, millimetres.after_width, assumption === 'yes');
      records.push({ ...values, ...changes, recordNumber, start: row.start, end: row.end });
    } catch (error) {
      diagnostics.push(issue('calculation', 'calculation', error.message, row.start, row.end, recordNumber));
      rejectedRecords++;
    }
  }
  return { records, diagnostics, rejectedRecords, structureValid: true, headerValid: true };
}

module.exports = { INPUT_COLUMNS, TEMPLATE, MAX_CHARACTERS, MAX_RECORDS, parseCsv, positiveNumber, calculateChanges, validateCsv };
