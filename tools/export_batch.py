"""Export a character translation batch with its rendered-data dependencies."""

import json
import os
import re
import sys
from collections import defaultdict

import pandas as pd


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
MASTER_FILE = os.path.join(PROJECT_ROOT, "localization", "localization_master.xlsx")
if not os.path.exists(MASTER_FILE):
    fallback_master = os.path.join(PROJECT_ROOT, "localization_master.xlsx")
    if os.path.exists(fallback_master):
        MASTER_FILE = fallback_master
RAW_DIR = os.path.join(os.path.dirname(PROJECT_ROOT), "NeoArtifacts", "MasterData", "json")
DEFAULT_OUTPUT = os.path.join(PROJECT_ROOT, "batch_5_characters_export.xlsx")
DEFAULT_CHARACTERS = ["V0146", "A0084", "A0086", "A0090", "A0093"]
INTENTIONALLY_EXCLUDED_SHEETS = {
    "GLOSSARY", "TALENT", "ITEM", "PROFILE", "REVIEW", "REVIEW_CANDIDATES", "UI_SYSTEM",
}
BUFF_TAG_RE = re.compile(r"\{(Buff_[^}\s]+)\}", re.IGNORECASE)
HAN_RE = re.compile(r"[\u3400-\u9fff\uf900-\ufaff]")
PRIMARY_COLUMNS = {
    "CHARACTER": "character_id", "SKILL": "skill_id", "ZHIZHI": "character_id",
    "HUANZHANG": "brilliant_id", "BUFF_STATUS": "buff_id", "SKIN": "skin_id",
}


def clean_id(value):
    """Normalize all relational identifiers, including mixed-case Buff tags."""
    if value is None or pd.isna(value):
        return ""
    return str(value).strip().upper()


