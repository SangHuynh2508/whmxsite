// server/profile/shape-character-profile.mjs
// Pure: DB rows -> public profile. 'legacy' = today's build output; 'v2' = spec §5.
import { DEPARTMENT_VI, STAFF_STATUS_MAP, STORE_STATUS_MAP } from './profile-code-maps.mjs';

export function publishableVi(row, field = 'vi') {
  return row && row.viOrigin === 'admin' && row.state === 'ok' && row[field] ? row[field] : null;
}

const cnOf = (texts, key) => texts.get(key)?.sourceCn ?? '';
const viOf = (texts, key) => publishableVi(texts.get(key));
// Latest published VI of a main text (Home "Mới dịch" order); titles and timeline labels are short labels.
function viUpdatedAt(texts) {
  let latest = null;
  for (const [key, row] of texts) {
    if (key.startsWith('tea.') || /\.(title|label)$/.test(key) || !publishableVi(row) || !row.viUpdatedAt) continue;
    if (!latest || row.viUpdatedAt > latest) latest = row.viUpdatedAt;
  }
  return latest ? new Date(latest).toISOString() : null;
}
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

// Tea room (spec 2026-10-03 §6). Trend is the game's reaction after a reply: 1 hearts, 2 tangled thread; openers none.
const TEA_REACTION = { 1: 'like', 2: 'puzzled' };
const TEA_STAGE_CODES = ['TEA_STAGE_1', 'TEA_STAGE_2', 'TEA_STAGE_3'];
function teaBlock(tea, texts, terms) {
  const line = (id) => ({ ask: cnOf(texts, `tea.${id}.ask`), ask_vi: viOf(texts, `tea.${id}.ask`), reply: cnOf(texts, `tea.${id}.reply`), reply_vi: viOf(texts, `tea.${id}.reply`) });
  const reacted = ({ id, trend }) => ({ ...line(id), reaction: TEA_REACTION[trend] ?? null });
  const shared = terms.get('TEA_RESULT');
  return {
    teas: tea.teas.map((code, i) => {
      const term = terms.get(code);
      return { code, name: term?.nameCn ?? '', name_vi: publishableVi(term, 'nameVi'), desc: term?.detailCn ?? '', desc_vi: publishableVi(term, 'detailVi'), comment: cnOf(texts, `tea.comment.${i + 1}`), comment_vi: viOf(texts, `tea.comment.${i + 1}`) };
    }),
    stages: TEA_STAGE_CODES.map((code) => ({ cn: terms.get(code)?.nameCn ?? '', vi: publishableVi(terms.get(code), 'nameVi') })),
    topics: tea.topics.map(reacted),
    branches: tea.branches.map((b) => ({ ...line(b.id), next: b.next.map(reacted) })),
    win: cnOf(texts, 'tea.win'), win_vi: viOf(texts, 'tea.win'),
    lose: cnOf(texts, 'tea.lose'), lose_vi: viOf(texts, 'tea.lose'),
    result: texts.has('tea.result') ? { cn: cnOf(texts, 'tea.result'), vi: viOf(texts, 'tea.result') }
      // the shared poem closes a tea that has endings (a character without a highteaCharacterMap row has none)
      : shared && texts.has('tea.win') ? { cn: shared.nameCn, vi: publishableVi(shared, 'nameVi') } : null,
  };
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
    vi_updated_at: viUpdatedAt(texts),
    department_detail: { cn: org?.detailCn ?? '', vi: publishableVi(org, 'detailVi') },
    quote: cnOf(texts, 'quote'), quote_vi: viOf(texts, 'quote'),
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
      tags: (profile.structure.relicTags ?? []).map(({ field, code }) => ({ field, ...termPair(terms, code) })),
      intro: cnOf(texts, 'relic_intro'), intro_vi: viOf(texts, 'relic_intro'),
      timeline: profile.structure.timeline.map((slot) => ({
        label: cnOf(texts, `timeline.${slot}.label`), label_vi: viOf(texts, `timeline.${slot}.label`),
        story: cnOf(texts, `timeline.${slot}.story`), story_vi: viOf(texts, `timeline.${slot}.story`),
      })),
    } : {},
    ...(profile.structure.tea ? { tea: teaBlock(profile.structure.tea, texts, terms) } : {}),
  };
}
