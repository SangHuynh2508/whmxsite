"""Import reviewed buff closure translations (NAME_ONLY) into localization_master.xlsx safely."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from safe_workbook_mutation import safe_mutate_workbook

DEFAULT_PACKET = ROOT / "localization" / "reviews" / "buff_closure_translation_packet_20260917_114332_FILLED.xlsx"
DEFAULT_MASTER = ROOT / "localization" / "localization_master.xlsx"

COLOR_WRAPPER_RE = re.compile(r"^(<color=[^>]+>)(.*?)(</color>)$", re.IGNORECASE | re.DOTALL)
TAG_RE = re.compile(r"<[^>]+>")


def clean_tag(s: Any) -> str:
    return TAG_RE.sub("", str(s or "")).strip()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest().upper()


def load_packet_data(packet_path: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if not packet_path.is_file():
        raise FileNotFoundError(f"Translation packet not found: {packet_path}")

    wb = openpyxl.load_workbook(packet_path, data_only=True)
    if "TO_TRANSLATE" not in wb.sheetnames:
        raise ValueError(f"Packet missing required 'TO_TRANSLATE' sheet: {wb.sheetnames}")

    ws = wb["TO_TRANSLATE"]
    headers = [ws.cell(1, c).value for c in range(1, ws.max_column + 1)]

    rows = []
    for r in range(2, ws.max_row + 1):
        vals = {headers[c - 1]: ws.cell(r, c).value for c in range(1, ws.max_column + 1)}
        if any(vals.values()):
            rows.append(vals)

    wb.close()
    return rows, {"sheets": wb.sheetnames, "total_rows": len(rows)}


def build_merge_plan(
    packet_rows: list[dict[str, Any]], master_path: Path
) -> dict[str, Any]:
    if not master_path.is_file():
        raise FileNotFoundError(f"Master workbook not found: {master_path}")

    wb_m = openpyxl.load_workbook(master_path, read_only=True)
    if "BUFF_STATUS" not in wb_m.sheetnames:
        raise ValueError(f"Master workbook missing BUFF_STATUS sheet: {wb_m.sheetnames}")

    ws_m = wb_m["BUFF_STATUS"]
    m_headers = [c for c in next(ws_m.iter_rows(min_row=1, max_row=1, values_only=True))]

    master_buffs = {}
    duplicate_master_ids = []
    for r_idx, row in enumerate(ws_m.iter_rows(min_row=2, values_only=True), start=2):
        bid = str(row[0] or "").strip()
        if bid:
            if bid in master_buffs:
                duplicate_master_ids.append(bid)
            master_buffs[bid] = (r_idx, dict(zip(m_headers, row)))

    wb_m.close()

    if duplicate_master_ids:
        raise ValueError(f"Duplicate buff_id found in master BUFF_STATUS: {duplicate_master_ids}")

    # Check packet invariants
    seen_packet_ids = set()
    duplicate_packet_ids = []
    for r in packet_rows:
        bid = str(r.get("buff_id") or "").strip()
        if not bid:
            raise ValueError(f"Empty buff_id in packet row: {r}")
        if bid in seen_packet_ids:
            duplicate_packet_ids.append(bid)
        seen_packet_ids.add(bid)

    if duplicate_packet_ids:
        raise ValueError(f"Duplicate buff_id found in packet: {duplicate_packet_ids}")

    matched = []
    unmatched = []
    already_identical = []
    updates = []
    conflicts = []

    for r in packet_rows:
        bid = str(r.get("buff_id") or "").strip()
        n_cn_p = str(r.get("buff_name_cn") or "").strip()
        n_vi_p = str(r.get("buff_name_vi") or "").strip()
        scope = str(r.get("translation_field") or "").strip()

        if not n_vi_p:
            conflicts.append({"buff_id": bid, "reason": "EMPTY_BUFF_NAME_VI_IN_PACKET"})
            continue

        if scope != "NAME_ONLY":
            conflicts.append({"buff_id": bid, "reason": f"UNEXPECTED_TRANSLATION_FIELD_{scope}"})
            continue

        if bid not in master_buffs:
            unmatched.append({"buff_id": bid, "buff_name_cn": n_cn_p, "buff_name_vi": n_vi_p})
            continue

        r_idx, mr = master_buffs[bid]
        m_cn = str(mr.get("buff_name_cn") or "").strip()
        m_vi = str(mr.get("buff_name_vi") or "").strip()
        m_desc_vi = mr.get("buff_desc_vi")

        matched.append(bid)

        # Check clean CN match
        clean_m_cn = clean_tag(m_cn)
        if clean_m_cn != n_cn_p:
            conflicts.append({
                "buff_id": bid,
                "reason": "CLEAN_CN_NAME_MISMATCH",
                "packet_cn": n_cn_p,
                "master_cn": m_cn,
                "clean_master_cn": clean_m_cn,
            })
            continue

        # Tag-aware formatting
        m_color = COLOR_WRAPPER_RE.match(m_cn)
        if m_color:
            open_tag, inner_cn, close_tag = m_color.groups()
            imported_vi = f"{open_tag}{n_vi_p}{close_tag}"
        else:
            imported_vi = n_vi_p

        # Check pre-existing VI value
        if m_vi == imported_vi:
            already_identical.append({"buff_id": bid, "name_vi": imported_vi})
        elif m_vi and m_vi != imported_vi:
            conflicts.append({
                "buff_id": bid,
                "reason": "PREEXISTING_VI_CONFLICT",
                "existing_master_vi": m_vi,
                "new_imported_vi": imported_vi,
            })
        else:
            updates.append({
                "buff_id": bid,
                "master_row_index": r_idx,
                "clean_cn": n_cn_p,
                "raw_master_cn": m_cn,
                "packet_vi": n_vi_p,
                "imported_vi": imported_vi,
                "existing_desc_vi": m_desc_vi,
            })

    return {
        "packet_rows_read": len(packet_rows),
        "rows_matched": len(matched),
        "rows_unmatched": len(unmatched),
        "rows_already_identical": len(already_identical),
        "rows_updated": len(updates),
        "conflicts_count": len(conflicts),
        "unmatched_list": unmatched,
        "already_identical_list": already_identical,
        "conflicts_list": conflicts,
        "updates_list": updates,
    }


def apply_merge(
    plan: dict[str, Any], master_path: Path, base_dir: Path
) -> dict[str, Any]:
    if plan["conflicts_count"] > 0:
        raise RuntimeError(f"Cannot apply merge with {plan['conflicts_count']} conflicts: {plan['conflicts_list']}")
    if plan["rows_unmatched"] > 0:
        raise RuntimeError(f"Cannot apply merge with {plan['rows_unmatched']} unmatched rows: {plan['unmatched_list']}")

    update_map = {u["buff_id"]: u["imported_vi"] for u in plan["updates_list"]}
    authorized_buff_ids = set(update_map.keys())

    def mutator(wb: openpyxl.Workbook):
        ws = wb["BUFF_STATUS"]
        headers = [ws.cell(1, c).value for c in range(1, ws.max_column + 1)]
        id_col = headers.index("buff_id") + 1
        name_vi_col = headers.index("buff_name_vi") + 1

        applied_count = 0
        for r in range(2, ws.max_row + 1):
            bid = str(ws.cell(r, id_col).value or "").strip()
            if bid in update_map:
                new_val = update_map[bid]
                ws.cell(r, name_vi_col).value = new_val
                applied_count += 1

        assert applied_count == len(update_map), (
            f"Applied count mismatch: {applied_count} != {len(update_map)}"
        )

    authorized_deps = {"player_facing_buff_ids": authorized_buff_ids}
    backup_path = safe_mutate_workbook(
        base_dir=str(base_dir),
        mutator_fn=mutator,
        authorized_deps=authorized_deps,
    )

    return {
        "backup_path": backup_path,
        "applied_count": len(update_map),
        "authorized_buff_ids": sorted(authorized_buff_ids),
    }


def main():
    parser = argparse.ArgumentParser(description="Import reviewed buff closure translations.")
    parser.add_argument("--packet", type=Path, default=DEFAULT_PACKET, help="Path to reviewed filled packet")
    parser.add_argument("--master", type=Path, default=DEFAULT_MASTER, help="Path to authoritative localization master")
    parser.add_argument("--apply", action="store_true", help="Apply changes durably via safe_mutate_workbook")
    args = parser.parse_args()

    sha_before = sha256_file(args.master)
    print(f"Authoritative master: {args.master}")
    print(f"Master SHA-256 before: {sha_before}")

    packet_rows, meta = load_packet_data(args.packet)
    print(f"Reviewed packet: {args.packet}")
    print(f"Packet rows read: {len(packet_rows)}")

    plan = build_merge_plan(packet_rows, args.master)

    print("\n--- MERGE PLAN SUMMARY ---")
    print(f"Packet rows read: {plan['packet_rows_read']}")
    print(f"Rows matched: {plan['rows_matched']}")
    print(f"Rows to update: {plan['rows_updated']}")
    print(f"Rows already identical: {plan['rows_already_identical']}")
    print(f"Rows unmatched: {plan['rows_unmatched']}")
    print(f"Conflicts: {plan['conflicts_count']}")

    if plan["conflicts_count"] > 0 or plan["rows_unmatched"] > 0:
        print("\nERRORS DETECTED - FAILING CLOSED:")
        if plan["conflicts_list"]:
            print(f"Conflicts: {json.dumps(plan['conflicts_list'], ensure_ascii=False, indent=2)}")
        if plan["unmatched_list"]:
            print(f"Unmatched: {json.dumps(plan['unmatched_list'], ensure_ascii=False, indent=2)}")
        sys.exit(1)

    print(f"\nAll {plan['rows_updated']} updates validated with 100% tag parity and exact buff_id identity.")

    if not args.apply:
        print("\n[DRY RUN MODE] No changes written to master workbook. Use --apply to execute.")
        sys.exit(0)

    print("\nExecuting durable safe mutation under safe_mutate_workbook guard...")
    result = apply_merge(plan, args.master, ROOT)
    sha_after = sha256_file(args.master)

    print(f"\n[MUTATION SUCCESSFUL]")
    print(f"Backup created: {result['backup_path']}")
    print(f"Rows updated: {result['applied_count']}")
    print(f"Master SHA-256 before: {sha_before}")
    print(f"Master SHA-256 after:  {sha_after}")


if __name__ == "__main__":
    main()
