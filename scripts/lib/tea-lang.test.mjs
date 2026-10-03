import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { teaLangFile, teaLangKeys } from './tea-lang.mjs';

test('teaLangFile follows the newest launch provenance to its decoded language table', () => {
  const root = mkdtempSync(join(tmpdir(), 'tea-lang-'));
  mkdirSync(join(root, 'provenance'));
  writeFileSync(join(root, 'provenance', 'launch_2026-09-30T05.json'), JSON.stringify({ language_decoded_path: 'captures/a/lang/5680_cn.json' }));
  writeFileSync(join(root, 'provenance', 'launch_2026-10-02T05.json'), JSON.stringify({ language_decoded_path: 'captures/b/lang/5696_cn.json' }));
  writeFileSync(join(root, 'provenance', 'notes.txt'), 'x');
  assert.equal(teaLangFile(root), join(root, 'captures/b/lang/5696_cn.json'));
});

test('teaLangFile names what is missing', () => {
  const root = mkdtempSync(join(tmpdir(), 'tea-lang-'));
  mkdirSync(join(root, 'provenance'));
  assert.throws(() => teaLangFile(root), /no launch provenance/);
  writeFileSync(join(root, 'provenance', 'launch_1.json'), JSON.stringify({}));
  assert.throws(() => teaLangFile(root), /launch_1\.json has no language_decoded_path/);
});

test('teaLangKeys keeps only the tea comments', () => {
  assert.deepEqual(teaLangKeys({ highteaLan_hightea_comment1Lan_A0001: 'a', highteaLan_hightea_topicLan_A0001101: 'b', other: 'c' }), { highteaLan_hightea_comment1Lan_A0001: 'a' });
});
