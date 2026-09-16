/**
 * Centralized constant for future Hoán Chương indicator asset path.
 * When the real asset is added to public/assets/ui/icon_huanzhang_indicator.png,
 * it will automatically display across character cards.
 */
export const HUANZHANG_INDICATOR_ICON = '/assets/huanzhang/huanzhang-badge.png';

/**
 * Authoritative helper to determine if a character has Hoán Chương data.
 */
export function hasHuanZhang(char) {
  if (!char) return false;
  if (typeof char.has_huanzhang === 'boolean') return char.has_huanzhang;
  const bInfo = char.brilliant_info;
  const bSkills = char.brilliant_skills || [];
  return !!(bInfo || (bSkills && bSkills.length > 0));
}
