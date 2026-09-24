# Closure-failed root-cause audit — 2026-09-13

## Executive summary

This is a read-only reverse-engineering audit of the 43 current `CLOSURE_FAILED` characters. The master workbook was not changed. Its SHA-256 was verified as `87837D38B52980122BFB4F35FCCEB8C5938DBE2EE886EE37120057BDD1A264AD`; the supplied semantic fingerprint is `7D7F158A151F930E764680DB60E2D2C0166E73252D4B8ED3F5695B4D2C005AC9`.

None of the 43 failures shows a missing direct player relation. They are caused by two over-broad closure predicates:

1. every non-concealed `characterSkillMap` / `characterPassiveSkillMap` group is promoted to a required localization group, although those maps also contain NPC mirrors, unused implementation rows, and runtime aliases; and
2. any HUANZHANG row requires display lore even when its raw `BrilliantMap` record contains no player display field and no gameplay skill relation.

The proposed relation-gated resolver would make all 43 characters closure-clean. Three unlinked, non-aliased raw rows remain data-quality warnings (`A012006`, `D009206`, `D017951`), but no relation identifies them as playable content and they must not block closure.

## Current exporter closure algorithm

`tools/export_character_translation_packet.mjs` currently builds expected groups from `characterTable.skill1…skill6`, `roleattrMap` `SkillUP` values (and a synthesized `EX`), **and every non-concealed** row owned by the character in `characterSkillMap` and `characterPassiveSkillMap`. It then adds `BrilliantMap.Skill1/Skill2`, requires every group to occur in `SKILL`, and separately requires every HUANZHANG row to have either `icon_info_cn` or `buff_show_cn`.

The first two sources are ownership/upgrade relations. The last map scan is an inventory of raw records, not a player-eligibility relation. Treating it as one produces all map-group failures below.

## Root-cause families

| Family | Characters | Meaning and safe generic rule | Risk |
| --- | ---: | --- | --- |
| `MAP_ONLY_NONCANONICAL_GROUP` | 37 | Do not make an owned, non-concealed map group required unless a direct player relation selects it: character slot, `SkillUP`/Zhizhi upgrade target, non-aliased playable actor configuration, or `BrilliantMap.Skill1/2`. Retain it as provenance/audit data. | Medium: require a regression fixture for each direct relation type. |
| `NPC_MIRROR_GROUP` | 11 | `NPC01` records are map-only copies and are absent from `characterTable` slots and direct actor configurations. Their texts often equal the canonical group. They are internal runtime mirrors, not translation units. | Low once relation-gated; never use suffix alone. |
| `DERIVED_RUNTIME_ALIAS` | 6 | `51`, `93/95`, `A`, and `NPC04` variants have an exact canonical counterpart (same name and description) and, where actors use them, are substituted runtime configurations. Canonicalize only after exact text/type/level equivalence is proved. | Medium: do not canonicalize merely by trimming an ID suffix. |
| `UNLINKED_RAW_ORPHAN` | 3 | `A012006`, `D009206`, and `D017951` are non-concealed map rows with Chinese text but have no slot, upgrade, HZ, or actor relation. Keep diagnostic warnings; do not block character closure. | Medium; manual MasterData review before ever adding them to player UI. |
| `HUANZHANG_EMPTY_PLACEHOLDER` | 8 | A `...3` HUANZHANG record has no `Skill1/2`, `IconInfoLanText`, or `BuffShow`; it is an internal localization-key placeholder. Require lore only when raw display source exists. | Low; raw non-empty source remains mandatory. |

### Exact affected IDs

- `NPC_MIRROR_GROUP` (11): A0025, A0160, D0035, D0060, S0013, S0132, V0037, V0091, W0029, W0051, W0151.
- map-only `EX` records (25): A0069, A0086, A0120, D0014, D0045, D0060, D0089, D0095, D0140, S0083, S0088, S0132, V0023, V0034, V0037, V0059, V0075, V0078, V0141, V0177, W0056, W0057, W0079, W0085, W0143.
- `DERIVED_RUNTIME_ALIAS` (6): A0160, D0060, S0028, S0083, W0051, W0182.
- `UNLINKED_RAW_ORPHAN` (3): A0120, D0092, D0179.
- `HUANZHANG_EMPTY_PLACEHOLDER` (8): A0061, A0139, D0035, S0012, V0049, V0059, W0036, W0038.

Families overlap; together they account for all 43 character IDs.

## Representative raw evidence

