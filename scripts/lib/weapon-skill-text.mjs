// scripts/lib/weapon-skill-text.mjs
// Pure: equipmentSkills levels → one description with the numbers filled in.
// Port of tools/build_web_data.py parse_attr / get_param_val / resolve_desc / resolve_multi_level_desc
// (without the popup-term and VI parts, which weapon skills don't have). Colour tags are removed: the text is a
// translatable term (lore_terms.detail_cn), edited as plain text.

// Same token pattern as the Python tool: [Name,index] + closing tags + an optional unit.
const TOKEN = /(\[([A-Za-z0-9_]+),(\d+)?\])(\s*(?:<\/span>|<\/color>)*\s*)(%|倍|格|回合|点|层|次)?/g;

export function parseAttr(attr) {
  const out = {};
  for (const item of Array.isArray(attr) ? attr : []) {
    const raw = Array.isArray(item) ? String(item[0] ?? '') : String(item ?? '');
    if (!raw.includes(',')) continue;
    const parts = raw.split(',');
    out[parts[0]] = parts.length >= 3 ? parts.slice(2) : [];
  }
  return out;
}

function paramValue(name, index, attr) {
  const values = attr[name];
  if (values && index >= 1 && index <= values.length) return String(values[index - 1]);
  const full = attr[`${name},${index}`];
  return full ? String(full[0]) : null;
}

const clean = (text) => text.replace(/\{Buff_[^}]+\}/g, '').replace(/<\/?color[^>]*>/g, '').trim();

function fill(template, attrs) {
  return template.replace(TOKEN, (_, token, name, idx, closing = '', unit = '') => {
    const values = attrs.map((attr) => paramValue(name, Number(idx || 1), attr) ?? token);
    if (new Set(values).size === 1) return `${values[0]}${unit}${closing}`;
    if (unit === '%') return `${values.map((v) => `${v}%`).join('/')}${closing}`;
    return `${values.join('/')}${unit}${closing}`;
  });
}

export function resolveSkillText(levels) {
  const templates = levels.map((level) => String(level?.DescriptionLanText ?? ''));
  if (!templates.some(Boolean)) return '';
  const attrs = levels.map((level) => parseAttr(level?.Attr));
  if (new Set(templates).size === 1) return clean(fill(templates[0], attrs));
  return templates.map((template, i) => `Lv.${i + 1}: ${clean(fill(template, [attrs[i]]))}`).join('\n');
}
