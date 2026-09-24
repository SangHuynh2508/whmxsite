"""Audit partially translated, frontend-rendered character content.

This tool reads the master workbook without modifying it.  It emits structured
rows for the Artifact Tool writer, which creates the requested XLSX report.
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / "localization" / "localization_master.xlsx"
GENERATED = ROOT / "localization" / "generated_localization.json"
PUBLIC = ROOT / "public" / "data.json"
OUTPUT = ROOT / "localization" / "audits" / "partial_character_translations.xlsx"
HAN_RE = re.compile(r"[\u3400-\u9fff\uf900-\ufaff]")
BUFF_RE = re.compile(r"\{(Buff_[^}\s]+)\}", re.IGNORECASE)


def clean(value):
    return str(value or "").strip()


def key(value):
    return clean(value).upper()


def valid_vi(value):
    value = clean(value)
    return bool(value) and not HAN_RE.search(value)


def reason(value):
    if not clean(value):
        return "blank_vi"
    if HAN_RE.search(clean(value)):
        return "mixed_cn_vi" if len(clean(value)) > 1 else "chinese_only"
    return ""


def sheet_rows(book, name):
    ws = book[name]
    headers = [cell.value for cell in next(ws.iter_rows(min_row=1, max_row=1))]
    return [dict(zip(headers, (cell.value for cell in row))) for row in ws.iter_rows(min_row=2)]


def public_skill_value(character, group_id, field):
    for collection in (character.get("skills", []), character.get("brilliant_skills", [])):
        for skill in collection:
            if key(skill.get("group_id")) == key(group_id):
                levels = skill.get("levels", [])
                if levels:
                    return clean(levels[0].get(field))
    return ""


def rendered_skill_groups(character):
    groups = set()
    for collection in (character.get("skills", []), character.get("brilliant_skills", [])):
        groups.update(key(skill.get("group_id")) for skill in collection)
    for star in character.get("zhizhi", []):
        upgrade = star.get("skill_upgrade") or {}
        enhanced = upgrade.get("enhanced_skill") or {}
        if enhanced.get("group_id"):
            groups.add(key(enhanced["group_id"]))
    return groups


def generated_skill_value(skills, record_id, group_id):
    row = skills.get(record_id)
    if row:
        return clean(row.get("desc_vi"))
    for candidate, value in skills.items():
        if key(candidate).startswith(f"{group_id}_"):
            return clean(value.get("desc_vi"))
    return ""


def add_issue(issues, translated, row, cid, section, sheet, record_id, relation,
              source_field, vi_field, source, current_vi, generated_value, public_value,
              counts_as_direct=True):
    if not clean(source):
        return
    if valid_vi(current_vi):
        if counts_as_direct:
            translated[cid] += 1
        return
    missing_reason = reason(current_vi)
    if not missing_reason:
        return
    issues.append({
        "character_id": cid, "section": section, "sheet": sheet,
        "record_id": record_id, "relation_from": relation,
        "source_field": source_field, "vi_field": vi_field,
        "source_cn": clean(source), "current_vi": clean(current_vi),
        "generated_value": clean(generated_value), "public_value": clean(public_value),
        "missing_reason": missing_reason,
        "suggested_action": "translate the matching source field; Chinese fallback is intentional until then",
    })


def build_report():
    with open(GENERATED, encoding="utf-8") as file:
        generated = json.load(file)
    with open(PUBLIC, encoding="utf-8") as file:
        public = json.load(file)
    workbook = load_workbook(MASTER, read_only=True, data_only=True)
    skills = sheet_rows(workbook, "SKILL")
    huanzhang = sheet_rows(workbook, "HUANZHANG")
    buffs = sheet_rows(workbook, "BUFF_STATUS")

    translated = defaultdict(int)
    issues, referenced_buffs, rendered_cids = [], defaultdict(set), set()
    skill_rows_by_cid = defaultdict(list)
    for row in skills:
        cid = key(row.get("character_id"))
        if cid:
            skill_rows_by_cid[cid].append(row)
    hz_rows_by_cid = defaultdict(list)
    for row in huanzhang:
        cid = key(row.get("character_id"))
        if cid:
            hz_rows_by_cid[cid].append(row)

    for cid, rows in skill_rows_by_cid.items():
        character = public.get("characters", {}).get(cid, {})
        visible_groups = rendered_skill_groups(character)
        for row in rows:
            record_id, record_key, group_id = clean(row.get("skill_id")), key(row.get("skill_id")), key(row.get("skill_group_id"))
            rendered_id = record_key if record_key.endswith("EX") else group_id
            if rendered_id not in visible_groups:
                continue
            slot = key(row.get("skill_slot"))
            section = "huanzhang" if slot in {"06", "061"} or "HUANZHANG" in key(row.get("type_label")) else ("ex_skill" if record_key.endswith("EX") else "base_skill")
            generated_value = generated_skill_value(generated.get("skills", {}), record_id, rendered_id)
            public_value = public_skill_value(character, rendered_id, "desc_vi")
            add_issue(issues, translated, row, cid, section, "SKILL", record_id, f"SKILL.gameplay_id={rendered_id}",
                      "desc_cn", "desc_vi", row.get("desc_cn"), row.get("desc_vi"), generated_value, public_value)
            if clean(row.get("desc_cn")):
                rendered_cids.add(cid)
                referenced_buffs[cid].update(key(value) for value in BUFF_RE.findall(clean(row.get("desc_cn"))))

    for cid, rows in hz_rows_by_cid.items():
        character = public.get("characters", {}).get(cid, {})
        info = character.get("brilliant_info") or {}
        for row in rows:
            record_id = key(row.get("brilliant_id"))
            for source_field, vi_field, public_field, section in (
                ("icon_info_cn", "icon_info_vi", "info_vi", "huanzhang"),
                ("buff_show_cn", "buff_show_vi", "buff_show_vi", "huanzhang"),
            ):
                add_issue(issues, translated, row, cid, section, "HUANZHANG", record_id,
                          f"HUANZHANG.brilliant_id={record_id}", source_field, vi_field,
                          row.get(source_field), row.get(vi_field),
                          generated.get("huanzhang", {}).get(record_id, {}).get(vi_field), info.get(public_field))
                if clean(row.get(source_field)):
                    rendered_cids.add(cid)
                    referenced_buffs[cid].update(key(value) for value in BUFF_RE.findall(clean(row.get(source_field))))

    buff_by_id = {key(row.get("buff_id")): row for row in buffs}
    for cid, buff_ids in referenced_buffs.items():
        for buff_id in sorted(buff_ids):
            row = buff_by_id.get(buff_id)
            if not row:
                issues.append({"character_id": cid, "section": "buff", "sheet": "BUFF_STATUS", "record_id": buff_id,
                               "relation_from": "rendered content Buff tag", "source_field": "buff_desc_cn", "vi_field": "buff_desc_vi",
                               "source_cn": "", "current_vi": "", "generated_value": "", "public_value": "",
                               "missing_reason": "missing_buff_record", "suggested_action": "add or export the referenced BUFF_STATUS record"})
                continue
            add_issue(issues, translated, row, cid, "buff", "BUFF_STATUS", buff_id, "rendered content Buff tag",
                      "buff_desc_cn", "buff_desc_vi", row.get("buff_desc_cn"), row.get("buff_desc_vi"),
                      generated.get("buffs", {}).get(buff_id, {}).get("buff_desc_vi"), "popup metadata",
                      counts_as_direct=False)

    issue_by_cid = defaultdict(list)
    for item in issues:
        issue_by_cid[item["character_id"]].append(item)
    all_cids = set(skill_rows_by_cid) | set(hz_rows_by_cid)
    summary, excluded = [], []
    for cid in sorted(all_cids):
        current = issue_by_cid[cid]
        if cid == "A0001":
            excluded.append({"character_id": cid, "reason": "player_avatar_temporary_character"})
        elif not rendered_cids.__contains__(cid):
            excluded.append({"character_id": cid, "reason": "no_rendered_content"})
        elif not translated[cid]:
            excluded.append({"character_id": cid, "reason": "completely_untranslated"})
        elif not current:
            excluded.append({"character_id": cid, "reason": "fully_translated"})
        else:
            counts = defaultdict(int)
            for item in current:
                counts[item["section"]] += 1
            mixed = sum(item["missing_reason"] == "mixed_cn_vi" for item in current)
            summary.append({
                "character_id": cid, "translated_direct_content_count": translated[cid], "missing_direct_content_count": len(current),
                "mixed_cn_vi_count": mixed, "base_skill_missing": counts["base_skill"],
                "ex_skill_missing": counts["ex_skill"], "huanzhang_missing": counts["huanzhang"],
                "zhizhi_missing": counts["zhizhi"], "buff_dependency_missing": counts["buff"],
                "coverage_percent": round(100 * translated[cid] / (translated[cid] + len(current)), 1),
                "priority": f"P{1 if len(current) <= 2 else 2}", "notes": "partially translated rendered content",
            })

    trace = []
    for cid, hz_id, hz_group, ex_id in (("W0029", "W00294", "W002906", "W002903ex"), ("V0141", "V01414", "V014106", "V014102ex")):
        trace.extend([
            {"character_id": cid, "ui_section": "Hoán Chương metadata/effect", "source_sheet": "HUANZHANG", "source_record_id": hz_id,
             "localized_field": "icon_info_*; buff_show_*", "generated_path": f"huanzhang.{hz_id}", "public_path": f"characters.{cid}.brilliant_info",
             "frontend_renderer": "buildHuanzhangPanelHtml", "fallback_order": "valid VI → Chinese; metadata is not a second card", "popup_reference_source": "BrilliantMap relation + SKILL mechanics"},
            {"character_id": cid, "ui_section": "Hoán Chương linked gameplay", "source_sheet": "SKILL", "source_record_id": f"{hz_group}1",
             "localized_field": "desc_*", "generated_path": f"skills.{hz_group}1", "public_path": f"characters.{cid}.brilliant_skills[{hz_group}]",
             "frontend_renderer": "renderSkillEntry", "fallback_order": "SKILL VI → proven HUANZHANG BuffShow VI → SKILL Chinese", "popup_reference_source": "SKILL raw Attr/{Buff_*}"},
            {"character_id": cid, "ui_section": "Trí Tri skill upgrade", "source_sheet": "SKILL", "source_record_id": ex_id,
             "localized_field": "desc_*", "generated_path": f"skills.{ex_id}", "public_path": f"characters.{cid}.zhizhi[*].skill_upgrade.enhanced_skill",
             "frontend_renderer": "buildZhizhiHtml", "fallback_order": "matching EX VI → Chinese", "popup_reference_source": "enhanced SKILL mechanics"},
        ])
    # Dependency gaps are useful only after direct character content proved that
    # the character is partially translated.  Do not leak fully/untranslated or
    # temporary-avatar rows into the actionable sheet sent to translators.
    included_cids = {row["character_id"] for row in summary}
    issues = [row for row in issues if row["character_id"] in included_cids]
    return {"SUMMARY": summary, "MISSING_FIELDS": issues, "SOURCE_TRACE": trace, "EXCLUDED": excluded}


def main():
    report = build_report()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".json", delete=False) as payload:
        json.dump(report, payload, ensure_ascii=False)
        payload_path = payload.name
    try:
        node = os.environ.get("CODEX_NODE_BIN") or shutil.which("node") or r"C:\Users\Legion\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
        subprocess.run([node, str(ROOT / "tools" / "write_partial_translation_audit.mjs"), payload_path, str(OUTPUT)], check=True)
    finally:
        os.unlink(payload_path)
    print(f"[V] {OUTPUT}")


if __name__ == "__main__":
    main()
