// Pure: published builds + the game document + data.json characters → what the public Build tab shows.
// Game names: VI when published, else CN flagged untranslated (like the lore tab). Ids missing from the game
// document or data.json are left out rather than shown raw.
import type { GameDocument, GameText } from '../../profile/api/loreOverlay.mts';

export type Unit = { text: string; untranslated: boolean };
type Deepen = { label: string; styleId: string; points: number[] };
type Step = { skillId: string; note?: string };
type Rotation = { label: string; note?: string; steps?: Step[]; skillIds?: string[] }; // skillIds: published before 2026-09-28
type Doc = {
  name?: string; rating?: string; summary?: string;
  weapons?: { weaponId: string; label: string }[];
  affixes?: { noReroll?: boolean; groups?: { label: string; affixIds: string[] }[] };
  deepens?: Deepen[]; // up to 3 深造 suggestions (owner 2026-09-27)
  deepen?: Omit<Deepen, 'label'> | null; // game documents published before that
  rotations?: Rotation[];
  tips?: string[];
  teams?: { label: string; characterIds: string[]; note: string }[];
  teamOther?: string;
};
type SiteCharacter = { id: string; slug?: string; name_vi?: string; name_cn?: string; icon?: string; skills?: { group_id: string; slot?: string; levels?: { name_vi?: string; name_cn?: string; icon?: string; type?: string }[] }[] };

const unit = (t: GameText | undefined, field: 'name' | 'detail' = 'name'): Unit => {
  const vi = field === 'name' ? t?.vi : t?.detail_vi;
  const cn = field === 'name' ? t?.cn : t?.detail;
  return vi ? { text: vi, untranslated: false } : { text: cn ?? '', untranslated: true };
};
const asset = (path?: string) => (path ? (path.startsWith('/') ? path : `/${path}`) : '');
// Skill slot (data.json) → the short tag under a rotation step (owner 2026-09-28).
const TAGS: Record<string, string> = { skill1: 'ATK', skill6: 'SKILL', skill2: 'ULT', skill3: 'P1', skill4: 'P2', skill5: 'P3' };
const frameOf = (rare: number) => `/assets/frames/itemRare${[2, 3, 4, 5].includes(rare) ? rare : 'K'}.png`;

// Spec C2: each 深造 label is a variant ("Chuẩn", "Lục Trí"); a weapon label naming one (exactly, or followed by a
// separator) gets its chip, the rest stays as text. Longest variant first so "Lục Trí 2" beats "Lục Trí".
const SEP = /^[\s,|–:(-]+/;
export function variantOf(label: string, variants: string[]) {
  const text = label.trim();
  for (const v of [...variants].filter(Boolean).sort((a, b) => b.length - a.length)) {
    if (text === v) return { variant: v, rest: '' };
    const after = text.slice(v.length);
    if (text.startsWith(v) && SEP.test(after)) {
      const rest = after.replace(SEP, '').trim();
      return { variant: v, rest: /^\s*\(/.test(after) && rest.endsWith(')') ? rest.slice(0, -1).trim() : rest }; // "Chuẩn (dự phòng)"
    }
  }
  return { variant: '', rest: text };
}

export function buildViews(docs: Doc[], game: GameDocument, characters: Record<string, SiteCharacter>, characterId: string) {
  const ref = (kind: string, code: string) => game.refs[kind]?.[code];
  const text = (kind: string, code: string) => game.texts[kind]?.[code];
  const skills = new Map((characters[characterId]?.skills ?? []).map((s) => [s.group_id, { ...(s.levels?.[0] ?? {}), slot: s.slot }]));

  return docs.map((doc) => {
    const deepens: Deepen[] = doc.deepens ?? (doc.deepen ? [{ label: '', ...doc.deepen }] : []);
    const variants = deepens.map((d) => d.label.trim()).filter(Boolean);
    return {
      name: doc.name ?? '', rating: doc.rating ?? '', summary: doc.summary ?? '',
      weapons: (doc.weapons ?? []).flatMap((w) => {
        const weapon = ref('weapon', w.weaponId);
        if (!weapon) return [];
        return [{
          id: w.weaponId, label: w.label, rare: weapon.rare as number, frame: frameOf(weapon.rare as number),
          ...(({ variant, rest }) => ({ variant, labelRest: rest }))(variantOf(w.label, variants)),
          // the importer's icon key = a file under public/assets/items (null when MasterData has no icon)
          icon: weapon.icon ? `/assets/items/${weapon.icon}.png` : '', name: unit(text('weapon', w.weaponId)),
          skills: (weapon.skillIds as string[]).map((id) => ({ name: unit(text('weapon_skill', id)), text: unit(text('weapon_skill', id), 'detail') }))
            .filter((s) => s.name.text || s.text.text), // an empty skill left an orphan "•" (critique)
        }];
      }),
      affixes: {
        noReroll: Boolean(doc.affixes?.noReroll),
        // HP and HP% share one name (生命值): the % tells them apart, like the admin picker
        groups: (doc.affixes?.groups ?? []).map((g) => ({ label: g.label, items: g.affixIds.filter((id) => ref('weapon_affix', id)).map((id) => {
          const u = unit(text('weapon_affix', id));
          return ref('weapon_affix', id).percent ? { ...u, text: `${u.text} %` } : u;
        }) })),
      },
      deepens: deepens.flatMap((d) => {
        const style = ref('job_style', d.styleId);
        if (!style) return [];
        return [{
          label: d.label, variant: d.label.trim(), style: unit(text('job_style', d.styleId)), total: d.points.reduce((a, b) => a + b, 0),
          icon: style.icon ? `/assets/styles/${style.icon}.png` : '', serial: d.points.join(''),
          columns: (style.sectorIds as string[]).map((sectorId, i) => {
            const points = d.points[i] ?? 0;
            const talentIds: string[][] = ref('style_sector', sectorId)?.talentIds ?? [];
            return {
              name: unit(text('style_sector', sectorId)), points,
              talents: talentIds.map((ids, p) => {
                const parts = ids.map((id) => unit(text('style_talent', id)));
                return { point: p + 1, reached: p < points, text: { text: parts.map((u, k) => u.text || ids[k]).join(' / '), untranslated: parts.some((u) => u.untranslated) } };
              }),
            };
          }),
        }];
      }),
      rotations: (doc.rotations ?? []).map((r) => ({
        label: r.label, note: r.note ?? '',
        steps: (r.steps ?? (r.skillIds ?? []).map((skillId) => ({ skillId, note: '' }))).filter((s) => skills.has(s.skillId)).map((s) => {
          const k = skills.get(s.skillId)!;
          return { id: s.skillId, name: k.name_vi || k.name_cn || s.skillId, type: k.type ?? '', tag: TAGS[k.slot ?? ''] ?? k.type ?? '', icon: asset(k.icon), note: s.note ?? '' };
        }),
      })),
      tips: (doc.tips ?? []).filter((t) => t.trim()),
      teams: (doc.teams ?? []).map((t) => ({
        label: t.label, note: t.note,
        members: t.characterIds.filter((id) => characters[id]).map((id) => {
          const c = characters[id];
          return { id, name: c.name_vi || c.name_cn || id, icon: asset(c.icon), href: `#/characters/${c.slug ?? id}` };
        }),
      })),
      teamOther: doc.teamOther ?? '',
    };
  });
}
export type BuildView = ReturnType<typeof buildViews>[number];
