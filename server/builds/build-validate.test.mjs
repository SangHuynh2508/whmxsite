import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeBuild, validateBuild, withDeepens, withSteps } from './build-validate.mjs';

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
  deepens: [{ label: '', styleId: '102', points: [7, 4, 0, 0] }],
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

test("深造: the style must be one of the character's 3; 4 points, each 0–7, total ≤ 11", () => {
  const d = (styleId, points) => ({ deepens: [{ label: '', styleId, points }] });
  assert.deepEqual(codes(d('301', [0, 0, 0, 0])), ['deepens.0.styleId FOREIGN_STYLE']);
  assert.deepEqual(codes(d('102', [8, 0, 0, 0])), ['deepens.0.points BAD_POINTS']);
  assert.deepEqual(codes(d('102', [1.5, 0, 0, 0])), ['deepens.0.points BAD_POINTS']);
  assert.deepEqual(codes(d('102', [7, 5])), ['deepens.0.points BAD_POINTS']);
  assert.deepEqual(codes(d('102', [7, 5, 0, 0])), ['deepens.0.points TOO_MANY_POINTS']);
  assert.deepEqual(codes(d('102', [7, 4, 0, 0])), []);
  assert.deepEqual(codes({ deepens: [] }), []); // no 深造 yet
});

test('深造: up to 3 suggestions per build (owner 2026-09-27), each with its own label', () => {
  const s = (label, styleId, points) => ({ label, styleId, points });
  const three = [s('Chuẩn', '101', [7, 2, 0, 2]), s('Lục Trí', '102', [7, 2, 2, 0]), s('', '103', [0, 0, 0, 0])];
  const { errors, doc } = validateBuild(build({ deepens: three }), ctx);
  assert.deepEqual(errors, []);
  assert.deepEqual(doc.deepens.map((x) => x.label), ['Chuẩn', 'Lục Trí', '']);
  assert.deepEqual(codes({ deepens: [...three, s('', '101', [0, 0, 0, 0])] }), ['deepens TOO_MANY']);
  assert.deepEqual(codes({ deepens: [s('x'.repeat(61), '101', [0, 0, 0, 0])] }), ['deepens.0.label TOO_LONG']);
});

test('a document saved before 2026-09-27 (one `deepen`) reads and saves as `deepens`', () => {
  const legacy = { name: 'Cũ', deepen: { styleId: '102', points: [7, 4, 0, 0] } };
  assert.deepEqual(withDeepens(legacy), { name: 'Cũ', deepens: [{ label: '', styleId: '102', points: [7, 4, 0, 0] }] });
  assert.deepEqual(withDeepens({ name: 'Cũ', deepen: null }), { name: 'Cũ', deepens: [] });
  const { errors, doc } = validateBuild(legacy, ctx);
  assert.deepEqual(errors, []);
  assert.deepEqual(doc.deepens, [{ label: '', styleId: '102', points: [7, 4, 0, 0] }]);
  assert.equal('deepen' in doc, false);
});

test('rotation skills must be the character\'s; team members must exist', () => {
  assert.deepEqual(codes({ rotations: [{ label: '', skillIds: ['A000101'] }] }), ['rotations.0.steps.0.skillId UNKNOWN_SKILL']);
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
  assert.deepEqual(doc, { name: 'Mới', rating: '', summary: '', weapons: [], affixes: { noReroll: false, groups: [] }, deepens: [], rotations: [], tips: [], teams: [], teamOther: '' });
});

test('rotations: steps with notes; old `skillIds` rotations become steps (spec 2026-09-28 §3.1)', () => {
  assert.deepEqual(withSteps({ rotations: [{ label: 'x', skillIds: ['D001701', 'D001701'] }] }).rotations,
    [{ label: 'x', note: '', steps: [{ skillId: 'D001701', note: '' }, { skillId: 'D001701', note: '' }] }]);
  const doc = { rotations: [{ label: 'x', note: '', steps: [] }] };
  assert.equal(withSteps(doc), doc); // already new: untouched
  assert.deepEqual(normalizeBuild({ deepen: null, rotations: [{ label: '', skillIds: [] }] }),
    { deepens: [], rotations: [{ label: '', note: '', steps: [] }] });

  const { errors, doc: out } = validateBuild(build({ rotations: [{ label: ' Lượt đầu ', note: ' Tam Trí ', steps: [
    { skillId: 'D001702', note: ' dùng lên Thố Động ' }, { skillId: 'D001702', note: '' }] }] }), ctx);
  assert.deepEqual(errors, []);
  assert.deepEqual(out.rotations, [{ label: 'Lượt đầu', note: 'Tam Trí', steps: [{ skillId: 'D001702', note: 'dùng lên Thố Động' }, { skillId: 'D001702', note: '' }] }]);
  // a document saved before 2026-09-28 still validates and comes out in the new shape
  assert.deepEqual(validateBuild(build(), ctx).doc.rotations, [{ label: '0 dupe', note: '', steps: [{ skillId: 'D001701', note: '' }, { skillId: 'D001702', note: '' }] }]);
});

test('rotations: note ≤ 500, step note ≤ 60, a step must be an object with a skill of the character', () => {
  const r = (patch) => ({ rotations: [{ label: '', note: '', steps: [{ skillId: 'D001701', note: '' }], ...patch }] });
  assert.deepEqual(codes(r({ note: 'a'.repeat(501) })), ['rotations.0.note TOO_LONG']);
  assert.deepEqual(codes(r({ steps: [{ skillId: 'D001701', note: 'a'.repeat(61) }] })), ['rotations.0.steps.0.note TOO_LONG']);
  assert.deepEqual(codes(r({ steps: ['D001701'] })), ['rotations.0.steps.0 BAD_SHAPE']);
  assert.deepEqual(codes(r({ steps: 'D001701' })), ['rotations.0.steps BAD_SHAPE']);
});
