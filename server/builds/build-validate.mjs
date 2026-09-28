// server/builds/build-validate.mjs
// Pure: checks one build document (spec docs/superpowers/specs/2026-09-26-character-build-design.md §4–§5) against the
// character and the game references. Returns the cleaned document (text trimmed, missing lists → empty) and every problem
// as { path, code }; an empty list means it may be saved.
//
// ctx = { character: { id, job, styleIds, skillIds }, weapons: Map(id → { job }), affixes: Map(id → { jobs }),
//         characterIds: Set }
export const MAX_WEAPONS = 4;
export const MAX_COLUMN_POINTS = 7;
export const MAX_TOTAL_POINTS = 11;
export const MAX_DEEPENS = 3;
const LIMITS = { name: 60, rating: 20, summary: 2000, label: 60, tip: 500, note: 500, teamOther: 500 };
const FIELDS = ['name', 'rating', 'summary', 'weapons', 'affixes', 'deepens', 'rotations', 'tips', 'teams', 'teamOther'];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// Up to 3 深造 suggestions per build (owner 2026-09-27). Documents saved before that hold one `deepen`: read, saved and
// published as `deepens` (used by the validator, the admin read and the game document).
export function withDeepens(doc) {
  if (!isObject(doc) || !('deepen' in doc)) return doc;
  const { deepen, ...rest } = doc;
  return { ...rest, deepens: rest.deepens ?? (isObject(deepen) ? [{ label: '', ...deepen }] : []) };
}

// Rotations saved before 2026-09-28 hold `skillIds`: read, saved and published as `steps` with notes (spec 2026-09-28
// §3.1). A non-array `skillIds` is passed through as `steps` so the validator reports it.
const oldRotation = (r) => isObject(r) && 'skillIds' in r && !('steps' in r);
export function withSteps(doc) {
  if (!isObject(doc) || !Array.isArray(doc.rotations) || !doc.rotations.some(oldRotation)) return doc;
  return {
    ...doc,
    rotations: doc.rotations.map((r) => (oldRotation(r)
      ? { label: r.label ?? '', note: r.note ?? '', steps: Array.isArray(r.skillIds) ? r.skillIds.map((skillId) => ({ skillId, note: '' })) : r.skillIds }
      : r)),
  };
}

// Every stored or published build goes through this: the validator, the admin read and the game document.
export const normalizeBuild = (doc) => withSteps(withDeepens(doc));

