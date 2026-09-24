#!/usr/bin/env node
/**
 * Read-only, character-atomic translation packet exporter.
 *
 * The master workbook and MasterData JSON are never written.  This module is
 * intentionally self-contained so future batches can be built with either
 * explicit IDs or the review-existing-VI selection policy.
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, "..");
const REPO = path.resolve(PROJECT, "..");
const MASTER_DEFAULT = path.join(PROJECT, "localization", "localization_master.xlsx");
const GAMEPLAY_DEFAULT = path.join(PROJECT, "localization", "translation_gameplay.xlsx");
const RAW_DEFAULT = path.join(REPO, "NeoArtifacts", "MasterData", "json");
const OUTPUT_DEFAULT_DIR = path.join(PROJECT, "localization", "reviews");
const BUFF_TAG = /\{(Buff_[^}\s]+)\}/gi;
const TEXT_FIELDS = ["skill_name_cn", "skill_name_vi", "desc_cn", "desc_vi"];

function clean(value) { return String(value ?? "").trim(); }
function key(value) { return clean(value).toUpperCase(); }
function hasValue(value) { return clean(value) !== ""; }
function truthyFlag(value) { return value === true || value === 1 || clean(value).toLowerCase() === "true" || clean(value) === "1"; }
function asList(value) { return Array.isArray(value) ? value : value == null || value === "" ? [] : [value]; }
function hasAnyValue(value) { return asList(value).some(hasValue); }
function unique(values) { return [...new Set(values.filter(Boolean))]; }
function tagsIn(value) {
  const found = [];
  const walk = (item) => {
    if (typeof item === "string") for (const match of item.matchAll(BUFF_TAG)) found.push(key(match[1]));
    else if (Array.isArray(item)) item.forEach(walk);
    else if (item && typeof item === "object") Object.values(item).forEach(walk);
  };
  walk(value);
  return unique(found);
}
function plainCell(value) {
  if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value ?? "";
  if (value instanceof Date) return value.toISOString();
  // Imported rich-text cells can be represented as objects.  Packet cells are
  // text-only, so retain their visible text rather than passing an opaque
  // object into artifact-tool's value serializer.
  if (typeof value === "object" && typeof value.text === "string") return value.text;
  if (typeof value === "object" && typeof value.value === "string") return value.value;
  return JSON.stringify(value);
}
function objectRows(rows) {
  const [headers = [], ...body] = rows;
  return body.filter((r) => r.some((v) => v !== null && v !== "")).map((r) =>
    Object.fromEntries(headers.map((h, i) => [clean(h), plainCell(r[i])])));
}
function isTranslated(value) { return hasValue(value); }
function cnTextLength(record) {
  return Object.entries(record).filter(([name]) => name.endsWith("_cn")).reduce((n, [, value]) => n + clean(value).length, 0);
}

async function readWorkbookRows(file, neededSheets) {
  const book = await SpreadsheetFile.importXlsx(await FileBlob.load(file));
  const result = {};
  for (const name of neededSheets) {
    const sheet = book.worksheets.getItem(name);
    result[name] = objectRows(sheet.getUsedRange().values);
  }
  return result;
}
async function readJson(directory, filename) {
  return JSON.parse(await fs.readFile(path.join(directory, filename), "utf8"));
}
export async function loadData({ master, gameplay, rawDir }) {
  const sheets = await readWorkbookRows(master, ["CHARACTER", "SKILL", "BUFF_STATUS", "HUANZHANG", "ZHIZHI"]);
  const gameplayRows = await readWorkbookRows(gameplay, ["SKILL_BUFF_LINKS"]);
  const names = ["characterTable.json", "skillMap.json", "characterSkillMap.json", "characterPassiveSkillMap.json", "roleattrMap.json", "BrilliantMap.json", "BrilliantUpMap.json", "buffMap.json", "actor.json"];
  const raw = Object.fromEntries(await Promise.all(names.map(async (name) => [name, await readJson(rawDir, name)])));
  return { ...sheets, skillBuffLinks: gameplayRows.SKILL_BUFF_LINKS, raw };
}

function rawGroupsForCharacter(data, characterId) {
  const cid = key(characterId);
  const groups = new Set();
  const baseToEx = new Map();
  const zhizhiExByBase = new Map();
  for (const row of data.ZHIZHI || []) if (key(row.character_id) === cid) {
    const base = key(row.skill_up_base_id); const ex = key(row.skill_up_ex_id);
    if (base && ex) zhizhiExByBase.set(base, ex);
  }
  const character = data.raw["characterTable.json"][cid] || data.raw["characterTable.json"][characterId] || {};
  // characterTable.skillN is a two-element [skillId, unlockedFlag] tuple.
  // The flag is not a relation and must never be treated as a skill ID.
  for (let slot = 1; slot <= 6; slot += 1) {
    const rawSlot = character[`skill${slot}`];
    const id = Array.isArray(rawSlot) ? rawSlot[0] : rawSlot;
    if (hasValue(id)) groups.add(key(id));
  }
  const roleattrs = data.raw["roleattrMap.json"];
  for (let star = 1; star <= 6; star += 1) {
    const entry = roleattrs[`${cid}${star}`] || {};
    for (const value of [...asList(entry.starUpAttr), ...asList(entry.starUpAttr2)]) {
      if (typeof value === "string" && value.startsWith("SkillUP,")) {
        const base = key(value.split(",", 2)[1]);
        if (base) {
          const ex = zhizhiExByBase.get(base) || `${base}EX`;
          groups.add(base); groups.add(ex); baseToEx.set(base, ex);
        }
      }
    }
  }
  // Zhizhi is an explicit player upgrade relation. It remains authoritative
  // even when a legacy roleattr record is absent.
  for (const [base, ex] of zhizhiExByBase) {
    groups.add(base); groups.add(ex); baseToEx.set(base, ex);
  }
  return { groups, baseToEx };
}

// Character skill maps are raw-record inventories. They preserve evidence for
// diagnostics but do not, on their own, establish player-facing eligibility.
function rawMapInventoryForCharacter(data, characterId) {
  const cid = key(characterId); const byGroup = new Map();
  for (const mapName of ["characterSkillMap.json", "characterPassiveSkillMap.json"]) {
    for (const [recordId, entry] of Object.entries(data.raw[mapName] || {})) {
      if (!entry || key(entry.HeroId) !== cid || truthyFlag(entry.IsConceal) || !hasValue(entry.GroupId)) continue;
      const group = key(entry.GroupId);
      if (!byGroup.has(group)) byGroup.set(group, { group_id: group, source_tables: new Set(), records: [] });
      const item = byGroup.get(group);
      item.source_tables.add(mapName);
      item.records.push({ record_id: recordId, type: entry.Type ?? "", level: entry.Level ?? "", name_cn: clean(entry.NameLanText), desc_cn: clean(entry.DescriptionLanText) });
    }
  }
  return [...byGroup.values()].map((item) => ({ ...item, source_tables: [...item.source_tables] }));
}

function actorGroupsForCharacter(data, characterId) {
  const cid = key(characterId); const groups = new Set();
  for (const actor of Object.values(data.raw["actor.json"] || {})) if (actor && key(actor.CharacterId) === cid) {
    for (let slot = 1; slot <= 6; slot += 1) {
      const rawSlot = actor[`Skill${slot}`];
      const id = Array.isArray(rawSlot) ? rawSlot[0] : rawSlot;
      if (hasValue(id)) groups.add(key(id));
    }
  }
  return groups;
}

function sameSkillPayload(left, right) {
  const normalized = (records) => records.map((r) => [clean(r.name_cn), clean(r.desc_cn), clean(r.type), clean(r.level)].join("\u0000")).sort();
  const a = normalized(left.records); const b = normalized(right.records);
  return a.length > 0 && a.length === b.length && a.every((value, index) => value === b[index]);
}

function nonBlockingRawGroups(data, characterId, requiredGroups) {
  const inventory = rawMapInventoryForCharacter(data, characterId);
  const direct = inventory.filter((item) => requiredGroups.has(item.group_id));
  const actorGroups = actorGroupsForCharacter(data, characterId);
  return inventory.filter((item) => !requiredGroups.has(item.group_id)).map((item) => {
    const canonical = direct.find((candidate) => sameSkillPayload(item, candidate));
    const actorSelected = actorGroups.has(item.group_id);
    return {
      group_id: item.group_id,
      classification: actorSelected && canonical ? "DERIVED_RUNTIME_ALIAS" : "UNLINKED_RAW_ORPHAN",
      actor_selected: actorSelected,
      canonical_group_id: canonical?.group_id || "",
      source_tables: item.source_tables,
      has_cn_source: item.records.some((record) => hasValue(record.name_cn) || hasValue(record.desc_cn)),
      records: item.records,
    };
  });
}

function huanzhangForCharacter(data, characterId) {
  const cid = key(characterId);
  const records = data.HUANZHANG.filter((row) => key(row.character_id) === cid);
  const groups = new Set(); const buffs = new Set(); const evidence = []; const rawDependencies = []; const displayRequirements = [];
  const source = data.raw["BrilliantMap.json"] || {};
  for (const hz of records) {
    const raw = source[clean(hz.brilliant_id)] || source[key(hz.brilliant_id)] || {};
    const displayFields = ["IconNameLanText", "IconInfoLanText", "BuffShow", "BuffShowLanText"];
    const gameplayFields = ["Skill1", "Skill2"];
    displayRequirements.push({
      brilliant_id: clean(hz.brilliant_id),
      required_by_raw_source: [...displayFields, ...gameplayFields].some((field) => hasAnyValue(raw[field])),
      non_empty_fields: [...displayFields, ...gameplayFields].filter((field) => hasAnyValue(raw[field])),
    });
    for (const field of ["Skill1", "Skill2"]) for (const value of asList(raw[field])) {
      if (hasValue(value)) { groups.add(key(value)); evidence.push({ skill_id: key(value), field }); }
    }
    for (const field of ["Buff", "BuffUp"]) for (const value of asList(raw[field])) if (hasValue(value)) {
      const rawId = clean(value); const rawBuff = (data.raw["buffMap.json"] || {})[rawId];
      // Brilliant IDs are not BUFF_STATUS IDs. Only a raw identity that is
      // independently present as the same exact BUFF_STATUS ID may become a
      // display dependency; otherwise retain provenance without blocking.
      const exactDisplay = data.BUFF_STATUS.some((row) => key(row.buff_id) === key(rawId));
      if (rawBuff && exactDisplay) buffs.add(key(rawId));
      rawDependencies.push({ raw_dependency_id: rawId, relation_type: rawBuff ? (exactDisplay ? "HUANZHANG_PLAYER_BUFF" : "HUANZHANG_INTERNAL_BUFF_CONTROLLER") : "HUANZHANG_UNRESOLVED_RAW_EFFECT", source_table: "BrilliantMap.json → buffMap.json", resolution_path: `BrilliantMap:${clean(hz.brilliant_id)}.${field} → ${rawBuff ? `buffMap:${rawId}` : `buffMap:MISSING:${rawId}`}${exactDisplay ? ` → BUFF_STATUS:${rawId}` : ""}` });
    }
    for (const buff of tagsIn(raw)) buffs.add(buff);
  }
  return { records, groups, buffs, evidence, rawDependencies, displayRequirements };
}

function relevantSkills(data, characterId, groups) {
  const cid = key(characterId);
  return data.SKILL.filter((row) => key(row.character_id) === cid || groups.has(key(row.skill_group_id)) || groups.has(key(row.skill_id)));
}
function exactBuffRelations(data, characterId, skillIds, skills, hZ) {
  const cid = key(characterId);
  const relations = [];
  const add = (character_id, skill_id, buff_id, relation_type, source_table, evidence) => {
    if (buff_id) relations.push({ character_id, skill_id, buff_id: key(buff_id), relation_type, source_table, source_evidence: evidence });
  };
  for (const link of data.skillBuffLinks || []) {
    const sid = key(link.skill_id); const bid = key(link.buff_id);
    // The relational workbook distinguishes visible description tags from raw
    // implementation attributes. Only skill_desc_tag is player-facing source
    // evidence; skill_attr_ref is an internal controller reference and must
    // not turn an absent BUFF_STATUS row into a closure failure.
    if (bid && clean(link.relationship_source) === "skill_desc_tag" && (key(link.character_id) === cid || skillIds.has(sid))) add(cid, sid, bid, "SKILL_BUFF_LINK", "translation_gameplay.xlsx:SKILL_BUFF_LINKS", `relationship_source=skill_desc_tag; character_id=${clean(link.character_id)}; skill_id=${clean(link.skill_id)}`);
  }
  for (const skill of skills) for (const field of TEXT_FIELDS) for (const bid of tagsIn(skill[field])) {
    add(cid, key(skill.skill_id), bid, "SKILL_TEXT_TAG", "localization_master.xlsx:SKILL", `${field} exact {${bid}} tag`);
  }
  for (const bid of hZ.buffs) add(cid, "", bid, "HUANZHANG_RAW_BUFF", "BrilliantMap.json", "Buff/BuffUp or exact {Buff_*} tag");
  return relations;
}
function closeBuffs(data, directRelations) {
  const byId = new Map(data.BUFF_STATUS.map((row) => [key(row.buff_id), row]));
  const pending = directRelations.map((r) => r.buff_id); const seen = new Set(); const records = [];
  const transitive = [];
  while (pending.length) {
    const bid = key(pending.shift()); if (!bid || seen.has(bid)) continue;
    seen.add(bid); const buff = byId.get(bid);
    if (!buff) continue;
    records.push(buff);
    for (const field of ["buff_name_cn", "buff_name_vi", "buff_desc_cn", "buff_desc_vi"]) for (const child of tagsIn(buff[field])) {
      transitive.push({ parent: bid, buff_id: child, field }); pending.push(child);
    }
  }
  return { records, found: seen, transitive, missing: [...seen].filter((id) => !byId.has(id)) };
}
function displaySkillType(row) { return clean(row.type_label) || clean(row.skill_slot) || "UNCLASSIFIED"; }
function variantRelation(row, baseToEx, hZGroups) {
  const sid = key(row.skill_id); const group = key(row.skill_group_id);
  for (const [base, ex] of baseToEx.entries()) if (sid === ex || group === ex) return `EX of ${base} (roleattrMap SkillUP)`;
  if (hZGroups.has(sid) || hZGroups.has(group)) return "Hoán Chương gameplay skill (BrilliantMap Skill1/Skill2)";
  return group && group !== sid ? `Group ${group}` : "Base/direct character skill";
}

export function buildCharacterClosure(data, characterId) {
  const cid = key(characterId);
  const character = data.CHARACTER.find((row) => key(row.character_id) === cid);
  if (!character) throw new Error(`Character ${cid} is missing from CHARACTER.`);
  const { groups, baseToEx } = rawGroupsForCharacter(data, cid);
  const hZ = huanzhangForCharacter(data, cid);
  hZ.groups.forEach((id) => groups.add(id));
  const nonBlockingRaw = nonBlockingRawGroups(data, cid, groups);
  const skills = relevantSkills(data, cid, groups);
  const skillIds = new Set(skills.map((row) => key(row.skill_id)));
  const directRelations = exactBuffRelations(data, cid, skillIds, skills, hZ);
  const buffClosure = closeBuffs(data, directRelations);
  const availableSkillKeys = new Set(skills.flatMap((row) => [key(row.skill_id), key(row.skill_group_id)]));
  const missingExpectedGroups = [...groups].filter((id) => id && !availableSkillKeys.has(id));
  const requiredEx = [...baseToEx.values()];
  const missingEx = requiredEx.filter((id) => !availableSkillKeys.has(id));
  const missingHzSkills = [...hZ.groups].filter((id) => id && !availableSkillKeys.has(id));
  const directBuffIds = new Set(directRelations.map((r) => r.buff_id));
  const dependencies = [...directRelations, ...hZ.rawDependencies.map((edge) => ({ character_id: cid, skill_id: "", buff_id: "", resolved_buff_status_id: edge.relation_type === "HUANZHANG_PLAYER_BUFF" ? edge.raw_dependency_id : "", raw_dependency_id: edge.raw_dependency_id, display_scope: edge.relation_type, relation_type: edge.relation_type, source_table: edge.source_table, source_evidence: edge.resolution_path, resolution_path: edge.resolution_path }))];
  for (const edge of buffClosure.transitive) for (const relation of directRelations.filter((r) => r.buff_id === edge.parent)) {
    dependencies.push({ ...relation, buff_id: edge.buff_id, relation_type: "BUFF_TRANSITIVE_TAG", source_table: "localization_master.xlsx:BUFF_STATUS", source_evidence: `${edge.parent}.${edge.field} exact {${edge.buff_id}} tag` });
  }
  const hasHz = hZ.records.length > 0;
  const hZRequirementById = new Map(hZ.displayRequirements.map((item) => [key(item.brilliant_id), item]));
  const loreComplete = !hasHz || hZ.records.every((row) => {
    const requirement = hZRequirementById.get(key(row.brilliant_id));
    if (!requirement?.required_by_raw_source) return true;
    return hasValue(row.icon_name_cn) || hasValue(row.icon_info_cn) || hasValue(row.buff_show_cn);
  });
  const flags = {
    skill_closure: missingExpectedGroups.length === 0 ? "PASS" : "FAIL",
    ex_closure: missingEx.length === 0 ? "PASS" : "FAIL",
    buff_closure: buffClosure.missing.length === 0 ? "PASS" : "FAIL",
    huanzhang_closure: !hasHz ? "NOT_APPLICABLE" : (missingHzSkills.length === 0 && loreComplete ? "PASS" : "FAIL"),
  };
  const complete = Object.values(flags).every((v) => v === "PASS" || v === "NOT_APPLICABLE");
  const fullyReviewed = skills.length > 0 && skills.every((row) => ["CHATGPT_REVIEWED", "OWNER_APPROVED"].includes(clean(row.translation_review_status))) && (!hZ.records.length || hZ.records.every((row) => ["CHATGPT_REVIEWED", "OWNER_APPROVED"].includes(clean(row.translation_review_status))));
  const isEx = (row) => [...baseToEx.values()].includes(key(row.skill_id)) || [...baseToEx.values()].includes(key(row.skill_group_id));
  return { cid, character, skills, buffs: buffClosure.records, huanzhang: hZ.records, dependencies, directBuffIds, requiredEx, exByBase: baseToEx, hZGroups: hZ.groups, flags, complete, fullyReviewed, diagnostics: { missingExpectedGroups, missingEx, missingHzSkills, missingBuffs: buffClosure.missing, nonBlockingRawGroups: nonBlockingRaw, huanzhangDisplayRequirements: hZ.displayRequirements } , isEx };
}

function existingViScore(closure) {
  const translatedSkills = closure.skills.filter((r) => isTranslated(r.skill_name_vi) || isTranslated(r.desc_vi)).length;
  const hZTranslated = closure.huanzhang.filter((r) => isTranslated(r.icon_name_vi) || isTranslated(r.icon_info_vi) || isTranslated(r.buff_show_vi)).length;
  return { translatedSkills, hZTranslated, total: translatedSkills * 1000 + hZTranslated * 100 + closure.skills.length };
}
function translationUnits(closure) {
  const units = new Map();
  for (const row of closure.skills) {
    const ex = closure.isEx(row) ? "EX" : "BASE";
    const hz = closure.hZGroups.has(key(row.skill_id)) || closure.hZGroups.has(key(row.skill_group_id)) ? "HZ" : "NORMAL";
    const unitKey = [clean(row.skill_name_cn), clean(row.desc_cn), ex, hz].join("\u0000");
    if (!units.has(unitKey)) units.set(unitKey, { key: unitKey, cnChars: clean(row.skill_name_cn).length + clean(row.desc_cn).length });
  }
  return units;
}
function rawPacketCnChars(closure) { return cnTextLength(closure.character) + closure.skills.reduce((n, r) => n + cnTextLength(r), 0) + closure.buffs.reduce((n, r) => n + cnTextLength(r), 0) + closure.huanzhang.reduce((n, r) => n + cnTextLength(r), 0); }
function diagnosticFor(closure) {
  const score = existingViScore(closure); const units = translationUnits(closure);
  const blockingDiagnostics = { missingExpectedGroups: closure.diagnostics.missingExpectedGroups, missingEx: closure.diagnostics.missingEx, missingHzSkills: closure.diagnostics.missingHzSkills, missingBuffs: closure.diagnostics.missingBuffs };
  return { character_id: closure.cid, existing_vi_skill_rows: score.translatedSkills, total_skill_rows: closure.skills.length, existing_vi_skill_ratio: closure.skills.length ? score.translatedSkills / closure.skills.length : 0, existing_vi_huanzhang_rows: score.hZTranslated, has_huanzhang: closure.huanzhang.length ? "YES" : "NO", atomic_closure: closure.complete ? "PASS" : "FAIL", skill_closure: closure.flags.skill_closure, ex_closure: closure.flags.ex_closure, buff_closure: closure.flags.buff_closure, huanzhang_closure: closure.flags.huanzhang_closure, raw_skill_rows: closure.skills.length, translation_unit_count: units.size, unique_buff_count: closure.buffs.length, unresolved_buff_count: closure.diagnostics.missingBuffs.length, non_blocking_raw_groups: closure.diagnostics.nonBlockingRawGroups, huanzhang_display_requirements: closure.diagnostics.huanzhangDisplayRequirements, translation_cn_chars: [...units.values()].reduce((n, u) => n + u.cnChars, 0) + closure.huanzhang.reduce((n, r) => n + cnTextLength(r), 0), raw_packet_cn_chars: rawPacketCnChars(closure), closure_failure_reason: Object.entries(blockingDiagnostics).filter(([, v]) => v.length).map(([k, v]) => `${k}=${v.join(",")}`).join("; "), selection_result: "", selection_reason: "" };
}
export function selectAtomicBatch(closures, limits) {
  const selected = []; const usedBuffs = new Set(); const usedUnits = new Set(); const diagnostics = closures.map(diagnosticFor); let counts = { exactSkillRows: 0, translationUnits: 0, buffsRequiringReview: 0, cnChars: 0, rawPacketCnChars: 0 };
  const byId = new Map(diagnostics.map((d) => [d.character_id, d]));
  const excluded = limits.excludeCharacterIds instanceof Set ? limits.excludeCharacterIds : new Set((limits.excludeCharacterIds || []).map(key));
  for (const closure of closures) {
    const diag = byId.get(closure.cid); const eligible = !limits.preferExistingVi || diag.existing_vi_skill_rows > 0 || diag.existing_vi_huanzhang_rows > 0;
    if (excluded.has(closure.cid)) { diag.selection_result = "EXCLUDED_PRIOR_BATCH"; diag.selection_reason = "Character completed in prior translation batch"; continue; }
    if (!closure.complete) { diag.selection_result = "CLOSURE_FAILED"; diag.selection_reason = diag.closure_failure_reason || "Atomic closure failed"; continue; }
    if (limits.preferExistingVi && !limits.explicitCharacterIds && closure.fullyReviewed) { diag.selection_result = "ALREADY_CHATGPT_REVIEWED"; diag.selection_reason = "All included SKILL and Hoán Chương rows carry CHATGPT_REVIEWED or stronger status"; continue; }
    if (!eligible) { diag.selection_result = "INELIGIBLE_NO_EXISTING_VI"; diag.selection_reason = "No existing SKILL or Hoán Chương Vietnamese text"; continue; }
    if (selected.length >= limits.targetCharacters) { diag.selection_result = "TARGET_ALREADY_FILLED"; diag.selection_reason = "Target character count reached"; continue; }
    const unitMap = translationUnits(closure); const newUnits = [...unitMap.values()].filter((u) => !usedUnits.has(u.key)); const newBuffs = closure.buffs.filter((b) => !usedBuffs.has(key(b.buff_id)));
    const marginalChars = newUnits.reduce((n, u) => n + u.cnChars, 0) + newBuffs.reduce((n, b) => n + clean(b.buff_name_cn).length + clean(b.buff_desc_cn).length, 0) + closure.huanzhang.reduce((n, r) => n + cnTextLength(r), 0);
    const next = { exactSkillRows: counts.exactSkillRows + closure.skills.length, translationUnits: counts.translationUnits + newUnits.length, buffsRequiringReview: counts.buffsRequiringReview + newBuffs.filter((b) => ["REVIEW_EXISTING", "NEEDS_TRANSLATION"].includes(buffAction(b))).length, cnChars: counts.cnChars + marginalChars, rawPacketCnChars: counts.rawPacketCnChars + rawPacketCnChars(closure) };
    const exceeds = next.translationUnits > limits.maxTranslationUnits || next.buffsRequiringReview > limits.maxBuffsRequiringReview || next.cnChars > limits.maxCnChars;
    if (exceeds && !limits.explicitSingle) { diag.selection_result = "OVERSIZED"; diag.selection_reason = selected.length ? "DEFERRED_COST: marginal complete closure exceeds soft cap" : "OVERSIZED: complete closure exceeds soft cap"; continue; }
    selected.push({ closure, oversized: exceeds }); diag.selection_result = exceeds ? "OVERSIZED" : "SELECTED"; diag.selection_reason = selectionReason(closure);
    newUnits.forEach((u) => usedUnits.add(u.key)); newBuffs.forEach((b) => usedBuffs.add(key(b.buff_id))); counts = next;
  }
  return { selected, counts, uniqueBuffs: usedBuffs, diagnostics, targetCharacters: limits.targetCharacters };
}
function buffAction(row) {
  if (clean(row.name_authority) === "OWNER_APPROVED") return "LOCKED_REFERENCE";
  if (clean(row.name_authority) === "CHATGPT_REVIEWED") return "REVIEWED_REFERENCE";
  return isTranslated(row.buff_name_vi) || isTranslated(row.buff_desc_vi) ? "REVIEW_EXISTING" : "NEEDS_TRANSLATION";
}
function selectionReason(closure) {
  const score = existingViScore(closure);
  return `Existing VI skill rows=${score.translatedSkills}; translated/partial Hoán Chương rows=${score.hZTranslated}; complete atomic closure`;
}
function canonicalTermContext(closure, row) {
  const terms = new Map();
  for (const buff of closure.buffs) if (["OWNER_APPROVED", "CHATGPT_REVIEWED"].includes(clean(buff.name_authority)) && hasValue(buff.buff_name_cn) && hasValue(buff.buff_name_vi)) {
    const cn = clean(buff.buff_name_cn); const prior = terms.get(cn); terms.set(cn, prior === undefined ? clean(buff.buff_name_vi) : prior === clean(buff.buff_name_vi) ? prior : "");
  }
  const text = `${clean(row.skill_name_cn)}\n${clean(row.desc_cn)}`;
  return [...terms.entries()].filter(([cn, vi]) => vi && text.includes(cn)).map(([cn, vi]) => `${cn} → ${vi}`).join("; ");
}
export function buildCanonicalCharacterRegistry(characterRows) {
  const seen = new Map();
  for (const row of characterRows || []) {
    for (const [cnRaw, viRaw] of [[row.name_cn, row.name_vi], [row.fullname_cn, row.fullname_vi]]) {
      if (!hasValue(cnRaw) || !hasValue(viRaw)) continue;
      const cn = clean(cnRaw); const vi = clean(viRaw);
      const values = seen.get(cn) || new Set();
      values.add(vi);
      seen.set(cn, values);
    }
  }
  const mappings = new Map(); const ambiguities = [];
  for (const [cn, values] of seen.entries()) {
    if (values.size === 1) mappings.set(cn, [...values][0]);
    else ambiguities.push({ cn, vi_values: [...values].sort() });
  }
  return { mappings, ambiguities };
}
export function canonicalCharacterContext(registry, ...sourceValues) {
  // This is advisory packet context, not a dependency edge. It scans exact,
  // unambiguous CHARACTER names globally and never guesses Hán-Việt from text.
  const source = sourceValues.map(clean).join("\n");
  return [...(registry?.mappings || new Map()).entries()].filter(([cn, vi]) => vi && source.includes(cn)).map(([cn, vi]) => `${cn} → ${vi}`).join("; ");
}
function packetRows(batch, batchId, characterRows = []) {
  const selected = batch.selected.map((entry) => entry.closure);
  const characterRegistry = buildCanonicalCharacterRegistry(characterRows);
  const buffMap = new Map(); const usedBy = new Map();
  for (const closure of selected) for (const relation of closure.dependencies) {
    const use = usedBy.get(relation.buff_id) || { characters: new Set(), skills: new Set(), usages: new Set() };
    use.characters.add(closure.cid); if (relation.skill_id) use.skills.add(relation.skill_id); use.usages.add(relation.relation_type); usedBy.set(relation.buff_id, use);
  }
  for (const closure of selected) for (const buff of closure.buffs) buffMap.set(key(buff.buff_id), buff);
  const characters = selected.map((c) => ({
    character_id: c.cid, character_name_cn: c.character.name_cn, character_name_vi: c.character.name_vi,
    translation_status_context: c.character.status, has_huanzhang: c.huanzhang.length ? "YES" : "NO", skill_count: c.skills.length,
    unique_buff_dependency_count: new Set(c.dependencies.map((d) => d.buff_id)).size, selection_reason: selectionReason(c),
  }));
  const skills = selected.flatMap((c) => c.skills.map((row) => ({
    character_id: c.cid, skill_id: row.skill_id, skill_type: displaySkillType(row), variant_relation: variantRelation(row, c.exByBase, c.hZGroups),
    is_ex: c.isEx(row) ? "YES" : "NO", is_huanzhang_skill: c.hZGroups.has(key(row.skill_id)) || c.hZGroups.has(key(row.skill_group_id)) ? "YES" : "NO",
    skill_name_cn: row.skill_name_cn, skill_name_vi_current: row.skill_name_vi, desc_cn: row.desc_cn, desc_vi_current: row.desc_vi,
    referenced_buff_ids: unique(c.dependencies.filter((d) => d.skill_id === key(row.skill_id)).map((d) => d.buff_id)).join(", "),
    canonical_term_context: canonicalTermContext(c, row),
    canonical_character_context: canonicalCharacterContext(characterRegistry, row.skill_name_cn, row.desc_cn),
    translation_action: isTranslated(row.skill_name_vi) || isTranslated(row.desc_vi) ? "REVIEW_EXISTING" : "NEEDS_TRANSLATION", proposed_vi_name: "", proposed_vi_desc: "", translator_notes: "",
  })));
  const buffs = [...buffMap.values()].sort((a, b) => key(a.buff_id).localeCompare(key(b.buff_id))).map((row) => {
    const use = usedBy.get(key(row.buff_id)) || { characters: new Set(), skills: new Set(), usages: new Set() };
    return { buff_id: row.buff_id, buff_name_cn: row.buff_name_cn, buff_name_vi: row.buff_name_vi, name_authority: row.name_authority,
      buff_desc_cn: row.buff_desc_cn, buff_desc_vi: row.buff_desc_vi, desc_translation_status: row.desc_translation_status, desc_translation_source: row.desc_translation_source,
      dependency_usage: [...use.usages].join(", "), referenced_by_character_ids: [...use.characters].join(", "), referenced_by_skill_ids: [...use.skills].join(", "), translation_action: buffAction(row), proposed_vi_name: "", proposed_vi_desc: "", translator_notes: "" };
  });
  const huanzhang = selected.flatMap((c) => c.huanzhang.map((row) => ({
    character_id: c.cid, huanzhang_id: row.brilliant_id, title_name_cn: row.icon_name_cn, title_name_vi_current: row.icon_name_vi,
    full_cn_lore_story: row.icon_info_cn, current_vi_lore_story: row.icon_info_vi, buff_show_cn: row.buff_show_cn, buff_show_vi_current: row.buff_show_vi,
    canonical_character_context: canonicalCharacterContext(characterRegistry, row.icon_name_cn, row.icon_info_cn, row.buff_show_cn),
    related_skill_ids: c.skills.filter((s) => c.hZGroups.has(key(s.skill_id)) || c.hZGroups.has(key(s.skill_group_id))).map((s) => s.skill_id).join(", "),
    related_buff_ids: unique(c.dependencies.filter((d) => !d.skill_id).map((d) => d.buff_id)).join(", "), proposed_vi_title: "", proposed_vi_lore: "", translator_notes: "" })));
  const validation = selected.map((c) => ({ character_id: c.cid, skill_closure: c.flags.skill_closure, ex_closure: c.flags.ex_closure, buff_closure: c.flags.buff_closure, huanzhang_closure: c.flags.huanzhang_closure, missing_expected_skill_ids: c.diagnostics.missingExpectedGroups.join(", "), missing_ex_skill_ids: c.diagnostics.missingEx.join(", "), missing_huanzhang_skill_ids: c.diagnostics.missingHzSkills.join(", "), missing_buff_ids: c.diagnostics.missingBuffs.join(", "), atomic_closure: c.complete ? "PASS" : "FAIL" }));
  const locked = buffs.filter((b) => b.translation_action === "LOCKED_REFERENCE").length;
  const reviewedReference = buffs.filter((b) => b.translation_action === "REVIEWED_REFERENCE").length;
  const reviewExisting = buffs.filter((b) => b.translation_action === "REVIEW_EXISTING").length;
  const needsTranslation = buffs.filter((b) => b.translation_action === "NEEDS_TRANSLATION").length;
  const count = (result) => batch.diagnostics.filter((d) => d.selection_result === result).length;
  const summary = [{ batch_id: batchId, selection_strategy: "review-existing-VI eligibility; Hoán Chương-first ordering; first-fit complete closures with marginal costs", character_count: selected.length, characters_with_existing_skill_vi: selected.filter((c) => existingViScore(c).translatedSkills).length, characters_with_existing_huanzhang_vi: selected.filter((c) => existingViScore(c).hZTranslated).length, huanzhang_character_count: selected.filter((c) => c.huanzhang.length).length, exact_skill_rows: skills.length, unique_skill_translation_units: batch.counts.translationUnits, unique_buff_count: buffs.length, locked_buff_count: locked, reviewed_reference_buff_count: reviewedReference, review_existing_buff_count: reviewExisting, needs_translation_buff_count: needsTranslation, buffs_requiring_translation_review: reviewExisting + needsTranslation, translation_cn_chars: batch.counts.cnChars, raw_packet_cn_chars: batch.counts.rawPacketCnChars, eligible_candidate_count: batch.diagnostics.filter((d) => d.existing_vi_skill_rows || d.existing_vi_huanzhang_rows).length, closure_failed_candidate_count: count("CLOSURE_FAILED"), cost_deferred_candidate_count: count("OVERSIZED"), oversized_candidate_count: batch.selected.filter((s) => s.oversized).length, canonical_character_ambiguity_count: characterRegistry.ambiguities.length, canonical_character_ambiguities: characterRegistry.ambiguities.map((item) => `${item.cn} → ${item.vi_values.join(" | ")}`).join("; "), underfill_reason: selected.length < batch.targetCharacters ? "All eligible candidates considered; remaining candidates failed closure, lacked existing VI, or exceeded a soft cap." : "", selected_character_ids: selected.map((c) => c.cid).join(", ") }];
  return { BATCH_SUMMARY: summary, CHARACTERS: characters, BUFFS: buffs, SKILLS: skills, HUANZHANG: huanzhang, DEPENDENCIES: selected.flatMap((c) => c.dependencies), VALIDATION: validation, SELECTION_DIAGNOSTICS: batch.diagnostics };
}
function columnName(index) { let n = index + 1; let out = ""; while (n) { const rem = (n - 1) % 26; out = String.fromCharCode(65 + rem) + out; n = Math.floor((n - 1) / 26); } return out; }
async function writePacket(rowsBySheet, output) {
  const book = Workbook.create();
  for (const [name, rows] of Object.entries(rowsBySheet)) {
    const sheet = book.worksheets.add(name); const headers = unique(rows.flatMap((row) => Object.keys(row)));
    const values = rows.map((row) => headers.map((h) => plainCell(row[h])));
    const end = columnName(Math.max(0, headers.length - 1));
    // artifact-tool's recursive serializer overflows on large rich-text
    // matrices; bounded block writes retain every row without truncation.
    sheet.getRange(`A1:${end}1`).values = [headers];
    for (let start = 0; start < values.length; start += 40) {
      const chunk = values.slice(start, start + 40);
      sheet.getRange(`A${start + 2}:${end}${start + 1 + chunk.length}`).values = chunk;
    }
    sheet.getRange(`A1:${end}1`).format = { fill: "#1F4E78", font: { name: "Arial", bold: true, color: "#FFFFFF" }, horizontalAlignment: "center", verticalAlignment: "center", wrapText: true };
    sheet.getRange(`A1:${end}${Math.max(1, values.length + 1)}`).format.font = { name: "Arial", size: 10 };
    sheet.getRange(`A1:${end}${Math.max(1, values.length + 1)}`).format.wrapText = true;
    sheet.freezePanes.freezeRows(1);
    for (let i = 0; i < headers.length; i += 1) sheet.getRange(`${columnName(i)}:${columnName(i)}`).format.columnWidth = Math.min(55, Math.max(14, headers[i].length + 3));
    for (const [i, header] of headers.entries()) if (/(desc|lore|story|notes|evidence|info)/i.test(header)) sheet.getRange(`${columnName(i)}:${columnName(i)}`).format.columnWidth = 45;
  }
  book.recalculate();
  const preview = await book.inspect({ kind: "workbook,sheet,table", maxChars: 4000, tableMaxRows: 4, tableMaxCols: 8 });
  if (!preview.ndjson.includes("BATCH_SUMMARY")) throw new Error("Export workbook verification failed: BATCH_SUMMARY missing.");
  await fs.mkdir(path.dirname(output), { recursive: true });
  const blob = await SpreadsheetFile.exportXlsx(book); await blob.save(output);
}
async function writePacketFallback(rowsBySheet, output) {
  const payload = `${output}.payload.json`;
  await fs.writeFile(payload, JSON.stringify(rowsBySheet), "utf8");
  const python = process.env.WHMX_PACKET_PYTHON || "python";
  try {
    await new Promise((resolve, reject) => execFile(python, [path.join(HERE, "write_character_translation_packet.py"), payload, output], { windowsHide: true }, (error, stdout, stderr) => error ? reject(new Error(stderr || error.message)) : resolve(stdout)));
  } finally { await fs.rm(payload, { force: true }); }
}
function parseArgs(argv) {
  const options = { targetCharacters: 20, preferExistingVi: false, characterIds: [], excludeCharacterIds: [], maxTranslationUnits: 180, maxBuffsRequiringReview: 120, maxCnTextChars: 120000, master: MASTER_DEFAULT, gameplay: GAMEPLAY_DEFAULT, rawDir: RAW_DEFAULT, output: "", payloadOutput: "", auditOutput: "" };
  for (let i = 0; i < argv.length; i += 1) { const a = argv[i]; const value = () => argv[++i];
    if (a === "--target-characters") options.targetCharacters = Number(value()); else if (a === "--prefer-existing-vi") options.preferExistingVi = true;
    else if (a === "--character-ids") options.characterIds = value().split(",").map(key).filter(Boolean);
    else if (a === "--exclude-character-ids") options.excludeCharacterIds = value().split(",").map(key).filter(Boolean);
    else if (a === "--output") options.output = value(); else if (a === "--payload-output") options.payloadOutput = value(); else if (a === "--audit-output") options.auditOutput = value();
    else if (a === "--master") options.master = value(); else if (a === "--gameplay") options.gameplay = value(); else if (a === "--raw-dir") options.rawDir = value();
    else if (a === "--soft-max-translation-units") options.maxTranslationUnits = Number(value()); else if (a === "--soft-max-buffs-requiring-review" || a === "--soft-max-unresolved-buff-ids") options.maxBuffsRequiringReview = Number(value()); else if (a === "--soft-max-cn-text-chars") options.maxCnTextChars = Number(value());
    else if (a === "--help") return null; else throw new Error(`Unknown argument: ${a}`);
  } return options;
}
export async function run(options) {
  const data = await loadData(options);
  const ids = options.characterIds.length ? options.characterIds : data.CHARACTER.map((r) => key(r.character_id));
  let closures = ids.map((id) => buildCharacterClosure(data, id));
  if (options.preferExistingVi && !options.characterIds.length) closures.sort((a, b) => existingViScore(b).hZTranslated - existingViScore(a).hZTranslated || existingViScore(b).total - existingViScore(a).total || a.cid.localeCompare(b.cid));
  const batch = selectAtomicBatch(closures, { targetCharacters: options.targetCharacters, excludeCharacterIds: options.excludeCharacterIds, maxTranslationUnits: options.maxTranslationUnits, maxBuffsRequiringReview: options.maxBuffsRequiringReview, maxCnChars: options.maxCnTextChars, preferExistingVi: options.preferExistingVi, explicitSingle: options.characterIds.length === 1, explicitCharacterIds: options.characterIds.length > 0 });
  if (options.auditOutput) {
    await fs.writeFile(options.auditOutput, JSON.stringify(batch.diagnostics.sort((a, b) => b.existing_vi_skill_rows - a.existing_vi_skill_rows || a.character_id.localeCompare(b.character_id)), null, 2), "utf8");
    return { output: options.auditOutput, batch };
  }
  if (!batch.selected.length) throw new Error("No complete character closure fits the requested selection.");
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const batchId = `character_translation_packet_${stamp}`;
  const output = options.output || path.join(OUTPUT_DEFAULT_DIR, `${batchId}.xlsx`);
  const rows = packetRows(batch, batchId, data.CHARACTER);
  if (options.payloadOutput) {
    await fs.mkdir(path.dirname(options.payloadOutput), { recursive: true });
    await fs.writeFile(options.payloadOutput, JSON.stringify(rows), "utf8");
    console.log(JSON.stringify({ payload: options.payloadOutput, batchId, characterIds: batch.selected.map((e) => e.closure.cid) }, null, 2));
    return { output: options.payloadOutput, rows, batch };
  }
  try { await writePacket(rows, output); }
  catch (error) {
    if (!(error instanceof RangeError) && !String(error.message).includes("Maximum call stack")) throw error;
    await writePacketFallback(rows, output);
  }
  const sha256 = crypto.createHash("sha256").update(await fs.readFile(output)).digest("hex");
  console.log(JSON.stringify({ output, sha256, batchId, characterIds: batch.selected.map((e) => e.closure.cid), counts: rows.BATCH_SUMMARY[0], validation: rows.VALIDATION }, null, 2));
  return { output, sha256, rows, batch };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2));
  if (!options) console.log("Usage: node tools/export_character_translation_packet.mjs --target-characters 20 --prefer-existing-vi [--character-ids A0001,A0002] [--output path]");
  else run(options).catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
}
