"""Safe workbook mutation: reduce SKIN sheet to 145 actual skins, add ITEM 8 currency 'Vé Trang Phục'."""
import json
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
from tools.safe_workbook_mutation import safe_mutate_workbook

def mutator_fn(wb):
    # 1. Update ITEM sheet: append item 8 (Vé Trang Phục)
    ws_item = wb["ITEM"]
    existing_items = {str(ws_item.cell(r, 1).value or "").strip() for r in range(2, ws_item.max_row + 1)}
    if "8" not in existing_items:
        new_row = [
            "8",
            "currency",
            "衣装券",
            "Vé Trang Phục",
            "可用来兑换器者衣装的票券。",
            "Vé dùng để đổi trang phục Khí Giả.",
            "HIGH",
            "APPROVED",
            "Canonical currency authority: MasterData itemMap.json id=8"
        ]
        ws_item.append(new_row)

    # 2. Update SKIN sheet: keep ONLY custom skins (skinType == 3), update currency to 'Vé Trang Phục'
    ws_skin = wb["SKIN"]
    skin_headers = [c.value for c in ws_skin[1]]
    
    skins_raw = json.load(open("D:/BaiTapCode/WHMX/NeoArtifacts/MasterData/json/characterSkins.json", encoding="utf-8"))
    custom_skin_ids = set()
    for cid, slist in skins_raw.items():
        for s in slist:
            if s.get("skinType") == 3:
                custom_skin_ids.add(s["skinID"])

    # Read existing rows in order
    kept_rows = []
    for r in range(2, ws_skin.max_row + 1):
        row_vals = [ws_skin.cell(r, c).value for c in range(1, len(skin_headers) + 1)]
        sid = str(row_vals[0] or "").strip()
        if sid in custom_skin_ids:
            # Update currency column (col 16, index 15) to 'Vé Trang Phục' if raw was '衣装券'
            if row_vals[15] == "衣装券":
                row_vals[15] = "Vé Trang Phục"
            kept_rows.append(row_vals)

    # Delete all data rows in ws_skin
    ws_skin.delete_rows(2, ws_skin.max_row)
    
    # Re-append kept rows in exact order
    for row in kept_rows:
        ws_skin.append(row)

def main():
    skins_raw = json.load(open("D:/BaiTapCode/WHMX/NeoArtifacts/MasterData/json/characterSkins.json", encoding="utf-8"))
    custom_skin_ids = set()
    base_skin_ids = set()
    for cid, slist in skins_raw.items():
        for s in slist:
            sid = s["skinID"]
            if s.get("skinType") == 3:
                custom_skin_ids.add(sid)
            else:
                base_skin_ids.add(sid)

    authorized_deps = {
        "skin_ids": list(custom_skin_ids),
        "item_ids": ["8"]
    }
    authorized_new_rows = {
        "ITEM": {"8"}
    }
    authorized_deleted_rows = {
        "SKIN": base_skin_ids
    }
    authorized_cells = [
        ("SKIN", sid, "currency") for sid in custom_skin_ids
    ]

    print(f"[MUTATION] Target: Retain {len(custom_skin_ids)} custom skins, delete {len(base_skin_ids)} base appearances, add ITEM 8...")
    safe_mutate_workbook(
        base_dir=str(BASE_DIR),
        mutator_fn=mutator_fn,
        authorized_deps=authorized_deps,
        authorized_new_rows=authorized_new_rows,
        authorized_deleted_rows=authorized_deleted_rows,
        authorized_cells=authorized_cells
    )
    print("[MUTATION SUCCESS] SKIN sheet reduced to 145 actual skins and ITEM 8 successfully added!")

if __name__ == "__main__":
    main()
