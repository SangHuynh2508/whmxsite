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

function unit(units, unitKey, sourceCn, sourceRef) {
  if (sourceCn) units.push({ unitKey, sourceCn, sourceRef, sourceHash: sha256(sourceCn) });
}

export function normalizeProfileSources(raw, characterIds) {
  const wanted = new Set(characterIds);
  const skipped = Object.keys(raw.characterFiles).filter((id) => !wanted.has(id)).sort();
  const terms = new Map();
  const profiles = [];
  const missingFromRaw = [...wanted].filter((id) => !raw.characterFiles[id]).sort();

  for (const characterId of [...wanted].sort()) {
    if (!raw.characterFiles[characterId]) continue;
    const file = raw.characterFiles[characterId] || {};
    const relic = raw.historicalRelicsMap[characterId];
    const units = [];
    unit(units, 'card_intro', text(file.cardIntrolanText), `characterFiles:${characterId}.cardIntrolanText`);

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
    }

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
      structure: { reports, timeline },
      units,
    };
    const { units: _u, ...structural } = profile;
    profiles.push({ ...profile, sourceHash: hashValue(structural) });
  }

  // Spec §3.4: all affinity levels are imported, not only the referenced ones.
  for (const [level, friend] of Object.entries(raw.friendshipDescription)) {
    addTerm(terms, `AFFINITY_${level}`, 'affinity_level', text(friend.iconDescriptionLanText), text(friend.descriptionLanText));
  }

  return { profiles, terms: [...terms.values()].sort((a, b) => a.code.localeCompare(b.code)), skipped, missingFromRaw };
}

function addTerm(terms, code, kind, nameCn, detailCn) {
  if (!terms.has(code)) terms.set(code, { code, kind, nameCn, detailCn, sourceHash: hashValue({ nameCn, detailCn }) });
}
