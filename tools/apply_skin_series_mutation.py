#!/usr/bin/env python3
"""WHMX - Safe Mutation Script to add Series metadata and avatar_path to SKIN sheet.

Follows safe_workbook_mutation with atomic replacement and scope check.
Preserves all existing data in columns 1..21.
Appends:
- series_id (characterSkins.skinLOGO: 202..220, or None for 0)
- series_name_cn (Canonical CN Series name, or None for 0)
- series_name_vi (None / blank until owner approval)
- avatar_path (characters/{cid}/avatars/{sid}.png)
"""

import json
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
from tools.safe_workbook_mutation import safe_mutate_workbook

SERIES_MAP_CN = {
    202: "新春",
    203: "花朝",
    204: "节气",
    205: "非遗",
    206: "闲趣",
    207: "长安",
    208: "绮梦",
    209: "幸食",
    210: "纪念",
    211: "异象",
    212: "幻景",
    213: "行者",
    214: "裁样",
    215: "聆律",
    216: "秦音",
    217: "织彩",
    218: "异世",
    219: "消暑",
    220: "云想新裳"
}

NEW_COLUMNS = ["series_id", "series_name_cn", "series_name_vi", "avatar_path"]


def mutate_skin_series(wb):
    ws = wb["SKIN"]
    headers = [cell.value for cell in ws[1]]
    orig_len = len(headers)

    # Append new headers
    for i, col_name in enumerate(NEW_COLUMNS, start=orig_len + 1):
        ws.cell(1, i, col_name)

    # Load raw MasterData
    raw_path = BASE_DIR.parent / "NeoArtifacts" / "MasterData" / "json" / "characterSkins.json"
    skins_raw = json.load(open(raw_path, "r", encoding="utf-8"))

    raw_map = {}
    for slist in skins_raw.values():
        if isinstance(slist, list):
            for s in slist:
                raw_map[s["skinID"]] = s

    # Populate rows
    updated_count = 0
    series_assigned = 0
    series_zero = 0

    for r in range(2, ws.max_row + 1):
        sid = str(ws.cell(r, 1).value or "").strip()
        if not sid:
            continue
        raw = raw_map.get(sid, {})
        cid = raw.get("characterId") or sid[:5]

        logo = raw.get("skinLOGO")
        if logo and logo in SERIES_MAP_CN:
            s_id = logo
            s_name_cn = SERIES_MAP_CN[logo]
            series_assigned += 1
        else:
            s_id = None
            s_name_cn = None
            series_zero += 1

        s_name_vi = None  # Blank until owner approval
        avatar_p = f"characters/{cid.lower()}/avatars/{sid.lower()}.png"

        # Write to appended columns
        ws.cell(r, orig_len + 1, s_id)
        ws.cell(r, orig_len + 2, s_name_cn)
        ws.cell(r, orig_len + 3, s_name_vi)
        ws.cell(r, orig_len + 4, avatar_p)
        updated_count += 1

    print(f"[MUTATOR] Updated {updated_count} rows in SKIN sheet.")
    print(f"[MUTATOR] Series assigned (202..220): {series_assigned}")
    print(f"[MUTATOR] Series zero / unassigned: {series_zero}")
    assert updated_count == 145, f"Expected 145 rows updated, got {updated_count}"
    assert series_assigned == 144, f"Expected 144 assigned, got {series_assigned}"
    assert series_zero == 1, f"Expected 1 zero, got {series_zero}"


def main():
    raw_path = BASE_DIR.parent / "NeoArtifacts" / "MasterData" / "json" / "characterSkins.json"
    skins_raw = json.load(open(raw_path, "r", encoding="utf-8"))
    all_sids = [s["skinID"] for sl in skins_raw.values() if isinstance(sl, list) for s in sl if s.get("skinType") == 3]

    authorized_deps = {"skin_ids": all_sids}
    authorized_new_columns = {"SKIN": NEW_COLUMNS}

    print("[START] Safe mutation of localization_master.xlsx SKIN sheet...")
    safe_mutate_workbook(
        base_dir=str(BASE_DIR),
        mutator_fn=mutate_skin_series,
        authorized_deps=authorized_deps,
        authorized_new_columns=authorized_new_columns
    )
    print("[SUCCESS] SKIN sheet safe mutation completed successfully!")


if __name__ == "__main__":
    main()
