"""Apply the 22 reviewed PROFILE repairs with exact guards.

Scope:
- 20 PROFILE_SCHEMA_SHIFT: clear title_vi (migration corruption), set text_vi to translation, restore metadata
- 2 PROFILE_PARTIAL_HAN: replace text_vi with clean translation, set confidence=HIGH, status=TRANSLATED
Total changed cells: exactly 86.
"""
from __future__ import annotations

import argparse
from collections import Counter
import gc
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from typing import Any

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))
from safe_workbook_mutation import AtomicReplaceLockError, create_workbook_backup, safe_mutate_workbook
from workbook_semantic_fingerprint import workbook_semantic_fingerprint


BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_ARTIFACT = (
    BASE_DIR
    / "localization"
    / "reviews"
    / "profile_han_cleanup_20260913_204227_TRANSLATED.xlsx"
)
DEFAULT_MASTER = BASE_DIR / "localization" / "localization_master.xlsx"

EXPECTED_ARTIFACT_SHA256 = "387DB5AF5008E1D48AEF44BC2AE067B719042BEBC628053DF6BAD5ADA57689D5"
EXPECTED_MASTER_SHA256 = "0AB3F5C9B119A8A38F8B59920070CC9F21C1C66B2FA3733D93AF7B357DB1CDDC"
EXPECTED_MASTER_SEMANTIC_FINGERPRINT = "E3E347169B5E2FB3DB86B456FC654E4D7985160C1E391131A1039EFA3AFB168F"

HAN_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")


class GuardError(RuntimeError):
    """Raised when an exact precondition or guard fails."""


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def headers_for(ws: Any) -> dict[str, int]:
    headers = [cell.value for cell in ws[1]]
    return {str(name): index + 1 for index, name in enumerate(headers) if name is not None}


def validate_hashes(artifact_path: Path, master_path: Path) -> dict[str, str]:
    actual_art_sha = sha256(artifact_path)
    actual_mst_sha = sha256(master_path)
    if actual_art_sha != EXPECTED_ARTIFACT_SHA256:
        raise GuardError(f"WRONG_ARTIFACT_SHA expected={EXPECTED_ARTIFACT_SHA256} actual={actual_art_sha}")
    if actual_mst_sha != EXPECTED_MASTER_SHA256:
        raise GuardError(f"WRONG_MASTER_SHA expected={EXPECTED_MASTER_SHA256} actual={actual_mst_sha}")
    actual_fp = workbook_semantic_fingerprint(master_path)
    if actual_fp != EXPECTED_MASTER_SEMANTIC_FINGERPRINT:
        raise GuardError(f"WRONG_MASTER_FINGERPRINT expected={EXPECTED_MASTER_SEMANTIC_FINGERPRINT} actual={actual_fp}")
    return {
        "artifact_sha256": actual_art_sha,
        "master_sha256_before": actual_mst_sha,
        "master_semantic_fingerprint_before": actual_fp,
    }


