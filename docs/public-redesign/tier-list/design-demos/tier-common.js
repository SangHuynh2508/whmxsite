// Shared demo logic for the three directions: lookups, badges, tier groups (joinAbove), filters, tabs, info text.
const P = '../../../../public/';
const JOBS = { 1: 'Túc Vệ', 2: 'Khinh Nhuệ', 3: 'Viễn Kích', 4: 'Cấu Thuật', 5: 'Chiến Lược' };
const RARE = { 4: 'SSR', 3: 'SR', 2: 'R' };
const C = (id) => TL_CHARS[id];
const jobIcon = (n) => `${P}assets/jobs/job_${n}.png`;
const glow = (r) => `${P}assets/frames/ui_ty_kp_pz_${r}.png`;
const href = (e) => `#/characters/${C(e.characterId).slug}/build`;
const badges = (e) => [e.zhizhi && `Z${e.zhizhi}`, e.hc && 'HC'].filter(Boolean);
const badgeText = (e) => (badges(e).length ? ` (${badges(e).join(' · ')})` : '');
const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const tileLabel = (e) => { const c = C(e.characterId); return `${c.vi}${badgeText(e)} · ${JOBS[c.job]} · ${RARE[c.rare]}`; };

// tiers → groups: a tier with joinAbove sits under the description of the tier above
function groups(tiers) {
  const out = [];
  for (const t of tiers) (t.joinAbove && out.length ? out[out.length - 1].tiers : (out.push({ description: t.description, tiers: [] }), out[out.length - 1].tiers)).push(t);
  return out;
}

const filter = { jobs: new Set(), rares: new Set() };
const match = (e) => { const c = C(e.characterId); return (!filter.jobs.size || filter.jobs.has(c.job)) && (!filter.rares.size || filter.rares.has(c.rare)); };
const presentRares = () => [...new Set(TL.solo.tiers.flatMap((t) => t.entries.map((e) => C(e.characterId).rare)))].sort((a, b) => b - a);
const listeners = [];
const onFilter = (fn) => listeners.push(fn);
function toggle(kind, v) {
  const s = filter[kind];
  s.has(v) ? s.delete(v) : s.add(v);
  listeners.forEach((fn) => fn());
}
function clearFilter() { filter.jobs.clear(); filter.rares.clear(); listeners.forEach((fn) => fn()); }

// plain text: blank line = paragraph, "- " lines = bullets
function paragraphs(text) {
  return text.split(/\n{2,}/).map((block) => {
    const lines = block.split('\n');
    return lines.every((l) => l.startsWith('- ')) ? `<ul>${lines.map((l) => `<li>${esc(l.slice(2))}</li>`).join('')}</ul>` : `<p>${lines.map(esc).join('<br>')}</p>`;
  }).join('');
}

// tabs: [data-tab] buttons show the matching [data-panel]; aria-selected drives the style
function wireTabs(root = document) {
  const tabs = [...root.querySelectorAll('[data-tab]')];
  const show = (name) => {
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    root.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== name; });
    document.body.dataset.view = name;
  };
  tabs.forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
  show('solo');
}

const updated = () => TL.updatedAt.split('-').reverse().join('/');
