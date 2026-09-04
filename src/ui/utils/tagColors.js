/**
 * Centralized Gameplay Tag Parser & Semantic Color Mapper for WhmxCalc
 * Styled matching pill tags with colored background fill and white text.
 */

export function parseTags(tagStr) {
  if (!tagStr) return [];
  return tagStr
    .split(/[,|;]/)
    .map(t => t.trim())
    .filter(Boolean);
}

export function getTagStyle(tag) {
  if (!tag) return { bg: '#283244', border: '#42516d', color: '#ffffff' };
  const t = tag.toLowerCase().trim();

  // COMBAT RANGE / POSITION (Indigo / Deep Blue fill)
  if (/viễn chiến|cận chiến|tầm xa|cận cảnh/.test(t)) {
    return { bg: '#1b2c5c', border: '#2f4994', color: '#ffffff' };
  }

  // OFFENSE / DAMAGE (Warm Amber / Brown-Orange fill - matching Image 2 "Skill DMG")
  if (/sát thương|bạo phát|đơn thể|quần thể|bạo kích|xuyên giáp|khái niệm|bộc phá/.test(t)) {
    return { bg: '#793812', border: '#aa5019', color: '#ffffff' };
  }

  // SUPPORT / BUFF (Dark Green fill - matching Image 2 "Physical DMG Support")
  if (/hỗ trợ|buff|tăng cường|hồi phục|trị liệu|hồi năng lượng|hồi chiêu|tăng cấp/.test(t)) {
    return { bg: '#164312', border: '#297021', color: '#ffffff' };
  }

  // DEBUFF / PHYSICAL (Deep Maroon / Crimson Red fill - matching Image 2 "Physical DMG")
  if (/vật lý|sát thương vật lý|debuff|giảm cấp|khóa|trầm mặc|làm chậm|giảm tốc|định thân/.test(t)) {
    return { bg: '#5c1724', border: '#8c2438', color: '#ffffff' };
  }

  // CONTROL / SPECIAL DEBUFF (Deep Violet / Purple fill)
  if (/khống chế|choáng|tê liệt|hóa đá/.test(t)) {
    return { bg: '#431952', border: '#6c2884', color: '#ffffff' };
  }

  // DEFENSE / SURVIVAL (Slate / Steel Blue fill)
  if (/hộ vệ|phòng ngự|khiên|giảm sát thương|hút máu|bất tử|sinh mệnh|túc vệ/.test(t)) {
    return { bg: '#23374d', border: '#385577', color: '#ffffff' };
  }

  // MOBILITY (Deep Teal fill)
  if (/di chuyển|tốc độ|lướt/.test(t)) {
    return { bg: '#0e464c', border: '#176c75', color: '#ffffff' };
  }

  // SUMMON / UNIQUE / LIMITED (Dark Gold / Bronze fill)
  if (/triệu hồi|triệu hoán|biến hình|cơ chế|đặc biệt|limited|khán giả/.test(t)) {
    return { bg: '#61480c', border: '#997213', color: '#ffffff' };
  }

  // DEFAULT FOR ALL OTHER TAGS (Filled Dark Slate Blue - ALWAYS COLORED!)
  return { bg: '#283244', border: '#42516d', color: '#ffffff' };
}

export function renderTagChipsHtml(tagStr) {
  const tags = parseTags(tagStr);
  if (tags.length === 0) return '';

  return tags.map(t => {
    const style = getTagStyle(t);
    return `<span class="cd-tag-chip" style="background: ${style.bg}; border-color: ${style.border}; color: ${style.color};">${t}</span>`;
  }).join('');
}
