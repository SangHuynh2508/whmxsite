import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTags, tagHue, renderTagChipsHtml } from './tagColors.mts';

const characters = Object.values(JSON.parse(readFileSync('public/data.json', 'utf8')).characters) as { id: string; tags_vi?: string; tags_cn?: string }[];
const tokens = readFileSync('src/styles/tokens.css', 'utf8');

// owner 2026-09-28: tags on one character must never share a colour ("màu của mấy cái tag đang trùng nhau")
test('no character shows two tags in the same colour', () => {
  const clashes = characters.flatMap((c) => {
    const hues = parseTags(c.tags_vi || c.tags_cn || '').map(tagHue);
    return new Set(hues).size === hues.length ? [] : [`${c.id}: ${c.tags_vi} → ${hues.join(', ')}`];
  });
  assert.deepEqual(clashes, []);
});

test('every tag colour is a token in tokens.css', () => {
  const hues = new Set(characters.flatMap((c) => parseTags(c.tags_vi || c.tags_cn || '').map(tagHue)));
  for (const hue of hues) assert.match(tokens, new RegExp(`--tag-${hue}:`), hue);
});

test('chips carry the colour as a token, not a literal', () => {
  const html = renderTagChipsHtml('Viễn Chiến; Hỗ Trợ');
  assert.match(html, /--tag: var\(--tag-sky\)/);
  assert.match(html, /--tag: var\(--tag-green\)/);
  assert.doesNotMatch(html, /#[0-9a-f]{3,6}/i);
});
