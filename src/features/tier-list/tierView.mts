// Pure view logic of the Tier List page (spec 2026-10-02 §7, direction D3). No DOM.
import { fold } from '../../lib/fold.mts';
import { JOB_NAMES, RARITY_LABELS } from '../../ui/utils/gameLabels.mts';
import { getCharacterAvatarUrl } from '../../ui/utils/avatar.mts';
import type { CharacterTileProps } from '../characters/components/CharacterTile.tsx';
import type { Tab } from './tierRoute.mts';

export type Entry = { characterId: string; zhizhi?: number; hc?: true };
export type Tier = { label: string; description: string; joinAbove: boolean; entries: Entry[] };
export type Team = { name: string; note: string; members: Entry[] };
export type TierListDoc = { title: string; author: string; sourceUrl: string; info: string; solo: { note: string; tiers: Tier[] }; teams: { note: string; groups: Team[] } };
export type PublishedList = { slug: string; status: 'published' | 'archived'; updatedAt: string; doc: TierListDoc };
export type SiteChar = { id: string; slug: string; name_vi?: string; name_cn: string; rare: number; job: number; icon?: string };
export type Filter = { jobs: Set<number>; rarities: Set<number>; q: string };

export const emptyFilter = (): Filter => ({ jobs: new Set(), rarities: new Set(), q: '' });

export function groupTiers(tiers: Tier[]) {
  const out: { description: string; tiers: Tier[] }[] = [];
  for (const t of tiers) {
    if (t.joinAbove && out.length) out[out.length - 1].tiers.push(t);
    else out.push({ description: t.description, tiers: [t] });
  }
  return out;
}

export function matchEntry(e: Entry, chars: Record<string, SiteChar>, f: Filter) {
  const c = chars[e.characterId];
  if (!c) return false;
  if (f.jobs.size && !f.jobs.has(c.job)) return false;
  if (f.rarities.size && !f.rarities.has(c.rare)) return false;
  const q = fold(f.q.trim());
  return !q || fold(c.name_vi || '').includes(q) || c.name_cn.includes(f.q.trim());
}

export function filterTiers(tiers: Tier[], chars: Record<string, SiteChar>, f: Filter) {
  return groupTiers(tiers)
    .map((g) => ({ description: g.description, rows: g.tiers.map((tier) => ({ tier, entries: tier.entries.filter((e) => matchEntry(e, chars, f)) })).filter((r) => r.entries.length) }))
    .filter((g) => g.rows.length);
}

export const countMatches = (tiers: Tier[], chars: Record<string, SiteChar>, f: Filter) =>
  tiers.reduce((n, t) => n + t.entries.filter((e) => matchEntry(e, chars, f)).length, 0);

export const chipCount = (tiers: Tier[], chars: Record<string, SiteChar>, f: Filter, kind: 'jobs' | 'rarities', value: number) =>
  countMatches(tiers, chars, { ...f, [kind]: new Set([value]) });

export const presentRarities = (tiers: Tier[], chars: Record<string, SiteChar>) =>
  [...new Set(tiers.flatMap((t) => t.entries.map((e) => chars[e.characterId]?.rare).filter((r): r is number => r !== undefined)))].sort((a, b) => b - a);

export const visibleTabs = (doc: TierListDoc): Tab[] =>
  ['characters' as const, ...(doc.teams.groups.length ? ['teams' as const] : []), ...(doc.info.trim() ? ['info' as const] : [])];

export function paragraphs(text: string) {
  return text.split(/\n\s*\n/).map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean)).filter((lines) => lines.length)
    .map((lines) => (lines.every((l) => l.startsWith('- ')) ? { kind: 'ul' as const, items: lines.map((l) => l.slice(2)) } : { kind: 'p' as const, lines }));
}

export const badges = (e: Entry) => [e.zhizhi ? `Z${e.zhizhi}` : '', e.hc ? 'HC' : ''].filter(Boolean);
export const badgeTitle = (e: Entry) => [e.zhizhi ? `Trí Tri ${e.zhizhi}` : '', e.hc ? 'cần Hoán Chương' : ''].filter(Boolean).join(' · ');

export function tileProps(e: Entry, c: SiteChar, href = `#/characters/${c.slug}/build`): CharacterTileProps {
  const untranslated = !c.name_vi;
  const name = c.name_vi || c.name_cn;
  const b = badges(e);
  const label = [`${name}${untranslated ? ' (chưa dịch)' : ''}${b.length ? ` (${b.join(' · ')})` : ''}`, JOB_NAMES[c.job], RARITY_LABELS[c.rare]].filter(Boolean).join(' · ');
  return { name, untranslated, avatar: getCharacterAvatarUrl(c), rare: c.rare, href, label, badges: b, badgeTitle: badgeTitle(e) };
}

export function pickList(lists: PublishedList[] | undefined, slug: string) {
  const all = lists ?? [];
  if (slug) {
    const list = all.find((l) => l.slug === slug);
    return list ? { kind: 'list' as const, list } : { kind: 'missing' as const };
  }
  if (!all.length) return { kind: 'none' as const };
  return all.length === 1 ? { kind: 'list' as const, list: all[0] } : { kind: 'index' as const, lists: all };
}

export const fmtDate = (iso: string) => { const d = new Date(iso); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`; };
