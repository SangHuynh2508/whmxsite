import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from './escapeHtml.mts';

test('escapes markup so injected text renders as text', () => {
  assert.equal(escapeHtml('<img src=x onerror="a(\'1\')">&'), '&lt;img src=x onerror=&quot;a(&#39;1&#39;)&quot;&gt;&amp;');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml('Bộ Thương Mại'), 'Bộ Thương Mại');
});