export function validateBuild(input, ctx) {
  const errors = [];
  const fail = (path, code) => { errors.push({ path, code }); };
  if (!isObject(input)) return { doc: null, errors: [{ path: '', code: 'BAD_SHAPE' }] };
  input = normalizeBuild(input);

  const str = (value, path, limit) => {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string') { fail(path, 'NOT_TEXT'); return ''; }
    const out = value.trim();
    if (out.length > limit) fail(path, 'TOO_LONG');
    return out;
  };
  const list = (value, path) => {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) { fail(path, 'BAD_SHAPE'); return []; }
    return value;
  };
  const ids = (value, path, check) => list(value, path).map((id, i) => {
    const code = check(String(id));
    if (code) fail(`${path}.${i}`, code);
    return String(id);
  });

  for (const key of Object.keys(input)) if (!FIELDS.includes(key)) fail(key, 'UNKNOWN_FIELD');
  const { character } = ctx;

  const weapons = list(input.weapons, 'weapons');
  if (weapons.length > MAX_WEAPONS) fail('weapons', 'TOO_MANY');
  const docWeapons = weapons.map((w, i) => {
    if (!isObject(w)) { fail(`weapons.${i}`, 'BAD_SHAPE'); return null; }
    const weaponId = String(w.weaponId ?? '');
    const weapon = ctx.weapons.get(weaponId);
    if (!weapon) fail(`weapons.${i}.weaponId`, 'UNKNOWN_WEAPON');
    else if (weapon.job !== character.job) fail(`weapons.${i}.weaponId`, 'WRONG_JOB');
    return { weaponId, label: str(w.label, `weapons.${i}.label`, LIMITS.label) };
  });

  let affixes = { noReroll: false, groups: [] };
  if (input.affixes !== undefined && input.affixes !== null) {
    if (!isObject(input.affixes)) fail('affixes', 'BAD_SHAPE');
    else {
      const { noReroll = false } = input.affixes;
      if (typeof noReroll !== 'boolean') fail('affixes.noReroll', 'BAD_SHAPE');
      affixes = {
        noReroll: noReroll === true,
        groups: list(input.affixes.groups, 'affixes.groups').map((g, i) => ({
          label: str(g?.label, `affixes.groups.${i}.label`, LIMITS.label),
          affixIds: ids(g?.affixIds, `affixes.groups.${i}.affixIds`, (id) => {
            const affix = ctx.affixes.get(id);
            if (!affix) return 'UNKNOWN_AFFIX';
            return affix.jobs.includes(character.job) ? null : 'WRONG_JOB';
          }),
        })),
      };
    }
  }

  const deepenList = list(input.deepens, 'deepens');
  if (deepenList.length > MAX_DEEPENS) fail('deepens', 'TOO_MANY');
  const deepens = deepenList.map((d, i) => {
    if (!isObject(d)) { fail(`deepens.${i}`, 'BAD_SHAPE'); return null; }
    const styleId = String(d.styleId ?? '');
    if (!character.styleIds.includes(styleId)) fail(`deepens.${i}.styleId`, 'FOREIGN_STYLE');
    const { points } = d;
    const valid = Array.isArray(points) && points.length === 4 && points.every((p) => Number.isInteger(p) && p >= 0 && p <= MAX_COLUMN_POINTS);
    if (!valid) fail(`deepens.${i}.points`, 'BAD_POINTS');
    else if (points.reduce((a, b) => a + b, 0) > MAX_TOTAL_POINTS) fail(`deepens.${i}.points`, 'TOO_MANY_POINTS');
    return { label: str(d.label, `deepens.${i}.label`, LIMITS.label), styleId, points: valid ? [...points] : [0, 0, 0, 0] };
  });

  const skills = new Set(character.skillIds);
  const doc = {
    name: str(input.name, 'name', LIMITS.name),
    rating: str(input.rating, 'rating', LIMITS.rating),
    summary: str(input.summary, 'summary', LIMITS.summary),
    weapons: docWeapons.filter(Boolean),
    affixes,
    deepens: deepens.filter(Boolean),
    rotations: list(input.rotations, 'rotations').map((r, i) => ({
      label: str(r?.label, `rotations.${i}.label`, LIMITS.label),
      note: str(r?.note, `rotations.${i}.note`, LIMITS.note),
      steps: list(r?.steps, `rotations.${i}.steps`).map((s, j) => {
        const at = `rotations.${i}.steps.${j}`;
        if (!isObject(s)) { fail(at, 'BAD_SHAPE'); return null; }
        const skillId = String(s.skillId ?? '');
        if (!skills.has(skillId)) fail(`${at}.skillId`, 'UNKNOWN_SKILL');
        return { skillId, note: str(s.note, `${at}.note`, LIMITS.label) };
      }).filter(Boolean),
    })),
    tips: list(input.tips, 'tips').map((t, i) => str(t, `tips.${i}`, LIMITS.tip)),
    teams: list(input.teams, 'teams').map((t, i) => ({
      label: str(t?.label, `teams.${i}.label`, LIMITS.label),
      characterIds: ids(t?.characterIds, `teams.${i}.characterIds`, (id) => (ctx.characterIds.has(id) ? null : 'UNKNOWN_CHARACTER')),
      note: str(t?.note, `teams.${i}.note`, LIMITS.note),
    })),
    teamOther: str(input.teamOther, 'teamOther', LIMITS.teamOther),
  };
  return { doc, errors };
}
