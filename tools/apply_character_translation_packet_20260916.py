"""Guarded importer for character_translation_packet_20260916T132319Z_translated.xlsx.

Executes Phase 1 (safe new translations) and Phase 2A (non-destructive duplicate reconciliation)
under safe workbook mutation guards with exact ID and cell authorizations.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import openpyxl

# Add tools directory to sys.path
TOOLS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = TOOLS_DIR.parent
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from safe_workbook_mutation import AtomicReplaceLockError, safe_mutate_workbook
from workbook_semantic_fingerprint import workbook_semantic_fingerprint

MASTER_PATH = PROJECT_ROOT / "localization" / "localization_master.xlsx"
PACKET_PATH = PROJECT_ROOT / "localization" / "reviews" / "character_translation_packet_20260916T132319Z_translated.xlsx"

EXPECTED_MASTER_SHA256 = "1C7894230918A5417B7C418E0AEB489CD31F9FDF7382D6F3BAAE957609783D62"
EXPECTED_MASTER_FP = "DDA234EBEA9F7119C010919DE05E2C0678D0090595A19CD8B046B7B3294203F5"
EXPECTED_PACKET_SHA256 = "06EADCF60EE745931CD6EF6ADAF509F864730D1FFAC57D94CE9577B6DD40F880"

TOKEN_RE = re.compile(r"(\[Effect[^\]]+\]|\[Condition[^\]]+\]|{Buff_[^}]+}|<color=[^>]+>|</color>)")


def compute_sha256(path: Path | str) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest().upper()


def guarded_in_place_fallback(master_path: Path, candidate_path: Path, backup_path: Path) -> None:
    current_sha = compute_sha256(master_path)
    current_fp = workbook_semantic_fingerprint(master_path)
    candidate_fp = workbook_semantic_fingerprint(candidate_path)
    if candidate_fp == current_fp:
        raise RuntimeError("FALLBACK_CANDIDATE_HAS_NO_DELTA")

    if compute_sha256(backup_path) != current_sha or workbook_semantic_fingerprint(backup_path) != current_fp:
        raise RuntimeError("FALLBACK_BACKUP_VERIFICATION_FAILED")

    candidate_bytes = candidate_path.read_bytes()

    import ctypes
    from ctypes import wintypes
    import msvcrt

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    create_file = kernel32.CreateFileW
    create_file.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, wintypes.LPVOID, wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
    create_file.restype = wintypes.HANDLE
    invalid_handle = ctypes.c_void_p(-1).value
    write_handle = create_file(str(master_path), 0xC0000000, 0, None, 3, 0x80, None)
    if write_handle == invalid_handle:
        raise RuntimeError(f"FALLBACK_EXCLUSIVE_WRITE_FAILED winerror={ctypes.get_last_error()}")

    def overwrite(handle: int, bytes_to_write: bytes) -> None:
        fd = msvcrt.open_osfhandle(handle, os.O_RDWR | getattr(os, "O_BINARY", 0))
        with os.fdopen(fd, "r+b", closefd=True) as destination:
            destination.seek(0)
            destination.truncate(0)
            destination.write(bytes_to_write)
            destination.flush()
            os.fsync(destination.fileno())

    try:
        overwrite(write_handle, candidate_bytes)
        if compute_sha256(master_path) != compute_sha256(candidate_path):
            raise RuntimeError("FALLBACK_SHA_VERIFICATION_FAILED")
        if workbook_semantic_fingerprint(master_path) != candidate_fp:
            raise RuntimeError("FALLBACK_SEMANTIC_VERIFICATION_FAILED")
        try:
            candidate_path.unlink(missing_ok=True)
        except Exception:
            pass
    except Exception as exc:
        restore_handle = create_file(str(master_path), 0xC0000000, 0, None, 3, 0x80, None)
        if restore_handle != invalid_handle:
            try:
                overwrite(restore_handle, backup_path.read_bytes())
            except Exception:
                pass
        raise RuntimeError(f"FALLBACK_FAILED_RESTORED cause={exc!r}") from exc


def load_packet_rows(packet_file: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    wb = openpyxl.load_workbook(packet_file, data_only=True)
    try:
        ws_tr = wb["TRANSLATION_RESULT"]
        headers_tr = [c.value for c in ws_tr[1]]
        translation_results = [dict(zip(headers_tr, [c.value for c in r])) for r in ws_tr.iter_rows(min_row=2)]

        ws_rr = wb["REVIEW_RESULT"]
        headers_rr = [c.value for c in ws_rr[1]]
        review_results = [dict(zip(headers_rr, [c.value for c in r])) for r in ws_rr.iter_rows(min_row=2)]

        ws_si = wb["SOURCE_ISSUES"]
        headers_si = [c.value for c in ws_si[1]]
        source_issues = [dict(zip(headers_si, [c.value for c in r])) for r in ws_si.iter_rows(min_row=2)]
    finally:
        wb.close()
    return translation_results, review_results, source_issues


def extract_tokens(text: str | None) -> list[str]:
    return sorted(TOKEN_RE.findall(text or ""))


def evaluate_phase1_safe_rows(translation_results: list[dict[str, Any]], master_file: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    wb_m = openpyxl.load_workbook(master_file, data_only=True)
    field_map = {
        "SKILL": {"skill_name": ("skill_name_cn", "skill_name_vi"), "description": ("desc_cn", "desc_vi")},
        "BUFF_STATUS": {"buff_name": ("buff_name_cn", "buff_name_vi"), "buff_description": ("buff_desc_cn", "buff_desc_vi")},
        "HUANZHANG": {"icon_name": ("icon_name_cn", "icon_name_vi"), "icon_info": ("icon_info_cn", "icon_info_vi"), "buff_show": ("buff_show_cn", "buff_show_vi")},
        "SKIN": {"skin_name": ("skin_name_cn", "skin_name_vi")},
        "CHARACTER": {"tags": ("tags_cn", "tags_vi")},
    }
    key_field = {
        "CHARACTER": "character_id",
        "SKILL": "skill_id",
        "BUFF_STATUS": "buff_id",
        "HUANZHANG": "brilliant_id",
        "SKIN": "skin_id",
    }

    safe_rows = []
    deferred_rows = []

    try:
        for r in translation_results:
            if r.get("action") != "APPLY_TRANSLATION":
                continue

            sheet = r["source_sheet"]
            rk = str(r["record_key"])
            field = r["field_name"]
            src_cn = r.get("source_cn") or ""
            prop_vi = r.get("proposed_vi") or ""
            cid = r.get("character_id")

            # Explicit Deferral Check: S01324 buff_show
            if rk == "S01324" and field == "buff_show":
                deferred_rows.append({
                    "row": r,
                    "reason": "DEFERRED_PROVENANCE_REVIEW (byte-identical CN to D00804 camera buff without proven raw ownership)",
                })
                continue

            ws = wb_m[sheet]
            headers = [c.value for c in ws[1]]
            kf = key_field[sheet]
            kf_idx = headers.index(kf)
            matches = []
            for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
                if str(row[kf_idx]) == rk:
                    matches.append((row_idx, dict(zip(headers, row))))

            if len(matches) != 1:
                deferred_rows.append({"row": r, "reason": f"Expected exactly 1 master match, found {len(matches)}"})
                continue

            row_idx, master_rec = matches[0]
            cn_col, vi_col = field_map[sheet][field]
            curr_cn = master_rec.get(cn_col) or ""
            curr_vi = master_rec.get(vi_col)

            # Safety Gate Checks
            if curr_cn != src_cn:
                deferred_rows.append({"row": r, "reason": f"Master CN mismatch: master={curr_cn!r} vs packet={src_cn!r}"})
                continue
            if curr_vi not in (None, ""):
                deferred_rows.append({"row": r, "reason": f"Master VI not blank: {curr_vi!r}"})
                continue
            if not prop_vi:
                deferred_rows.append({"row": r, "reason": "Packet proposed VI is empty"})
                continue

            # Technical Token Preservation Check
            cn_tokens = extract_tokens(src_cn)
            vi_tokens = extract_tokens(prop_vi)
            if cn_tokens != vi_tokens:
                deferred_rows.append({"row": r, "reason": f"Token mismatch: CN={cn_tokens} vs VI={vi_tokens}"})
                continue

            # Terminology Check
            if "Miêu Chuẩn" in prop_vi:
                deferred_rows.append({"row": r, "reason": "Violates canonical owner terminology: contains 'Miêu Chuẩn'"})
                continue

            safe_rows.append({
                "packet_row": r,
                "sheet": sheet,
                "record_key": rk,
                "field": field,
                "row_idx": row_idx,
                "cn_col": cn_col,
                "vi_col": vi_col,
                "src_cn": src_cn,
                "new_vi": prop_vi,
                "character_id": cid,
            })
    finally:
        wb_m.close()

    return safe_rows, deferred_rows


def apply_phase1_transaction(safe_rows: list[dict[str, Any]], packet_name: str) -> dict[str, Any]:
    packet_filename = Path(packet_name).name

    def mutator(workbook: openpyxl.Workbook) -> None:
        for item in safe_rows:
            sheetname = item["sheet"]
            row_idx = item["row_idx"]
            vi_col_name = item["vi_col"]
            new_vi = item["new_vi"]
            ws = workbook[sheetname]
            headers = [c.value for c in ws[1]]
            vi_col_idx = headers.index(vi_col_name) + 1

            # Set the translated Vietnamese text
            ws.cell(row_idx, vi_col_idx).value = new_vi

            # Update Sheet-Specific Review Metadata
            if sheetname == "SKILL":
                status_idx = headers.index("status") + 1
                rev_status_idx = headers.index("translation_review_status") + 1
                rev_source_idx = headers.index("translation_review_source") + 1
                ws.cell(row_idx, status_idx).value = "TRANSLATED"
                ws.cell(row_idx, rev_status_idx).value = "CHATGPT_REVIEWED"
                ws.cell(row_idx, rev_source_idx).value = packet_filename

            elif sheetname == "BUFF_STATUS":
                status_idx = headers.index("status") + 1
                name_auth_idx = headers.index("name_authority") + 1
                desc_status_idx = headers.index("desc_translation_status") + 1
                desc_source_idx = headers.index("desc_translation_source") + 1

                current_status = ws.cell(row_idx, status_idx).value
                if current_status != "OWNER_APPROVED":
                    ws.cell(row_idx, status_idx).value = "TRANSLATED"

                current_name_auth = ws.cell(row_idx, name_auth_idx).value
                if current_name_auth != "OWNER_APPROVED":
                    ws.cell(row_idx, name_auth_idx).value = "CHATGPT_REVIEWED"

                ws.cell(row_idx, desc_status_idx).value = "CHATGPT_REVIEWED"
                ws.cell(row_idx, desc_source_idx).value = packet_filename

            elif sheetname == "HUANZHANG":
                status_idx = headers.index("status") + 1
                rev_status_idx = headers.index("translation_review_status") + 1
                rev_source_idx = headers.index("translation_review_source") + 1
                ws.cell(row_idx, status_idx).value = "TRANSLATED"
                ws.cell(row_idx, rev_status_idx).value = "CHATGPT_REVIEWED"
                ws.cell(row_idx, rev_source_idx).value = packet_filename

            elif sheetname == "SKIN":
                status_idx = headers.index("status") + 1
                ws.cell(row_idx, status_idx).value = "TRANSLATED"

            elif sheetname == "CHARACTER":
                # tags_vi was set, also update notes with review status
                notes_idx = headers.index("notes") + 1
                prior_notes = str(ws.cell(row_idx, notes_idx).value or "").strip()
                if "tags_translation_status=PENDING" in prior_notes:
                    updated_notes = prior_notes.replace("tags_translation_status=PENDING", "tags_translation_status=CHATGPT_REVIEWED")
                else:
                    updated_notes = f"{prior_notes}; tags_translation_status=CHATGPT_REVIEWED; tags_review_source={packet_filename}".strip("; ")
                ws.cell(row_idx, notes_idx).value = updated_notes

    # Authorized deps and cells
    authorized_deps = {
        "skill_ids": {item["record_key"] for item in safe_rows if item["sheet"] == "SKILL"},
        "player_facing_buff_ids": {item["record_key"] for item in safe_rows if item["sheet"] == "BUFF_STATUS"},
        "huanzhang_ids": {item["record_key"] for item in safe_rows if item["sheet"] == "HUANZHANG"},
    }
    authorized_cells = set()
    for item in safe_rows:
        if item["sheet"] == "SKIN":
            authorized_cells.add(("SKIN", item["record_key"], item["vi_col"]))
            authorized_cells.add(("SKIN", item["record_key"], "status"))
        elif item["sheet"] == "CHARACTER":
            authorized_cells.add(("CHARACTER", item["record_key"], "tags_vi"))
            authorized_cells.add(("CHARACTER", item["record_key"], "notes"))

    try:
        backup = safe_mutate_workbook(
            str(PROJECT_ROOT),
            mutator,
            authorized_deps,
            authorized_new_columns={},
            authorized_cells=authorized_cells,
        )
        write_method = "ATOMIC_REPLACE"
    except AtomicReplaceLockError as lock_err:
        print("[INFO] Atomic replace hit Windows file lock; engaging GUARDED_IN_PLACE_FALLBACK...", file=sys.stderr)
        guarded_in_place_fallback(Path(lock_err.master_path), Path(lock_err.temp_path), Path(lock_err.backup_path))
        write_method = "GUARDED_IN_PLACE_FALLBACK"
        backup = lock_err.backup_path

    return {
        "write_method": write_method,
        "backup": str(backup),
        "fields_applied": len(safe_rows),
        "master_sha_after": compute_sha256(MASTER_PATH),
        "master_fp_after": workbook_semantic_fingerprint(MASTER_PATH),
    }


def evaluate_phase2a_reconcile_rows(translation_results: list[dict[str, Any]], master_file: Path) -> list[dict[str, Any]]:
    wb_m = openpyxl.load_workbook(master_file, data_only=True)
    ws_skill = wb_m["SKILL"]
    headers = [c.value for c in ws_skill[1]]
    rows = [dict(zip(headers, r)) for r in ws_skill.iter_rows(min_row=2, values_only=True)]
    wb_m.close()

    # Index by skill_id
    from collections import defaultdict
    by_id = defaultdict(list)
    for row_idx, r in enumerate(rows, start=2):
        r["_excel_row"] = row_idx
        by_id[r["skill_id"]].append(r)

    reconcile_tasks = []
    recon_packet_rows = [r for r in translation_results if r.get("action") == "RECONCILE_DUPLICATE_ROW"]

    for r in recon_packet_rows:
        sk_id = str(r["record_key"])
        field = r["field_name"]
        prop_vi = r.get("proposed_vi") or ""
        matches = by_id.get(sk_id, [])

        if len(matches) != 2:
            raise RuntimeError(f"Expected exactly 2 rows for duplicate skill {sk_id}, found {len(matches)}")

        r1, r2 = matches[0], matches[1]
        col_name = "skill_name_vi" if field == "skill_name" else "desc_vi"

        # Verify r1 has translation and matches proposed_vi
        if r1.get(col_name) != prop_vi:
            raise RuntimeError(f"Established translation mismatch for {sk_id}.{field}: r1={r1.get(col_name)!r} vs packet={prop_vi!r}")

        # r2 is the blank/PENDING row to reconcile
        reconcile_tasks.append({
            "skill_id": sk_id,
            "field": field,
            "col_name": col_name,
            "target_row_idx": r2["_excel_row"],
            "new_vi": prop_vi,
            "original_row_idx": r1["_excel_row"],
            "character_id": r["character_id"],
        })

    return reconcile_tasks


def apply_phase2a_transaction(reconcile_tasks: list[dict[str, Any]], packet_name: str) -> dict[str, Any]:
    packet_filename = Path(packet_name).name

    def mutator(workbook: openpyxl.Workbook) -> None:
        ws = workbook["SKILL"]
        headers = [c.value for c in ws[1]]
        status_idx = headers.index("status") + 1
        rev_status_idx = headers.index("translation_review_status") + 1
        rev_source_idx = headers.index("translation_review_source") + 1

        for task in reconcile_tasks:
            row_idx = task["target_row_idx"]
            col_idx = headers.index(task["col_name"]) + 1
            ws.cell(row_idx, col_idx).value = task["new_vi"]
            ws.cell(row_idx, status_idx).value = "TRANSLATED"
            ws.cell(row_idx, rev_status_idx).value = "RECONCILED_DUPLICATE"
            ws.cell(row_idx, rev_source_idx).value = packet_filename

    authorized_deps = {
        "skill_ids": {t["skill_id"] for t in reconcile_tasks},
    }

    try:
        backup = safe_mutate_workbook(
            str(PROJECT_ROOT),
            mutator,
            authorized_deps,
            authorized_new_columns={},
            authorized_cells=set(),
        )
        write_method = "ATOMIC_REPLACE"
    except AtomicReplaceLockError as lock_err:
        print("[INFO] Atomic replace hit Windows file lock; engaging GUARDED_IN_PLACE_FALLBACK...", file=sys.stderr)
        guarded_in_place_fallback(Path(lock_err.master_path), Path(lock_err.temp_path), Path(lock_err.backup_path))
        write_method = "GUARDED_IN_PLACE_FALLBACK"
        backup = lock_err.backup_path

    return {
        "write_method": write_method,
        "backup": str(backup),
        "fields_reconciled": len(reconcile_tasks),
        "master_sha_after": compute_sha256(MASTER_PATH),
        "master_fp_after": workbook_semantic_fingerprint(MASTER_PATH),
    }


def audit_master_duplicate_skills(master_file: Path) -> dict[str, Any]:
    wb = openpyxl.load_workbook(master_file, data_only=True)
    ws = wb["SKILL"]
    headers = [c.value for c in ws[1]]
    rows = [dict(zip(headers, r)) for r in ws.iter_rows(min_row=2, values_only=True)]
    wb.close()

    from collections import defaultdict
    by_id = defaultdict(list)
    for idx, r in enumerate(rows, start=2):
        r["_excel_row"] = idx
        by_id[r["skill_id"]].append(r)

    duplicates = {k: v for k, v in by_id.items() if len(v) > 1}
    return {
        "total_skills": len(rows),
        "unique_skill_ids": len(by_id),
        "duplicate_id_count": len(duplicates),
        "duplicates": {
            k: [
                {
                    "row": item["_excel_row"],
                    "character_id": item["character_id"],
                    "skill_slot": item.get("skill_slot"),
                    "type_label": item.get("type_label"),
                    "skill_name_cn": item.get("skill_name_cn"),
                    "skill_name_vi": item.get("skill_name_vi"),
                    "status": item.get("status"),
                    "translation_review_status": item.get("translation_review_status"),
                    "notes": item.get("notes"),
                }
                for item in items
            ]
            for k, items in duplicates.items()
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--phase1", action="store_true", help="Execute Phase 1 safe import")
    parser.add_argument("--phase2a", action="store_true", help="Execute Phase 2A duplicate reconciliation")
    parser.add_argument("--audit-duplicates", action="store_true", help="Audit duplicate skill_id rows in master")
    parser.add_argument("--verify-inputs", action="store_true", help="Verify input files and safety criteria without mutating")
    args = parser.parse_args()

    # Pre-flight SHA verification
    master_sha = compute_sha256(MASTER_PATH)
    master_fp = workbook_semantic_fingerprint(MASTER_PATH)
    packet_sha = compute_sha256(PACKET_PATH)

    print(f"MASTER_PATH: {MASTER_PATH}")
    print(f"MASTER_SHA256: {master_sha}")
    print(f"MASTER_SEMANTIC_FINGERPRINT: {master_fp}")
    print(f"PACKET_PATH: {PACKET_PATH}")
    print(f"PACKET_SHA256: {packet_sha}")

    tr_rows, rr_rows, si_rows = load_packet_rows(PACKET_PATH)

    if args.phase1 or args.verify_inputs:
        safe_rows, deferred_rows = evaluate_phase1_safe_rows(tr_rows, MASTER_PATH)
        print(f"\n[PHASE 1 EVALUATION]")
        print(f"Total APPLY_TRANSLATION rows: {len(safe_rows) + len(deferred_rows)}")
        print(f"Safe rows to apply: {len(safe_rows)}")
        print(f"Deferred rows: {len(deferred_rows)}")
        for d in deferred_rows:
            print(f"  DEFERRED: {d['row']['source_sheet']} {d['row']['record_key']}.{d['row']['field_name']} -> {d['reason']}")

        if args.verify_inputs:
            print("\nInput verification completed successfully. No mutations performed.")
            return

        print("\n=== EXECUTING PHASE 1 TRANSACTION ===")
        res1 = apply_phase1_transaction(safe_rows, PACKET_PATH.name)
        print(f"PHASE 1 COMPLETE: {res1}")

    if args.phase2a:
        print("\n=== EXECUTING PHASE 2A TRANSACTION ===")
        reconcile_tasks = evaluate_phase2a_reconcile_rows(tr_rows, MASTER_PATH)
        print(f"Reconcile tasks to execute: {len(reconcile_tasks)} fields across {len(reconcile_tasks) // 2} duplicate skills")
        res2 = apply_phase2a_transaction(reconcile_tasks, PACKET_PATH.name)
        print(f"PHASE 2A COMPLETE: {res2}")

    if args.audit_duplicates:
        dup_audit = audit_master_duplicate_skills(MASTER_PATH)
        print(f"\n[DUPLICATE SKILL AUDIT] Duplicate skill_id count: {dup_audit['duplicate_id_count']}")
        for sid, rows in dup_audit["duplicates"].items():
            print(f"  {sid}: {len(rows)} occurrences (rows {[r['row'] for r in rows]})")


if __name__ == "__main__":
    main()
