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
const LIMITS = { name: 60, rating: 20, summary: 2000, label: 60, tip: 500, note: 500, teamOther: 500 };
const FIELDS = ['name', 'rating', 'summary', 'weapons', 'affixes', 'deepen', 'rotations', 'tips', 'teams', 'teamOther'];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateBuild(input, ctx) {
  const errors = [];
  const fail = (path, code) => { errors.push({ path, code }); };
  if (!isObject(input)) return { doc: null, errors: [{ path: '', code: 'BAD_SHAPE' }] };

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

  let deepen = null;
  if (input.deepen !== undefined && input.deepen !== null) {
    if (!isObject(input.deepen)) fail('deepen', 'BAD_SHAPE');
    else {
      const styleId = String(input.deepen.styleId ?? '');
      if (!character.styleIds.includes(styleId)) fail('deepen.styleId', 'FOREIGN_STYLE');
      const points = input.deepen.points;
      const valid = Array.isArray(points) && points.length === 4 && points.every((p) => Number.isInteger(p) && p >= 0 && p <= MAX_COLUMN_POINTS);
      if (!valid) fail('deepen.points', 'BAD_POINTS');
      else if (points.reduce((a, b) => a + b, 0) > MAX_TOTAL_POINTS) fail('deepen.points', 'TOO_MANY_POINTS');
      deepen = { styleId, points: valid ? [...points] : [0, 0, 0, 0] };
    }
  }

  const skills = new Set(character.skillIds);
  const doc = {
    name: str(input.name, 'name', LIMITS.name),
    rating: str(input.rating, 'rating', LIMITS.rating),
    summary: str(input.summary, 'summary', LIMITS.summary),
    weapons: docWeapons.filter(Boolean),
    affixes,
    deepen,
    rotations: list(input.rotations, 'rotations').map((r, i) => ({
      label: str(r?.label, `rotations.${i}.label`, LIMITS.label),
      skillIds: ids(r?.skillIds, `rotations.${i}.skillIds`, (id) => (skills.has(id) ? null : 'UNKNOWN_SKILL')),
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
