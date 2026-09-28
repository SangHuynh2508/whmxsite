/**
 * Character role tags ("Viễn Chiến", "Hỗ Trợ" …) → a colour token (`--tag-<hue>` in src/styles/tokens.css).
 * Owner 2026-09-28 (option C): outlined chips, one colour per tag, and no two tags of one character alike — the old
 * 8-family map painted Hỗ Trợ / Trị Liệu / Buff the same green. tagColors.test.mts checks every character in
 * public/data.json, so a new tag that clashes fails the test instead of shipping; give it a free hue here.
 */

const HUES: Record<string, string> = {
  'viễn chiến': 'sky',
  'cận chiến': 'coral',
  'sát thương': 'amber',
  'buff': 'violet',
  'đỡ đòn': 'steel',
  'bạo phát': 'lime',
  'hỗ trợ': 'green',
  'trị liệu': 'pink',
  'debuff': 'magenta',
  'khống chế': 'indigo',
  'đột kích': 'teal',
  'tự hồi phục': 'teal',
  'đẩy lùi': 'magenta',
  'sát thương duy trì': 'teal',
  'phản công': 'lime',
  'triệu hồi': 'green',
  'sát thương diện rộng': 'teal',
  'hộ vệ': 'green',
  'liên kích': 'teal',
  'né tránh': 'indigo',
  'lá chắn cấu thuật': 'violet',
  'khiêu khích': 'indigo',
  'đánh thường': 'teal',
  'hồi năng lượng': 'green',
  'hút máu': 'pink',
  'giải trừ': 'teal',
  'sát thương kỹ năng': 'pink',
};

export function parseTags(tagStr: unknown): string[] {
  if (!tagStr) return [];
  return String(tagStr)
    .split(/[,|;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Rare tags (one character each) share the neutral outline. */
export const tagHue = (tag: string) => HUES[tag.toLowerCase().trim()] ?? 'neutral';

export function renderTagChipsHtml(tagStr: unknown) {
  return parseTags(tagStr)
    .map((t) => `<span class="cd-tag-chip" style="--tag: var(--tag-${tagHue(t)})">${t}</span>`)
    .join('');
}