def load_and_validate_proposals(artifact_path: Path, master_path: Path) -> list[dict[str, Any]]:
    wb_art = openpyxl.load_workbook(artifact_path, data_only=True)
    try:
        if "PROFILE_HAN_BACKLOG" not in wb_art.sheetnames:
            raise GuardError(f"MISSING_SHEET_PROFILE_HAN_BACKLOG {wb_art.sheetnames}")
        ws = wb_art["PROFILE_HAN_BACKLOG"]
        headers = headers_for(ws)
        rows: list[dict[str, Any]] = []
        for row_idx in range(2, ws.max_row + 1):
            row = {h: ws.cell(row_idx, col_idx).value for h, col_idx in headers.items()}
            if any(row.values()):
                rows.append(row)
    finally:
        wb_art.close()

    if len(rows) != 22:
        raise GuardError(f"ROW_COUNT_MISMATCH expected=22 actual={len(rows)}")

    counts = Counter(r["problem_class"] for r in rows)
    if counts.get("PROFILE_SCHEMA_SHIFT") != 20 or counts.get("PROFILE_PARTIAL_HAN") != 2:
        raise GuardError(f"PROBLEM_CLASS_COUNTS_MISMATCH {counts}")

    # Validate proposals
    for r in rows:
        pid = str(r["profile_id"] or "").strip()
        prop = str(r.get("translation_proposed_text_vi") or "").strip()
        if not prop:
            raise GuardError(f"EMPTY_PROPOSAL profile_id={pid}")
        if HAN_RE.search(prop):
            raise GuardError(f"HAN_LEAK_IN_PROPOSAL profile_id={pid} prop={prop}")

    # Validate against master
    fields_to_check = [
        "profile_id", "character_id", "category", "title_cn", "title_vi",
        "text_cn", "text_vi", "confidence", "status", "notes"
    ]
    wb_mst = openpyxl.load_workbook(master_path, data_only=True)
    try:
        ws_m = wb_mst["PROFILE"]
        h_m = headers_for(ws_m)
        m_rows: dict[str, dict[str, Any]] = {}
        for row_idx in range(2, ws_m.max_row + 1):
            pid = str(ws_m.cell(row_idx, h_m["profile_id"]).value or "").strip()
            if pid:
                m_rows[pid] = {f: ws_m.cell(row_idx, h_m[f]).value for f in fields_to_check}

        for r in rows:
            pid = str(r["profile_id"] or "").strip()
            if pid not in m_rows:
                raise GuardError(f"PROFILE_NOT_IN_MASTER {pid}")
            cur_m = m_rows[pid]
            for f in fields_to_check:
                val_art = r.get(f)
                val_mst = cur_m.get(f)
                if val_art != val_mst:
                    raise GuardError(
                        f"MASTER_MISMATCH {pid} field={f}: artifact={val_art!r} vs master={val_mst!r}"
                    )
    finally:
        wb_mst.close()

    return rows


def get_authorized_cells(rows: list[dict[str, Any]]) -> set[tuple[str, str, str]]:
    authorized = set()
    for r in rows:
        pid = str(r["profile_id"] or "").strip()
        pclass = r["problem_class"]
        if pclass == "PROFILE_SCHEMA_SHIFT":
            authorized.add(("PROFILE", pid, "title_vi"))
            authorized.add(("PROFILE", pid, "text_vi"))
            authorized.add(("PROFILE", pid, "confidence"))
            authorized.add(("PROFILE", pid, "status"))
        elif pclass == "PROFILE_PARTIAL_HAN":
            authorized.add(("PROFILE", pid, "text_vi"))
            authorized.add(("PROFILE", pid, "confidence"))
            authorized.add(("PROFILE", pid, "status"))
    return authorized


def mutate_master_in_memory(wb: Any, rows: list[dict[str, Any]]) -> None:
    by_pid = {str(r["profile_id"] or "").strip(): r for r in rows}
    ws = wb["PROFILE"]
    h = headers_for(ws)

    for row_idx in range(2, ws.max_row + 1):
        pid = str(ws.cell(row_idx, h["profile_id"]).value or "").strip()
        item = by_pid.get(pid)
        if not item:
            continue

        pclass = item["problem_class"]
        raction = item["repair_action"]

        if pclass == "PROFILE_SCHEMA_SHIFT":
            if raction != "CLEAR_TITLE_VI_AND_RESTORE_TEXT_METADATA":
                raise GuardError(f"UNEXPECTED_REPAIR_ACTION {pid} {raction}")
            ws.cell(row_idx, h["title_vi"]).value = None
            ws.cell(row_idx, h["text_vi"]).value = item["translation_proposed_text_vi"]
            ws.cell(row_idx, h["confidence"]).value = item["repair_proposed_confidence"] or "HIGH"
            ws.cell(row_idx, h["status"]).value = item["repair_proposed_status"] or "TRANSLATED"
            ws.cell(row_idx, h["notes"]).value = item["repair_proposed_notes"] or "Migrated from names_vi.xlsx (Hồ Sơ)"
        elif pclass == "PROFILE_PARTIAL_HAN":
            if raction != "REPLACE_TEXT_VI_AND_REVIEW_METADATA":
                raise GuardError(f"UNEXPECTED_REPAIR_ACTION {pid} {raction}")
            ws.cell(row_idx, h["text_vi"]).value = item["translation_proposed_text_vi"]
            ws.cell(row_idx, h["confidence"]).value = "HIGH"
            ws.cell(row_idx, h["status"]).value = "TRANSLATED"


