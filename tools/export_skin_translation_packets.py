#!/usr/bin/env python3
"""WHMX Skin Localization Audit & Translation Packet Exporter.

Strictly read-only:
- Audits player-facing text in SKIN sheet of localization/localization_master.xlsx
- Never mutates localization_master.xlsx (verifies SHA-256 before & after)
- Exports review/translation packets to localization/exports/
- Leaves translation_vi strictly empty for manual translator input
"""
from __future__ import annotations

import hashlib
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

import openpyxl
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

sys.stdout.reconfigure(encoding='utf-8')

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MASTER_PATH = PROJECT_ROOT / "localization" / "localization_master.xlsx"
EXPORTS_DIR = PROJECT_ROOT / "localization" / "exports"

PACKET_COLUMNS = [
    "skin_id",
    "character_id",
    "character_name_vi",
    "skin_name_cn",
    "skin_name_vi",
    "series_id",
    "series_name_vi",
    "field_type",
    "source_cn",
    "current_vi",
    "translation_vi",
    "notes",
]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def format_packet_worksheet(ws: openpyxl.worksheet.worksheet.Worksheet, headers: list[str]) -> None:
    header_fill = PatternFill("solid", fgColor="1F4E78")
    header_font = Font(name="Arial", size=10, bold=True, color="FFFFFF")
    body_font = Font(name="Arial", size=10)

    # Style header
    for cell in ws[1]:
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[1].height = 28
    ws.freeze_panes = "A2"

    # Style body
    for row in ws.iter_rows(min_row=2):
        for cell in row:
            cell.font = body_font
            cell.alignment = Alignment(vertical="top", wrap_text=True)

    # Column widths
    col_widths = {
        "skin_id": 14,
        "character_id": 14,
        "character_name_vi": 22,
        "skin_name_cn": 18,
        "skin_name_vi": 24,
        "series_id": 10,
        "series_name_vi": 22,
        "field_type": 12,
        "source_cn": 55,
        "current_vi": 35,
        "translation_vi": 55,
        "notes": 45,
    }
    for idx, header in enumerate(headers, 1):
        w = col_widths.get(header, max(14, len(header) + 4))
        ws.column_dimensions[get_column_letter(idx)].width = w


def save_packet(filename: str, sheet_name: str, rows: list[dict[str, Any]]) -> Path:
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name

    ws.append(PACKET_COLUMNS)
    for r in rows:
        ws.append([r.get(col, "") for col in PACKET_COLUMNS])

    format_packet_worksheet(ws, PACKET_COLUMNS)

    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = EXPORTS_DIR / filename
    wb.save(out_path)
    return out_path