def read_json(name):
    path = os.path.join(RAW_DIR, name)
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def strings_in(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from strings_in(item)
    elif isinstance(value, list):
        for item in value:
            yield from strings_in(item)


def buff_tags_in(value):
    return {clean_id(tag) for text in strings_in(value) for tag in BUFF_TAG_RE.findall(text)}


def expected_raw_dependencies(target_cids):
    """Find concrete gameplay groups and BUFF tags from raw game relations."""
    char_table = read_json("characterTable.json")
    roleattrs = read_json("roleattrMap.json")
    brilliant = read_json("BrilliantMap.json")
    skill_map = read_json("skillMap.json")
    char_skills = read_json("charSkillMap.json")
    passive_map = read_json("passiveSkillMap.json")
    groups, buffs, brilliant_ids = defaultdict(set), defaultdict(set), defaultdict(set)

    for cid in target_cids:
        entry = char_table.get(cid, {}) if isinstance(char_table, dict) else {}
        for slot in range(1, 7):
            value = entry.get(f"skill{slot}") if isinstance(entry, dict) else None
            if isinstance(value, list) and value:
                groups[cid].add(clean_id(value[0]))

        for star in range(1, 7):
            attrs = (roleattrs.get(f"{cid}{star}") or {}) if isinstance(roleattrs, dict) else {}
            for field in ("starUpAttr", "starUpAttr2"):
                values = attrs.get(field)
                for value in values if isinstance(values, list) else [values]:
                    if isinstance(value, str) and value.startswith("SkillUP,"):
                        base_id = clean_id(value.split(",", 1)[1])
                        groups[cid].update({base_id, f"{base_id}EX"})

        for mapping in (char_skills, passive_map):
            if isinstance(mapping, dict):
                for value in mapping.values():
                    if isinstance(value, dict) and clean_id(value.get("HeroId")) == cid and not value.get("IsConceal", False):
                        groups[cid].add(clean_id(value.get("GroupId")))

        if isinstance(brilliant, dict):
            for brilliant_id, value in brilliant.items():
                if clean_id(brilliant_id).startswith(cid) and isinstance(value, dict):
                    brilliant_ids[cid].add(clean_id(brilliant_id))
                    for field in ("Buff", "Skill1", "Skill2"):
                        related_values = value.get(field, [])
                        for related in related_values if isinstance(related_values, list) else [related_values]:
                            if related:
                                groups[cid].add(clean_id(related))
                    buffs[cid].update(buff_tags_in(value))

        # Some shared statuses live only in raw Attr fields, so descriptions are
        # insufficient as a dependency source.
        for mapping in (skill_map, char_skills, passive_map):
            if isinstance(mapping, dict):
                for value in mapping.values():
                    if isinstance(value, dict) and clean_id(value.get("GroupId")) in groups[cid]:
                        buffs[cid].update(buff_tags_in(value))
    return groups, buffs, brilliant_ids


def selected_rows(frame, column, values):
    if frame.empty or column not in frame.columns:
        return frame.iloc[0:0].copy()
    return frame[frame[column].map(clean_id).isin(values)].copy()


def needs_translation(row, source_field, vi_field):
    source, vi = str(row.get(source_field) or "").strip(), str(row.get(vi_field) or "").strip()
    return bool(source) and (not vi or bool(HAN_RE.search(vi)))


def record_id_for(sheet, row):
    column = PRIMARY_COLUMNS.get(sheet, "")
    if sheet == "ZHIZHI":
        return f"{clean_id(row.get('character_id'))}:star:{clean_id(row.get('star'))}"
    return clean_id(row.get(column)) if column else ""


def translation_fields(sheet, row):
    fields = []
    for field in row.index:
        if not field.endswith("_vi"):
            continue
        source_field = field[:-3] + "_cn"
        if source_field in row.index and needs_translation(row, source_field, field):
            fields.append((source_field, field))
    return fields


def export_batch(char_ids, output_file=DEFAULT_OUTPUT):
    if not os.path.exists(MASTER_FILE):
        raise FileNotFoundError(f"Không tìm thấy file master tại: {MASTER_FILE}")
    target_cids = {clean_id(cid) for cid in char_ids if clean_id(cid)}
    if not target_cids:
        raise ValueError("Danh sách ID nhân vật trống")

    print(f"[+] Export dependency closure for: {', '.join(sorted(target_cids))}")
    workbook = pd.ExcelFile(MASTER_FILE)
    frames = {sheet: pd.read_excel(MASTER_FILE, sheet_name=sheet) for sheet in workbook.sheet_names}
    groups, raw_buff_refs, brilliant_ids = expected_raw_dependencies(target_cids)
    selected = {}

    # Direct character rows are selected first. SKILL is then extended by actual
    # raw group IDs, preserving EX and HZ gameplay if character_id was omitted.
    for sheet, frame in frames.items():
        if sheet in INTENTIONALLY_EXCLUDED_SHEETS or sheet == "BUFF_STATUS":
            continue
        if "character_id" in frame.columns:
            selected[sheet] = selected_rows(frame, "character_id", target_cids)

    skill_frame = frames.get("SKILL", pd.DataFrame())
    expected_groups = set().union(*groups.values()) if groups else set()
    selected["SKILL"] = pd.concat([
        selected.get("SKILL", skill_frame.iloc[0:0].copy()),
        selected_rows(skill_frame, "skill_group_id", expected_groups),
        # EX rows retain their base skill_group_id in the workbook; their actual
        # rendered relation is the exact skill_id ending in ``ex``.
        selected_rows(skill_frame, "skill_id", expected_groups),
    ], ignore_index=True).drop_duplicates()

    hz_frame = frames.get("HUANZHANG", pd.DataFrame())
    expected_hz_ids = set().union(*brilliant_ids.values()) if brilliant_ids else set()
    selected["HUANZHANG"] = pd.concat([
        selected.get("HUANZHANG", hz_frame.iloc[0:0].copy()),
        selected_rows(hz_frame, "brilliant_id", expected_hz_ids),
    ], ignore_index=True).drop_duplicates()

    # Close over direct workbook tags from all rendered content fields.
    buff_refs = set().union(*raw_buff_refs.values()) if raw_buff_refs else set()
    for sheet in ("SKILL", "HUANZHANG", "ZHIZHI"):
        frame = selected.get(sheet, pd.DataFrame())
        if not frame.empty:
            for value in frame.fillna("").astype(str).to_numpy().flat:
                buff_refs.update(clean_id(tag) for tag in BUFF_TAG_RE.findall(value))

    buff_frame = frames.get("BUFF_STATUS", pd.DataFrame())
    selected_buffs = buff_frame.iloc[0:0].copy()
    pending, seen = set(buff_refs), set()
    while pending:
        wanted = pending - seen
        if not wanted:
            break
        seen.update(wanted)
        newly_selected = pd.concat([
            selected_rows(buff_frame, "buff_id", wanted),
            selected_rows(buff_frame, "group_root_id", wanted),
        ], ignore_index=True).drop_duplicates()
        selected_buffs = pd.concat([selected_buffs, newly_selected], ignore_index=True).drop_duplicates()
        for value in newly_selected.fillna("").astype(str).to_numpy().flat:
            pending.update(clean_id(tag) for tag in BUFF_TAG_RE.findall(value))
    if not selected_buffs.empty:
        selected["BUFF_STATUS"] = selected_buffs

    exported_groups = set(selected["SKILL"].get("skill_group_id", pd.Series(dtype=str)).map(clean_id))
    exported_groups.update(selected["SKILL"].get("skill_id", pd.Series(dtype=str)).map(clean_id))
    exported_buffs = set(selected_buffs.get("buff_id", pd.Series(dtype=str)).map(clean_id))
    missing_groups = sorted(group for group in expected_groups if group and group not in exported_groups)
    missing_buffs = sorted(buff for buff in buff_refs if buff and buff not in exported_buffs)

    manifest = []
    for sheet, frame in selected.items():
        if frame.empty:
            continue
        for _, row in frame.iterrows():
            row_cid = clean_id(row.get("character_id"))
            owner_cids = [row_cid] if row_cid in target_cids else sorted(target_cids)
            translated_fields = translation_fields(sheet, row)
            for cid in owner_cids:
                fields = translated_fields or [("", "")]
                for source_field, vi_field in fields:
                    relation = "direct character row" if row_cid == cid else "raw dependency closure"
                    if sheet == "SKILL" and clean_id(row.get("skill_id")).endswith("EX"):
                        relation = "roleattrMap SkillUP → EX skill"
                    elif sheet == "SKILL" and clean_id(row.get("skill_group_id")) in groups[cid]:
                        relation = "raw skill/BrilliantMap group relation"
                    elif sheet == "HUANZHANG":
                        relation = "BrilliantMap brilliant_id relation"
                    elif sheet == "BUFF_STATUS":
                        relation = "direct or recursive {Buff_*} reference"
                    manifest.append({
                        "character_id": cid, "sheet": sheet, "record_id": record_id_for(sheet, row),
                        "record_type": "translation_needed" if source_field else "context_row",
                        "required_by": relation, "relation_path": relation,
                        "source_field": source_field, "vi_field": vi_field,
                        "included": "YES", "exclusion_reason": "",
                    })

    checklist = []
    for cid in sorted(target_cids):
        cid_skills = selected["SKILL"][selected["SKILL"].get("character_id", pd.Series(dtype=str)).map(clean_id) == cid]
        base_count = sum(not clean_id(row.get("skill_id")).endswith("EX") and clean_id(row.get("skill_group_id")) not in set().union(*brilliant_ids.values()) for _, row in cid_skills.iterrows())
        ex_count = sum(clean_id(row.get("skill_id")).endswith("EX") for _, row in cid_skills.iterrows())
        gameplay_count = sum(clean_id(row.get("skill_group_id")) in groups[cid] and clean_id(row.get("skill_group_id")) in set().union(*[set(v.get("Buff", []) + v.get("Skill1", []) + v.get("Skill2", [])) for bid, v in read_json("BrilliantMap.json").items() if clean_id(bid).startswith(cid) and isinstance(v, dict)]) for _, row in cid_skills.iterrows())
        zz_count = len(selected.get("ZHIZHI", pd.DataFrame()).loc[lambda f: f.get("character_id", pd.Series(dtype=str)).map(clean_id) == cid])
        hz_count = len(selected.get("HUANZHANG", pd.DataFrame()).loc[lambda f: f.get("character_id", pd.Series(dtype=str)).map(clean_id) == cid])
        direct_buffs = len(raw_buff_refs[cid])
        recursive_buffs = max(0, len(buff_refs) - direct_buffs)
        cid_missing = [item for item in missing_groups if item in groups[cid]]
        checklist.append({
            "character_id": cid, "base_skill_count": base_count, "ex_skill_count": ex_count,
            "zhizhi_record_count": zz_count, "huanzhang_metadata_count": hz_count,
            "huanzhang_gameplay_count": gameplay_count, "direct_buff_count": direct_buffs,
            "recursive_buff_count": recursive_buffs, "required_record_count": len(groups[cid]) + hz_count + zz_count + len(raw_buff_refs[cid]),
            "exported_record_count": len(cid_skills) + hz_count + zz_count,
            "missing_ids": ", ".join(cid_missing),
            "unresolved_references": ", ".join(missing_buffs),
        })
    unresolved = ([{"kind": "missing_expected_skill_group", "id": item} for item in missing_groups] +
                  [{"kind": "missing_referenced_buff", "id": item} for item in missing_buffs])

    total_rows = sum(len(frame) for frame in selected.values())
    if total_rows == 0:
        raise RuntimeError("Không tìm thấy dữ liệu nào cho các ID đã cung cấp")
    os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)
    with pd.ExcelWriter(output_file, engine="openpyxl") as writer:
        for sheet, frame in selected.items():
            if not frame.empty:
                frame.to_excel(writer, sheet_name=sheet[:31], index=False)
        pd.DataFrame(manifest).to_excel(writer, sheet_name="EXPORT_MANIFEST", index=False)
        pd.DataFrame(checklist).to_excel(writer, sheet_name="CHARACTER_CHECKLIST", index=False)
        pd.DataFrame([{"context_type": "read_only", "source": "GLOSSARY", "note": "No glossary rows are required for this dependency closure; do not merge this sheet."}]).to_excel(writer, sheet_name="REFERENCE_CONTEXT", index=False)
        pd.DataFrame(unresolved, columns=["kind", "id"]).to_excel(writer, sheet_name="UNRESOLVED_REFERENCES", index=False)
    print(f"[V] Exported {total_rows} rows; missing groups={len(missing_groups)}, buffs={len(missing_buffs)}; SAFE_TO_SEND_TO_GROK={'YES' if not unresolved else 'NO'}")


if __name__ == "__main__":
    args = sys.argv[1:]
    output = DEFAULT_OUTPUT
    use_partial_audit = "--partial-audit" in args
    args = [arg for arg in args if arg != "--partial-audit"]
    if "--output" in args:
        index = args.index("--output")
        if index + 1 >= len(args):
            raise SystemExit("--output requires a path")
        output = args[index + 1]
        del args[index:index + 2]
    if use_partial_audit:
        audit_file = os.path.join(PROJECT_ROOT, "localization", "audits", "partial_character_translations.xlsx")
        audit = pd.read_excel(audit_file, sheet_name="SUMMARY")
        args = [clean_id(value) for value in audit.get("character_id", []) if clean_id(value) != "A0001"]
    export_batch(args or DEFAULT_CHARACTERS, output)
