// scripts/lib/profile-source.mjs
// Pure: raw MasterData tables -> normalized lore rows. No I/O, no DB.
import { createHash } from 'node:crypto';

export const sha256 = (text) => createHash('sha256').update(String(text)).digest('hex');

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}
export const hashValue = (value) => sha256(JSON.stringify(stable(value)));

const text = (value) => (value === null || value === undefined ? '' : String(value).trim());
const SLOTS = ['A', 'B', 'C', 'D', 'E', 'F'];
// Kind comes from the raw field that references the code, never from the code's first letter.
const FIELD_KIND = { relics: 'relic_type', dynasty: 'era', museum: 'museum', photoDynasty: 'era_range' };
// Extra relic facts shown in-game under the relic (tag1 = 工艺, tag3 = 产地 confirmed by the owner's screenshot of S0132).
const TAG_FIELDS = ['tag1', 'tag2', 'tag3', 'tag4'];

function unit(units, unitKey, sourceCn, sourceRef) {
  if (sourceCn) units.push({ unitKey, sourceCn, sourceRef, sourceHash: sha256(sourceCn) });
}

// Tea room (品茗). playerAskMap: TopicType 1 = the pool of the first two questions (缘起, 相知), TopicType 2 = the 契合
// openers whose TopicNext are the two follow-ups (TopicType 0). highteaCharacterMap: favourite teas (UPTea; InterestTea
// always equals it, ForbidTea is always empty), one comment per tea at the same position (80/80 comments that name a
// tea name their own one, r3075), endings. The stage names are drawn into the game's UI sprites (ui_pm_qxjdt_d1-3), not
// stored in any table, and the result-card poem (VictoryEnd2) is the same for every character.
export const TEA_STAGES = [['TEA_STAGE_1', '缘起'], ['TEA_STAGE_2', '相知'], ['TEA_STAGE_3', '契合']];
const poemText = (value) => text(value).replace(/\\n/g, '\n'); // the game stores a literal backslash + "n"

