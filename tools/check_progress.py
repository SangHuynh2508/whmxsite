#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
check_progress.py
Kiểm tra tiến độ dịch localization_master.xlsx
- Chỉ tính thiếu khi cột *_cn CÓ NỘI DUNG mà *_vi còn trống
- Có check CHARACTER (name_vi, fullname_vi, nickname_vi, tags_vi)
"""

import os
import sys
from collections import defaultdict
import openpyxl

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CANDIDATE_PATHS = [
    os.path.join(SCRIPT_DIR, "..", "localization", "localization_master.xlsx"),
    os.path.join(SCRIPT_DIR, "localization", "localization_master.xlsx"),
    "localization/localization_master.xlsx",
    "localization_master.xlsx",
]

# sheet -> (primary_key_character, list of (cn_col, vi_col))
SHEET_CHECKS = {
    "CHARACTER": {
        "pk": "character_id",
        "pairs": [
            ("name_cn", "name_vi"),
            ("fullname_cn", "fullname_vi"),
            ("tags_cn", "tags_vi"),
            # nickname không có nickname_cn nên chỉ check nếu muốn bắt buộc
        ],
        "optional_vi": ["nickname_vi"],  # có thì tốt, không có cũng không tính thiếu
    },
    "SKILL": {
        "pk": "character_id",
        "pairs": [
            ("skill_name_cn", "skill_name_vi"),
            ("desc_cn", "desc_vi"),
        ],
    },
    "PROFILE": {
        "pk": "character_id",
        "pairs": [
            ("title_cn", "title_vi"),
            ("text_cn", "text_vi"),
        ],
    },
    "HUANZHANG": {
        "pk": "character_id",
        "pairs": [
            ("icon_name_cn", "icon_name_vi"),
            ("icon_info_cn", "icon_info_vi"),
            ("buff_show_cn", "buff_show_vi"),
        ],
    },
    "SKIN": {
        "pk": "character_id",
        "pairs": [
            ("skin_name_cn", "skin_name_vi"),
            ("desc_cn", "desc_vi"),
            ("obtain_cn", "obtain_vi"),
        ],
    },
    "ZHIZHI": {
        "pk": "character_id",
        "pairs": [
            ("effect_summary_cn", "effect_summary_vi"),
        ],
    },
}


def find_master_file():
    for p in CANDIDATE_PATHS:
        if os.path.exists(p):
            return os.path.abspath(p)
    return None


def is_filled(val):
    if val is None:
        return False
    s = str(val).strip()
    return s != "" and s.lower() != "nan"


def main():
    master_path = find_master_file()
    if not master_path:
        print("[-] Không tìm thấy localization_master.xlsx")
        sys.exit(1)

    print(f"[+] Đọc file: {master_path}\n")
    wb = openpyxl.load_workbook(master_path, read_only=True, data_only=True)

    # ===== Lấy danh sách character =====
    ws_char = wb["CHARACTER"]
    headers_char = [c.value for c in next(ws_char.iter_rows(min_row=1, max_row=1))]
    cid_idx = headers_char.index("character_id")
    name_vi_idx = headers_char.index("name_vi") if "name_vi" in headers_char else None

    all_characters = {}
    for row in ws_char.iter_rows(min_row=2, values_only=True):
        cid = row[cid_idx]
        if cid is None:
            continue
        cid = str(cid).strip()
        name = row[name_vi_idx] if name_vi_idx is not None else ""
        all_characters[cid] = str(name).strip() if name else cid

    print(f"Tổng số nhân vật: {len(all_characters)}\n")

    # ===== Thu thập thiếu sót =====
    # char_missing[cid][sheet] = list of missing vi_col
    char_missing = defaultdict(lambda: defaultdict(list))
    char_has_data = defaultdict(set)  # sheet nào có dữ liệu của character này

    for sheet_name, cfg in SHEET_CHECKS.items():
        if sheet_name not in wb.sheetnames:
            continue
        ws = wb[sheet_name]
        headers = [c.value for c in next(ws.iter_rows(min_row=1, max_row=1))]
        if cfg["pk"] not in headers:
            continue

        pk_idx = headers.index(cfg["pk"])
        col_idx = {h: i for i, h in enumerate(headers)}

        for row in ws.iter_rows(min_row=2, values_only=True):
            cid = row[pk_idx]
            if cid is None:
                continue
            cid = str(cid).strip()
            if cid not in all_characters:
                continue

            char_has_data[cid].add(sheet_name)

            for cn_col, vi_col in cfg["pairs"]:
                if cn_col not in col_idx or vi_col not in col_idx:
                    continue
                cn_val = row[col_idx[cn_col]]
                vi_val = row[col_idx[vi_col]]
                # Chỉ tính thiếu khi cn CÓ nội dung mà vi TRỐNG
                if is_filled(cn_val) and not is_filled(vi_val):
                    if vi_col not in char_missing[cid][sheet_name]:
                        char_missing[cid][sheet_name].append(vi_col)

    # ===== Phân loại =====
    fully_done = []
    partial = []
    not_started = []

    for cid, name in sorted(all_characters.items()):
        missing = char_missing.get(cid, {})
        has_data = char_has_data.get(cid, set())

        if not has_data and not missing:
            not_started.append((cid, name))
            continue

        if not missing:
            fully_done.append((cid, name))
        else:
            # còn thiếu ở sheet nào
            info = []
            for sheet, cols in sorted(missing.items()):
                info.append(f"{sheet} (thiếu: {', '.join(cols)})")
            partial.append((cid, name, info))

    # ===== In kết quả =====
    print("=" * 60)
    print("TỔNG QUAN")
    print("=" * 60)
    print(f"  Đã dịch xong     : {len(fully_done):4d}")
    print(f"  Dịch một phần    : {len(partial):4d}")
    print(f"  Chưa dịch        : {len(not_started):4d}")
    print(f"  ────────────────────────")
    print(f"  Tổng             : {len(all_characters):4d}")
    print()

    print("=" * 60)
    print(f"NHÂN VẬT CHƯA DỊCH ({len(not_started)})")
    print("=" * 60)
    if not not_started:
        print("  (không có)")
    else:
        for cid, name in not_started:
            print(f"  {cid:10s}  {name}")
    print()

    print("=" * 60)
    print(f"NHÂN VẬT DỊCH MỘT PHẦN ({len(partial)})")
    print("=" * 60)
    if not partial:
        print("  (không có)")
    else:
        for cid, name, info in partial:
            print(f"\n  {cid}  |  {name}")
            for m in info:
                print(f"      → {m}")
    print()

    print("=" * 60)
    print(f"NHÂN VẬT ĐÃ DỊCH XONG ({len(fully_done)})")
    print("=" * 60)
    if not fully_done:
        print("  (không có)")
    else:
        line = []
        for i, (cid, name) in enumerate(fully_done, 1):
            line.append(cid)
            if i % 6 == 0:
                print("  " + "  ".join(line))
                line = []
        if line:
            print("  " + "  ".join(line))
    print()
    print("[V] Xong.")
    wb.close()


if __name__ == "__main__":
    main()