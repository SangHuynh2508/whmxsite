import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addWeapon, buildErrors, emptyBuild, move, sameDoc, setPoint, totalPoints } from './buildDoc.mts';

test('a new build starts from the game\'s recommended style (0 points), or without 深造 when there is none', () => {
  assert.deepEqual(emptyBuild('102'), {
    name: '', rating: '', summary: '', weapons: [], affixes: { noReroll: false, groups: [] },
    deepen: { styleId: '102', points: [0, 0, 0, 0] }, rotations: [], tips: [], teams: [], teamOther: '',
  });
  assert.equal(emptyBuild(null).deepen, null);
});

test('points: each column 0–7, and a value that would pass 11 in total is cut to what is left', () => {
  const doc = emptyBuild('102');
  const a = setPoint(doc, 0, 9);
  assert.deepEqual(a.deepen?.points, [7, 0, 0, 0]);
  const b = setPoint(a, 1, 6);
  assert.deepEqual(b.deepen?.points, [7, 4, 0, 0]);
  assert.equal(totalPoints(b), 11);
  assert.deepEqual(setPoint(b, 1, -3).deepen?.points, [7, 0, 0, 0]);
  assert.deepEqual(setPoint(doc, 2, 2.6).deepen?.points, [0, 0, 3, 0]);
  assert.equal(doc.deepen?.points[0], 0); // never mutates
});

test('weapons: at most 4', () => {
  let doc = emptyBuild(null);
  for (let i = 0; i < 6; i += 1) doc = addWeapon(doc, `W${i}`);
  assert.deepEqual(doc.weapons.map((w) => w.weaponId), ['W0', 'W1', 'W2', 'W3']);
});

test('move: an item one step up or down, never out of the list', () => {
  assert.deepEqual(move(['a', 'b', 'c'], 2, -1), ['a', 'c', 'b']);
  assert.deepEqual(move(['a', 'b', 'c'], 0, -1), ['a', 'b', 'c']);
});

test('sameDoc: deep equality (dirty check)', () => {
  assert.ok(sameDoc(emptyBuild('1'), emptyBuild('1')));
  assert.ok(!sameDoc(emptyBuild('1'), setPoint(emptyBuild('1'), 0, 1)));
});

test('server 422 details → one Vietnamese line per problem', () => {
  assert.deepEqual(buildErrors([{ path: 'weapons.0.weaponId', code: 'WRONG_JOB' }, { path: 'deepen.points', code: 'TOO_MANY_POINTS' }, { path: 'x', code: 'NEW_CODE' }]), [
    'Vũ khí 1: không cùng chức nghiệp với nhân vật',
    'Thâm tạo: tổng điểm vượt 11',
    'x: NEW_CODE',
  ]);
});
