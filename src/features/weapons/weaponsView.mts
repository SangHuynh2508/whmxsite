// Pure: the public game document (refs.weapon + texts) + data.json characters → what the Vũ Khí page shows.
// Same naming rule as the Build tab: VI when published, else CN flagged untranslated.
import type { GameDocument, GameText } from '../profile/api/loreOverlay.mts';
import { pickText, txt, type Unit } from '../../i18n/lang.mts';

type SiteChar = { id: string; slug?: string; name_vi?: string; name_cn?: string; icon?: string };
export type WeaponUser = { id: string; href: string; name: string; icon: string };
export type Weapon = {
  id: string; rare: number; job: number; icon: string; frame: string; name: Unit; cn: string;
  skills: { name: Unit; text: Unit }[]; users: WeaponUser[]; extra?: WeaponExtra; art: string;
  file: Partial<Record<FileKey, Unit>>;
};
/** public/weapons.json (tools/build_weapons.py): what only the game has. Text is CN. */
export type WeaponExtra = {
  tags: string[]; series: number | null;
  grades: { hp: number; atk: number }[]; grow: { hp: number; atk: number } | null;
  file: Partial<Record<'type' | 'class' | 'trait' | 'maker' | 'text' | 'weight' | 'batch', string>>;
};
export type WeaponsDoc = { version: 1; weapons: Record<string, WeaponExtra> };
type FileKey = keyof WeaponExtra['file'];
/** public/weapons.vi.json: VI of the file fields (Claude draft 2026-11-23, owner reviews). Weight and batch need none. */
export type WeaponsViDoc = { version: 1; weapons: Record<string, Partial<Record<FileKey, string>>> };
const PLAIN: FileKey[] = ['weight', 'batch'];
function fileUnits(cn: WeaponExtra['file'] | undefined, vi: Partial<Record<FileKey, string>> | undefined) {
  const out: Partial<Record<FileKey, Unit>> = {};
  for (const [k, v] of Object.entries(cn ?? {}) as [FileKey, string][]) {
    out[k] = PLAIN.includes(k) ? { text: v, untranslated: false } : pickText(vi?.[k], v);
  }
  return out;
}
export const MAX_LEVEL = 60;
/** Stats per breakthrough grade at level 1, then max level = top grade + 59 × growth (owner's check: 30321 → 3147). */
export function statRows(x: WeaponExtra | undefined) {
  if (!x?.grades.length) return [];
  const top = x.grades[x.grades.length - 1];
  const rows = x.grades.map((g, i) => ({ grade: i, level: 1, ...g }));
  if (x.grow) rows.push({ grade: x.grades.length - 1, level: MAX_LEVEL, hp: top.hp + (MAX_LEVEL - 1) * x.grow.hp, atk: top.atk + (MAX_LEVEL - 1) * x.grow.atk });
  return rows;
}
export type WeaponFilter = { q: string; jobs: Set<number>; rares: Set<number> };

const unit = (t: GameText | undefined, field: 'name' | 'detail' = 'name'): Unit =>
  field === 'name' ? pickText(t?.vi, t?.cn) : pickText(t?.detail_vi, t?.detail);
export const frameOf = (rare: number) => `/assets/frames/itemRare${[2, 3, 4, 5].includes(rare) ? rare : 'K'}.png`;

/** Every weapon of the document, rarest first, then by job and id; users = characters whose builds suggest it. */
export function weaponList(game: GameDocument, characters: Record<string, SiteChar>, extras: WeaponsDoc | null = null, vi: WeaponsViDoc | null = null): Weapon[] {
  const users = new Map<string, WeaponUser[]>();
  for (const [charId, docs] of Object.entries(game.builds ?? {})) {
    const c = characters[charId];
    if (!c) continue;
    const ids = new Set(docs.flatMap((d) => (d.weapons ?? []).map((w: { weaponId: string }) => w.weaponId)));
    for (const id of ids) {
      const list = users.get(id) ?? [];
      list.push({ id: c.id, href: `/characters/${c.slug || c.id}`, name: txt(c, 'name'), icon: c.icon ? `/${c.icon.replace(/^\//, '')}` : '' });
      users.set(id, list);
    }
  }
  return Object.entries(game.refs.weapon ?? {})
    .map(([id, r]) => {
      const t = game.texts.weapon?.[id];
      return {
        id, rare: Number(r.rare) || 0, job: Number(r.job) || 0,
        // the game document's icon is null for weapons whose icon arrived after its import; the site has them all
        icon: r.icon || extras?.weapons[id] ? `/assets/items/${r.icon || `itemicon_${id}`}.png` : '', frame: frameOf(Number(r.rare)),
        name: unit(t), cn: t?.cn ?? '',
        skills: ((r.skillIds ?? []) as string[]).map((sid) => ({ name: unit(game.texts.weapon_skill?.[sid]), text: unit(game.texts.weapon_skill?.[sid], 'detail') })),
        users: users.get(id) ?? [],
        file: fileUnits(extras?.weapons[id]?.file, vi?.weapons[id]),
        extra: extras?.weapons[id], art: extras?.weapons[id] ? `/assets/weapons/${id}.webp` : '',
      };
    })
    .filter((w) => w.name.text)
    .sort((a, b) => b.rare - a.rare || a.job - b.job || a.id.localeCompare(b.id));
}

/** Search matches the shown name or the CN name; empty job / rarity sets mean "all". */
export function filterWeapons(list: Weapon[], f: WeaponFilter): Weapon[] {
  const q = f.q.trim().toLowerCase();
  return list.filter((w) => (!f.jobs.size || f.jobs.has(w.job)) && (!f.rares.size || f.rares.has(w.rare))
    && (!q || w.name.text.toLowerCase().includes(q) || w.cn.includes(q)));
}
