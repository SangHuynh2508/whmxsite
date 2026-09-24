"""
Safe mutation script to append raw-backed commerce and inventory fields to SKIN sheet:
- item_id              <- characterSkins.mapItemsID
- goods_id             <- characterSkins.goodsID
- discount_goods_id    <- characterSkins.discountGoodsID
- discount_price       <- charge[discountGoodsID].Cost.count
- discount_start       <- charge[discountGoodsID].StartTime
- discount_end         <- charge[discountGoodsID].EndTime
"""
from __future__ import annotations

import hashlib
import json
import os
import sys

from safe_workbook_mutation import safe_mutate_workbook

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


def get_sha256(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def main():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    master_path = os.path.join(base_dir, "localization", "localization_master.xlsx")
    raw_skins_path = os.path.join(base_dir, "..", "NeoArtifacts", "MasterData", "json", "characterSkins.json")
    charge_path = os.path.join(base_dir, "..", "NeoArtifacts", "MasterData", "json", "charge.json")

    print("=== APPLY SKIN COMMERCE FIELDS MUTATION ===")
    before_sha = get_sha256(master_path)
    print(f"Master workbook path: {master_path}")
    print(f"Master SHA-256 before: {before_sha}")

    with open(raw_skins_path, "r", encoding="utf-8") as f:
        raw_skins_json = json.load(f)

    with open(charge_path, "r", encoding="utf-8") as f:
        charge_json = json.load(f)

    raw_skin_map = {}
    for cid, sl in raw_skins_json.items():
        if isinstance(sl, list):
            for s in sl:
                if s.get("skinType") == 3:
                    raw_skin_map[s["skinID"]] = s

    print(f"Loaded {len(raw_skin_map)} actual skins (skinType == 3) from characterSkins.json")
    print(f"Loaded {len(charge_json)} commodity entries from charge.json")

    NEW_COLUMNS = [
        "item_id",
        "goods_id",
        "discount_goods_id",
        "discount_price",
        "discount_start",
        "discount_end",
    ]

    def mutator(wb):
        ws = wb["SKIN"]
        headers = [ws.cell(1, c).value for c in range(1, ws.max_column + 1)]
        expected_base_headers = [
            "skin_id", "character_id", "skin_name_cn", "skin_name_vi", "desc_cn", "desc_vi",
            "obtain_cn", "obtain_vi", "is_base_skin", "confidence", "status", "notes",
            "skin_type", "unlock_date", "price", "currency", "is_high_skin", "skin_rare",
            "cv_name", "drawing_path", "card_path", "series_id", "series_name_cn", "series_name_vi",
            "avatar_path"
        ]
        assert headers[:25] == expected_base_headers, f"Header mismatch: {headers[:25]} != {expected_base_headers}"

        # Write new headers at cols 26..31
        for idx, col_name in enumerate(NEW_COLUMNS, start=26):
            ws.cell(1, idx, col_name)

        counts = {c: 0 for c in NEW_COLUMNS}
        rows_mutated = 0

        for r in range(2, ws.max_row + 1):
            sid = ws.cell(r, 1).value
            if not sid:
                continue

            raw = raw_skin_map[sid]
            mid = raw.get("mapItemsID")
            gid = raw.get("goodsID")
            dgid = raw.get("discountGoodsID")

            item_id_val = str(mid) if mid else None
            goods_id_val = str(gid) if gid else None
            discount_goods_id_val = str(dgid) if dgid else None

            discount_price_val = None
            discount_start_val = None
            discount_end_val = None

            if dgid:
                dgid_str = str(dgid)
                if dgid_str in charge_json:
                    ch = charge_json[dgid_str]
                    cost = ch.get("Cost", {})
                    if "count" in cost and cost["count"] is not None:
                        discount_price_val = int(cost["count"])
                    if ch.get("StartTime") is not None:
                        discount_start_val = int(ch["StartTime"])
                    if ch.get("EndTime") is not None:
                        discount_end_val = int(ch["EndTime"])

            ws.cell(r, 26, item_id_val)
            ws.cell(r, 27, goods_id_val)
            ws.cell(r, 28, discount_goods_id_val)
            ws.cell(r, 29, discount_price_val)
            ws.cell(r, 30, discount_start_val)
            ws.cell(r, 31, discount_end_val)

            if item_id_val is not None: counts["item_id"] += 1
            if goods_id_val is not None: counts["goods_id"] += 1
            if discount_goods_id_val is not None: counts["discount_goods_id"] += 1
            if discount_price_val is not None: counts["discount_price"] += 1
            if discount_start_val is not None: counts["discount_start"] += 1
            if discount_end_val is not None: counts["discount_end"] += 1
            rows_mutated += 1

        print(f"Mutator finished: {rows_mutated} rows mutated.")
        print(f"Coverage summary: {counts}")

    authorized_deps = {
        "skin_ids": list(raw_skin_map.keys())
    }
    authorized_new_columns = {
        "SKIN": NEW_COLUMNS
    }
    authorized_deleted_rows = {
        "SKIN": {""}
    }

    safe_mutate_workbook(
        base_dir=base_dir,
        mutator_fn=mutator,
        authorized_deps=authorized_deps,
        authorized_new_columns=authorized_new_columns,
        authorized_deleted_rows=authorized_deleted_rows,
    )

    after_sha = get_sha256(master_path)
    print(f"Master SHA-256 after: {after_sha}")
    print("Safe mutation completed successfully!")


if __name__ == "__main__":
    main()
