import { getLang } from '../../i18n/lang.mts';
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
  'chuyển nghề nghiệp': 'indigo',
  'truy kích': 'coral',
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

/** VI tag → in-game CN (CharacterTagLanText), from localization_master.xlsx CHARACTER tags_cn/tags_vi pairs. */
const TAG_CN: Record<string, string> = {
  'Buff': '增益', 'Buff Phản Công': '反击增益', 'Bạo Phát': '爆发', 'Chuyển Nghề Nghiệp': '职业切换', 'Chuyển Trạng Thái': '形态切换',
  'Cận Chiến': '近战', 'Debuff': '减益', 'Di Chuyển Thêm': '再移动', 'Dịch Chuyển': '传送', 'Giải Trừ': '驱散', 'Giảm Tốc': '减速',
  'Hành Động Liên Tục': '连续行动', 'Hút Máu': '生命吸取', 'Hồi Năng Lượng': '回能', 'Hỗ Trợ': '支援', 'Hộ Vệ': '援护',
  'Khiêu Khích': '嘲讽', 'Khống Chế': '控制', 'Liên Kích': '连击', 'Lá Chắn Cấu Thuật': '构素护盾', 'Miễn Thương': '免伤',
  'Né Tránh': '闪避', 'Phản Công': '回击', 'Phản Sát Thương': '反弹伤害', 'Quay Ngược Thời Gian': '回溯', 'Sát Thương': '输出',
  'Sát Thương Chuẩn': '真实伤害', 'Sát Thương Diện Rộng': '范围伤害', 'Sát Thương Duy Trì': '持续伤害', 'Sát Thương Kèm Theo': '伤害追加',
  'Sát Thương Kỹ Năng': '技能伤害', 'Sát Thương Nhiều Đoạn': '多段伤害', 'Triệu Hồi': '召唤', 'Truy Kích': '追击', 'Trị Liệu': '治疗',
  'Tăng Tầm Bắn': '射程加强', 'Tập Trung Hỏa Lực': '集火', 'Tự Hồi Phục': '自愈', 'Viễn Chiến': '远程', 'Xuyên Giáp': '伤害穿透',
  'Đánh Thường': '常击', 'Đẩy Lùi': '击退', 'Đột Kích': '突入', 'Đỡ Gạt': '格挡', 'Đỡ Đòn': '承伤',
};

export function renderTagChipsHtml(tagStr: unknown) {
  return parseTags(tagStr)
    .map((t) => `<span class="cd-tag-chip" style="--tag: var(--tag-${tagHue(t)})">${getLang() === 'cn' ? TAG_CN[t.trim()] ?? t : t}</span>`)
    .join('');
}
