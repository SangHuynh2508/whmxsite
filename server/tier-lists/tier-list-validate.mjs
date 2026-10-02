// server/tier-lists/tier-list-validate.mjs
// Pure: checks one tier list document (spec docs/superpowers/specs/2026-10-02-tier-list-design.md §3–§4). Returns the
// cleaned document (text trimmed, unknown fields dropped) and every problem as { path, code }; [] = may be saved.
// ctx = tierListContext(public/data.json characters): which characters exist and which have Hoán Chương.
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const STATUSES = ['draft', 'published', 'archived'];
export const TIER_LIMITS = {
  title: 80, author: 80, sourceUrl: 300, info: 5000, note: 1000, label: 6, description: 200,
  teamName: 60, teamNote: 300, tiers: 15, entries: 200, groups: 30, members: 6,
};
const DEFAULT_TIERS = ['S+', 'S', 'A', 'B', 'C', 'D', 'X'];

export function defaultTierListDoc(title) {
  return {
    title, author: '', sourceUrl: '', info: '',
    solo: { note: '', tiers: DEFAULT_TIERS.map((label) => ({ label, description: label === 'X' ? 'Chưa thử' : '', joinAbove: false, entries: [] })) },
    teams: { note: '', groups: [] },
  };
}

export const tierListContext = (siteCharacters) => ({
  characters: new Map(Object.entries(siteCharacters).map(([id, c]) => [id, { hasHuanzhang: Boolean(c?.has_huanzhang) }])),
});

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function validateTierList(input, ctx) {
  const errors = [];
  const fail = (path, code) => { errors.push({ path, code }); };
  if (!isObject(input)) return { doc: null, errors: [{ path: '', code: 'BAD_SHAPE' }] };

  const str = (value, path, limit, required = false) => {
    if (value !== undefined && value !== null && typeof value !== 'string') { fail(path, 'NOT_TEXT'); return ''; }
    const out = (value ?? '').trim();
    if (required && !out) fail(path, 'REQUIRED');
    else if (out.length > limit) fail(path, 'TOO_LONG');
    return out;
  };
  const list = (value, path, max, min = 0) => {
    if (value === undefined || value === null) value = [];
    if (!Array.isArray(value)) { fail(path, 'BAD_SHAPE'); return []; }
    if (value.length < min) fail(path, 'TOO_FEW');
    if (value.length > max) fail(path, 'TOO_MANY');
    return value;
  };
  const entry = (e, path) => {
    if (!isObject(e)) { fail(path, 'BAD_SHAPE'); return null; }
    const characterId = String(e.characterId ?? '');
    const character = ctx.characters.get(characterId);
    if (!character) fail(`${path}.characterId`, 'UNKNOWN_CHARACTER');
    const out = { characterId };
    if (e.zhizhi !== undefined && e.zhizhi !== null) {
      if (Number.isInteger(e.zhizhi) && e.zhizhi >= 1 && e.zhizhi <= 6) out.zhizhi = e.zhizhi;
      else fail(`${path}.zhizhi`, 'BAD_ZHIZHI');
    }
    if (e.hc !== undefined && e.hc !== null && e.hc !== false) {
      if (e.hc !== true) fail(`${path}.hc`, 'BAD_SHAPE');
      else if (character && !character.hasHuanzhang) fail(`${path}.hc`, 'NO_HUANZHANG');
      else out.hc = true;
    }
    return out;
  };
  const key = (e) => `${e.characterId}|${e.zhizhi ?? ''}|${e.hc ? 'hc' : ''}`;

  const title = str(input.title, 'title', TIER_LIMITS.title, true);
  const author = str(input.author, 'author', TIER_LIMITS.author);
  const sourceUrl = str(input.sourceUrl, 'sourceUrl', TIER_LIMITS.sourceUrl);
  if (sourceUrl && !/^https?:\/\/\S+$/i.test(sourceUrl)) fail('sourceUrl', 'BAD_URL');
  const info = str(input.info, 'info', TIER_LIMITS.info);

  const solo = isObject(input.solo) ? input.solo : {};
  const seen = new Set();
  const tiers = list(solo.tiers, 'solo.tiers', TIER_LIMITS.tiers, 1).map((t, i) => {
    const at = `solo.tiers.${i}`;
    if (!isObject(t)) { fail(at, 'BAD_SHAPE'); return null; }
    const joinAbove = i > 0 && t.joinAbove === true;
    const label = str(t.label, `${at}.label`, TIER_LIMITS.label, true);
    const description = joinAbove ? '' : str(t.description, `${at}.description`, TIER_LIMITS.description);
    const entries = list(t.entries, `${at}.entries`, TIER_LIMITS.entries).map((e, j) => {
      const out = entry(e, `${at}.entries.${j}`);
      if (out && seen.has(key(out))) fail(`${at}.entries.${j}`, 'DUPLICATE_ENTRY');
      if (out) seen.add(key(out));
      return out;
    }).filter(Boolean);
    return { label, description, joinAbove, entries };
  }).filter(Boolean);

  const teams = isObject(input.teams) ? input.teams : {};
  const groups = list(teams.groups, 'teams.groups', TIER_LIMITS.groups).map((g, i) => {
    const at = `teams.groups.${i}`;
    if (!isObject(g)) { fail(at, 'BAD_SHAPE'); return null; }
    const ids = new Set();
    const name = str(g.name, `${at}.name`, TIER_LIMITS.teamName, true);
    const note = str(g.note, `${at}.note`, TIER_LIMITS.teamNote);
    const members = list(g.members, `${at}.members`, TIER_LIMITS.members, 1).map((m, j) => {
      const out = entry(m, `${at}.members.${j}`);
      if (out && ids.has(out.characterId)) fail(`${at}.members.${j}`, 'DUPLICATE_MEMBER');
      if (out) ids.add(out.characterId);
      return out;
    }).filter(Boolean);
    return { name, note, members };
  }).filter(Boolean);

  const doc = {
    title, author, sourceUrl, info,
    solo: { note: str(solo.note, 'solo.note', TIER_LIMITS.note), tiers },
    teams: { note: str(teams.note, 'teams.note', TIER_LIMITS.note), groups },
  };
  return { doc, errors };
}
