// server/game/weapon-skills.mjs
// Kept apart from game-text-admin.mjs (which loads the DB/auth modules) so its test runs without server env.
// Pure: each weapon text gets its skill codes (weapon reference data.skillIds), so the admin Từ điển shows a
// weapon's name and its skills in one place.
export function withWeaponSkills(texts, refs) {
  const skillsOf = new Map(refs.filter((r) => r.kind === 'weapon').map((r) => [r.code, r.data?.skillIds ?? []]));
  return texts.map((t) => (t.kind === 'weapon' ? { ...t, skillCodes: skillsOf.get(t.code) ?? [] } : t));
}
