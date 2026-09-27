import assert from 'node:assert/strict';
import test from 'node:test';

import { validateBuild } from './build-validate.mjs';

// D0017 (Túc Vệ, job 1, styles 101/102/103) with two real weapons of its job and one of another job.
const ctx = {
  character: { id: 'D0017', job: 1, styleIds: ['101', '102', '103'], skillIds: ['D001701', 'D001702', 'D001703'] },
  weapons: new Map([['30111', { job: 1 }], ['30112', { job: 1 }], ['30211', { job: 2 }]]),
  affixes: new Map([['AA001001', { jobs: [1, 2, 3, 4, 5] }], ['AA009001', { jobs: [3] }]]),
  characterIds: new Set(['D0017', 'A0001', 'W0182']),
};
const build = (patch = {}) => ({
  name: 'Chuẩn', rating: 'S', summary: 'Chống chịu tốt',
  weapons: [{ weaponId: '30111', label: 'Chịu đòn' }],
  affixes: { noReroll: true, groups: [{ label: 'Ưu tiên', affixIds: ['AA001001'] }] },
  deepen: { styleId: '102', points: [7, 4, 0, 0] },
  rotations: [{ label: '0 dupe', skillIds: ['D001701', 'D001702'] }],
  tips: ['Mở đầu bằng khiên'],
  teams: [{ label: 'Đội chính', characterIds: ['A0001', 'W0182'], note: '' }],
  teamOther: '',
  ...patch,
});
const codes = (patch) => validateBuild(build(patch), ctx).errors.map((e) => `${e.path} ${e.code}`);

test('a full build like the reference card is valid; text is trimmed', () => {
  const { errors, doc } = validateBuild(build({ name: '  Chuẩn  ', tips: [' a '] }), ctx);
  assert.deepEqual(errors, []);
  assert.equal(doc.name, 'Chuẩn');
  assert.deepEqual(doc.tips, ['a']);
});

test('weapons: at most 4, must exist, must be of the character\'s job', () => {
  const four = Array.from({ length: 5 }, () => ({ weaponId: '30111', label: '' }));
  assert.deepEqual(codes({ weapons: four }), ['weapons TOO_MANY']);
  assert.deepEqual(codes({ weapons: [{ weaponId: '99999', label: '' }] }), ['weapons.0.weaponId UNKNOWN_WEAPON']);
  assert.deepEqual(codes({ weapons: [{ weaponId: '30211', label: '' }] }), ['weapons.0.weaponId WRONG_JOB']);
});

test('affixes: must exist and allow the character\'s job', () => {
  assert.deepEqual(codes({ affixes: { noReroll: false, groups: [{ label: '', affixIds: ['AA009001', 'AA404'] }] } }), [
    'affixes.groups.0.affixIds.0 WRONG_JOB',
    'affixes.groups.0.affixIds.1 UNKNOWN_AFFIX',
  ]);
});

test('深造: the style must be one of the character\'s 3; 4 points, each 0–7, total ≤ 11', () => {
  assert.deepEqual(codes({ deepen: { styleId: '301', points: [0, 0, 0, 0] } }), ['deepen.styleId FOREIGN_STYLE']);
  assert.deepEqual(codes({ deepen: { styleId: '102', points: [8, 0, 0, 0] } }), ['deepen.points BAD_POINTS']);
  assert.deepEqual(codes({ deepen: { styleId: '102', points: [1.5, 0, 0, 0] } }), ['deepen.points BAD_POINTS']);
  assert.deepEqual(codes({ deepen: { styleId: '102', points: [7, 5] } }), ['deepen.points BAD_POINTS']);
  assert.deepEqual(codes({ deepen: { styleId: '102', points: [7, 5, 0, 0] } }), ['deepen.points TOO_MANY_POINTS']);
  assert.deepEqual(codes({ deepen: { styleId: '102', points: [7, 4, 0, 0] } }), []);
  assert.deepEqual(codes({ deepen: null }), []); // no 深造 yet
});

test('rotation skills must be the character\'s; team members must exist', () => {
  assert.deepEqual(codes({ rotations: [{ label: '', skillIds: ['A000101'] }] }), ['rotations.0.skillIds.0 UNKNOWN_SKILL']);
  assert.deepEqual(codes({ teams: [{ label: '', characterIds: ['ZZ999'], note: '' }] }), ['teams.0.characterIds.0 UNKNOWN_CHARACTER']);
});

test('shape: unknown fields, wrong types and over-long text are rejected', () => {
  assert.deepEqual(codes({ extra: 1 }), ['extra UNKNOWN_FIELD']);
  assert.deepEqual(codes({ weapons: 'x' }), ['weapons BAD_SHAPE']);
  assert.deepEqual(codes({ name: 5 }), ['name NOT_TEXT']);
  assert.deepEqual(codes({ name: 'x'.repeat(61) }), ['name TOO_LONG']);
  assert.deepEqual(codes({ affixes: { noReroll: 'yes', groups: [] } }), ['affixes.noReroll BAD_SHAPE']);
  assert.deepEqual(validateBuild(null, ctx).errors, [{ path: '', code: 'BAD_SHAPE' }]);
});

test('missing lists default to empty (a new, blank build is valid)', () => {
  const { errors, doc } = validateBuild({ name: 'Mới' }, ctx);
  assert.deepEqual(errors, []);
  assert.deepEqual(doc, { name: 'Mới', rating: '', summary: '', weapons: [], affixes: { noReroll: false, groups: [] }, deepen: null, rotations: [], tips: [], teams: [], teamOther: '' });
});