| Character / missing group | Raw relation evidence | Classification |
| --- | --- | --- |
| A0025 / `A002501NPC01` | `characterSkillMap` owns levels 1–5, but `characterTable.skill1` selects `A002501`, not the NPC group; both carry name `镂雕` and the same description. No actor selects the NPC group. | `INTERNAL_RUNTIME_ONLY` |
| D0060 / `D006005A` | `actor.json` IDs 111, 112, 113, 114, and 53 select it for `D0060`; raw name/description exactly match canonical `D006005`. | `DERIVED_OR_ALIAS` |
| S0083 / `S008306NPC04` | actor 159 (rank 6) selects it; its raw name/description exactly match `S008304`. `S008304A` and `S008305A` have the same canonical text. | `DERIVED_OR_ALIAS` |
| W0051 / `W005193`, `W005195` | actors 20/40/44/49/51 (and rank-6 105/106 for 95) use them; each has exact canonical text (`W005103`, `W005105`). | `DERIVED_OR_ALIAS` |
| A0069 / `A006905EX` | non-concealed passive map row with name `化木为金-超群`, but rank 3 `roleattrMap` upgrades `A006903 → A006903ex`, not 905; no character slot or actor selects 905EX. | `STALE_ORPHAN` |
| A0120 / `A012006` | type-6 passive `鹤羽` is map-only; it is absent from slots, all `SkillUP` values, HZ relations, and actor configurations. | `STALE_ORPHAN` (manual warning) |
| D0179 / `D017951` | type-1 `彗剑·撩` has no canonical text twin and no slot, upgrade, HZ, or actor relation. | `STALE_ORPHAN` (manual warning) |
| A0061 / HZ `A00613` | master row is empty; raw `BrilliantMap.A00613` has empty `Skill1`, `Skill2`, `Buff`, `BuffUp`, `BuffShow`, `IconNameLanText`, and `IconInfoLanText`. Its `A00614` sibling holds actual lore. | `HUANZHANG_INTERNAL` |

The same raw pattern holds for the other seven HZ `...3` records. Their paired `...4` rows contain the real lore where one exists; this audit does not ignore non-empty HZ source content.

## Suffix semantics

Suffixes are signals for investigation, never the decision rule.

- `NPC01`: map-only mirror inventory; 11 affected owners have no direct player selection. Some strings exactly match canonical skills and some do not, so lack of a string match is not used to infer player eligibility.
- `NPC04`: observed at `S008306NPC04`; an actor configuration selects it, but exact text/type/level equivalence with `S008304` makes it an alias.
- `EX`: 25 failing EX groups are not the `SkillUP` target. Each character's actual rank-3 relation targets a different base/EX pair already represented by Zhizhi; the failure group is only map-owned.
- `51`: `A016051` and `W018251` are exact canonical aliases; `D017951` is unlinked and must stay an orphan warning.
- `06`: `A012006` and `D009206` are unlinked type-6 map rows, not direct player closure dependencies.
- `93/95`: `W005193/195` are actor-selected runtime substitutions with exact canonical text.
- `A` variants: `D006005A`, `S002804A`, `S008304A`, and `S008305A` are aliases only after exact canonical equivalence. Two have actor evidence; two do not.

## HUANZHANG audit

All eight requested characters fail solely because `loreComplete` applies to an empty `...3` row. No raw `Skill1/Skill2` is missing for these placeholder rows. `D0035` also has NPC-map failures and `V0059` also has a map-only EX failure; those are independent. The correct predicate is source-backed: a HZ row requires display localization only if raw `IconNameLanText`, `IconInfoLanText`, or `BuffShow` is non-empty, or if `Skill1/Skill2` declares gameplay content.

## Proposed generic resolver changes (not implemented)

1. **P0 — direct-relation eligibility.** Build required groups from player slots, `SkillUP` targets and their EX target, and actual HZ gameplay links. Treat map tables as lookup/provenance, not automatic requirements. It removes map blockers for 37 characters and makes 35 immediately closure-clean; D0035 and V0059 still await P1. Risk: medium; add fixtures for NPC, orphan, EX, actor alias, and a positive direct relation.
2. **P1 — source-backed HZ display gate.** Ignore only raw-empty HZ placeholders; retain checks for non-empty display/lore or gameplay source. Expected additional release: 8 characters (six HZ-only plus D0035 and V0059). Risk: low.
3. **P2 — canonical alias resolver.** Where an actor-selected variant is otherwise relevant, map to an existing canonical group only with exact name+description+type+level evidence. Expected release already covered by P0, but protects a future actor-aware resolver. Risk: medium.
4. **P3 — orphan warning channel.** Emit, but do not closure-block, unlinked non-concealed map records. Expected release already covered by P0; three rows remain manual MasterData warnings. Risk: low.

## Expected state after implementation

The two required fixes should yield **43 newly closure-clean characters** and **0 remaining closure blockers** from this cohort. `A012006`, `D009206`, and `D017951` remain three non-blocking, manually reviewable raw-orphan warnings. No translation, workbook mutation, packet export, or code change was performed by this audit.
