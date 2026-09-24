"""Audit deterministic Hoán Chương/gameplay/buff popup relationships.

Read-only: this tool never changes MasterData or the localization workbook.
"""

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT.parent / "NeoArtifacts" / "MasterData" / "json"
MASTER = ROOT / "localization" / "localization_master.xlsx"
OUTPUT = ROOT / "localization" / "audits" / "huanzhang_popup_links.json"
KEY_RE = re.compile(r"^characterlan_Brilliant_buffShowLan_[A-Za-z0-9_]+$")
BUFF_RE = re.compile(r"\{(Buff_[^}\s]+)\}")


def load_json(name):
    with (RAW / name).open(encoding="utf-8") as file:
        return json.load(file)


def text(value):
    return str(value or "").strip()


def comparable(value):
    # Rich-text/spacing may differ; placeholders, conditions and {Buff_*} remain.
    return re.sub(r"\s+", "", re.sub(r"<[^>]+>", "", text(value)))


def walk_strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from walk_strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from walk_strings(item)


def headers_and_rows(workbook, sheet):
    ws = workbook[sheet]
    headers = [cell.value for cell in next(ws.iter_rows(max_row=1))]
    return [dict(zip(headers, row)) for row in ws.iter_rows(min_row=2, values_only=True)]


def classify(buff_show, gameplay_descriptions):
    value = text(buff_show)
    if KEY_RE.fullmatch(value):
        return "UNRESOLVED_LOCALIZATION_KEY"
    if not value:
        return "INDEPENDENT_BLOCKS" if gameplay_descriptions else "AMBIGUOUS"
    source = comparable(value)
    exact = [description for description in gameplay_descriptions if source == comparable(description)]
    if exact:
        return "EXACT_DUPLICATE"
    # Prefix/suffix equivalence proves an authored composition, rather than a
    # name-based guess. It preserves all clauses and placeholders for later UI.
    if any(source.startswith(comparable(description)) or comparable(description).startswith(source)
           for description in gameplay_descriptions if text(description)):
        return "PARTIAL_COMPLEMENT"
    # A terminal {Buff_*} marker is a relation, not a prose clause.  It proves a
    # complement only when the remaining gameplay source is a strict prefix; it
    # is deliberately not accepted as EXACT_DUPLICATE.
    for description in gameplay_descriptions:
        without_marker = re.sub(r"\{Buff_[^}]+\}", "", text(description))
        if without_marker and source.startswith(comparable(without_marker)):
            return "PARTIAL_COMPLEMENT"
    return "INDEPENDENT_BLOCKS" if gameplay_descriptions else "AMBIGUOUS"


def main():
    brilliant = load_json("BrilliantMap.json")
    skill_map = load_json("skillMap.json")
    char_skills = load_json("characterSkillMap.json")
    passive_skills = load_json("characterPassiveSkillMap.json")
    buff_map = load_json("buffMap.json")
    workbook = load_workbook(MASTER, read_only=True, data_only=True)
    hz_rows = {text(row.get("brilliant_id")): row for row in headers_and_rows(workbook, "HUANZHANG")}
    buff_rows = {text(row.get("buff_id")): row for row in headers_and_rows(workbook, "BUFF_STATUS")}

    skills_by_group = defaultdict(list)
    for source_name, source in (("skillMap.json", skill_map), ("characterSkillMap.json", char_skills), ("characterPassiveSkillMap.json", passive_skills)):
        for skill_id, record in source.items():
            if isinstance(record, dict) and record.get("GroupId"):
                skills_by_group[text(record["GroupId"])].append((text(skill_id), record, source_name))

    rows = []
    for brilliant_id, record in sorted(brilliant.items()):
        if not isinstance(record, dict):
            continue
        hz = hz_rows.get(text(brilliant_id), {})
        character_id = text(hz.get("character_id"))
        group_ids = []
        for field in ("Buff", "Skill1", "Skill2"):
            values = record.get(field, [])
            for value in values if isinstance(values, list) else [values]:
                if text(value) and text(value) not in group_ids:
                    group_ids.append(text(value))
        gameplay = []
        popup_targets = set()
        seen_skill_ids = set()
        for group_id in group_ids:
            for skill_id, skill, source_name in skills_by_group.get(group_id, []):
                if skill_id in seen_skill_ids:
                    continue
                seen_skill_ids.add(skill_id)
                raw_desc = text(skill.get("DescriptionLanText"))
                gameplay.append({
                    "gameplay_skill_id": skill_id, "group_id": group_id,
                    "description": raw_desc, "source": source_name,
                    "icon_source": "SkillIcon" if text(skill.get("SkillIcon")) else "none",
                    "skill_type_source": "Type" if skill.get("Type") is not None else "none",
                })
                popup_targets.update(BUFF_RE.findall(raw_desc))
                for raw_string in walk_strings(skill.get("Attr", [])):
                    popup_targets.update(re.findall(r"\b(Buff_[A-Za-z0-9_]+)\b", raw_string))
        # Recursive buff edges are raw Attr references, not display-name matches.
        queue, visited = list(popup_targets), set()
        while queue:
            buff_id = queue.pop()
            if buff_id in visited:
                continue
            visited.add(buff_id)
            for raw_string in walk_strings((buff_map.get(buff_id) or {}).get("Attr", [])):
                for child in re.findall(r"\b(Buff_[A-Za-z0-9_]+)\b", raw_string):
                    if child not in visited:
                        queue.append(child)

        raw_show = text(record.get("BuffShowLanText"))
        workbook_show = text(hz.get("buff_show_cn"))
        shown_source = raw_show or workbook_show
        classification = classify(shown_source, [entry["description"] for entry in gameplay])
        warnings = []
        if KEY_RE.fullmatch(shown_source):
            warnings.append("localization_key_not_resolved")
        if not gameplay:
            warnings.append("no_deterministic_gameplay_skill")
        if any(buff_id not in buff_rows for buff_id in visited):
            warnings.append("missing_popup_target")
        if any(entry["icon_source"] == "none" for entry in gameplay):
            warnings.append("gameplay_icon_not_proven")
        rows.append({
            "character_id": character_id,
            "brilliant_id": text(brilliant_id),
            "gameplay_skill_id": [entry["gameplay_skill_id"] for entry in gameplay],
            "metadata_source": "HUANZHANG" if hz else "BrilliantMap only",
            "buff_show_source": "BrilliantMap.BuffShowLanText" if raw_show else ("HUANZHANG.buff_show_cn" if workbook_show else "none"),
            "localization_key": shown_source if KEY_RE.fullmatch(shown_source) else "",
            "buff_ids": sorted(visited),
            "classification": classification,
            "icon_source": sorted(set(entry["icon_source"] for entry in gameplay)),
            "skill_type_source": sorted(set(entry["skill_type_source"] for entry in gameplay)),
            "popup_targets": sorted(visited),
            "warnings": warnings,
            "provenance": f"BrilliantMap.{brilliant_id} → {', '.join(group_ids) or 'no linked gameplay'}",
        })

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    result = {
        "summary": dict(Counter(row["classification"] for row in rows)),
        "missing_popup_targets": sum("missing_popup_target" in row["warnings"] for row in rows),
        "rows": rows,
    }
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] {OUTPUT} ({len(rows)} brilliant records)")


if __name__ == "__main__":
    main()
