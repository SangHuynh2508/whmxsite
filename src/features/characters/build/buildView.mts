// Pure: published builds + the game document + data.json characters → what the public Build tab shows.
// Game names: VI when published, else CN flagged untranslated (like the lore tab). Ids missing from the game
// document or data.json are left out rather than shown raw.
import type { GameDocument, GameText } from '../../profile/api/loreOverlay.mts';

export type Unit = { text: string; untranslated: boolean };
type Doc = {
  name?: string; rating?: string; summary?: string;
  weapons?: { weaponId: string; label: string }[];
  affixes?: { noReroll?: boolean; groups?: { label: string; affixIds: string[] }[] };
  deepen?: { styleId: string; points: number[] } | null;
  rotations?: { label: string; skillIds: string[] }[];
  tips?: string[];
  teams?: { label: string; characterIds: string[]; note: string }[];
  teamOther?: string;
};
type SiteCharacter = { id: string; slug?: string; name_vi?: string; name_cn?: string; icon?: string; skills?: { group_id: string; levels?: { name_vi?: string; name_cn?: string; icon?: string }[] }[] };

const unit = (t: GameText | undefined, field: 'name' | 'detail' = 'name'): Unit => {
  const vi = field === 'name' ? t?.vi : t?.detail_vi;
  const cn = field === 'name' ? t?.cn : t?.detail;
  return vi ? { text: vi, untranslated: false } : { text: cn ?? '', untranslated: true };
};
const asset = (path?: string) => (path ? (path.startsWith('/') ? path : `/${path}`) : '');

export function buildViews(docs: Doc[], game: GameDocument, characters: Record<string, SiteCharacter>, characterId: string) {
  const ref = (kind: string, code: string) => game.refs[kind]?.[code];
  const text = (kind: string, code: string) => game.texts[kind]?.[code];
  const skills = new Map((characters[characterId]?.skills ?? []).map((s) => [s.group_id, s.levels?.[0] ?? {}]));

  return docs.map((doc) => {
    const style = doc.deepen ? ref('job_style', doc.deepen.styleId) : null;
    return {
      name: doc.name ?? '', rating: doc.rating ?? '', summary: doc.summary ?? '',
      weapons: (doc.weapons ?? []).flatMap((w) => {
        const weapon = ref('weapon', w.weaponId);
        if (!weapon) return [];
        return [{
          id: w.weaponId, label: w.label, rare: weapon.rare as number,
          // the importer's icon key = a file under public/assets/items (null when MasterData has no icon)
          icon: weapon.icon ? `/assets/items/${weapon.icon}.png` : '', name: unit(text('weapon', w.weaponId)),
          skills: (weapon.skillIds as string[]).map((id) => ({ name: unit(text('weapon_skill', id)), text: unit(text('weapon_skill', id), 'detail') })),
        }];
      }),
      affixes: {
        noReroll: Boolean(doc.affixes?.noReroll),
        groups: (doc.affixes?.groups ?? []).map((g) => ({ label: g.label, items: g.affixIds.filter((id) => ref('weapon_affix', id)).map((id) => unit(text('weapon_affix', id))) })),
      },
      deepen: style && doc.deepen ? {
        style: unit(text('job_style', doc.deepen.styleId)),
        total: doc.deepen.points.reduce((a, b) => a + b, 0),
        columns: (style.sectorIds as string[]).map((sectorId, i) => {
          const points = doc.deepen!.points[i] ?? 0;
          const talentIds: string[][] = ref('style_sector', sectorId)?.talentIds ?? [];
          return {
            name: unit(text('style_sector', sectorId)), points,
            talents: talentIds.map((ids, p) => {
              const parts = ids.map((id) => unit(text('style_talent', id)));
              return { point: p + 1, reached: p < points, text: { text: parts.map((u, k) => u.text || ids[k]).join(' / '), untranslated: parts.some((u) => u.untranslated) } };
            }),
          };
        }),
      } : null,
      rotations: (doc.rotations ?? []).map((r) => ({
        label: r.label,
        skills: r.skillIds.filter((id) => skills.has(id)).map((id) => { const s = skills.get(id)!; return { id, name: s.name_vi || s.name_cn || id, icon: asset(s.icon) }; }),
      })),
      tips: doc.tips ?? [],
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