def main():
    print("=== WHMX SKIN LOCALIZATION AUDIT & PACKET EXPORT ===")
    
    # 1. SHA-256 Before
    sha_before = sha256_file(MASTER_PATH)
    print(f"localization_master.xlsx SHA-256 (Before): {sha_before}")

    # 2. Load Master Workbook (Read-Only)
    wb = openpyxl.load_workbook(MASTER_PATH, data_only=True, read_only=True)

    # Load CHARACTER for name_vi mapping
    char_ws = wb["CHARACTER"]
    char_rows = list(char_ws.iter_rows(values_only=True))
    char_header = char_rows[0]
    cid_idx = char_header.index("character_id")
    cname_vi_idx = char_header.index("name_vi")
    char_name_map = {}
    for r in char_rows[1:]:
        cid = str(r[cid_idx]).strip() if r[cid_idx] is not None else ""
        c_vi = str(r[cname_vi_idx]).strip() if r[cname_vi_idx] is not None else ""
        char_name_map[cid] = c_vi

    # Load SKIN sheet
    skin_ws = wb["SKIN"]
    skin_rows = list(skin_ws.iter_rows(values_only=True))
    skin_header = skin_rows[0]
    skin_data = skin_rows[1:]
    cols = {name: skin_header.index(name) for name in skin_header}

    total_skins = len(skin_data)
    print(f"Total SKIN rows audited: {total_skins}")

    # 3. Detailed Audit
    lore_entries = []
    obtain_entries = []
    name_entries = []

    lore_cn_count = 0
    lore_vi_blank_count = 0
    lore_vi_copied_from_obtain = 0
    lore_vi_genuine_count = 0

    obtain_cn_count = 0
    obtain_vi_blank_count = 0

    name_cn_count = 0
    name_vi_blank_count = 0

    for r in skin_data:
        sid = str(r[cols["skin_id"]]).strip() if r[cols["skin_id"]] is not None else ""
        cid = str(r[cols["character_id"]]).strip() if r[cols["character_id"]] is not None else ""
        cname_vi = char_name_map.get(cid, "")
        sname_cn = str(r[cols["skin_name_cn"]]).strip() if r[cols["skin_name_cn"]] is not None else ""
        sname_vi = str(r[cols["skin_name_vi"]]).strip() if r[cols["skin_name_vi"]] is not None else ""
        series_id = r[cols["series_id"]]
        series_name_vi = str(r[cols["series_name_vi"]]).strip() if r[cols["series_name_vi"]] is not None else ""
        is_high_skin = r[cols["is_high_skin"]] in (True, 1, "TRUE", "true")
        
        desc_cn = str(r[cols["desc_cn"]]).strip() if r[cols["desc_cn"]] is not None else ""
        desc_vi = str(r[cols["desc_vi"]]).strip() if r[cols["desc_vi"]] is not None else ""

        obtain_cn = str(r[cols["obtain_cn"]]).strip() if r[cols["obtain_cn"]] is not None else ""
        obtain_vi = str(r[cols["obtain_vi"]]).strip() if r[cols["obtain_vi"]] is not None else ""
        price = r[cols["price"]]
        currency = r[cols["currency"]]

        # Skin Name check
        if sname_cn:
            name_cn_count += 1
            if not sname_vi:
                name_vi_blank_count += 1
                name_entries.append({
                    "skin_id": sid,
                    "character_id": cid,
                    "character_name_vi": cname_vi,
                    "skin_name_cn": sname_cn,
                    "skin_name_vi": sname_vi,
                    "series_id": series_id,
                    "series_name_vi": series_name_vi,
                    "field_type": "skin_name",
                    "source_cn": sname_cn,
                    "current_vi": sname_vi,
                    "translation_vi": "",
                    "notes": f"Khí Giả: {cname_vi} | Dòng: {series_name_vi}",
                })

        # Acquisition check
        if obtain_cn:
            obtain_cn_count += 1
            if not obtain_vi:
                obtain_vi_blank_count += 1
                notes_acq = f"[Phương Thức Sở Hữu] Khí Giả: {cname_vi} | Trang Phục: {sname_vi} | Dòng: {series_name_vi}"
                if is_high_skin:
                    notes_acq += " | Trang Phục Cao Cấp"
                obtain_entries.append({
                    "skin_id": sid,
                    "character_id": cid,
                    "character_name_vi": cname_vi,
                    "skin_name_cn": sname_cn,
                    "skin_name_vi": sname_vi,
                    "series_id": series_id,
                    "series_name_vi": series_name_vi,
                    "field_type": "obtain",
                    "source_cn": obtain_cn,
                    "current_vi": "",
                    "translation_vi": "",
                    "notes": notes_acq,
                })

        # Lore / Bút Ký check
        if desc_cn:
            lore_cn_count += 1
            is_copied = False
            if not desc_vi:
                lore_vi_blank_count += 1
            else:
                # Check if desc_vi is duplicate of obtain_vi or generic acquisition text
                if desc_vi == obtain_vi or desc_vi in [
                    "Bán giới hạn tại Cửa Hàng Trang Phục",
                    "Bán giới hạn qua gói quà",
                    "Nhận được thông qua Du Lịch",
                    "Nhận được thông qua Chợ Tập Huấn",
                    "Mở khóa sau khi thông quan Chương 7",
                    "Nhận được thông qua hoạt động",
                ]:
                    lore_vi_copied_from_obtain += 1
                    is_copied = True
                else:
                    lore_vi_genuine_count += 1

            # Prepare notes context
            notes_lore_parts = [f"Khí Giả: {cname_vi}", f"Trang Phục: {sname_vi}"]
            if is_high_skin:
                notes_lore_parts.append("Tiêu Điểm Cao Cấp (High Skin)")
            if series_name_vi:
                notes_lore_parts.append(f"Dòng: {series_name_vi}")
            if obtain_vi:
                notes_lore_parts.append(f"Cách sở hữu: {obtain_vi}")
            if price:
                notes_lore_parts.append(f"Giá: {price} {currency or 'Vé Trang Phục'}")
            if is_copied:
                notes_lore_parts.append("[LƯU Ý: desc_vi cũ bị sao chép nhầm từ obtain_vi; cần dịch Bút Ký thực sự từ desc_cn]")

            lore_entries.append({
                "skin_id": sid,
                "character_id": cid,
                "character_name_vi": cname_vi,
                "skin_name_cn": sname_cn,
                "skin_name_vi": sname_vi,
                "series_id": series_id,
                "series_name_vi": series_name_vi,
                "field_type": "desc",
                "source_cn": desc_cn,
                "current_vi": desc_vi if is_copied else "",
                "translation_vi": "",
                "notes": " | ".join(notes_lore_parts),
            })

    print("\n--- AUDIT SUMMARY ---")
    print(f"Total skin rows: {total_skins}")
    print(f"Skin Name: {name_cn_count} rows with CN, {name_vi_blank_count} missing VI")
    print(f"Acquisition: {obtain_cn_count} rows with CN, {obtain_vi_blank_count} missing VI (140 translated)")
    print(f"Skin Lore (desc): {lore_cn_count} rows with CN:")
    print(f"  - Completely blank desc_vi: {lore_vi_blank_count}")
    print(f"  - Erroneously copied from obtain_vi: {lore_vi_copied_from_obtain}")
    print(f"  - Genuine reviewed lore desc_vi: {lore_vi_genuine_count}")
    print(f"  -> Total lore rows needing translation: {len(lore_entries)} ({lore_vi_blank_count} blank + {lore_vi_copied_from_obtain} copied)")

    # 4. Duplicate Source Text Analysis
    print("\n--- DUPLICATE SOURCE ANALYSIS ---")
    lore_sources = [e["source_cn"] for e in lore_entries]
    lore_counter = Counter(lore_sources)
    lore_dups = {k: v for k, v in lore_counter.items() if v > 1}
    print(f"Skin Lore duplicate source strings: {len(lore_dups)}")

    obtain_sources = [e["source_cn"] for e in obtain_entries]
    obtain_counter = Counter(obtain_sources)
    obtain_dups = {k: v for k, v in obtain_counter.items() if v > 1}
    print(f"Acquisition missing-packet duplicate source strings: {len(obtain_dups)}")
    for s_cn, cnt in obtain_dups.items():
        print(f"  - Count {cnt}: '{s_cn}'")

    all_obtain_cn = [str(r[cols["obtain_cn"]]).strip() for r in skin_data if r[cols["obtain_cn"]]]
    all_obtain_counter = Counter(all_obtain_cn)
    all_obtain_dups = {k: v for k, v in all_obtain_counter.items() if v > 1}
    print(f"Acquisition dataset-wide duplicate source strings: {len(all_obtain_dups)}")
    for s_cn, cnt in sorted(all_obtain_dups.items(), key=lambda x: x[1], reverse=True):
        print(f"  - Count {cnt:3d}: '{s_cn}'")

    # 5. Export Packets
    print("\n--- EXPORTING TRANSLATION PACKETS ---")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    created_packets = []

    # Export Lore Packets (145 rows split into 5 packets of 29 rows each)
    batch_size = 29
    num_packets = (len(lore_entries) + batch_size - 1) // batch_size
    for i in range(num_packets):
        chunk = lore_entries[i * batch_size : (i + 1) * batch_size]
        packet_num = f"{i + 1:02d}"
        filename = f"skin_lore_translation_packet_{packet_num}_{timestamp}.xlsx"
        sheet_name = f"SKIN_LORE_{packet_num}"
        p_path = save_packet(filename, sheet_name, chunk)
        created_packets.append({
            "filename": filename,
            "path": p_path,
            "field_type": "desc (Skin Lore / Bút Ký)",
            "row_count": len(chunk),
            "range": f"Rows {i * batch_size + 1} - {i * batch_size + len(chunk)}",
        })
        print(f"Exported: {filename} ({len(chunk)} rows)")

    # Export Acquisition Packet (5 rows)
    if obtain_entries:
        filename = f"skin_acquisition_translation_packet_{timestamp}.xlsx"
        sheet_name = "SKIN_ACQUISITION"
        p_path = save_packet(filename, sheet_name, obtain_entries)
        created_packets.append({
            "filename": filename,
            "path": p_path,
            "field_type": "obtain (Acquisition)",
            "row_count": len(obtain_entries),
            "range": f"Rows 1 - {len(obtain_entries)}",
        })
        print(f"Exported: {filename} ({len(obtain_entries)} rows)")

    # Skin name packet
    if name_entries:
        filename = f"skin_name_translation_packet_{timestamp}.xlsx"
        sheet_name = "SKIN_NAME"
        p_path = save_packet(filename, sheet_name, name_entries)
        created_packets.append({
            "filename": filename,
            "path": p_path,
            "field_type": "skin_name",
            "row_count": len(name_entries),
            "range": f"Rows 1 - {len(name_entries)}",
        })
        print(f"Exported: {filename} ({len(name_entries)} rows)")
    else:
        print("Skin Names: 0 gaps found (all 145/145 translated). No packet needed.")

    # 6. Verification of Created Packets
    print("\n--- VERIFYING CREATED PACKETS ---")
    for p in created_packets:
        wb_check = openpyxl.load_workbook(p["path"], data_only=True, read_only=True)
        ws_check = wb_check.active
        rows_check = list(ws_check.iter_rows(values_only=True))
        check_headers = rows_check[0]
        check_data = rows_check[1:]

        assert list(check_headers) == PACKET_COLUMNS, f"Header mismatch in {p['filename']}"
        assert len(check_data) == p["row_count"], f"Row count mismatch in {p['filename']}: {len(check_data)} vs {p['row_count']}"
        
        # Verify translation_vi is strictly empty
        trans_col_idx = check_headers.index("translation_vi")
        for row in check_data:
            val = row[trans_col_idx]
            assert val is None or str(val).strip() == "", f"translation_vi must be empty in {p['filename']}"

        print(f"[VERIFIED PASS] {p['filename']}: {len(check_data)} rows, headers exact, translation_vi empty")

    # 7. SHA-256 After
    sha_after = sha256_file(MASTER_PATH)
    print(f"\nlocalization_master.xlsx SHA-256 (After):  {sha_after}")
    assert sha_before == sha_after, "FATAL: localization_master.xlsx was mutated!"
    print("[INTEGRITY VERIFIED] localization_master.xlsx is 100% UNCHANGED and BYTE-IDENTICAL!")


if __name__ == "__main__":
    main()
