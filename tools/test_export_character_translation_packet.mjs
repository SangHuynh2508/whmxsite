import assert from "node:assert/strict";
import { buildCanonicalCharacterRegistry, buildCharacterClosure, canonicalCharacterContext, selectAtomicBatch } from "./export_character_translation_packet.mjs";

const data = {
  CHARACTER: [{ character_id: "A0001", name_cn: "甲", name_vi: "Giáp", status: "REVIEW" }, { character_id: "A0002", name_cn: "乙", name_vi: "Ất", status: "REVIEW" }],
  SKILL: [
    { skill_id: "S1", character_id: "A0001", skill_group_id: "S1", skill_name_cn: "Kỹ", skill_name_vi: "Ky", desc_cn: "{Buff_X}", desc_vi: "" },
    { skill_id: "S1EX", character_id: "", skill_group_id: "S1EX", skill_name_cn: "Kỹ EX", skill_name_vi: "", desc_cn: "{Buff_X}", desc_vi: "" },
    { skill_id: "HZ1", character_id: "", skill_group_id: "HZ1", skill_name_cn: "H", skill_name_vi: "", desc_cn: "{Buff_H}", desc_vi: "" },
    { skill_id: "S2", character_id: "A0002", skill_group_id: "S2", skill_name_cn: "K2", skill_name_vi: "K2", desc_cn: "{Buff_X}", desc_vi: "" },
  ],
  BUFF_STATUS: [
    { buff_id: "Buff_X", buff_name_cn: "X", buff_name_vi: "X khóa", buff_desc_cn: "{Buff_Y}", buff_desc_vi: "", name_authority: "OWNER_APPROVED" },
    { buff_id: "Buff_Y", buff_name_cn: "Y", buff_name_vi: "", buff_desc_cn: "", buff_desc_vi: "", name_authority: "" },
    { buff_id: "Buff_H", buff_name_cn: "H", buff_name_vi: "", buff_desc_cn: "", buff_desc_vi: "", name_authority: "" },
  ],
  HUANZHANG: [{ brilliant_id: "HZ_A", character_id: "A0001", icon_name_cn: "Chương", icon_info_cn: "Lore đầy đủ", icon_name_vi: "", icon_info_vi: "", buff_show_cn: "", buff_show_vi: "" }],
  ZHIZHI: [{ character_id: "A0001", skill_up_base_id: "S1", skill_up_ex_id: "S1EX" }], skillBuffLinks: [{ character_id: "A0001", skill_id: "S1", buff_id: "Buff_X" }, { character_id: "A0002", skill_id: "S2", buff_id: "Buff_X" }],
  raw: {
    "characterTable.json": { A0001: { skill1: ["S1"] }, A0002: { skill1: ["S2"] } },
    "roleattrMap.json": { A00011: { starUpAttr: ["SkillUP,S1"] } },
    "characterSkillMap.json": {
      S1_1: { HeroId: "A0001", GroupId: "S1", Type: 1, Level: 1, NameLanText: "Kỹ", DescriptionLanText: "{Buff_X}" },
      MAP_EX_1: { HeroId: "A0001", GroupId: "MAP_EX", Type: 4, Level: 1, NameLanText: "Map EX", DescriptionLanText: "Không được chọn" },
      NPC_1: { HeroId: "A0001", GroupId: "S1NPC01", Type: 1, Level: 1, NameLanText: "NPC mirror", DescriptionLanText: "Không được chọn" },
      ALIAS_1: { HeroId: "A0001", GroupId: "S1_ALIAS", Type: 1, Level: 1, NameLanText: "Kỹ", DescriptionLanText: "{Buff_X}" },
      ORPHAN_1: { HeroId: "A0001", GroupId: "ORPHAN", Type: 6, Level: 1, NameLanText: "Raw orphan", DescriptionLanText: "Không được chọn" },
    }, "characterPassiveSkillMap.json": {},
    "BrilliantMap.json": { HZ_A: { Skill1: ["HZ1"], Buff: ["Buff_H"] } },
    "actor.json": { runtime: { CharacterId: "A0001", Skill1: ["S1"], Skill2: ["S1_ALIAS"] } },
  },
};
const first = buildCharacterClosure(data, "A0001"); const second = buildCharacterClosure(data, "A0002");
assert.equal(first.complete, true, "complete character must include all closure domains");
assert.equal(first.flags.skill_closure, "PASS", "direct player skill slot remains required and present");
assert.equal(first.flags.ex_closure, "PASS", "exact roleattr SkillUP EX must be included");
assert.equal(first.flags.huanzhang_closure, "PASS", "Huanzhang skill and lore must be included");
assert(first.diagnostics.nonBlockingRawGroups.some((row) => row.group_id === "MAP_EX"), "map-only EX remains diagnostic, not required");
assert(first.diagnostics.nonBlockingRawGroups.some((row) => row.group_id === "S1NPC01"), "map-only NPC mirror remains diagnostic, not required");
assert.equal(first.diagnostics.nonBlockingRawGroups.find((row) => row.group_id === "S1_ALIAS").classification, "DERIVED_RUNTIME_ALIAS", "exact actor alias does not create a second localization group");
assert.equal(first.diagnostics.nonBlockingRawGroups.find((row) => row.group_id === "ORPHAN").classification, "UNLINKED_RAW_ORPHAN", "unlinked raw CN record is a non-blocking warning");
assert(first.buffs.some((b) => b.buff_id === "Buff_Y"), "transitive exact buff tag must be included");
assert(first.dependencies.some((d) => d.buff_id === "BUFF_X"), "exact skill-buff relation must be preserved");
assert.equal(first.buffs.find((b) => b.buff_id === "Buff_X").name_authority, "OWNER_APPROVED", "locked authority is retained");
const batch = selectAtomicBatch([first, second], { targetCharacters: 2, maxTranslationUnits: 3, maxUnresolvedBuffs: 10, maxCnChars: 10000, preferExistingVi: true });
assert.equal(batch.selected.length, 1, "soft cap stops before the next whole character");
assert.equal(batch.diagnostics.find((d) => d.character_id === "A0002").selection_result, "OVERSIZED", "over-cap candidate must be diagnosed instead of truncating");
const oversized = selectAtomicBatch([first], { targetCharacters: 1, maxTranslationUnits: 1, maxUnresolvedBuffs: 1, maxCnChars: 1, explicitSingle: true });
assert.equal(oversized.selected[0].oversized, true, "oversized singleton remains whole");
const noVi = { ...second, cid: "A0003", skills: second.skills.map((s) => ({ ...s, skill_name_vi: "", desc_vi: "" })) };
const eligibility = selectAtomicBatch([noVi, first], { targetCharacters: 2, maxTranslationUnits: 99, maxUnresolvedBuffs: 99, maxCnChars: 99999, preferExistingVi: true });
assert.equal(eligibility.diagnostics.find((d) => d.character_id === "A0003").selection_result, "INELIGIBLE_NO_EXISTING_VI", "prefer-existing-VI cannot silently select untranslated characters");
const missingDirect = buildCharacterClosure({ ...data, SKILL: data.SKILL.filter((row) => row.skill_id !== "S1") }, "A0001");
assert.equal(missingDirect.flags.skill_closure, "FAIL", "a missing direct character slot still blocks closure");
const emptyHz = buildCharacterClosure({
  ...data,
  CHARACTER: [...data.CHARACTER, { character_id: "A0004", name_cn: "Đ", name_vi: "D", status: "REVIEW" }],
  HUANZHANG: [...data.HUANZHANG, { brilliant_id: "HZ_EMPTY", character_id: "A0004", icon_name_cn: "", icon_info_cn: "", buff_show_cn: "" }],
  raw: { ...data.raw, "characterTable.json": { ...data.raw["characterTable.json"], A0004: {} }, "BrilliantMap.json": { ...data.raw["BrilliantMap.json"], HZ_EMPTY: { Skill1: [], Skill2: [], IconNameLanText: "", IconInfoLanText: "", BuffShow: "" } } },
}, "A0004");
assert.equal(emptyHz.flags.huanzhang_closure, "PASS", "raw-empty Huanzhang placeholder does not require display localization");
const missingHzLore = buildCharacterClosure({ ...data, HUANZHANG: [{ ...data.HUANZHANG[0], icon_name_cn: "", icon_info_cn: "", buff_show_cn: "" }], raw: { ...data.raw, "BrilliantMap.json": { ...data.raw["BrilliantMap.json"], HZ_A: { ...data.raw["BrilliantMap.json"].HZ_A, IconInfoLanText: "Raw lore" } } } }, "A0001");
assert.equal(missingHzLore.flags.huanzhang_closure, "FAIL", "non-empty raw Huanzhang gameplay/display source still requires localization");
const missingHzGameplay = buildCharacterClosure({ ...data, SKILL: data.SKILL.filter((row) => row.skill_id !== "HZ1") }, "A0001");
assert.equal(missingHzGameplay.flags.huanzhang_closure, "FAIL", "raw Huanzhang Skill1/Skill2 remains required");
const registry = buildCanonicalCharacterRegistry([
  ...data.CHARACTER,
  { character_id: "A0100", name_cn: "愿望杯", name_vi: "Lotus Chalice", fullname_cn: "愿望杯", fullname_vi: "Lotus Chalice" },
]);
assert.equal(canonicalCharacterContext(registry, "愿望杯向她许愿。"), "愿望杯 → Lotus Chalice", "global CHARACTER registry supplies canonical character context");
assert.equal(canonicalCharacterContext(registry, "Không chứa tên."), "", "canonical context must not invent an absent source-name reference");
assert.equal(canonicalCharacterContext(registry, "S0155-like source mentions 愿望杯 outside its own closure."), "愿望杯 → Lotus Chalice", "cross-character exact source mention is visible");
const ambiguous = buildCanonicalCharacterRegistry([
  { name_cn: "同名", name_vi: "Tên Một", fullname_cn: "", fullname_vi: "" },
  { name_cn: "同名", name_vi: "Tên Hai", fullname_cn: "", fullname_vi: "" },
]);
assert.equal(canonicalCharacterContext(ambiguous, "同名"), "", "ambiguous CHARACTER names are not emitted as canonical context");
console.log("PASS: character atomic closure exporter tests");
