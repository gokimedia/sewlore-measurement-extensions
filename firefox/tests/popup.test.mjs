import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { initialisePopup } from '../extension/popup.js';
const html = await readFile(new URL('../extension/popup.html', import.meta.url), 'utf8');
function setup() {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const downloads = [];
  initialisePopup(doc, (csv, filename) => downloads.push({ csv, filename }));
  const get = (id) => doc.getElementById(id);
  const fill = (id, value) => { get(id).value = value; get(id).dispatchEvent(new dom.window.Event('input', { bubbles: true })); };
  const submit = (id) => get(id).dispatchEvent(new dom.window.Event('submit', { cancelable: true, bubbles: true }));
  return { dom, doc, downloads, get, fill, submit };
}

test('all inputs have associated labels and page IDs are unique', () => {
  const { doc } = setup();
  const ids = [...doc.querySelectorAll('[id]')].map((node) => node.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const input of doc.querySelectorAll('input,select')) assert.equal(doc.querySelectorAll(`label[for="${input.id}"]`).length, 1);
});

test('no physical measurements appear as initial input defaults', () => {
  const { get } = setup();
  for (const id of ['length', 'target', 'measured-x', 'measured-y']) assert.equal(get(id).value, '');
  assert.equal(get('threshold').value, '0.5');
  assert.equal(get('export-conversion').disabled, true); assert.equal(get('export-print').disabled, true);
});

test('converter handler renders equivalent units and exports only on explicit action', () => {
  const { get, fill, submit, downloads } = setup();
  fill('length', '1'); fill('from-unit', 'in'); fill('conversion-label', '=1+1'); submit('conversion-form');
  assert.equal(get('conversion-output').hidden, false);
  assert.equal(get('conversion-error').hidden, true);
  assert.equal(get('export-conversion').disabled, false);
  assert.equal(downloads.length, 0);
  const values = [...get('conversion-output').querySelectorAll('td')].map((node) => node.textContent);
  assert.deepEqual(values, ['25.4', '2.54', '1']);
  get('export-conversion').click();
  assert.equal(downloads.length, 1); assert.equal(downloads[0].filename, 'sewlore-length-conversion.csv');
  assert.ok(downloads[0].csv.includes('"\'=1+1"'));
});

test('editing a conversion field clears the snapshot and blocks stale CSV export', () => {
  const { get, fill, submit, downloads } = setup();
  fill('length', '10'); submit('conversion-form');
  fill('conversion-label', 'new label');
  assert.equal(get('conversion-output').hidden, true); assert.equal(get('export-conversion').disabled, true);
  get('export-conversion').click(); assert.equal(downloads.length, 0);
  submit('conversion-form'); get('export-conversion').click();
  assert.ok(downloads[0].csv.includes('new label'));
});

test('invalid conversion never leaves a previously exportable result', () => {
  const { get, fill, submit, downloads } = setup();
  fill('length', '10'); submit('conversion-form');
  fill('length', '1e999'); submit('conversion-form');
  assert.equal(get('conversion-output').hidden, true); assert.equal(get('conversion-error').hidden, false);
  assert.equal(get('export-conversion').disabled, true);
  get('export-conversion').click(); assert.equal(downloads.length, 0);
});

test('print form preserves direction and presents the two independently true flags', () => {
  const { get, fill, submit, downloads } = setup();
  get('show-print').click();
  assert.equal(get('print-section').hidden, false); assert.equal(get('convert-section').hidden, true);
  assert.equal(get('show-print').getAttribute('aria-pressed'), 'true');
  fill('target', '100'); fill('measured-x', '99.6'); fill('measured-y', '100.4'); fill('print-label', 'A'); submit('print-form');
  assert.equal(get('print-error').hidden, true);
  assert.deepEqual([...get('print-output').querySelectorAll('td')].map((node) => node.textContent), ['-0.4%', '+0.4%', '0.8 pp']);
  const text = get('print-output').textContent;
  assert.ok(text.includes('Both axes within 0.5%: Yes')); assert.ok(text.includes('Axis gap exceeds 0.5 pp: Yes'));
  assert.equal(downloads.length, 0); get('export-print').click();
  assert.equal(downloads[0].filename, 'sewlore-print-check.csv');
  assert.ok(downloads[0].csv.endsWith('"0.5","0.5","true","true"\r\n'));
});

test('uniform undersize is not incorrectly labelled an acceptable print', () => {
  const { get, fill, submit } = setup();
  fill('target', '100'); fill('measured-x', '98'); fill('measured-y', '98'); submit('print-form');
  assert.ok(get('print-output').textContent.includes('Both axes within 0.5%: No'));
  assert.ok(get('print-output').textContent.includes('Axis gap exceeds 0.5 pp: No'));
});

test('changed print unit and zero target invalidate the previous downloadable record', () => {
  const { get, fill, submit, downloads, dom } = setup();
  fill('target', '100'); fill('measured-x', '100'); fill('measured-y', '100'); submit('print-form');
  get('print-unit').value = 'cm'; get('print-unit').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal(get('print-output').hidden, true); assert.equal(get('export-print').disabled, true);
  fill('target', '0'); submit('print-form');
  assert.equal(get('print-error').hidden, false); assert.ok(get('print-error').textContent.includes('positive'));
  get('export-print').click(); assert.equal(downloads.length, 0);
});

test('a new popup has no state from a previously calculated popup', () => {
  const old = setup(); old.fill('target', '100'); old.fill('measured-x', '98'); old.fill('measured-y', '98'); old.submit('print-form');
  const fresh = setup();
  assert.equal(fresh.get('target').value, ''); assert.equal(fresh.get('print-output').hidden, true);
  assert.equal(fresh.get('export-print').disabled, true);
});
