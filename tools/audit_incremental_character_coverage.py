#!/usr/bin/env python3
"""Audit and close exact character-source coverage from an immutable snapshot.

The audit deliberately derives ownership only through explicit raw relations:
character skill references, combat-map HeroId records, BrilliantMap links, and
roleattrMap SkillUP entries.  In particular, no skill suffix classifies a
Hoan Chuong record.  The only supported write is a scope-guarded import of an
authoritative ``CharacterTagLanText`` value that is absent from CHARACTER.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import copy
from collections import defaultdict, deque
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

from openpyxl import load_workbook

from safe_workbook_mutation import safe_mutate_workbook
from workbook_semantic_fingerprint import workbook_semantic_fingerprint


PROJECT = Path(__file__).resolve().parents[1]
REPO = PROJECT.parent
NEO = REPO / "NeoArtifacts"
MASTER = PROJECT / "localization" / "localization_master.xlsx"
SNAPSHOT_ID = "r3021-20260915T081707511131Z-W0182"
AUDIT_DIR = PROJECT / "localization" / "audits"
BUFF_RE = re.compile(r"\b(Buff_[A-Za-z0-9_]+)\b")


def scalar(value: Any) -> str:
    return "" if value is None else str(value)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def strings(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for child in value.values():
            yield from strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from strings(child)


def refs(value: Any) -> set[str]:
    return {match for text in strings(value) for match in BUFF_RE.findall(text)}


def explicit_list(record: dict[str, Any], field: str) -> list[str]:
    value = record.get(field, [])
    if not isinstance(value, list):
        value = [value]
    return [scalar(item).strip() for item in value if scalar(item).strip()]


def load_authority() -> tuple[dict[str, Any], dict[str, Any]]:
    sys.path.insert(0, str(NEO))
    import character_assets

    root, manifest = character_assets.load_snapshot(SNAPSHOT_ID)
    mirror = NEO / "MasterData" / "json"
    actual = character_assets.fingerprint_tree(mirror)
    expected = manifest["masterdata_json_source_fingerprint"]
    if actual != expected:
        raise RuntimeError(
            f"Convenience mirror parity failed: {actual} != selected snapshot {expected}"
        )
    tables = character_assets._decode_tables(root / "MasterData", [
        "characterTable", "skillMap", "roleattrMap", "buffMap", "characterSkins",
        "characterFiles", "characterFileTextMap", "historicalRelicsMap", "BrilliantMap",
        "characterSkillMap", "characterPassiveSkillMap",
    ])
    authority = {
        "selected_snapshot": SNAPSHOT_ID,
        "snapshot_capture_time": manifest.get("capture_time"),
        "masterdata_provenance": manifest.get("masterdata_provenance"),
        "semantic_fingerprint": expected,
        "convenience_mirror_parity": "PROVEN",
    }
    return tables, authority


def workbook_rows() -> dict[str, list[dict[str, Any]]]:
    book = load_workbook(MASTER, read_only=True, data_only=False)
    result: dict[str, list[dict[str, Any]]] = {}
    try:
        for sheet in ("CHARACTER", "SKILL", "ZHIZHI", "HUANZHANG", "PROFILE", "SKIN", "BUFF_STATUS"):
            ws = book[sheet]
            headers = [scalar(cell.value) for cell in ws[1]]
            result[sheet] = [dict(zip(headers, row)) for row in ws.iter_rows(min_row=2, values_only=True)]
    finally:
        book.close()
    return result


def append_source_row(ws, values: dict[str, Any]) -> None:
    """Append a schema-compatible PENDING source row without touching existing rows."""
    headers = [scalar(cell.value) for cell in ws[1]]
    source_row, destination = ws.max_row, ws.max_row + 1
    ws.row_dimensions[destination].height = ws.row_dimensions[source_row].height
    for column, header in enumerate(headers, 1):
        source, target = ws.cell(source_row, column), ws.cell(destination, column)
        if source.has_style:
            target._style = copy.copy(source._style)
        target.number_format = source.number_format
        target.font = copy.copy(source.font)
        target.fill = copy.copy(source.fill)
        target.border = copy.copy(source.border)
        target.alignment = copy.copy(source.alignment)
        target.protection = copy.copy(source.protection)
        if header in values:
            target.value = values[header]


def skill_levels(skill_map: dict[str, Any], group: str) -> list[tuple[str, int, dict[str, Any]]]:
    entries = []
    for raw_key, record in skill_map.items():
        if isinstance(record, dict) and scalar(record.get("GroupId")) == group:
            level = record.get("level", record.get("Level"))
            if level in (None, ""):
                raise RuntimeError(f"Raw skill record lacks explicit level: {raw_key}")
            entries.append((str(raw_key), int(level), record))
    return sorted(entries, key=lambda item: (item[1], item[0]))


def profile_values(character_id: str, tables: dict[str, Any]) -> list[tuple[str, str]]:
    values: list[tuple[str, str]] = []
    char_file = tables["characterFiles"].get(character_id, {})
    relic = tables["historicalRelicsMap"].get(character_id, {})
    for category, record, field in (
        ("card_intro", char_file, "cardIntrolanText"),
        ("staff_status", char_file, "stafflanText"),
        ("entity_status", char_file, "storelanText"),
        ("relic_name", relic, "relicslanText"),
        ("relic_dynasty", relic, "dynastylanText"),
        ("relic_museum", relic, "museumlanText"),
        ("relic_intro", relic, "introductionlanText"),
    ):
        text = scalar(record.get(field)).strip()
        if text:
            values.append((category, text))
    for index, file_id in enumerate(explicit_list(char_file, "basicFileID"), 1):
        record = tables["characterFileTextMap"].get(file_id, {})
        for kind, field in (("report_title", "titleLanText"), ("report_content", "textLanText")):
            text = scalar(record.get(field)).strip()
            if text:
                values.append((f"{kind}_{index}", text))
    return values


def audit() -> dict[str, Any]:
    tables, authority = load_authority()
    rows = workbook_rows()
    chars = {cid: value for cid, value in tables["characterTable"].items()
             if isinstance(value, dict) and str(value.get("Switch")) == "0"}
    character_rows = {scalar(row["character_id"]): row for row in rows["CHARACTER"]}
    skill_rows = {scalar(row["skill_id"]): row for row in rows["SKILL"]}
    skill_ids = set(skill_rows)
    zhizhi = {(scalar(row["character_id"]), int(row["star"])) for row in rows["ZHIZHI"]}
    hz_rows = {scalar(row["brilliant_id"]): row for row in rows["HUANZHANG"]}
    skins = {scalar(row["skin_id"]) for row in rows["SKIN"]}
    buffs = {scalar(row["buff_id"]): row for row in rows["BUFF_STATUS"]}

    # This is an ownership index, not a name/prefix/suffix convention.
    owners_by_group: dict[str, set[str]] = defaultdict(set)
    for source_name in ("characterSkillMap", "characterPassiveSkillMap"):
        for record in tables[source_name].values():
            if isinstance(record, dict) and record.get("HeroId") and record.get("GroupId"):
                owners_by_group[scalar(record["GroupId"])].add(scalar(record["HeroId"]))

    hz_by_owner: dict[str, list[tuple[str, list[str]]]] = defaultdict(list)
    unresolved_hz_owners: list[dict[str, Any]] = []
    for brilliant_id, record in tables["BrilliantMap"].items():
        if not isinstance(record, dict):
            continue
        groups = sorted(set(
            explicit_list(record, "Buff") + explicit_list(record, "Skill1") + explicit_list(record, "Skill2")
        ))
        owners = sorted({owner for group in groups for owner in owners_by_group.get(group, set()) if owner in chars})
        if len(owners) != 1:
            # These 11 raw placeholders carry no HZ links or localizable display text.
            # They remain explicit, non-invented raw-source classifications rather than
            # guessed character ownership.
            unresolved_hz_owners.append({
                "brilliant_id": brilliant_id, "groups": groups, "owners": owners,
                "classification": "EMPTY_RAW_HUANZHANG_NO_OWNER_RELATION" if not groups else "RAW_OWNER_RELATION_UNRESOLVED",
                "presentable": bool(scalar(record.get("IconNameLanText")).strip() or scalar(record.get("IconInfoLanText")).strip() or scalar(record.get("BuffShowLanText")).strip()),
            })
            continue
        hz_by_owner[owners[0]].append((brilliant_id, groups))

    by_character: dict[str, Any] = {}
    all_missing: list[dict[str, Any]] = []
    all_source_changed: list[dict[str, Any]] = []
    hzs_current_snapshot = {
        scalar(row["character_id"]) for row in rows["HUANZHANG"]
        if SNAPSHOT_ID in scalar(row.get("notes"))
    }
    for character_id, char in sorted(chars.items()):
        missing: list[dict[str, Any]] = []
        source_changed: list[dict[str, Any]] = []
        char_row = character_rows.get(character_id)
        if not char_row:
            missing.append({"domain": "CHARACTER", "id": character_id, "reason": "MISSING_ROW"})
        else:
            raw_tags = scalar(char.get("CharacterTagLanText")).strip()
            workbook_tags = scalar(char_row.get("tags_cn")).strip()
            if raw_tags and raw_tags != workbook_tags:
                missing.append({"domain": "CHARACTER_TAG", "id": character_id,
                                "reason": "AUTHORITATIVE_TAG_SOURCE_EXISTS", "source_cn": raw_tags})
            elif not raw_tags:
                missing.append({"domain": "CHARACTER_TAG", "id": character_id,
                                "reason": "SOURCE_RESOLUTION_REQUIRED"})

        base_groups = {explicit_list(char, f"skill{slot}")[0]
                       for slot in range(1, 7) if explicit_list(char, f"skill{slot}")}
        ex_groups: set[str] = set()
        for star in range(1, 7):
            role = tables["roleattrMap"].get(f"{character_id}{star}", {})
            if not isinstance(role, dict):
                missing.append({"domain": "ZHIZHI", "id": f"{character_id}:{star}", "reason": "RAW_ROLEATTR_MISSING"})
                continue
            if (character_id, star) not in zhizhi:
                missing.append({"domain": "ZHIZHI", "id": f"{character_id}:{star}", "reason": "MISSING_ROW"})
            for attr in strings(role.get("starUpAttr", [])):
                match = re.search(r"(?:^|,)SkillUP,([A-Za-z0-9_]+)(?:,|$)", attr)
                if not match:
                    continue
                base = match.group(1)
                # SkillUP is the authority for enhancement.  The candidate must additionally
                # be a raw skill group with a direct combat-map HeroId relation to this owner.
                enhanced = f"{base}ex"
                enhanced_levels = skill_levels(tables["skillMap"], enhanced)
                if character_id not in owners_by_group.get(enhanced, set()) or not enhanced_levels:
                    missing.append({"domain": "EX_SKILL", "id": enhanced,
                                    "reason": "RAW_SKILLUP_TARGET_UNRESOLVED", "base_group": base})
                else:
                    ex_groups.add(enhanced)
                    # The established schema stores one exact enhanced record keyed by the
                    # SkillUP target (not three duplicate level rows).  Its source is the
                    # explicit level-1 raw record; enhancement meaning comes from SkillUP.
                    existing = next((row for row in rows["SKILL"] if scalar(row.get("skill_id")) == enhanced), None)
                    if not existing:
                        missing.append({"domain": "EX_SKILL", "id": enhanced, "reason": "MISSING_ROW",
                                        "base_group": base, "raw_key": enhanced_levels[0][0]})
                    elif scalar(existing.get("desc_cn")).strip() != scalar(enhanced_levels[0][2].get("DescriptionLanText")).strip():
                        source_changed.append({"domain": "EX_SKILL", "id": enhanced, "reason": "SOURCE_CHANGED_AFTER_TRANSLATION",
                                               "base_group": base, "raw_key": enhanced_levels[0][0]})

        hz_groups: set[str] = set()
        for brilliant_id, groups in hz_by_owner.get(character_id, []):
            if brilliant_id not in hz_rows:
                missing.append({"domain": "HUANZHANG", "id": brilliant_id, "reason": "MISSING_ROW"})
            hz_groups.update(groups)

        # EX is audited above in the established one-row representation.  The
        # gameplay group collection contains only raw character slots and exact
        # BrilliantMap links; it never classifies a group by an ID suffix.
        expected_groups = base_groups | hz_groups
        direct_buffs: set[str] = set()
        for group in expected_groups:
            raw_levels = skill_levels(tables["skillMap"], group)
            if not raw_levels:
                missing.append({"domain": "SKILL", "id": group, "reason": "RAW_GROUP_WITHOUT_SKILL_RECORD"})
            for raw_key, level, record in raw_levels:
                row_id = raw_key if group in hz_groups else f"{group}_{level}"
                # Exact raw identity check: exact canonical skill_id, or exact character+group raw identity
                already_represented = (row_id in skill_ids) or any(
                    scalar(r.get("character_id")) == character_id and scalar(r.get("skill_group_id")) == group
                    and (scalar(r.get("skill_id")) in (raw_key, f"{group}_{level}"))
                    for r in rows["SKILL"]
                )
                if not already_represented:
                    missing.append({"domain": "SKILL", "id": row_id, "reason": "MISSING_ROW", "raw_key": raw_key, "group": group})
                direct_buffs.update(refs(record))
            for source_name in ("characterSkillMap", "characterPassiveSkillMap"):
                for record in tables[source_name].values():
                    if isinstance(record, dict) and scalar(record.get("GroupId")) == group:
                        direct_buffs.update(refs(record.get("Attr", [])))

        for enhanced in ex_groups:
            for _, _, record in skill_levels(tables["skillMap"], enhanced):
                direct_buffs.update(refs(record))
            for source_name in ("characterSkillMap", "characterPassiveSkillMap"):
                for record in tables[source_name].values():
                    if isinstance(record, dict) and scalar(record.get("GroupId")) == enhanced:
                        direct_buffs.update(refs(record.get("Attr", [])))

        closure, queue = set(), deque(sorted(direct_buffs))
        while queue:
            buff_id = queue.popleft()
            if buff_id in closure:
                continue
            closure.add(buff_id)
            record = tables["buffMap"].get(buff_id)
            if not isinstance(record, dict):
                missing.append({"domain": "BUFF_STATUS", "id": buff_id, "reason": "RAW_REFERENCE_UNRESOLVED"})
                continue
            for child in sorted(refs(record.get("Attr", [])) - closure):
                queue.append(child)
            display = scalar(record.get("NameLanText")).strip() or scalar(record.get("DescriptionLanText")).strip()
            if display and buff_id not in buffs:
                missing.append({"domain": "BUFF_STATUS", "id": buff_id, "reason": "MISSING_PLAYER_FACING_ROW"})

        for skin in tables["characterSkins"].get(character_id, []) or []:
            skin_id = scalar(skin.get("skinID"))
            if skin_id and skin_id not in skins:
                missing.append({"domain": "SKIN", "id": skin_id, "reason": "MISSING_ROW"})

        profile_texts = profile_values(character_id, tables)
        own_profiles = [row for row in rows["PROFILE"] if scalar(row.get("character_id")) == character_id]
        for profile_key, text in profile_texts:
            if not any(text in {scalar(row.get("title_cn")).strip(), scalar(row.get("text_cn")).strip()} for row in own_profiles):
                missing.append({"domain": "PROFILE", "id": f"{character_id}:{profile_key}", "reason": "MISSING_SOURCE_TEXT"})

        translation_missing: list[str] = []
        def vi_gap(row: dict[str, Any] | None, record_id: str, pairs: list[tuple[str, str]]) -> None:
            if not row:
                return
            for source_field, vi_field in pairs:
                if scalar(row.get(source_field)).strip() and not scalar(row.get(vi_field)).strip():
                    translation_missing.append(f"{record_id}.{vi_field}")

        vi_gap(char_row, f"CHARACTER:{character_id}", [("name_cn", "name_vi"), ("fullname_cn", "fullname_vi"), ("tags_cn", "tags_vi")])
        for brilliant_id, _ in hz_by_owner.get(character_id, []):
            vi_gap(hz_rows.get(brilliant_id), f"HUANZHANG:{brilliant_id}", [
                ("icon_name_cn", "icon_name_vi"), ("icon_info_cn", "icon_info_vi"), ("buff_show_cn", "buff_show_vi"),
            ])
        for group in expected_groups:
            for raw_key, level, _ in skill_levels(tables["skillMap"], group):
                skill_id = raw_key if group in hz_groups else f"{group}_{level}"
                vi_gap(skill_rows.get(skill_id), f"SKILL:{skill_id}", [("skill_name_cn", "skill_name_vi"), ("desc_cn", "desc_vi")])
        for enhanced in ex_groups:
            vi_gap(skill_rows.get(enhanced), f"SKILL:{enhanced}", [("skill_name_cn", "skill_name_vi"), ("desc_cn", "desc_vi")])
        for buff_id in closure:
            vi_gap(buffs.get(buff_id), f"BUFF_STATUS:{buff_id}", [("buff_name_cn", "buff_name_vi"), ("buff_desc_cn", "buff_desc_vi")])
        for skin in tables["characterSkins"].get(character_id, []) or []:
            skin_row = next((row for row in rows["SKIN"] if scalar(row.get("skin_id")) == scalar(skin.get("skinID"))), None)
            vi_gap(skin_row,
                   f"SKIN:{scalar(skin.get('skinID'))}", [("skin_name_cn", "skin_name_vi"), ("desc_cn", "desc_vi"), ("obtain_cn", "obtain_vi")])
        for _, text in profile_texts:
            profile = next((row for row in own_profiles if text in {scalar(row.get("title_cn")).strip(), scalar(row.get("text_cn")).strip()}), None)
            if profile:
                field = "title_vi" if scalar(profile.get("title_cn")).strip() == text else "text_vi"
                if not scalar(profile.get(field)).strip():
                    translation_missing.append(f"PROFILE:{scalar(profile.get('profile_id'))}.{field}")

        # A recent provenance marker is treated as a current-delta trigger even after its
        # source rows have been imported, so its full closure is re-audited.
        affected = bool(missing or source_changed) or character_id in hzs_current_snapshot
        if affected:
            all_missing.extend({"character_id": character_id, **entry} for entry in missing)
            all_source_changed.extend({"character_id": character_id, **entry} for entry in source_changed)
        by_character[character_id] = {
            "name_cn": scalar(char.get("namelanText")),
            "affected": affected,
            "affected_reasons": (["CURRENT_SNAPSHOT_HUANZHANG"] if character_id in hzs_current_snapshot else []) +
                                (["SOURCE_COVERAGE_GAP"] if missing else []) +
                                (["SOURCE_CHANGED_AFTER_TRANSLATION"] if source_changed else []),
            "character_row_complete": not any(x["domain"] == "CHARACTER" for x in missing),
            "tags_complete": not any(x["domain"] == "CHARACTER_TAG" for x in missing),
            "base_skills_complete": not any(x["domain"] == "SKILL" and x["id"].split("_")[0] in base_groups for x in missing),
            "ex_skillup_complete": not any(x["domain"] in {"ZHIZHI", "EX_SKILL"} for x in missing),
            "huanzhang_complete": not any(x["domain"] == "HUANZHANG" for x in missing),
            "huanzhang_linked_skill_groups_complete": not any(x["domain"] == "SKILL" and x.get("group") in hz_groups for x in missing),
            "zhizhi_complete": not any(x["domain"] == "ZHIZHI" for x in missing),
            "profile_complete": not any(x["domain"] == "PROFILE" for x in missing),
            "skin_complete": not any(x["domain"] == "SKIN" for x in missing),
            "related_buffs_complete": not any(x["domain"] == "BUFF_STATUS" for x in missing),
            "missing_localization_rows": missing,
            "source_changed_existing_rows": source_changed,
            "data_complete": all(x["reason"] in {"RAW_REFERENCE_UNRESOLVED", "SOURCE_RESOLUTION_REQUIRED"} for x in missing),
            "translation_complete": not translation_missing and not source_changed,
            "missing_vi": translation_missing,
            "source_blockers": [x for x in missing if x["reason"].endswith("UNRESOLVED") or x["reason"] == "SOURCE_RESOLUTION_REQUIRED"],
            "huanzhang_records": [entry[0] for entry in hz_by_owner.get(character_id, [])],
            "huanzhang_groups": sorted(hz_groups),
            "skillup_groups": sorted(ex_groups),
            "buff_closure_count": len(closure),
        }

    explained_raw_hz = [item for item in unresolved_hz_owners if not item["presentable"]]
    unresolved_presentable_hz = [item for item in unresolved_hz_owners if item["presentable"]]
    affected = {cid: item for cid, item in by_character.items() if item["affected"]}
    return {
        "authority": authority,
        "master_sha256": sha256(MASTER),
        "workbook_semantic_fingerprint": workbook_semantic_fingerprint(MASTER),
        "summary": {
            "playable_characters": len(chars),
            "raw_brilliant_records": len(tables["BrilliantMap"]),
            "resolved_brilliant_records": sum(len(items) for items in hz_by_owner.values()),
            "unresolved_brilliant_owners": len(unresolved_presentable_hz),
            "empty_raw_huanzhang_owner_blockers": len(explained_raw_hz),
            "affected_character_count": len(affected),
            "missing_row_count": len(all_missing),
            "source_changed_existing_row_count": len(all_source_changed),
            "affected_character_ids": list(affected),
        },
        "unresolved_brilliant_owners": unresolved_hz_owners,
        "affected_characters": affected,
        "all_missing_rows": all_missing,
        "all_source_changed_existing_rows": all_source_changed,
    }


def write_report(report: dict[str, Any], stage: str) -> Path:
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = AUDIT_DIR / f"incremental_character_coverage_{stamp}_{stage}.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def apply_source_rows(report: dict[str, Any]) -> tuple[Path, dict[str, list[str]]]:
    """Append audited source rows and fill exact tag gaps in one guarded transaction."""
    tables, _ = load_authority()
    missing = report["all_missing_rows"]
    blockers = [item for item in missing if item["reason"] == "RAW_SKILLUP_TARGET_UNRESOLVED"]
    if blockers:
        raise RuntimeError(f"Refusing mutation with non-append source blocker: {blockers[:5]}")
    tag_updates = {item["character_id"]: item["source_cn"] for item in missing
                   if item["domain"] == "CHARACTER_TAG" and item["reason"] == "AUTHORITATIVE_TAG_SOURCE_EXISTS"}
    skill_missing = [item for item in missing if item["domain"] == "SKILL" and item["reason"] == "MISSING_ROW"]
    ex_missing = [item for item in missing if item["domain"] == "EX_SKILL" and item["reason"] == "MISSING_ROW"]
    buff_missing = [item for item in missing if item["domain"] == "BUFF_STATUS" and item["reason"] == "MISSING_PLAYER_FACING_ROW"]
    skin_missing = [item for item in missing if item["domain"] == "SKIN" and item["reason"] == "MISSING_ROW"]
    # Missing buffMap records are exact raw-source blockers, not rows we can
    # invent.  Every other listed form must be one of the exact source imports.
    supported = {
        ("CHARACTER_TAG", "AUTHORITATIVE_TAG_SOURCE_EXISTS"),
        ("SKILL", "MISSING_ROW"),
        ("EX_SKILL", "MISSING_ROW"),
        ("BUFF_STATUS", "MISSING_PLAYER_FACING_ROW"),
        ("BUFF_STATUS", "RAW_REFERENCE_UNRESOLVED"),
        ("SKIN", "MISSING_ROW"),
    }
    unsupported = [item for item in missing if (item["domain"], item["reason"]) not in supported]
    if unsupported:
        raise RuntimeError(f"Unsupported gap type requires owner decision: {unsupported[:5]}")

    changed = {
        "CHARACTER_TAG": sorted(tag_updates),
        "SKILL": sorted(item["id"] for item in skill_missing),
        "EX_SKILL": sorted(item["id"] for item in ex_missing),
        "BUFF_STATUS": sorted(item["id"] for item in buff_missing),
        "SKIN": sorted(item["id"] for item in skin_missing),
    }
    if not any(changed.values()):
        return Path(), changed

    group_to_owner = defaultdict(set)
    for source_name in ("characterSkillMap", "characterPassiveSkillMap"):
        for record in tables[source_name].values():
            if isinstance(record, dict) and record.get("GroupId") and record.get("HeroId"):
                group_to_owner[scalar(record["GroupId"])].add(scalar(record["HeroId"]))

    def buff_group(record: dict[str, Any], buff_id: str) -> str:
        for text in strings(record.get("Attr", [])):
            if text.startswith("BuffGroup,"):
                candidate = text.split(",")[-1].strip()
                if candidate:
                    return candidate
        return buff_id

    def mutate(book):
        ws = book["CHARACTER"]
        headers = [scalar(cell.value) for cell in ws[1]]
        by_id = {scalar(ws.cell(row, 1).value): row for row in range(2, ws.max_row + 1)}
        for character_id, tags in tag_updates.items():
            row = by_id.get(character_id)
            if not row:
                raise RuntimeError(f"CHARACTER row disappeared during transaction: {character_id}")
            ws.cell(row, headers.index("tags_cn") + 1).value = tags
            # Do not create, translate, or approve Vietnamese content.
            ws.cell(row, headers.index("tags_vi") + 1).value = ""

        skill_ws = book["SKILL"]
        for item in [*skill_missing, *ex_missing]:
            is_ex = item["domain"] == "EX_SKILL"
            group, raw_key = (item["base_group"], item["raw_key"]) if is_ex else (item["group"], item["raw_key"])
            record = tables["skillMap"][raw_key]
            owner_group = f"{group}ex" if is_ex else group
            owners = sorted(group_to_owner[owner_group])
            if len(owners) != 1:
                raise RuntimeError(f"Skill group lacks exact owner at mutation time: {owner_group} -> {owners}")
            base_records = skill_levels(tables["skillMap"], group) if is_ex else []
            if is_ex and not base_records:
                raise RuntimeError(f"Raw SkillUP base group disappeared during transaction: {group}")
            append_source_row(skill_ws, {
                "skill_id": item["id"], "character_id": owners[0], "skill_group_id": group,
                "skill_slot": "ZHIZHI_EX" if is_ex else "HUANZHANG_LINKED",
                "type_label": "ZHIZHI_ENHANCED" if is_ex else scalar(record.get("type")),
                "skill_name_cn": scalar(base_records[0][2].get("NameLanText")) if is_ex else scalar(record.get("NameLanText")), "skill_name_vi": "",
                "desc_cn": scalar(record.get("DescriptionLanText")), "desc_vi": "",
                "confidence": "LOW", "status": "PENDING",
                "notes": (f"Authoritative roleattrMap SkillUP closure; snapshot={SNAPSHOT_ID}; raw_key={raw_key}"
                          if is_ex else f"Authoritative BrilliantMap gameplay closure; snapshot={SNAPSHOT_ID}; raw_key={raw_key}"),
            })

        buff_ws = book["BUFF_STATUS"]
        for item in buff_missing:
            buff_id, record = item["id"], tables["buffMap"][item["id"]]
            append_source_row(buff_ws, {
                "buff_id": buff_id, "group_root_id": buff_group(record, buff_id),
                "buff_name_cn": scalar(record.get("NameLanText")), "buff_name_vi": "",
                "buff_desc_cn": scalar(record.get("DescriptionLanText")), "buff_desc_vi": "",
                "classification_scope": "PLAYER_FACING", "confidence": "LOW", "status": "PENDING",
                "notes": f"Authoritative character gameplay closure; snapshot={SNAPSHOT_ID}; source=buffMap",
            })

        skin_ws = book["SKIN"]
        for item in skin_missing:
            skin_id = item["id"]
            match = next((skin for skin_list in tables["characterSkins"].values() for skin in skin_list or []
                          if scalar(skin.get("skinID")) == skin_id), None)
            if not match:
                raise RuntimeError(f"Skin disappeared during transaction: {skin_id}")
            append_source_row(skin_ws, {
                "skin_id": skin_id, "character_id": scalar(match.get("characterId")),
                "skin_name_cn": scalar(match.get("skinNamelanText")), "skin_name_vi": "",
                "desc_cn": scalar(match.get("tipsLanText") or match.get("skinFileLanText")), "desc_vi": "",
                "obtain_cn": scalar(match.get("getdescriptionLanText")), "obtain_vi": "",
                "is_base_skin": bool(match.get("bIsBaseSkin")), "confidence": "LOW", "status": "PENDING",
                "notes": f"Authoritative character skin import; snapshot={SNAPSHOT_ID}; source=characterSkins",
            })

    authorized = {("CHARACTER", cid, field) for cid in tag_updates for field in ("tags_cn", "tags_vi")}
    backup = safe_mutate_workbook(
        str(PROJECT), mutate, {}, authorized_new_columns={}, authorized_cells=authorized,
        authorized_new_rows={"SKILL": set(changed["SKILL"] + changed["EX_SKILL"]),
                             "BUFF_STATUS": set(changed["BUFF_STATUS"]), "SKIN": set(changed["SKIN"])},
    )
    return Path(backup), changed


def annotate_pending_tags() -> tuple[Path, list[str]]:
    """Record field-level pending state without demoting approved character names."""
    tables, _ = load_authority()
    book = load_workbook(MASTER, read_only=True, data_only=False)
    try:
        ws = book["CHARACTER"]
        headers = [scalar(cell.value) for cell in ws[1]]
        targets = []
        for row in ws.iter_rows(min_row=2, values_only=True):
            data = dict(zip(headers, row))
            cid = scalar(data.get("character_id"))
            raw_tags = scalar((tables["characterTable"].get(cid) or {}).get("CharacterTagLanText")).strip()
            if (raw_tags and raw_tags == scalar(data.get("tags_cn")).strip() and not scalar(data.get("tags_vi")).strip()
                    and "tags_translation_status=PENDING" not in scalar(data.get("notes"))):
                targets.append(cid)
    finally:
        book.close()
    if not targets:
        return Path(), []

    def mutate(book):
        ws = book["CHARACTER"]
        headers = [scalar(cell.value) for cell in ws[1]]
        notes_col = headers.index("notes") + 1
        for row_number in range(2, ws.max_row + 1):
            cid = scalar(ws.cell(row_number, 1).value)
            if cid in targets:
                prior = scalar(ws.cell(row_number, notes_col).value).rstrip("; ")
                ws.cell(row_number, notes_col).value = (
                    f"{prior}; " if prior else ""
                ) + f"tags_translation_status=PENDING; tags_source=CharacterTagLanText; snapshot={SNAPSHOT_ID}"

    backup = safe_mutate_workbook(
        str(PROJECT), mutate, {}, authorized_new_columns={},
        authorized_cells={("CHARACTER", cid, "notes") for cid in targets}, authorized_new_rows={},
    )
    return Path(backup), targets


def repair_huanzhang_skill_keys() -> tuple[Path, dict[str, str]]:
    """Correct only this transaction's HZ rows to the public builder's raw keys."""
    tables, _ = load_authority()
    book = load_workbook(MASTER, read_only=True, data_only=False)
    try:
        ws = book["SKILL"]
        headers = [scalar(cell.value) for cell in ws[1]]
        group_col, id_col, notes_col = (headers.index(name) + 1 for name in ("skill_group_id", "skill_id", "notes"))
        repairs: dict[str, str] = {}
        for values in ws.iter_rows(min_row=2, values_only=True):
            group, skill_id, notes = (scalar(values[col - 1]) for col in (group_col, id_col, notes_col))
            if f"Authoritative BrilliantMap gameplay closure; snapshot={SNAPSHOT_ID}" not in notes:
                continue
            raw = skill_levels(tables["skillMap"], group)
            if len(raw) == 1 and skill_id != raw[0][0]:
                repairs[skill_id] = raw[0][0]
    finally:
        book.close()
    if not repairs:
        return Path(), repairs

    def mutate(book):
        ws = book["SKILL"]
        headers = [scalar(cell.value) for cell in ws[1]]
        id_col = headers.index("skill_id") + 1
        for row in range(2, ws.max_row + 1):
            prior = scalar(ws.cell(row, id_col).value)
            if prior in repairs:
                ws.cell(row, id_col).value = repairs[prior]

    backup = safe_mutate_workbook(
        str(PROJECT), mutate, {"skill_ids": set(repairs)}, authorized_new_columns={},
        authorized_cells={("SKILL", prior, "skill_id") for prior in repairs}, authorized_new_rows={},
    )
    return Path(backup), repairs


def recover_exact_ex_rows() -> tuple[Path, list[str]]:
    """Reuse only exact level-1 historical EX localization on a new canonical row."""
    book = load_workbook(MASTER, read_only=True, data_only=False)
    try:
        ws = book["SKILL"]
        headers = [scalar(cell.value) for cell in ws[1]]
        records = [dict(zip(headers, values)) for values in ws.iter_rows(min_row=2, values_only=True)]
        targets = []
        for row in records:
            target_id = scalar(row.get("skill_id"))
            if not scalar(row.get("notes")).startswith("Authoritative roleattrMap SkillUP closure;") or scalar(row.get("skill_name_vi")).strip():
                continue
            legacy = next((candidate for candidate in records if scalar(candidate.get("skill_id")) == f"{target_id}_1" and scalar(candidate.get("skill_group_id")) == target_id), None)
            if legacy and scalar(legacy.get("skill_name_vi")).strip() and scalar(legacy.get("desc_vi")).strip():
                targets.append(target_id)
    finally:
        book.close()
    if not targets:
        return Path(), []

    def mutate(book):
        ws = book["SKILL"]
        headers = [scalar(cell.value) for cell in ws[1]]
        index = {name: column + 1 for column, name in enumerate(headers)}
        data = [{name: ws.cell(row, col).value for name, col in index.items()} for row in range(2, ws.max_row + 1)]
        legacy_by_id = {scalar(row["skill_id"]): row for row in data}
        for row_number in range(2, ws.max_row + 1):
            target_id = scalar(ws.cell(row_number, index["skill_id"]).value)
            if target_id not in targets:
                continue
            legacy = legacy_by_id[f"{target_id}_1"]
            for field in ("skill_name_cn", "skill_name_vi", "desc_cn", "desc_vi", "translation_review_status", "translation_review_source"):
                ws.cell(row_number, index[field]).value = legacy[field]
            ws.cell(row_number, index["notes"]).value = (
                scalar(ws.cell(row_number, index["notes"]).value) +
                f"; exact_level1_historical_recovery={target_id}_1"
            )

    fields = {"skill_name_cn", "skill_name_vi", "desc_cn", "desc_vi", "translation_review_status", "translation_review_source", "notes"}
    backup = safe_mutate_workbook(
        str(PROJECT), mutate, {"skill_ids": set(targets)}, authorized_new_columns={},
        authorized_cells={("SKILL", target, field) for target in targets for field in fields}, authorized_new_rows={},
    )
    return Path(backup), targets


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Safely append all audited exact source rows")
    parser.add_argument("--annotate-pending-tags", action="store_true", help="Add field-level pending provenance to untranslated tag imports")
    parser.add_argument("--repair-huanzhang-skill-keys", action="store_true", help="Correct audited HZ SKILL primary keys to raw builder keys")
    parser.add_argument("--recover-ex", action="store_true", help="Recover exact legacy level-1 EX localization for newly canonicalized rows")
    args = parser.parse_args()
    if args.repair_huanzhang_skill_keys:
        backup, repairs = repair_huanzhang_skill_keys()
        print(json.dumps({"huanzhang_skill_key_repair": {"backup": str(backup), "repairs": repairs}}, ensure_ascii=False, indent=2))
        return 0
    if args.recover_ex:
        backup, targets = recover_exact_ex_rows()
        print(json.dumps({"exact_ex_recovery": {"backup": str(backup), "skill_ids": targets}}, ensure_ascii=False, indent=2))
        return 0
    before = audit()
    before_path = write_report(before, "before")
    result = {"before_report": str(before_path), "before": before["summary"]}
    if args.apply:
        before_sha = before["master_sha256"]
        before_fingerprint = before["workbook_semantic_fingerprint"]
        backup, changed = apply_source_rows(before)
        after = audit()
        after_path = write_report(after, "after")
        result.update({
            "backup": str(backup), "backup_sha256": sha256(backup) if backup else "",
            "master_sha256_before": before_sha, "master_sha256_after": after["master_sha256"],
            "semantic_fingerprint_before": before_fingerprint,
            "semantic_fingerprint_after": after["workbook_semantic_fingerprint"],
            "rows_changed": changed, "after_report": str(after_path), "after": after["summary"],
        })
        unexplained = [item for item in after["all_missing_rows"] if item["reason"] != "RAW_REFERENCE_UNRESOLVED"]
        if unexplained or after["summary"]["unresolved_brilliant_owners"]:
            raise SystemExit("Coverage gate remains incomplete after tag transaction")
    if args.annotate_pending_tags:
        backup, tagged = annotate_pending_tags()
        result["pending_tag_annotation"] = {"backup": str(backup), "character_ids": tagged}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
