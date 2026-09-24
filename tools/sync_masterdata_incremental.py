#!/usr/bin/env python3
"""Incrementally upsert one MasterData character into localization_master.xlsx.

The tool never rebuilds or reorders the workbook. Existing rows are read-only:
source differences are reported for owner review, while only missing primary keys
are appended with the current sheet's schema and style.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import shutil
import sys
from collections import defaultdict, deque
from datetime import datetime
from pathlib import Path
from typing import Any

from openpyxl import load_workbook
from openpyxl.formula.translate import Translator


PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = PROJECT_ROOT.parent
MASTER = PROJECT_ROOT / "localization" / "localization_master.xlsx"
SOURCE_ROOT = REPO_ROOT / "NeoArtifacts" / "MasterData" / "json"
LANG_ROOT = REPO_ROOT / "NeoArtifacts" / "MasterData" / "lang"
VERSION_FILE = REPO_ROOT / "NeoArtifacts" / "version.json"
MANIFEST_DIR = PROJECT_ROOT / "localization" / "manifests"
BUFF_RE = re.compile(r"Buff_[A-Za-z0-9_]+")

VI_FIELDS = {
    "name_vi", "fullname_vi", "nickname_vi", "tags_vi", "skill_name_vi",
    "desc_vi", "buff_name_vi", "buff_desc_vi", "rank_numeral_vi",
    "effect_summary_vi", "icon_name_vi", "icon_info_vi", "buff_show_vi",
    "title_vi", "text_vi", "skin_name_vi", "obtain_vi",
}
SYNC_METADATA_FIELDS = ("row_kind", "translation_required", "release_state", "source_hash", "source_version")

# These are owner-approved identity migrations, not prose substitutions.  They
# are applied only when the matching CN cell contains the exact named source in
# the corresponding rich-text span (or exact name field).
OWNER_NAMED_MIGRATIONS = (
    {"cn": "瞄准", "vi": "Miêu Chuẩn", "old": {"Nhắm Bắn", "Nhắm"}},
    {"cn": "脆弱", "vi": "Thúy Nhược", "old": {"Tùy Nhược", "Dễ Vỡ"}},
)


def load_json(name: str, default: Any = None) -> Any:
    path = SOURCE_ROOT / name
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8-sig"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def source_hash_record(record: dict[str, Any]) -> str:
    """Fingerprint raw/source fields only; human VI is deliberately excluded."""
    source = {
        key: scalar(value) for key, value in record.items()
        if key not in VI_FIELDS | {"confidence", "status", "notes"} | set(SYNC_METADATA_FIELDS)
    }
    return hashlib.sha256(json.dumps(source, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()


def ensure_sync_metadata_columns(ws) -> list[str]:
    headers = [scalar(cell.value) for cell in ws[1]]
    for field in SYNC_METADATA_FIELDS:
        if field in headers:
            continue
        target_col = ws.max_column + 1
        ws.cell(1, target_col).value = field
        if target_col > 1:
            ws.cell(1, target_col)._style = copy.copy(ws.cell(1, target_col - 1)._style)
        headers.append(field)
    return headers


def metadata_for(candidate: dict[str, Any], trace: dict[str, Any]) -> dict[str, str]:
    row_kind = scalar(candidate.get("classification_scope")) or "PLAYER_FACING"
    return {
        "row_kind": row_kind,
        "translation_required": "YES" if row_kind == "PLAYER_FACING" else "NO",
        "release_state": "PRELOAD" if trace.get("switch") == 0 else "OFFICIAL",
        "source_hash": source_hash_record(candidate),
        "source_version": json.dumps(trace.get("source_version", {}), ensure_ascii=False, sort_keys=True),
    }


def scalar(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return str(value)


def raw_record_level(record: dict[str, Any], raw_key: str = "") -> int:
    """Use an explicit raw level, or an exact raw-key level suffix when present."""
    explicit = record.get("Level", record.get("level"))
    if explicit not in (None, ""):
        try:
            return int(explicit)
        except (TypeError, ValueError):
            return 1
    group_id = first(record, "GroupId")
    suffix = raw_key[len(group_id):] if group_id and raw_key.startswith(group_id) else ""
    return int(suffix) if suffix.isdigit() and int(suffix) > 0 else 1


def refs_in(value: Any) -> set[str]:
    """Read gameplay relations without mistaking localization/icon IDs for edges."""
    found: set[str] = set()
    ignored_fields = {"NameLan", "DescriptionLan", "BuffIcon", "SkillIcon"}

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            for key, child in node.items():
                if key not in ignored_fields:
                    walk(child)
        elif isinstance(node, list):
            for child in node:
                walk(child)
        elif isinstance(node, str):
            found.update(BUFF_RE.findall(node))

    walk(value)
    return {x for x in found if not x.startswith(("Buff_NameLan_", "Buff_DescriptionLan_"))}


def first(record: dict[str, Any], *names: str) -> str:
    for name in names:
        value = record.get(name)
        if value not in (None, ""):
            return scalar(value)
    return ""


def source_note(version: dict[str, Any], sources: list[str], extra: str = "") -> str:
    parts = [
        "Incremental MasterData sync",
        f"cfcVersion={version.get('cfcVersion', '')}",
        f"langVersion={version.get('langVersion', '')}",
        f"source={','.join(sources)}",
    ]
    if extra:
        parts.append(extra)
    return "; ".join(parts)


def classify_buff(record: dict[str, Any]) -> str:
    """Classify a raw buff without deriving semantics from its identifier.

    A named, described record is the only class safe to localize automatically.
    A partial display record is deliberately retained for owner review.  Empty
    records remain in the dependency manifest as controller nodes, not workbook
    translation rows.
    """
    name = first(record, "NameLanText", "NameLan")
    desc = first(record, "DescriptionLanText", "DescriptionLan")
    if name and desc:
        return "PLAYER_FACING"
    if name or desc:
        return "AMBIGUOUS"
    return "INTERNAL_CONTROLLER"


def build_dependency_manifest(character_id: str, trace: dict[str, Any], buff_map: dict[str, Any]) -> dict[str, Any]:
    """Preserve raw controller relations outside the translation workbook."""
    closure = trace.get("buff_closure", [])
    edge_map: dict[str, list[str]] = defaultdict(list)
    for edge in trace.get("buff_edges", []):
        edge_map[str(edge["parent"])].append(str(edge["child"]))
    nodes = []
    for buff_id in closure:
        record = buff_map.get(buff_id, {}) or {}
        attrs = record.get("Attr", []) or []
        attr_strings = [scalar(value) for value in attrs]
        nodes.append({
            "id": buff_id,
            "classification": classify_buff(record),
            "name_cn": first(record, "NameLanText", "NameLan"),
            "description_cn": first(record, "DescriptionLanText", "DescriptionLan"),
            "raw_edges": sorted(set(edge_map.get(buff_id, []))),
            "conditions": [value for value in attr_strings if value.startswith("Condition")],
            "selectors": [value for value in attr_strings if ",Id," in value or "Selector" in value],
            "parameter_paths": [value for value in attr_strings if "Para" in value or "#" in value],
            "raw_attr": attr_strings,
            "source_table": "buffMap.json",
            "source_version": trace["source_version"],
            "provenance": "skill/combat raw relation closure",
        })
    return {
        "schema_version": 1,
        "character_id": character_id,
        "release_state": "PRELOAD",
        "public_roster_included": False,
        "source_table": "buffMap.json",
        "source_version": trace["source_version"],
        "direct_buffs": trace.get("direct_buffs", []),
        "edges": trace.get("buff_edges", []),
        "nodes": nodes,
    }


def cleanup_internal_rows(workbook, character_id: str, manifest: dict[str, Any]) -> dict[str, Any]:
    """Remove only demonstrably empty incremental controller rows.

    The raw graph is already retained in ``manifest``.  Anything with display
    source, VI, or non-sync provenance is retained (and partial display rows are
    marked ambiguous) so this operation cannot silently delete user work.
    """
    ws = workbook["BUFF_STATUS"]
    headers = [scalar(cell.value) for cell in ws[1]]
    by_id = {node["id"]: node for node in manifest["nodes"]}
    candidates, retained = [], []
    for row_number in range(2, ws.max_row + 1):
        row = {header: ws.cell(row_number, index + 1).value for index, header in enumerate(headers)}
        buff_id = scalar(row.get("buff_id"))
        node = by_id.get(buff_id)
        if not node:
            continue
        has_vi = any(scalar(row.get(field)) for field in ("buff_name_vi", "buff_desc_vi"))
        sync_owned = scalar(row.get("notes")).startswith("Incremental MasterData sync")
        if node["classification"] == "INTERNAL_CONTROLLER" and not has_vi and sync_owned:
            candidates.append((row_number, buff_id))
        elif node["classification"] != "PLAYER_FACING":
            retained.append({"row": row_number, "id": buff_id, "classification": node["classification"],
                             "has_vi": has_vi, "sync_owned": sync_owned})
    for row_number, _ in reversed(candidates):
        ws.delete_rows(row_number, 1)
    return {
        "removed": [buff_id for _, buff_id in candidates],
        "retained_non_player_facing": retained,
    }


def audit_cleanup_integrity(backup: Path, current: Path, removed_ids: list[str]) -> dict[str, Any]:
    """Verify cleanup removed exactly the approved empty controller IDs."""
    before = load_workbook(backup, data_only=False)
    after = load_workbook(current, data_only=False)
    bws, aws = before["BUFF_STATUS"], after["BUFF_STATUS"]
    headers = [scalar(cell.value) for cell in bws[1]]
    def rows(ws):
        return {
            scalar(ws.cell(row, 1).value): {header: ws.cell(row, col + 1).value for col, header in enumerate(headers)}
            for row in range(2, ws.max_row + 1) if scalar(ws.cell(row, 1).value)
        }
    before_rows, after_rows = rows(bws), rows(aws)
    removed_set = set(removed_ids)
    removed_were_empty = all(
        item not in before_rows or (
            not scalar(before_rows[item].get("buff_name_vi"))
            and not scalar(before_rows[item].get("buff_desc_vi"))
            and scalar(before_rows[item].get("notes")).startswith("Incremental MasterData sync")
        )
        for item in removed_set
    )
    preserved = all(before_rows[key] == after_rows.get(key) for key in before_rows if key not in removed_set)
    absent = all(key not in after_rows for key in removed_set)
    _, index = workbook_index(aws)
    nonempty = sum(1 for row in range(2, aws.max_row + 1)
                   if any(aws.cell(row, col).value not in (None, "") for col in range(1, aws.max_column + 1)))
    no_duplicates = nonempty == len(index)
    return {
        "opens": True,
        "sheet_names_equal": before.sheetnames == after.sheetnames,
        "rows_before_after": {name: [before[name].max_row, after[name].max_row] for name in before.sheetnames},
        "removed_ids_absent": absent,
        "removed_rows_had_no_vi_or_user_provenance": removed_were_empty,
        "remaining_rows_unchanged": preserved,
        "no_duplicate_primary_ids": no_duplicates,
        "integrity_pass": all((before.sheetnames == after.sheetnames, absent, removed_were_empty, preserved, no_duplicates)),
    }


def migrate_owner_named_references(workbook, apply: bool) -> dict[str, list[dict[str, Any]]]:
    """Audit/apply only source-aligned rich-text status references.

    This intentionally has no whole-string replacement path: ordinary prose,
    historical supersedes notes, and source/target pairs without an exact named
    span remain untouched and appear in the audit instead.
    """
    audit: dict[str, list[dict[str, Any]]] = {
        "NAMED_REFERENCE_TO_MIGRATE": [], "ORDINARY_PROSE": [],
        "PROVENANCE_OR_NOTE": [], "AMBIGUOUS": [],
    }
    color_re = re.compile(r"(<color=[^>]+>)(.*?)(</color>)", re.I | re.S)
    for ws in workbook.worksheets:
        headers = [scalar(cell.value) for cell in ws[1]]
        header_index = {header: index + 1 for index, header in enumerate(headers)}
        pairs = [(header, header[:-2] + "vi") for header in headers
                 if header.endswith("_cn") and header[:-2] + "vi" in header_index]
        for row_number in range(2, ws.max_row + 1):
            row_id = scalar(ws.cell(row_number, 1).value)
            for migration in OWNER_NAMED_MIGRATIONS:
                for header in headers:
                    value = scalar(ws.cell(row_number, header_index[header]).value)
                    if not value or not any(old in value for old in migration["old"]):
                        continue
                    context = {"sheet": ws.title, "row": row_number, "id": row_id,
                               "field": header, "cn": migration["cn"], "vi": migration["vi"]}
                    if header in {"notes", "provenance", "supersedes"}:
                        audit["PROVENANCE_OR_NOTE"].append(context)
                        continue
                    pair = next((candidate for candidate in pairs if candidate[1] == header), None)
                    if not pair:
                        audit["ORDINARY_PROSE"].append(context)
                        continue
                    source = scalar(ws.cell(row_number, header_index[pair[0]]).value)
                    source_spans = [match.group(2).strip() for match in color_re.finditer(source)]
                    target_matches = list(color_re.finditer(value))
                    target_spans = [match.group(2).strip() for match in target_matches]
                    # A bare named status field is also deterministic, provided
                    # the CN field is exactly the approved source term.
                    if source.strip() == migration["cn"] and value.strip() in migration["old"]:
                        audit["NAMED_REFERENCE_TO_MIGRATE"].append(context)
                        if apply:
                            ws.cell(row_number, header_index[header]).value = migration["vi"]
                        continue
                    if len(source_spans) != len(target_spans):
                        # Translation formatting may omit an unrelated colour
                        # span.  A unique named source span and a unique legacy
                        # target span are still an exact, safe binding.
                        source_count = sum(span == migration["cn"] for span in source_spans)
                        target_old = [index for index, span in enumerate(target_spans)
                                      if span in migration["old"]]
                        if source_count == 1 and len(target_old) == 1:
                            audit["NAMED_REFERENCE_TO_MIGRATE"].append(
                                {**context, "span_indexes": target_old,
                                 "evidence": "UNIQUE_NAMED_SPAN_WITH_FORMAT_MISMATCH"}
                            )
                            if apply:
                                match = target_matches[target_old[0]]
                                value = value[:match.start(2)] + migration["vi"] + value[match.end(2):]
                                ws.cell(row_number, header_index[header]).value = value
                            continue
                        audit["AMBIGUOUS"].append({**context, "reason": "RICH_TEXT_SPAN_COUNT_MISMATCH"})
                        continue
                    positions = [index for index, span in enumerate(source_spans) if span == migration["cn"]]
                    old_positions = [index for index in positions if target_spans[index] in migration["old"]]
                    if old_positions:
                        audit["NAMED_REFERENCE_TO_MIGRATE"].append({**context, "span_indexes": old_positions})
                        if apply:
                            rebuilt, cursor = [], 0
                            for index, match in enumerate(target_matches):
                                rebuilt.append(value[cursor:match.start()])
                                inner = migration["vi"] if index in old_positions else match.group(2)
                                rebuilt.append(f"{match.group(1)}{inner}{match.group(3)}")
                                cursor = match.end()
                            rebuilt.append(value[cursor:])
                            ws.cell(row_number, header_index[header]).value = "".join(rebuilt)
                    elif any(old in value for old in migration["old"]):
                        audit["ORDINARY_PROSE" if migration["cn"] not in source else "AMBIGUOUS"].append(context)
    return audit


def item_category(record: dict[str, Any]) -> str:
    item_type = int(record.get("type", 0) or 0)
    return {
        1: "currency", 2: "exp_book", 3: "talent_material_common",
        4: "talent_material_tier", 5: "rank_up_fragment",
        6: "skill_material", 7: "specialty", 12: "talent_material_specialty",
    }.get(item_type, f"type_{item_type}")


def skill_slot(group_id: str) -> str:
    low = group_id.lower()
    if low.endswith("ex"):
        return "ZHIZHI_EX"
    suffix = group_id[-2:]
    return {
        "01": "COMMON_ATTACK", "02": "ULTIMATE", "03": "PASSIVE_1",
        "04": "PASSIVE_2", "05": "PASSIVE_3", "11": "PROFESSION",
        "06": "HUANZHANG", "61": "HUANZHANG_EX",
    }.get(suffix, "RELATED")


def primary_key(sheet: str, row: dict[str, Any]) -> tuple[str, ...]:
    if sheet == "ZHIZHI":
        return (scalar(row.get("character_id")), scalar(row.get("star")))
    key_name = {
        "CHARACTER": "character_id", "SKILL": "skill_id", "BUFF_STATUS": "buff_id",
        "HUANZHANG": "brilliant_id", "ITEM": "item_id", "PROFILE": "profile_id",
        "SKIN": "skin_id", "TALENT": "talent_bank_id",
    }[sheet]
    return (scalar(row.get(key_name)),)


def workbook_index(ws) -> tuple[list[str], dict[tuple[str, ...], tuple[int, dict[str, Any]]]]:
    headers = [scalar(cell.value) for cell in ws[1]]
    rows: dict[tuple[str, ...], tuple[int, dict[str, Any]]] = {}
    for row_number in range(2, ws.max_row + 1):
        record = {header: ws.cell(row_number, i + 1).value for i, header in enumerate(headers)}
        if not any(value not in (None, "") for value in record.values()):
            continue
        rows[primary_key(ws.title, record)] = (row_number, record)
    return headers, rows


def copy_row_schema(ws, source_row: int, target_row: int, headers: list[str]) -> None:
    ws.row_dimensions[target_row].height = ws.row_dimensions[source_row].height
    for col, header in enumerate(headers, 1):
        src = ws.cell(source_row, col)
        dst = ws.cell(target_row, col)
        if src.has_style:
            dst._style = copy.copy(src._style)
        dst.number_format = src.number_format
        dst.font = copy.copy(src.font)
        dst.fill = copy.copy(src.fill)
        dst.border = copy.copy(src.border)
        dst.alignment = copy.copy(src.alignment)
        dst.protection = copy.copy(src.protection)
        if isinstance(src.value, str) and src.value.startswith("=") and header not in VI_FIELDS:
            try:
                dst.value = Translator(src.value, origin=src.coordinate).translate_formula(dst.coordinate)
            except Exception:
                dst.value = src.value


def current_source_version() -> dict[str, Any]:
    """Version of the MasterData actually on disk: the newest launch provenance written by
    `NeoArtifacts.py masterdata`. version.json is not refreshed by that command."""
    launches = sorted((SOURCE_ROOT.parent / "provenance").glob("launch_*.json"))
    if not launches:
        return json.loads(VERSION_FILE.read_text(encoding="utf-8-sig"))
    launch = json.loads(launches[-1].read_text(encoding="utf-8"))["launch"]
    return {"cfcVersion": launch["ConfigVersion_v2"], "langVersion": launch["LangData"]}


def collect(character_id: str) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    version = current_source_version()
    character_table = load_json("characterTable.json", {})
    skill_map = load_json("skillMap.json", {})
    role_map = load_json("roleattrMap.json", {})
    buff_map = load_json("buffMap.json", {})
    skins_map = load_json("characterSkins.json", {})
    files_map = load_json("characterFiles.json", {})
    file_text_map = load_json("characterFileTextMap.json", {})
    relic_map = load_json("historicalRelicsMap.json", {})
    item_map = load_json("itemMap.json", {})
    char_talent_map = load_json("characterTalentMap.json", {})
    talent_bank_map = load_json("talentBankMap.json", {})
    brilliant_map = load_json("BrilliantMap.json", {}) or load_json("brilliantMap.json", {}) or {}
    brilliant_up_map = load_json("BrilliantUpMap.json", {}) or load_json("brilliantUpMap.json", {}) or {}
    combat_sources = {
        "characterSkillMap.json": load_json("characterSkillMap.json", {}),
        "characterPassiveSkillMap.json": load_json("characterPassiveSkillMap.json", {}),
    }

    char = character_table.get(character_id)
    if not isinstance(char, dict):
        raise SystemExit(f"Character {character_id} not found in characterTable.json")

    rows: dict[str, list[dict[str, Any]]] = defaultdict(list)
    trace: dict[str, Any] = {
        "character": character_id,
        "switch": char.get("Switch"),
        "source_version": {
            "cfcVersion": version.get("cfcVersion"), "langVersion": version.get("langVersion"),
            "table_count": len(list(SOURCE_ROOT.glob("*.json"))),
        },
        "skills": [], "skill_levels": {}, "skill_up": [], "buff_edges": [],
        "direct_buffs": [], "buff_closure": [], "shared_dependencies": [],
        "huanzhang": [], "huanzhang_gameplay": [], "items": [], "skins": [],
        "profiles": [], "talents": [], "unresolved_references": [],
        "asset_references": [], "missing_local_asset_files": [],
    }

    rows["CHARACTER"].append({
        "character_id": character_id,
        "name_cn": first(char, "namelanText", "name"), "name_vi": "",
        "fullname_cn": first(char, "FullnameLanText", "fullname"), "fullname_vi": "",
        "nickname_vi": "", "tags_cn": first(char, "tags", "TagsLanText"), "tags_vi": "",
        "rare": char.get("rare", ""), "confidence": "LOW", "status": "PENDING",
        "notes": source_note(version, ["characterTable.json"], f"Switch={char.get('Switch')}")
    })

    group_ids: set[str] = set()
    for i in range(1, 7):
        relation = char.get(f"skill{i}")
        if isinstance(relation, list) and relation:
            group_ids.add(str(relation[0]))
    for source in combat_sources.values():
        for record in source.values() if isinstance(source, dict) else []:
            if scalar(record.get("HeroId")) == character_id:
                gid = first(record, "GroupId")
                if gid:
                    group_ids.add(gid)
    for key, record in role_map.items():
        if str(key).startswith(character_id):
            for attr in record.get("starUpAttr", []) or []:
                match = re.search(r"SkillUP,([A-Za-z0-9_]+)", scalar(attr))
                if match:
                    base = match.group(1)
                    group_ids.add(base)
                    group_ids.add(base + "ex")
                    trace["skill_up"].append({"roleattr": key, "base": base, "ex": base + "ex"})

    # Include actual raw groups tied to the character, plus 06/061 Hoán Chương gameplay when present.
    actual_groups = {first(v, "GroupId") for v in skill_map.values() if first(v, "GroupId").startswith(character_id)}
    group_ids.update(g for g in actual_groups if g)
    trace["huanzhang_gameplay"] = sorted(g for g in actual_groups if g.endswith(("06", "061")))

    direct_buff_refs: set[str] = set()
    for gid in sorted(group_ids):
        levels = []
        for raw_key, record in skill_map.items():
            if first(record, "GroupId") != gid:
                continue
            level = raw_record_level(record, raw_key)
            levels.append(level)
            desc = first(record, "DescriptionLanText", "DescriptionLan")
            rows["SKILL"].append({
                "skill_id": f"{gid}_{level}", "character_id": character_id,
                "skill_group_id": gid, "skill_slot": skill_slot(gid),
                "type_label": scalar(record.get("type", "")),
                "skill_name_cn": first(record, "NameLanText", "NameLan"), "skill_name_vi": "",
                "desc_cn": desc, "desc_vi": "", "confidence": "LOW", "status": "PENDING",
                "notes": source_note(version, ["skillMap.json"], f"raw_key={raw_key}; level={level}")
            })
            direct_buff_refs.update(refs_in(record))
            icon = first(record, "SkillIcon")
            if icon:
                trace["asset_references"].append({"source": "skillMap.json", "id": gid, "field": "SkillIcon", "value": icon})
        if levels:
            trace["skills"].append(gid)
            trace["skill_levels"][gid] = sorted(levels)

    for source_name, source in combat_sources.items():
        for raw_key, record in source.items() if isinstance(source, dict) else []:
            if first(record, "GroupId") in group_ids or scalar(record.get("HeroId")) == character_id:
                direct_buff_refs.update(refs_in(record))

    trace["direct_buffs"] = sorted(direct_buff_refs)
    seen_buffs: set[str] = set()
    queue = deque((buff_id, "skill/combat raw relation") for buff_id in sorted(direct_buff_refs))
    while queue:
        buff_id, parent = queue.popleft()
        if buff_id in seen_buffs:
            continue
        seen_buffs.add(buff_id)
        record = buff_map.get(buff_id)
        if not isinstance(record, dict):
            trace["unresolved_references"].append({"type": "BUFF_STATUS", "id": buff_id, "from": parent})
            continue
        children = sorted(refs_in(record) - {buff_id})
        for child in children:
            trace["buff_edges"].append({"parent": buff_id, "child": child})
            queue.append((child, buff_id))
        name_cn = first(record, "NameLanText", "NameLan")
        desc_cn = first(record, "DescriptionLanText", "DescriptionLan")
        group = ""
        for attr in record.get("Attr", []) or []:
            text = scalar(attr)
            if text.startswith("BuffGroup,"):
                group = text.split(",")[-1]
                break
        classification = classify_buff(record)
        # Keep the complete raw closure during collection so dry-runs and the
        # dependency manifest retain every edge.  ``--cleanup-internal`` moves
        # empty controller nodes out of the workbook only after the manifest is
        # written and a backup exists.
        rows["BUFF_STATUS"].append({
            "buff_id": buff_id, "group_root_id": group or buff_id,
            "buff_name_cn": name_cn, "buff_name_vi": "",
            "buff_desc_cn": desc_cn, "buff_desc_vi": "",
            "classification_scope": classification,
            "confidence": "LOW", "status": "PENDING",
            "notes": source_note(version, ["buffMap.json"], f"reached_from={parent}")
        })
        icon = first(record, "BuffIcon")
        if icon:
            trace["asset_references"].append({"source": "buffMap.json", "id": buff_id, "field": "BuffIcon", "value": icon})
    trace["buff_closure"] = sorted(seen_buffs)
    trace["shared_dependencies"] = sorted(x for x in seen_buffs if not x.startswith(f"Buff_{character_id}"))

    numerals = "一二三四五六"
    for star in range(1, 7):
        record = role_map.get(f"{character_id}{star}", {})
        attrs = record.get("starUpAttr", []) or []
        skill_up = next((re.search(r"SkillUP,([A-Za-z0-9_]+)", scalar(x)) for x in attrs if "SkillUP," in scalar(x)), None)
        summary = "; ".join(scalar(x) for x in attrs)
        base = skill_up.group(1) if skill_up else ""
        rows["ZHIZHI"].append({
            "character_id": character_id, "star": star, "rank_numeral_cn": f"致知{numerals[star-1]}",
            "rank_numeral_vi": "", "effect_type": "skill_upgrade" if base else "stat_bonus",
            "effect_summary_cn": summary, "effect_summary_vi": "", "skill_up_base_id": base,
            "skill_up_ex_id": base + "ex" if base else "", "confidence": "LOW", "status": "PENDING",
            "notes": source_note(version, ["roleattrMap.json"], f"raw_key={character_id}{star}")
        })

    brilliant_records = []
    for source_name, source in (("BrilliantMap.json", brilliant_map), ("BrilliantUpMap.json", brilliant_up_map)):
        for raw_key, record in source.items() if isinstance(source, dict) else []:
            if character_id in scalar(record):
                brilliant_records.append((source_name, raw_key, record))
    for source_name, raw_key, record in brilliant_records:
        bid = first(record, "BrilliantId", "brilliantId", "Id", "id") or str(raw_key)
        rows["HUANZHANG"].append({
            "brilliant_id": bid, "character_id": character_id,
            "icon_name_cn": first(record, "IconNameLanText", "NameLanText", "name"), "icon_name_vi": "",
            "icon_info_cn": first(record, "IconInfoLanText", "DescriptionLanText", "description"), "icon_info_vi": "",
            "buff_show_cn": first(record, "BuffShowLanText", "BuffShow", "buffShow"), "buff_show_vi": "",
            "confidence": "LOW", "status": "PENDING",
            "notes": source_note(version, [source_name], f"raw_key={raw_key}")
        })
        trace["huanzhang"].append(bid)

    item_ids = {scalar(char.get("crystalItemId")), scalar(char.get("mapItem"))}
    skins = skins_map.get(character_id, []) or []
    for skin in skins:
        skin_id = first(skin, "skinID")
        linked_item = first(skin, "mapItemsID")
        if linked_item:
            item_ids.add(linked_item)
        rows["SKIN"].append({
            "skin_id": skin_id, "character_id": character_id,
            "skin_name_cn": first(skin, "skinNamelanText", "skinName"), "skin_name_vi": "",
            "desc_cn": first(skin, "tipsLanText", "tipsLan", "skinFileLanText"), "desc_vi": "",
            "obtain_cn": first(skin, "getdescriptionLanText", "getdescriptionLan"), "obtain_vi": "",
            "is_base_skin": bool(skin.get("bIsBaseSkin")), "confidence": "LOW", "status": "PENDING",
            "notes": source_note(version, ["characterSkins.json"], f"skinType={skin.get('skinType')}")
        })
        trace["skins"].append(skin_id)
        for field in ("skinLOGO", "resLOGO", "skinFile"):
            value = skin.get(field)
            if value not in (None, "", 0, []):
                trace["asset_references"].append({"source": "characterSkins.json", "id": skin_id, "field": field, "value": value})
    for item_id in sorted(x for x in item_ids if x):
        record = item_map.get(item_id)
        if not isinstance(record, dict):
            trace["unresolved_references"].append({"type": "ITEM", "id": item_id, "from": character_id})
            continue
        rows["ITEM"].append({
            "item_id": item_id, "category": item_category(record),
            "name_cn": first(record, "nameLanText", "nameRem", "nameLan"), "name_vi": "",
            "desc_cn": first(record, "DescriptionLanText", "DescriptionLan"), "desc_vi": "",
            "confidence": "LOW", "status": "PENDING",
            "notes": source_note(version, ["itemMap.json"], f"type={record.get('type')}")
        })
        trace["items"].append(item_id)
        icon = first(record, "Icon")
        if icon:
            trace["asset_references"].append({"source": "itemMap.json", "id": item_id, "field": "Icon", "value": icon})

    char_file = files_map.get(character_id, {})
    profile_specs = [
        ("card_intro", "cardIntrolanText"), ("staff_status", "stafflanText"),
        ("entity_status", "storelanText"),
    ]
    relic = relic_map.get(character_id, {})
    profile_specs += [
        ("relic_name", "relicslanText"), ("relic_dynasty", "dynastylanText"),
        ("relic_museum", "museumlanText"), ("relic_intro", "introductionlanText"),
    ]
    for category, field in profile_specs:
        source_record = char_file if category in {"card_intro", "staff_status", "entity_status"} else relic
        text_cn = first(source_record, field)
        if text_cn:
            pid = f"{character_id}_{category}"
            rows["PROFILE"].append({
                "profile_id": pid, "character_id": character_id, "category": category,
                "title_cn": "", "title_vi": "", "text_cn": text_cn, "text_vi": "",
                "confidence": "LOW", "status": "PENDING",
                "notes": source_note(version, ["characterFiles.json" if source_record is char_file else "historicalRelicsMap.json"], f"field={field}")
            })
            trace["profiles"].append(pid)
    for index, file_id in enumerate(char_file.get("basicFileID", []) or [], 1):
        record = file_text_map.get(file_id, {})
        title = first(record, "titleLanText", "titlelanText", "TitleLanText", "title")
        text = first(record, "textLanText", "TextLanText", "text")
        if title:
            pid = f"{character_id}_report_title_{index}"
            rows["PROFILE"].append({"profile_id": pid, "character_id": character_id, "category": "report_title", "title_cn": title, "title_vi": "", "text_cn": "", "text_vi": "", "confidence": "LOW", "status": "PENDING", "notes": source_note(version, ["characterFileTextMap.json"], f"raw_key={file_id}")})
            trace["profiles"].append(pid)
        if text:
            pid = f"{character_id}_report_content_{index}"
            rows["PROFILE"].append({"profile_id": pid, "character_id": character_id, "category": "report_content", "title_cn": "", "title_vi": "", "text_cn": text, "text_vi": "", "confidence": "LOW", "status": "PENDING", "notes": source_note(version, ["characterFileTextMap.json"], f"raw_key={file_id}")})
            trace["profiles"].append(pid)

    related_talents = [v for v in char_talent_map.values() if scalar(v.get("characterId")) == character_id]
    talent_ids = {first(record, "talentBankId") for record in related_talents}
    talent_ids.update(scalar(x) for record in related_talents for x in (record.get("talentOption", []) or []))
    talent_character_names = {
        first(record, "talentBankId"): first(record, "namelanText", "name")
        for record in related_talents if first(record, "talentBankId")
    }
    for talent_id in sorted(x for x in talent_ids if x):
        record = talent_bank_map.get(talent_id)
        if not isinstance(record, dict):
            trace["unresolved_references"].append({"type": "TALENT", "id": talent_id, "from": character_id})
            continue
        rows["TALENT"].append({
            "talent_bank_id": talent_id,
            "name_cn": talent_character_names.get(talent_id) or first(record, "showTypeNameLanText", "nameLanText", "name"), "name_vi": "",
            "example_desc_cn": first(record, "DescriptionLanText", "descriptionlanText", "des", "description"), "desc_vi": "",
            "category": "TALENT_PATTERN", "confidence": "LOW", "status": "PENDING",
            "notes": source_note(version, ["talentBankMap.json", "characterTalentMap.json"], f"referenced_by={character_id}")
        })
        trace["talents"].append(talent_id)

    for field in ("mainAvatar", "trainingAvatar", "setCharacterAvatar", "beforeFullImage", "afterFullImage"):
        value = char.get(field)
        if value not in (None, "", 0, []):
            trace["asset_references"].append({"source": "characterTable.json", "id": character_id, "field": field, "value": value})
    asset_root = PROJECT_ROOT / "public" / "assets" / "characters"
    avatar = asset_root / "avatars" / f"{character_id}.png"
    if not avatar.exists():
        trace["missing_local_asset_files"].append(str(avatar))
    for skin in skins:
        sid = first(skin, "skinID")
        if sid and not any((asset_root / "drawings" / f"{sid}.{ext}").exists() for ext in ("png", "webp", "jpg", "jpeg")):
            trace["missing_local_asset_files"].append(str(asset_root / "drawings" / f"{sid}.<png|webp|jpg|jpeg>"))

    trace["asset_references"] = list({
        json.dumps(ref, ensure_ascii=False, sort_keys=True): ref for ref in trace["asset_references"]
    }.values())
    for sheet_rows in rows.values():
        for row in sheet_rows:
            for field in VI_FIELDS:
                if field in row:
                    row[field] = ""
    return dict(rows), trace


def compare_existing(sheet: str, current: dict[str, Any], proposed: dict[str, Any], row_number: int) -> dict[str, Any] | None:
    differences = {}
    for field, proposed_value in proposed.items():
        if field in VI_FIELDS or field in {"confidence", "status", "notes"}:
            continue
        current_value = current.get(field)
        if proposed_value not in (None, "") and scalar(current_value) != scalar(proposed_value):
            differences[field] = {"workbook": current_value, "source": proposed_value}
    if differences:
        return {"sheet": sheet, "row": row_number, "primary_key": primary_key(sheet, proposed), "differences": differences}
    return None


def audit_against_backup(backup: Path, current: Path, added: dict[str, list[int]]) -> dict[str, Any]:
    before = load_workbook(backup, data_only=False)
    after = load_workbook(current, data_only=False)
    result: dict[str, Any] = {
        "opens": True, "sheet_names_equal": before.sheetnames == after.sheetnames,
        "rows_before_after": {}, "old_cells_unchanged": True, "old_vi_unchanged": True,
        "no_row_count_decrease": True, "layout_properties_preserved": True,
        "changed_cells": [], "duplicate_primary_ids": {},
    }
    for sheet in before.sheetnames:
        bws, aws = before[sheet], after[sheet]
        result["rows_before_after"][sheet] = [bws.max_row, aws.max_row]
        if aws.max_row < bws.max_row:
            result["no_row_count_decrease"] = False
        for row in range(1, bws.max_row + 1):
            for col in range(1, bws.max_column + 1):
                if bws.cell(row, col).value != aws.cell(row, col).value:
                    result["old_cells_unchanged"] = False
                    result["changed_cells"].append({"sheet": sheet, "cell": aws.cell(row, col).coordinate, "before": bws.cell(row, col).value, "after": aws.cell(row, col).value})
        headers = [scalar(c.value) for c in aws[1]]
        for row in added.get(sheet, []):
            for col, header in enumerate(headers, 1):
                value = aws.cell(row, col).value
                if value not in (None, ""):
                    result["changed_cells"].append({"sheet": sheet, "cell": aws.cell(row, col).coordinate, "before": None, "after": value})
                if header in VI_FIELDS and value not in (None, ""):
                    result["old_vi_unchanged"] = False
        props = lambda ws: (ws.freeze_panes, ws.auto_filter.ref, tuple((k, v.width) for k, v in ws.column_dimensions.items()))
        if props(bws) != props(aws):
            result["layout_properties_preserved"] = False
        if sheet in {"CHARACTER", "SKILL", "BUFF_STATUS", "ZHIZHI", "HUANZHANG", "ITEM", "PROFILE", "SKIN", "TALENT"}:
            _, idx = workbook_index(aws)
            nonempty = sum(1 for r in range(2, aws.max_row + 1) if any(aws.cell(r, c).value not in (None, "") for c in range(1, aws.max_column + 1)))
            duplicates = nonempty - len(idx)
            if duplicates:
                result["duplicate_primary_ids"][sheet] = duplicates
    result["integrity_pass"] = all((result["sheet_names_equal"], result["old_cells_unchanged"], result["old_vi_unchanged"], result["no_row_count_decrease"], result["layout_properties_preserved"], not result["duplicate_primary_ids"]))
    return result


def run(character_id: str, apply: bool, cleanup_internal: bool = False,
        migrate_owner_terms: bool = False) -> dict[str, Any]:
    proposed, trace = collect(character_id)
    buff_map = load_json("buffMap.json", {})
    manifest = build_dependency_manifest(character_id, trace, buff_map)
    workbook = load_workbook(MASTER, data_only=False)
    before_counts = {name: workbook[name].max_row for name in workbook.sheetnames}
    report: dict[str, Any] = {
        "mode": "apply" if apply else "dry-run", "master": str(MASTER),
        "master_sha256_before": sha256(MASTER), "source_version": trace["source_version"],
        "dependency_trace": trace, "rows_to_add_by_sheet": {},
        "source_changed_existing_rows": [], "added_row_numbers": {},
        "dependency_manifest": str(MANIFEST_DIR / f"{character_id}_dependencies.json"),
        "buff_classification_counts": dict(
            __import__("collections").Counter(node["classification"] for node in manifest["nodes"])
        ),
    }
    missing: dict[str, list[dict[str, Any]]] = {}
    existing_updates: dict[str, list[tuple[int, dict[str, Any], bool]]] = defaultdict(list)
    for sheet, candidates in proposed.items():
        if sheet not in workbook.sheetnames:
            trace["unresolved_references"].append({"type": "WORKBOOK_SCHEMA", "id": sheet, "from": character_id})
            continue
        _, existing = workbook_index(workbook[sheet])
        missing[sheet] = []
        for candidate in candidates:
            if (
                cleanup_internal
                and sheet == "BUFF_STATUS"
                and candidate.get("classification_scope") == "INTERNAL_CONTROLLER"
            ):
                # Dependency-only records stay in the D0183 manifest and are
                # deliberately not re-added to the publication workbook.
                continue
            found = existing.get(primary_key(sheet, candidate))
            if found:
                conflict = compare_existing(sheet, found[1], candidate, found[0])
                if conflict:
                    report["source_changed_existing_rows"].append(conflict)
                existing_updates[sheet].append((found[0], candidate, bool(conflict)))
            else:
                missing[sheet].append(candidate)
        report["rows_to_add_by_sheet"][sheet] = len(missing[sheet])

    if not apply:
        if migrate_owner_terms:
            report["term_migration_audit"] = migrate_owner_named_references(workbook, apply=False)
        if cleanup_internal:
            ws = workbook["BUFF_STATUS"]
            headers = [scalar(cell.value) for cell in ws[1]]
            classified = {node["id"]: node["classification"] for node in manifest["nodes"]}
            report["internal_rows_to_remove"] = [
                scalar(ws.cell(row, 1).value) for row in range(2, ws.max_row + 1)
                if classified.get(scalar(ws.cell(row, 1).value)) == "INTERNAL_CONTROLLER"
                and not scalar(ws.cell(row, headers.index("buff_name_vi") + 1).value)
                and not scalar(ws.cell(row, headers.index("buff_desc_vi") + 1).value)
                and scalar(ws.cell(row, headers.index("notes") + 1).value).startswith("Incremental MasterData sync")
            ]
        report["rows_before_after_by_sheet"] = {s: [n, n + len(missing.get(s, []))] for s, n in before_counts.items()}
        print(json.dumps(report, ensure_ascii=False, indent=2, default=str))
        return report

    backup_dir = MASTER.parent / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = backup_dir / f"localization_master_{character_id}_{stamp}.xlsx"
    shutil.copy2(MASTER, backup)
    report["backup"] = str(backup)
    report["backup_sha256"] = sha256(backup)
    if report["backup_sha256"] != report["master_sha256_before"]:
        raise RuntimeError("Backup SHA-256 does not match the pre-edit master SHA-256")

    added: dict[str, list[int]] = defaultdict(list)
    # Appended metadata leaves the positional public exporter unchanged while
    # giving future incremental syncs stable lifecycle/source-change state.
    ensure_sync_metadata_columns(workbook["BUFF_STATUS"])
    lifecycle_updates = []
    for sheet, updates in existing_updates.items():
        ws = workbook[sheet]
        headers, _ = workbook_index(ws)
        header_index = {header: index + 1 for index, header in enumerate(headers)}
        for row_number, candidate, source_changed in updates:
            for field, value in candidate.items():
                if field in VI_FIELDS or field in {"confidence", "status", "notes"} or field not in header_index:
                    continue
                ws.cell(row_number, header_index[field]).value = value
            if sheet == "BUFF_STATUS":
                metadata = metadata_for(candidate, trace)
                has_vi = any(scalar(ws.cell(row_number, header_index[field]).value)
                             for field in ("buff_name_vi", "buff_desc_vi"))
                if source_changed and has_vi:
                    ws.cell(row_number, header_index["status"]).value = "REVIEW"
                    metadata["release_state"] = "SOURCE_CHANGED"
                elif candidate.get("classification_scope") == "PLAYER_FACING" and not has_vi:
                    ws.cell(row_number, header_index["status"]).value = "PENDING"
                for field, value in metadata.items():
                    ws.cell(row_number, header_index[field]).value = value
                lifecycle_updates.append({"sheet": sheet, "row": row_number,
                                          "id": primary_key(sheet, candidate)[0],
                                          "source_changed": source_changed})
    for sheet, candidates in missing.items():
        ws = workbook[sheet]
        headers, _ = workbook_index(ws)
        template_row = max(2, ws.max_row)
        for candidate in candidates:
            target_row = ws.max_row + 1
            copy_row_schema(ws, template_row, target_row, headers)
            for col, header in enumerate(headers, 1):
                if header in candidate:
                    ws.cell(target_row, col).value = candidate[header]
                elif header in VI_FIELDS:
                    ws.cell(target_row, col).value = ""
            if sheet == "BUFF_STATUS":
                for field, value in metadata_for(candidate, trace).items():
                    ws.cell(target_row, headers.index(field) + 1).value = value
            added[sheet].append(target_row)
            template_row = target_row
    if migrate_owner_terms:
        report["term_migration_audit"] = migrate_owner_named_references(workbook, apply=True)
    cleanup_report = {"removed": [], "retained_non_player_facing": []}
    if cleanup_internal:
        MANIFEST_DIR.mkdir(parents=True, exist_ok=True)
        manifest_path = MANIFEST_DIR / f"{character_id}_dependencies.json"
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        cleanup_report = cleanup_internal_rows(workbook, character_id, manifest)
        report["internal_rows_removed"] = cleanup_report["removed"]
        report["ambiguous_rows_retained"] = cleanup_report["retained_non_player_facing"]
    workbook.save(MASTER)
    report["master_sha256_after"] = sha256(MASTER)
    report["lifecycle_updates"] = lifecycle_updates
    report["added_row_numbers"] = dict(added)
    report["rows_added_by_sheet"] = {sheet: len(rows) for sheet, rows in added.items()}
    report["workbook_integrity"] = (
        audit_cleanup_integrity(backup, MASTER, cleanup_report["removed"])
        if cleanup_internal else audit_against_backup(backup, MASTER, dict(added))
    )
    report["rows_before_after_by_sheet"] = report["workbook_integrity"]["rows_before_after"]
    print(json.dumps(report, ensure_ascii=False, indent=2, default=str))
    if not report["workbook_integrity"]["integrity_pass"]:
        raise SystemExit(2)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--character", required=True, help="MasterData character ID, e.g. D0183")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true", help="Report additions/conflicts without writing")
    mode.add_argument("--apply", action="store_true", help="Create a timestamped backup and append missing rows")
    parser.add_argument("--cleanup-internal", action="store_true",
                        help="For a PRELOAD dependency closure, manifest and remove only empty sync-owned controllers")
    parser.add_argument("--migrate-owner-terms", action="store_true",
                        help="Apply only exact CN-rich-text owner-approved named-term migrations")
    args = parser.parse_args()
    run(args.character, args.apply, args.cleanup_internal, args.migrate_owner_terms)


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:
        sys.exit(0)