def validate_candidate_exact_delta(before_path: Path, candidate_path: Path, authorized: set[tuple[str, str, str]]) -> None:
    current = openpyxl.load_workbook(before_path, data_only=False, read_only=True)
    candidate = openpyxl.load_workbook(candidate_path, data_only=False, read_only=True)
    try:
        if current.sheetnames != candidate.sheetnames:
            raise GuardError("CANDIDATE_SHEET_TOPOLOGY_CHANGED")
        changes: set[tuple[str, str, str]] = set()
        for sheet_name in current.sheetnames:
            source_ws, candidate_ws = current[sheet_name], candidate[sheet_name]
            source_headers = [cell.value for cell in next(source_ws.iter_rows(min_row=1, max_row=1))]
            candidate_headers = [cell.value for cell in next(candidate_ws.iter_rows(min_row=1, max_row=1))]
            if source_headers != candidate_headers or source_ws.max_row != candidate_ws.max_row:
                raise GuardError(f"CANDIDATE_TOPOLOGY_CHANGED sheet={sheet_name}")
            for source_row, candidate_row in zip(
                source_ws.iter_rows(min_row=2, values_only=True),
                candidate_ws.iter_rows(min_row=2, values_only=True),
            ):
                record_id = str((source_row[0] if source_row else None) or "")
                for index, (source_value, candidate_value) in enumerate(zip(source_row, candidate_row)):
                    if source_value == candidate_value:
                        continue
                    key = (sheet_name, record_id, str(source_headers[index]))
                    if key not in authorized:
                        raise GuardError(f"CANDIDATE_UNAUTHORIZED_DELTA {key!r} before={source_value!r} after={candidate_value!r}")
                    changes.add(key)
        if changes != authorized:
            raise GuardError(
                f"CANDIDATE_DELTA_COUNT_INVALID expected={len(authorized)} actual={len(changes)}"
            )
    finally:
        current.close()
        candidate.close()


def generate_candidate(master_path: Path, rows: list[dict[str, Any]]) -> Path:
    candidate_path = master_path.with_name(master_path.name + ".candidate.tmp.xlsx")
    wb = openpyxl.load_workbook(master_path)
    try:
        mutate_master_in_memory(wb, rows)
        wb.save(candidate_path)
    finally:
        wb.close()
    return candidate_path


def guarded_in_place_fallback(
    master_path: Path,
    candidate_path: Path,
    backup_path: Path,
    authorized: set[tuple[str, str, str]]
) -> None:
    current_sha = sha256(master_path)
    current_fp = workbook_semantic_fingerprint(master_path)
    if current_fp != EXPECTED_MASTER_SEMANTIC_FINGERPRINT:
        raise GuardError("FALLBACK_MASTER_FINGERPRINT_GUARD_FAILED")

    candidate_fp = workbook_semantic_fingerprint(candidate_path)
    if candidate_fp == current_fp:
        raise GuardError("FALLBACK_CANDIDATE_HAS_NO_DELTA")

    validate_candidate_exact_delta(master_path, candidate_path, authorized)

    if sha256(backup_path) != current_sha or workbook_semantic_fingerprint(backup_path) != current_fp:
        raise GuardError("FALLBACK_BACKUP_VERIFICATION_FAILED")

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
        raise GuardError(f"FALLBACK_EXCLUSIVE_WRITE_FAILED winerror={ctypes.get_last_error()}")

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
        if sha256(master_path) != sha256(candidate_path):
            raise GuardError("FALLBACK_SHA_VERIFICATION_FAILED")
        if workbook_semantic_fingerprint(master_path) != candidate_fp:
            raise GuardError("FALLBACK_SEMANTIC_VERIFICATION_FAILED")
        validate_candidate_exact_delta(backup_path, master_path, authorized)
    except Exception as exc:
        restore_handle = create_file(str(master_path), 0xC0000000, 0, None, 3, 0x80, None)
        if restore_handle == invalid_handle:
            raise GuardError(
                f"FALLBACK_FAILED_AND_RESTORE_HANDLE_UNAVAILABLE winerror={ctypes.get_last_error()}"
            ) from exc
        try:
            overwrite(restore_handle, backup_path.read_bytes())
            if sha256(master_path) != sha256(backup_path):
                raise GuardError("FALLBACK_RESTORE_SHA_VERIFICATION_FAILED")
            if workbook_semantic_fingerprint(master_path) != workbook_semantic_fingerprint(backup_path):
                raise GuardError("FALLBACK_RESTORE_SEMANTIC_VERIFICATION_FAILED")
        except Exception as restore_exc:
            raise GuardError(f"FALLBACK_FAILED_AND_RESTORE_FAILED {restore_exc!r}") from exc
        raise GuardError(f"FALLBACK_FAILED_RESTORED_FROM={backup_path} cause={exc!r}") from exc


