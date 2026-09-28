import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sheetLayout, teamSpan } from './sheetLayout.mts';

const items = (n: number) => Array.from({ length: n }, () => ({}));
// W0182's production build: 2 weapons, tiers 1/3/2, one 4-step rotation, 2 深造, 4 tips, 10 teams
const w0182 = {
  weapons: items(2), affixes: { noReroll: false, groups: [{ items: items(1) }, { items: items(3) }, { items: items(2) }] },
  rotations: [{ note: '', steps: items(4) }], deepens: items(2), tips: ['a', 'b', 'c', 'd'], teams: items(10), teamOther: '',
};
const spans = (v: typeof w0182) => sheetLayout(v).map((b) => `${b.id}:${b.span}`);

test('W0182: content-sized staggered pairs 4|8 and 6|6, then tips and teams full width', () => {
  assert.deepEqual(spans(w0182), ['weapons:4', 'affixes:8', 'rotations:6', 'deepens:6', 'tips:12', 'teams:12']);
});

test('pair 1 goes full width past 2 weapons, 3 tiers or 5 affixes in a tier', () => {
  assert.deepEqual(spans({ ...w0182, weapons: items(3) }).slice(0, 2), ['weapons:12', 'affixes:12']);
  assert.deepEqual(spans({ ...w0182, affixes: { noReroll: false, groups: [...w0182.affixes.groups, { items: items(1) }] } }).slice(0, 2), ['weapons:12', 'affixes:12']);
  assert.deepEqual(spans({ ...w0182, affixes: { noReroll: false, groups: [{ items: items(6) }] } }).slice(0, 2), ['weapons:12', 'affixes:12']);
});

test('pair 2 goes full width with a rotation note, > 2 rotations, > 5 steps or > 3 深造', () => {
  assert.deepEqual(spans({ ...w0182, rotations: [{ note: 'Tam Trí', steps: [] }] }).slice(2, 4), ['rotations:12', 'deepens:12']);
  assert.deepEqual(spans({ ...w0182, rotations: [0, 1, 2].map(() => ({ note: '', steps: items(1) })) }).slice(2, 4), ['rotations:12', 'deepens:12']);
  assert.deepEqual(spans({ ...w0182, rotations: [{ note: '', steps: items(6) }] }).slice(2, 4), ['rotations:12', 'deepens:12']);
  assert.deepEqual(spans({ ...w0182, deepens: items(4) }).slice(2, 4), ['rotations:12', 'deepens:12']);
});

test('empty blocks are left out and a lone half takes the full width', () => {
  const bare = { ...w0182, weapons: [], rotations: [], tips: ['', ' '], teams: [], teamOther: '' };
  assert.deepEqual(spans(bare), ['affixes:12', 'deepens:12']);
  assert.deepEqual(spans({ ...bare, affixes: { noReroll: true, groups: [] }, teamOther: 'Khác' }), ['affixes:12', 'deepens:12', 'teams:12']);
  // a rotation whose skills are all unknown still shows (label + note)
  assert.deepEqual(spans({ ...bare, rotations: [{ note: 'x', steps: [] }] }).includes('rotations:12'), true);
});

test('teamSpan: members, label (~9 chars/track) and note (~30 chars/track), between 2 and 6', () => {
  assert.equal(teamSpan({ label: 'Hệ thống – mạnh', note: '', members: items(3) }), 3);
  assert.equal(teamSpan({ label: 'Lai', note: '', members: items(1) }), 2);
  assert.equal(teamSpan({ label: 'Hỗ trợ mạnh khác', note: '', members: items(5) }), 5);
  assert.equal(teamSpan({ label: '', note: 'a'.repeat(95), members: items(1) }), 4);
  assert.equal(teamSpan({ label: '', note: '', members: items(9) }), 6);
});
