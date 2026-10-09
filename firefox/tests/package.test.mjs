import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const runtime = new URL('../extension/', import.meta.url);

test('the equivalence-test fixture preserves the immutable original source bytes', async () => {
  const source = await readFile(new URL('./fixtures/upstream-calculations.js', import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'), '8b64eb70d683574dda93aa2eb68c268177d60e6f7a3c857ac79ae718cee5044e');
});

test('manifest declares no API or site access and no transmitted data', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', runtime), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  for (const key of ['permissions', 'host_permissions', 'optional_permissions', 'optional_host_permissions', 'background', 'content_scripts', 'web_accessible_resources']) assert.equal(manifest[key], undefined);
  assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions, { required: ['none'] });
  assert.equal(manifest.browser_specific_settings.gecko.strict_min_version, '142.0');
  assert.match(manifest.browser_specific_settings.gecko.id, /^[\w.-]+@[\w.-]+$/);
  assert.ok(manifest.content_security_policy.extension_pages.includes("connect-src 'none'"));
});

test('runtime contains neither network clients nor dynamic code or persistent storage', async () => {
  for (const filename of await readdir(runtime)) {
    if (!filename.endsWith('.js')) continue;
    const source = await readFile(new URL(filename, runtime), 'utf8');
    for (const banned of [/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/, /\beval\s*\(/, /new\s+Function/, /localStorage/, /sessionStorage/, /browser\.storage/, /innerHTML/]) {
      assert.equal(banned.test(source), false, `${filename}: ${banned}`);
    }
  }
});

test('all script, stylesheet and image references are local packaged files', async () => {
  for (const filename of ['popup.html', 'privacy.html']) {
    const html = await readFile(new URL(filename, runtime), 'utf8');
    assert.equal(/\son\w+\s*=/i.test(html), false);
    for (const match of html.matchAll(/<(?:script|link|img)\b[^>]*\b(?:src|href)="([^"]+)"/g)) {
      assert.equal(/^(?:https?:|\/\/|data:)/.test(match[1]), false);
      assert.equal(path.isAbsolute(match[1]), false);
      assert.ok(await readFile(new URL(match[1], runtime)));
    }
  }
});
