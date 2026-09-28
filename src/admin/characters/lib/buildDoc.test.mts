import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDeepen, addWeapon, buildErrors, emptyBuild, move, sameDoc, setPoint, totalPoints, type BuildDoc } from './buildDoc.mts';

test('a new build starts from the game\'s recommended style (0 points), or without 深造 when there is none', () => {
  assert.deepEqual(emptyBuild('102'), {
    name: '', rating: '', summary: '', weapons: [], affixes: { noReroll: false, groups: [] },
    deepens: [{ label: '', styleId: '102', points: [0, 0, 0, 0] }], rotations: [], tips: [], teams: [], teamOther: '',
  });
  assert.deepEqual(emptyBuild(null).deepens, []);
});

test('points: each column 0–7, and a value that would pass 11 in total is cut to what is left', () => {
  const doc = emptyBuild('102');
  const a = setPoint(doc, 0, 0, 9);
  assert.deepEqual(a.deepens[0].points, [7, 0, 0, 0]);
  const b = setPoint(a, 0, 1, 6);
  assert.deepEqual(b.deepens[0].points, [7, 4, 0, 0]);
  assert.equal(totalPoints(b.deepens[0]), 11);
  assert.deepEqual(setPoint(b, 0, 1, -3).deepens[0].points, [7, 0, 0, 0]);
  assert.deepEqual(setPoint(doc, 0, 2, 2.6).deepens[0].points, [0, 0, 3, 0]);
  assert.equal(doc.deepens[0].points[0], 0); // never mutates
});

test('深造: up to 3 suggestions, each counted on its own', () => {
  let doc = emptyBuild('101');
  for (let i = 0; i < 4; i += 1) doc = addDeepen(doc, '102');
  assert.deepEqual(doc.deepens.map((d) => d.styleId), ['101', '102', '102']);
  const c = setPoint(setPoint(doc, 0, 0, 7), 1, 0, 7);
  assert.deepEqual(c.deepens.map((d) => totalPoints(d)), [7, 7, 0]);
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
  assert.ok(!sameDoc(emptyBuild('1'), setPoint(emptyBuild('1'), 0, 0, 1)));
});

test('server 422 details → one Vietnamese line per problem', () => {
  assert.deepEqual(buildErrors([{ path: 'weapons.0.weaponId', code: 'WRONG_JOB' }, { path: 'deepens.1.points', code: 'TOO_MANY_POINTS' }, { path: 'x', code: 'NEW_CODE' }]), [
    'Vũ khí 1: không cùng chức nghiệp với nhân vật',
    'Thâm tạo 2: tổng điểm vượt 11',
    'x: NEW_CODE',
  ]);
});

test('server errors inside a rotation step name the rotation', () => {
  assert.deepEqual(buildErrors([{ path: 'rotations.1.steps.0.note', code: 'TOO_LONG' }, { path: 'rotations.0.steps.2.skillId', code: 'UNKNOWN_SKILL' }]),
    ['Xoay vòng 2: quá dài', 'Xoay vòng 1: kỹ năng không thuộc nhân vật']);
});

test('a rotation is { label, note, steps }', () => {
  const doc: BuildDoc = { ...emptyBuild(null), rotations: [{ label: 'Lượt đầu', note: '', steps: [{ skillId: 'V005502', note: '' }] }] };
  assert.equal(doc.rotations[0].steps[0].skillId, 'V005502');
});
