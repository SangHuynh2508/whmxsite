// server/profile/shape-character-profile.mjs
// Pure: DB rows -> public profile. 'legacy' = today's build output; 'v2' = spec §5.
import { DEPARTMENT_VI, STAFF_STATUS_MAP, STORE_STATUS_MAP } from './profile-code-maps.mjs';

export function publishableVi(row, field = 'vi') {
  return row && row.viOrigin === 'admin' && row.state === 'ok' && row[field] ? row[field] : null;
}

const cnOf = (texts, key) => texts.get(key)?.sourceCn ?? '';
const viOf = (texts, key) => publishableVi(texts.get(key));
const map = (table, cn) => (Object.hasOwn(table, cn) ? table[cn] : cn);

function department(profile, terms, shape) {
  const org = profile.organisationCode ? terms.get(`ORG_${profile.organisationCode}`) : null;
  const cn = org?.nameCn ?? '';
  if (shape === 'v2') return publishableVi(org, 'nameVi') ?? cn; // organisations are translated in lore_terms
  return map(DEPARTMENT_VI, cn);
}

// detail/detail_vi feed the public lore-tab popups (spec Q7b).
function termPair(terms, code) {
  const row = code ? terms.get(code) : null;
  return { cn: row?.nameCn ?? '', vi: publishableVi(row, 'nameVi'), detail: row?.detailCn ?? '', detail_vi: publishableVi(row, 'detailVi') };
}

export function shapeCharacterProfile({ profile, texts }, terms, { shape }) {
  const base = {
    record_id: profile.recordId ?? '',
    department: department(profile, terms, shape),
    staff_status: map(STAFF_STATUS_MAP, profile.staffStatusCn ?? ''),
    entity_status: map(STORE_STATUS_MAP, profile.storeStatusCn ?? ''),
  };
  const reports = profile.structure.reports;

  if (shape === 'legacy') {
    const legacy = profile.legacyRelicFields;
    return {
      ...base,
      eval_intro: cnOf(texts, 'card_intro'),
      reports: reports.filter((r) => r.kind === 'basic').map((r) => ({
        id: r.fileId, title: cnOf(texts, `report.${r.fileId}.title`), content: cnOf(texts, `report.${r.fileId}.content`),
      })).filter((r) => r.title || r.content),
      relic_info: legacy.hasEntry
        ? { relic_name: legacy.relicName, dynasty: legacy.dynasty, museum: legacy.museum, intro: cnOf(texts, 'relic_intro') }
        : {},
    };
  }

  const org = profile.organisationCode ? terms.get(`ORG_${profile.organisationCode}`) : null;
  return {
    ...base,
    department_detail: { cn: org?.detailCn ?? '', vi: publishableVi(org, 'detailVi') },
    eval_intro: cnOf(texts, 'card_intro'),
    eval_intro_vi: viOf(texts, 'card_intro'),
    reports: reports.map((r) => {
      const level = r.kind === 'basic' && r.unlock.type === 2 ? Number(r.unlock.elementId) : null;
      const levelTerm = level === null ? null : terms.get(`AFFINITY_${level}`);
      return {
        kind: r.kind,
        title: cnOf(texts, `report.${r.fileId}.title`), title_vi: viOf(texts, `report.${r.fileId}.title`),
        content: cnOf(texts, `report.${r.fileId}.content`), content_vi: viOf(texts, `report.${r.fileId}.content`),
        unlock_level: level, unlock_name: levelTerm?.nameCn ?? null, unlock_name_vi: publishableVi(levelTerm, 'nameVi'),
      };
    }).filter((r) => r.title || r.content),
    relic_info: profile.legacyRelicFields.hasEntry ? {
      type: termPair(terms, profile.relicTypeCode),
      era: termPair(terms, profile.eraCode),
      museum: termPair(terms, profile.museumCode),
      intro: cnOf(texts, 'relic_intro'), intro_vi: viOf(texts, 'relic_intro'),
      timeline: profile.structure.timeline.map((slot) => ({
        label: cnOf(texts, `timeline.${slot}.label`), label_vi: viOf(texts, `timeline.${slot}.label`),
        story: cnOf(texts, `timeline.${slot}.story`), story_vi: viOf(texts, `timeline.${slot}.story`),
      })),
    } : {},
  };
}
