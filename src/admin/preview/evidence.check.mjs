// Run: node src/admin/preview/evidence.check.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// package.json is "type": "commonjs", so load the ESM helper as a data: module (it has no imports).
const source = readFileSync(new URL('./evidence.js', import.meta.url), 'utf8');
const { buildEvidence, evidenceExtra, evidenceNote, parseJsonObject } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

const current = { note: 'a', source: 'x' };
const same = (value) => JSON.stringify(value);

// Editor, untouched → byte-identical (no spurious revision); edits keep the other keys.
assert.equal(same(buildEvidence(current, 'a')), same(current));
assert.deepEqual(buildEvidence(current, 'b'), { note: 'b', source: 'x' });
assert.deepEqual(buildEvidence(current, ''), { source: 'x' });

// Owner leaves the shown JSON alone → identical; edits it → replaced.
assert.equal(same(buildEvidence(current, 'a', JSON.stringify(evidenceExtra(current), null, 2))), same(current));
assert.deepEqual(buildEvidence(current, 'a', '{"source":"y"}'), { source: 'y', note: 'a' });
assert.equal(buildEvidence(current, 'a', '{'), null);
assert.equal(buildEvidence(current, 'a', '[1]'), null);

// Legacy evidence whose `note` isn't a string stays owner-only and round-trips.
const legacy = { source: 'ghi chú', note: 5 };
assert.equal(evidenceNote(legacy), '');
assert.equal(same(buildEvidence(legacy, '')), same(legacy));
assert.equal(same(buildEvidence(legacy, '', JSON.stringify(evidenceExtra(legacy)))), same(legacy));
assert.deepEqual(buildEvidence(null, 'x'), { note: 'x' });

assert.deepEqual(parseJsonObject(''), {});
assert.equal(parseJsonObject('"x"'), null);

console.log('evidence ok');
