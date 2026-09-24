// scripts/check-profile-overlay.mjs
// Gate 2: only characters.*.profile may differ, no raw codes, list department changes.
import { readFileSync } from 'node:fs';

const [beforePath, afterPath] = process.argv.slice(2);
const before = JSON.parse(readFileSync(beforePath, 'utf8'));
const after = JSON.parse(readFileSync(afterPath, 'utf8'));
const strip = (data) => ({ ...data, characters: Object.fromEntries(Object.entries(data.characters).map(([id, c]) => [id, { ...c, profile: null }])) });
const problems = [];
if (JSON.stringify(strip(before)) !== JSON.stringify(strip(after))) problems.push('data outside characters.*.profile changed');
const codeLeaks = Object.entries(after.characters).filter(([, c]) => /"[KTSP]\d{4}"/.test(JSON.stringify(c.profile ?? {}))).map(([id]) => id);
if (codeLeaks.length) problems.push(`raw codes in profile: ${codeLeaks.join(', ')}`);
const departments = Object.keys(after.characters)
  .filter((id) => before.characters[id]?.profile?.department !== after.characters[id].profile?.department)
  .map((id) => `${id}: ${before.characters[id]?.profile?.department} -> ${after.characters[id].profile?.department}`);
console.log(JSON.stringify({ ok: problems.length === 0, problems, departmentChanges: departments }, null, 2));
process.exitCode = problems.length ? 1 : 0;
