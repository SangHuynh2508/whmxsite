// What the Lồng tiếng tab shows (spec docs/superpowers/specs/2026-11-19-voice-tab-design.md): one voice pack's lines
// for one skin, split into the four groups. The VI labels are the owner-approved table in the spec (2026-11-19).
import { pick, type LoreUnit } from '../lore/loreView.mts';

export type VoiceLine = { skin: string; type: string; order: number; label: string; text: string; unlock?: string; zone?: string; cv?: string; key: string | null };
export type VoiceLang = { lang: string; name: string; cv: string; lines: VoiceLine[] };
export type VoiceDoc = { version: string; asset_base_url: string; id: string; langs: VoiceLang[] };
export type GroupId = 'daily' | 'growth' | 'battle' | 'base' | 'other';
export type Take = { n: number; line: VoiceLine; vi: string; text: LoreUnit | null; cn: string; unlock: LoreUnit | null; zone: string; playable: boolean };
/** Published VI for one character (spec voice-translation §7): `main` is the pack the unprefixed keys belong to. */
export type VoiceTr = { vi: Record<string, string>; unlock: Record<string, string>; main: VoiceLang };
export type Group = { id: GroupId; takes: Take[] };

const GROUPS: [GroupId, string][] = [
  ['daily', 'dropLine regardsLine appointmentLine touchLine_1 touchLine_2 touchLine_3 touchLine_4 touchLine_5 touchLine_6 timeLine_1 timeLine_2 unuseLine happyBirthdayLine'],
  ['growth', 'levelUpLine strengthenLine_1 strengthenLine_2 strengthenLine_3 equipLine_1 equipLine_2'],
  ['battle', 'joinpLine displayLine_1 displayLine_2 switchToLine switchToLine_2 switchToLine_3 skillLine skillLine_2 skillReadyLine skillReadyLine_2 beDyingLine victoryLine_1 victoryLine_2 loseLine_1 loseLine_2'],
  ['base', 'enterInstallationLine installationLine_1 installationLine_2 expeditionstartLine expeditionsucceedLine expeditionbackLine giftVictoryLine giftLoseLine teaVictoryLine teaLoseLine'],
];
export const GROUP_OF: Record<string, GroupId> = Object.fromEntries(GROUPS.flatMap(([g, ts]) => ts.split(' ').map((t) => [t, g])));
export const GROUP_ORDER: GroupId[] = ['daily', 'growth', 'battle', 'base', 'other'];

export const LABEL_VI: Record<string, string> = {
  dropLine: 'Chiêu mộ', regardsLine: 'Chào hỏi', appointmentLine: 'Bổ nhiệm',
  touchLine_1: 'Trò chuyện 1', touchLine_2: 'Trò chuyện 2', touchLine_3: 'Trò chuyện 3',
  touchLine_4: 'Đầu Khế chi đàm', touchLine_5: 'Lộc Minh chi đàm', touchLine_6: 'Mạc Nghịch chi đàm',
  timeLine_1: 'Trò chuyện theo giờ 1', timeLine_2: 'Trò chuyện theo giờ 2', unuseLine: 'Một mình', happyBirthdayLine: 'Mừng sinh nhật',
  levelUpLine: 'Lên cấp', strengthenLine_1: 'Tăng Trí Tri', strengthenLine_2: 'Hoán Chương', strengthenLine_3: 'Tinh Nghiên',
  equipLine_1: 'Trang bị 1', equipLine_2: 'Trang bị 2',
  joinpLine: 'Vào đội hình', displayLine_1: 'Ra trận 1', displayLine_2: 'Ra trận 2',
  switchToLine: 'Tập trung 1', switchToLine_2: 'Tập trung 2', switchToLine_3: 'Tập trung 3',
  skillLine: 'Dùng kỹ năng 1', skillLine_2: 'Dùng kỹ năng 2', beDyingLine: 'Nguy kịch',
  skillReadyLine: 'Tuyệt kỹ sẵn sàng 1', skillReadyLine_2: 'Tuyệt kỹ sẵn sàng 2',
  victoryLine_1: 'Phá cục thành công 1', victoryLine_2: 'Phá cục thành công 2', loseLine_1: 'Phá cục thất bại 1', loseLine_2: 'Phá cục thất bại 2',
  enterInstallationLine: 'Vào cơ sở', installationLine_1: 'Hội thoại cơ sở 1', installationLine_2: 'Hội thoại cơ sở 2',
  expeditionstartLine: 'Viễn chinh xuất phát', expeditionsucceedLine: 'Viễn chinh thành công', expeditionbackLine: 'Viễn chinh trở về',
  giftVictoryLine: 'Cảm ứng 1', giftLoseLine: 'Cảm ứng 2', teaVictoryLine: 'Thưởng trà 1', teaLoseLine: 'Thưởng trà 2',
};