def main() -> int:
    if getattr(sys.stdout, "encoding", "").lower() != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact", type=Path, default=DEFAULT_ARTIFACT)
    parser.add_argument("--master", type=Path, default=DEFAULT_MASTER)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    artifact_path, master_path = args.artifact.resolve(), args.master.resolve()

    try:
        result = validate_hashes(artifact_path, master_path)
        rows = load_and_validate_proposals(artifact_path, master_path)
        authorized = get_authorized_cells(rows)

        if len(authorized) != 86:
            raise GuardError(f"AUTHORIZED_CELLS_COUNT_MISMATCH expected=86 actual={len(authorized)}")

        result.update(
            total_rows=len(rows),
            schema_shift_rows=sum(1 for r in rows if r["problem_class"] == "PROFILE_SCHEMA_SHIFT"),
            partial_han_rows=sum(1 for r in rows if r["problem_class"] == "PROFILE_PARTIAL_HAN"),
            authorized_cells_count=len(authorized),
            pre_apply_guards="PASS",
        )

        candidate_path = generate_candidate(master_path, rows)
        try:
            validate_candidate_exact_delta(master_path, candidate_path, authorized)
            result["candidate_delta_check"] = "PASS (exactly 86 cells)"

            if args.dry_run:
                result["dry_run"] = True
                print(json.dumps(result, ensure_ascii=False, indent=2))
                return 0

            backup_path = Path(create_workbook_backup(str(BASE_DIR)))
            backup_sha = sha256(backup_path)
            result["backup_path"] = str(backup_path)
            result["backup_sha256"] = backup_sha

            gc.collect()

            # Mutate master
            try:
                safe_mutate_workbook(
                    str(BASE_DIR),
                    lambda wb: mutate_master_in_memory(wb, rows),
                    authorized_deps={},
                    authorized_cells=authorized,
                )
                result["write_method"] = "ATOMIC_REPLACE"
            except AtomicReplaceLockError:
                print("[INFO] Atomic replace hit Windows lock; engaging GUARDED_IN_PLACE_FALLBACK...", file=sys.stderr)
                guarded_in_place_fallback(master_path, candidate_path, backup_path, authorized)
                result["write_method"] = "GUARDED_IN_PLACE_FALLBACK"

            validate_candidate_exact_delta(backup_path, master_path, authorized)
            new_sha = sha256(master_path)
            new_fp = workbook_semantic_fingerprint(master_path)

            result.update(
                master_sha256_after=new_sha,
                master_semantic_fingerprint_after=new_fp,
                schema_shift_rows_applied=20,
                partial_han_rows_applied=2,
                total_modified_cells=len(authorized),
            )
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0
        finally:
            if candidate_path.is_file():
                try:
                    candidate_path.unlink()
                except Exception:
                    pass
    except GuardError as exc:
        print(f"GUARD_ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
