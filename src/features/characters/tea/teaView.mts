// Turns char.profile.tea (v2 lore overlay, spec 2026-10-03 §6) into what the Phòng Trà tab shows.
import { pick, type LoreUnit } from '../lore/loreView.mts';

export type Reaction = 'like' | 'puzzled';
export type Exchange = { ask: LoreUnit; askCn: string; reply: LoreUnit | null; narration: boolean; reaction: Reaction | null };
export type Branch = Exchange & { next: Exchange[] };
export type TeaItem = { icon: string; name: LoreUnit; cn: string; desc: LoreUnit | null; comment: LoreUnit | null };
export type TeaView = { drawing: string | null; teas: TeaItem[]; stages: LoreUnit[]; topics: Exchange[]; branches: Branch[]; win: LoreUnit | null; lose: LoreUnit | null; poem: LoreUnit | null; hasUntranslated: boolean };

type Obj = Record<string, any>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.map(obj) : []);
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
// The game's stage names are drawn in its UI sprites; their CN is the fallback when no term was published.
const STAGE_CN = ['缘起', '相知', '契合'];
const REACTIONS = new Set(['like', 'puzzled']);

function exchange(x: Obj): Exchange | null {
  const ask = pick(x.ask_vi, x.ask);
  if (!ask) return null;
  return {
    ask, askCn: str(x.ask), reply: pick(x.reply_vi, x.reply),
    narration: /^（[\s\S]*）$/.test(str(x.reply)), // a stage direction, decided on the CN source
    reaction: REACTIONS.has(x.reaction) ? (x.reaction as Reaction) : null,
  };
}

export function buildTeaView(char: unknown): TeaView | null {
  const c = obj(char);
  const tea = obj(obj(c.profile).tea);
  const topics = list(tea.topics).map(exchange).filter((x): x is Exchange => x !== null);
  const branches = list(tea.branches).flatMap((b) => {
    const head = exchange(b);
    return head ? [{ ...head, next: list(b.next).map(exchange).filter((x): x is Exchange => x !== null) }] : [];
  });
  const teas = list(tea.teas).flatMap((t) => {
    const name = pick(t.name_vi, t.name);
    return name && str(t.code) ? [{ icon: `assets/items/itemicon_${str(t.code)}.png`, name, cn: str(t.name), desc: pick(t.desc_vi, t.desc), comment: pick(t.comment_vi, t.comment) }] : [];
  });
  if (!topics.length && !branches.length && !teas.length) return null;
  const stages = STAGE_CN.map((cn, i) => pick(list(tea.stages)[i]?.vi, str(list(tea.stages)[i]?.cn) || cn)!);
  const result = obj(tea.result);
  const view: TeaView = {
    drawing: str(list(c.skins).find((s) => s.is_base)?.image) || null,
    teas, stages, topics, branches,
    win: pick(tea.win_vi, tea.win), lose: pick(tea.lose_vi, tea.lose), poem: pick(result.vi, result.cn),
    hasUntranslated: false,
  };
  const units: (LoreUnit | null)[] = [...teas.flatMap((t) => [t.name, t.desc, t.comment]), ...[...topics, ...branches, ...branches.flatMap((b) => b.next)].flatMap((x) => [x.ask, x.reply]), view.win, view.lose];
  view.hasUntranslated = units.some((u) => u?.untranslated);
  return view;
}