function sharedTeaResult(highteaMap) {
  const counts = new Map();
  for (const row of Object.values(highteaMap ?? {})) {
    const poem = poemText(row?.VictoryEnd2LanText);
    if (poem) counts.set(poem, (counts.get(poem) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

function teaFor(characterId, raw, units, terms, sharedResult) {
  const asks = Object.values(raw.playerAskMap ?? {}).filter((r) => text(r?.CharacterId) === characterId)
    .sort((a, b) => text(a.ID).localeCompare(text(b.ID)));
  const hightea = raw.highteaCharacterMap?.[characterId];
  if (!asks.length && !hightea) return null;
  const byId = new Map(asks.map((r) => [text(r.ID), r]));
  const add = (r) => {
    const id = text(r.ID);
    unit(units, `tea.${id}.ask`, text(r.TopicContentLanText), `playerAskMap:${id}.TopicContentLanText`);
    unit(units, `tea.${id}.reply`, text(r.TopicRespLanText), `playerAskMap:${id}.TopicRespLanText`);
    return { id, trend: Number(r.Trend ?? 0) };
  };
  const topics = asks.filter((r) => Number(r.TopicType) === 1).map(add);
  const branches = asks.filter((r) => Number(r.TopicType) === 2).map((r) => {
    const { id } = add(r);
    const next = (Array.isArray(r.TopicNext) ? r.TopicNext : []).map((childId) => {
      const child = byId.get(text(childId));
      if (!child) throw new Error(`playerAskMap has no topic ${childId} (TopicNext of ${id})`);
      return add(child);
    });
    return { id, next };
  });
  const teas = (hightea?.UPTea ?? []).map(text).filter(Boolean);
  teas.forEach((code, i) => {
    const item = raw.itemMap?.[code];
    if (!item) throw new Error(`itemMap has no tea ${code} (${characterId}.UPTea)`);
    addTerm(terms, code, 'tea', text(item.nameLanText), text(item.DescriptionLanText));
    const key = text(hightea.Comments?.[i]);
    if (!key) return;
    if (!Object.hasOwn(raw.teaLang ?? {}, key)) throw new Error(`language table has no ${key} (${characterId}.Comments)`);
    unit(units, `tea.comment.${i + 1}`, text(raw.teaLang[key]), `lang:${key}`);
  });
  if (hightea) {
    unit(units, 'tea.win', text(hightea.VictoryEndLanText), `highteaCharacterMap:${characterId}.VictoryEndLanText`);
    unit(units, 'tea.lose', text(hightea.FailEnd), `highteaCharacterMap:${characterId}.FailEnd`);
    const poem = poemText(hightea.VictoryEnd2LanText);
    if (poem && poem !== sharedResult) unit(units, 'tea.result', poem, `highteaCharacterMap:${characterId}.VictoryEnd2LanText`);
  }
  return { teas, topics, branches };
}

export function normalizeProfileSources(raw, characterIds) {
  const wanted = new Set(characterIds);
  const skipped = Object.keys(raw.characterFiles).filter((id) => !wanted.has(id)).sort();
  const terms = new Map();
  const profiles = [];
  const missingFromRaw = [...wanted].filter((id) => !raw.characterFiles[id]).sort();
  // Recruit line (招集, shown by the wiki as the character quote): line bank id = the base skin's skinID.
  const baseSkin = new Map(Object.values(raw.characterSkins ?? {}).flat().filter((sk) => sk?.bIsBaseSkin).map((sk) => [text(sk.characterId), text(sk.skinID)]));
  const linesById = new Map(Object.values(raw.characterLines ?? {}).map((l) => [text(l?.id), l]));
  const sharedResult = sharedTeaResult(raw.highteaCharacterMap);
  const teaOdd = [];
  const teaOwnResult = [];

  for (const characterId of [...wanted].sort()) {
    if (!raw.characterFiles[characterId]) continue;
    const file = raw.characterFiles[characterId] || {};
    const relic = raw.historicalRelicsMap[characterId];
    const units = [];
    unit(units, 'card_intro', text(file.cardIntrolanText), `characterFiles:${characterId}.cardIntrolanText`);
    const skinId = baseSkin.get(characterId);
    if (skinId) unit(units, 'quote', text(linesById.get(skinId)?.dropLineLanText), `characterLines:${skinId}.dropLineLanText`);

    const reports = [];
    for (const [kind, ids, unlocks] of [
      ['basic', file.basicFileID, file.basicFileUnlock],
      ['special', file.specialFileID, file.specialFileUnlock],
    ]) {
      (Array.isArray(ids) ? ids : []).forEach((fileId, index) => {
        const lock = (Array.isArray(unlocks) ? unlocks[index] : null) || {};
        reports.push({ fileId, kind, unlock: { type: Number(lock.UnlockType ?? 0), elementId: text(lock.ElementID) } });
        const entry = raw.characterFileTextMap[fileId] || {};
        unit(units, `report.${fileId}.title`, text(entry.titleLanText), `characterFileTextMap:${fileId}.titleLanText`);
        unit(units, `report.${fileId}.content`, text(entry.textLanText), `characterFileTextMap:${fileId}.textLanText`);
        if (kind === 'basic' && lock.UnlockType === 2) {
          const level = text(lock.ElementID);
          const friend = raw.friendshipDescription[level];
          if (!friend) throw new Error(`friendshipDescription has no level ${level} (report ${fileId})`);
          addTerm(terms, `AFFINITY_${level}`, 'affinity_level', text(friend.iconDescriptionLanText), text(friend.descriptionLanText));
        }
      });
    }

    const timeline = [];
    const relicTags = [];
    if (relic) {
      unit(units, 'relic_intro', text(relic.introductionlanText), `historicalRelicsMap:${characterId}.introductionlanText`);
      for (const slot of SLOTS) {
        const label = text(relic[`age${slot}lanText`]);
        const story = text(relic[`ageStory${slot}lanText`]);
        if (!label && !story) continue;
        timeline.push(slot);
        unit(units, `timeline.${slot}.label`, label, `historicalRelicsMap:${characterId}.age${slot}lanText`);
        unit(units, `timeline.${slot}.story`, story, `historicalRelicsMap:${characterId}.ageStory${slot}lanText`);
      }
      for (const [field, kind] of Object.entries(FIELD_KIND)) {
        const code = text(relic[field]);
        if (!code) continue;
        const entry = raw.historicalTextMap[code];
        if (!entry) throw new Error(`HistoricalTextMap has no entry for ${code} (${characterId}.${field})`);
        addTerm(terms, code, kind, text(entry.Text), text(entry.TextIntroduce));
      }
      for (const field of TAG_FIELDS) {
        const code = text(relic[field]);
        if (!code) continue;
        const entry = raw.historicalTextMap[code];
        if (!entry) throw new Error(`HistoricalTextMap has no entry for ${code} (${characterId}.${field})`);
        relicTags.push({ field, code });
        addTerm(terms, code, 'relic_tag', text(entry.Text), text(entry.TextIntroduce));
      }
    }

    const tea = teaFor(characterId, raw, units, terms, sharedResult);
    if (tea && (tea.topics.length !== 8 || tea.branches.length !== 2 || tea.branches.some((br) => br.next.length !== 2))) teaOdd.push(characterId);
    if (units.some((u) => u.unitKey === 'tea.result')) teaOwnResult.push(characterId);

    const organisationCode = text((raw.characterTable[characterId] || {}).typeJJh) || null;
    if (organisationCode) {
      const org = raw.typeJJHMap[organisationCode];
      if (!org) throw new Error(`TypeJJHMap has no entry ${organisationCode} (${characterId})`);
      addTerm(terms, `ORG_${organisationCode}`, 'organisation', text(org.NameLanText), text(org.FileLanText));
    }

    const profile = {
      characterId,
      recordId: text(file.recordID),
      staffStatusCn: text(file.stafflanText),
      storeStatusCn: text(file.storelanText),
      organisationCode,
      relicTypeCode: text(relic?.relics) || null,
      eraCode: text(relic?.dynasty) || null,
      museumCode: text(relic?.museum) || null,
      eraRangeCode: text(relic?.photoDynasty) || null,
      legacyRelicFields: {
        hasEntry: Boolean(relic),
        relicName: text(relic?.relicslanText),
        dynasty: text(relic?.dynastylanText),
        museum: text(relic?.museumlanText),
      },
      // relicTags only when present, so profiles without tags keep their source hash
      structure: { reports, timeline, ...(relicTags.length ? { relicTags } : {}), ...(tea ? { tea } : {}) },
      units,
    };
    const { units: _u, ...structural } = profile;
    profiles.push({ ...profile, sourceHash: hashValue(structural) });
  }

  // Spec §3.4: all affinity levels are imported, not only the referenced ones.
  for (const [level, friend] of Object.entries(raw.friendshipDescription)) {
    addTerm(terms, `AFFINITY_${level}`, 'affinity_level', text(friend.iconDescriptionLanText), text(friend.descriptionLanText));
  }

  if (raw.highteaCharacterMap && Object.keys(raw.highteaCharacterMap).length) {
    for (const [code, cn] of TEA_STAGES) addTerm(terms, code, 'tea_text', cn, '');
    if (sharedResult) addTerm(terms, 'TEA_RESULT', 'tea_text', sharedResult, '');
  }

  return { profiles, terms: [...terms.values()].sort((a, b) => a.code.localeCompare(b.code)), skipped, missingFromRaw, teaOdd, teaOwnResult };
}

function addTerm(terms, code, kind, nameCn, detailCn) {
  if (!terms.has(code)) terms.set(code, { code, kind, nameCn, detailCn, sourceHash: hashValue({ nameCn, detailCn }) });
}