/** Skins that have lines in this pack, in data order (the build sorts by skin id, base skin first). */
export function skinsOf(lang: VoiceLang): string[] {
  return [...new Set(lang.lines.map((l) => l.skin))];
}

/** The non-empty groups for one skin; lines are numbered across the groups like takes on a recorder. */
export function groupsOf(lang: VoiceLang, skin: string, tr?: VoiceTr | null): Group[] {
  // An alt pack without its own key shares the main pack's VI when the CN is the same (V1; the importer trims too).
  const mainCn = new Map((tr?.main.lines ?? []).map((l) => [`${l.skin}.${l.type}`, l.text.trim()]));
  const viOf = (l: VoiceLine) => {
    if (!tr) return '';
    const base = `${l.skin}.${l.type}`;
    if (lang.lang === tr.main.lang) return tr.vi[base] ?? '';
    return tr.vi[`${base}.${lang.lang}`] ?? (mainCn.get(base) === l.text.trim() ? tr.vi[base] ?? '' : '');
  };
  const by = new Map<GroupId, VoiceLine[]>(GROUP_ORDER.map((g) => [g, []]));
  for (const l of lang.lines) if (l.skin === skin) by.get(GROUP_OF[l.type] ?? 'other')!.push(l);
  let n = 0;
  return GROUP_ORDER.map((id) => ({
    id,
    takes: by.get(id)!.map((line) => ({
      n: ++n, line, vi: LABEL_VI[line.type] ?? line.label, text: pick(viOf(line), line.text), cn: line.text,
      unlock: pick(tr?.unlock[line.unlock ?? ''] ?? '', line.unlock ?? ''),
      zone: line.zone ?? '', playable: !!line.key,
    })),
  })).filter((g) => g.takes.length);
}

/** '中文-普通话' / '古埃及语（女收藏家）' → name and the second line of the pack button (the parenthesis, else the CV). */
export function packLabel(lang: VoiceLang): { name: string; sub: string } {
  const m = /^(.*?)（(.*)）$/.exec(lang.name);
  return m ? { name: m[1], sub: m[2] } : { name: lang.name, sub: lang.cv ? `CV ${lang.cv}` : '' };
}

/** Analyser bins (fftSize 1024, ~47 Hz each) → one 0–1 level per meter bar. Bar i reads bins
 *  [edge(i), edge(i+1)) with edge growing from bin 2 (~94 Hz) to bin 100 (~4.7 kHz), wider to the right like the ear. */
export function barLevels(bins: Uint8Array, bars: number): number[] {
  const edge = (i: number) => Math.floor(2 + i + 50 * (i / bars) ** 2);
  return Array.from({ length: bars }, (_, i) => {
    let v = 0;
    for (let b = edge(i); b < edge(i + 1); b++) v = Math.max(v, bins[b] ?? 0);
    return v / 255;
  });
}

/** The listener's saved volume (localStorage text) → 0–1; nothing saved or junk → 0.6, since the mp3 are mastered loud. */
export function parseVolume(raw: string | null): number {
  const v = raw === null || raw.trim() === '' ? NaN : Number(raw);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.6;
}
