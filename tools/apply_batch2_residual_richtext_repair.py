"""Apply the reviewed Batch #2 residual rich-text repair workbook with exact guards.

This importer intentionally accepts only the reviewed repair artifact described
in the WHMX residual rich-text repair request. It never derives new text:
the artifact is the sole source of every replacement string.
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
    / "WHMX_batch2_residual_audit_20260913.xlsx"
)
DEFAULT_MASTER = BASE_DIR / "localization" / "localization_master.xlsx"
EXPECTED_ARTIFACT_SHA256 = "0D44DE05950A18B9E5580E6336EE2AB70BFE9604740E7AA1BED5F0B5E3F2E0DC"
EXPECTED_MASTER_SHA256 = "C5B872DB977C685559F93ED0063B2D8DFF9D175E7D2F30FF2C08EE8D44B8358C"
EXPECTED_MASTER_SEMANTIC_FINGERPRINT = "4308C73B0FE992AB7CA92588501BA7535B65FAB91136A0A9687DE99293D34D47"

REQUIRED_REPAIR_HEADERS = {
    "sheet",
    "record_id",
    "field",
    "source_cn",
    "current_vi",
    "repair_proposed_vi",
    "qa",
}
SOURCE_FIELD_BY_TARGET = {
    ("SKILL", "desc_vi"): "desc_cn",
    ("BUFF_STATUS", "buff_desc_vi"): "buff_desc_cn",
    ("BUFF_STATUS", "buff_name_vi"): "buff_name_cn",
}
EXPECTED_COUNTS = {"BUFF_STATUS": 41, "SKILL": 1}
EXPECTED_FIELD_COUNTS = {
    ("BUFF_STATUS", "buff_name_vi"): 39,
    ("BUFF_STATUS", "buff_desc_vi"): 2,
    ("SKILL", "desc_vi"): 1,
}
COLOR_TAG_RE = re.compile(r"</?color[^>]*>")
PLACEHOLDER_RE = re.compile(r"\[Effect[^\]]+\]")
BUFF_MARKER_RE = re.compile(r"\{Buff_[^}]+\}")
HAN_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")


class RepairGuardError(RuntimeError):
    """Raised when an exact repair precondition does not hold."""


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def ordered_tokens(pattern: re.Pattern[str], value: Any) -> list[str]:
    return pattern.findall(str(value or ""))


def headers_for(ws: Any) -> dict[str, int]:
    headers = [cell.value for cell in ws[1]]
    return {str(name): index + 1 for index, name in enumerate(headers) if name is not None}


def validate_hashes(artifact_path: Path, master_path: Path) -> dict[str, str]:
    artifact_sha = sha256(artifact_path)
    master_sha = sha256(master_path)
    if artifact_sha != EXPECTED_ARTIFACT_SHA256:
        raise RepairGuardError(
            f"WRONG_REPAIR_ARTIFACT_RUNTIME_FILE expected={EXPECTED_ARTIFACT_SHA256} actual={artifact_sha}"
        )
    if master_sha != EXPECTED_MASTER_SHA256:
        raise RepairGuardError(
            f"WRONG_MASTER_RUNTIME_FILE expected={EXPECTED_MASTER_SHA256} actual={master_sha}"
        )
    return {"artifact_sha256": artifact_sha, "master_sha256_before": master_sha}


def validate_pre_repair_semantics(master_path: Path) -> dict[str, str]:
    current_fingerprint = workbook_semantic_fingerprint(master_path)
    if current_fingerprint != EXPECTED_MASTER_SEMANTIC_FINGERPRINT:
        raise RepairGuardError(
            f"PRE_APPLY_SEMANTIC_GUARD_FAILED current={current_fingerprint} expected={EXPECTED_MASTER_SEMANTIC_FINGERPRINT}"
        )
    return {
        "current_semantic_fingerprint": current_fingerprint,
    }


def load_repairs(artifact_path: Path) -> list[dict[str, str]]:
    workbook = openpyxl.load_workbook(artifact_path, data_only=False, read_only=False)
    try:
        if "RICH_TEXT_REPAIR" not in workbook.sheetnames or "QA" not in workbook.sheetnames:
            raise RepairGuardError(f"REPAIR_ARTIFACT_SHEETS_INVALID actual={workbook.sheetnames!r}")
        ws = workbook["RICH_TEXT_REPAIR"]
        headers = headers_for(ws)
        missing = REQUIRED_REPAIR_HEADERS - set(headers)
        if missing:
            raise RepairGuardError(f"REPAIR_ARTIFACT_HEADERS_MISSING {sorted(missing)!r}")
        repairs: list[dict[str, str]] = []
        for row_number in range(2, ws.max_row + 1):
            row = {
                header: "" if ws.cell(row_number, column).value is None else str(ws.cell(row_number, column).value)
                for header, column in headers.items()
            }
            if not any(row.values()):
                continue
            repairs.append(row)
        validate_artifact_shape(repairs)
        validate_repair_qa(workbook["QA"])
        return repairs
    finally:
        workbook.close()


def validate_artifact_shape(repairs: list[dict[str, str]]) -> None:
    if len(repairs) != 42:
        raise RepairGuardError(f"REPAIR_ARTIFACT_ROW_COUNT_INVALID expected=42 actual={len(repairs)}")
    counts = Counter(repair["sheet"] for repair in repairs)
    if dict(counts) != EXPECTED_COUNTS:
        raise RepairGuardError(f"REPAIR_ARTIFACT_BREAKDOWN_INVALID expected={EXPECTED_COUNTS!r} actual={dict(counts)!r}")
    field_counts = Counter((repair["sheet"], repair["field"]) for repair in repairs)
    if dict(field_counts) != EXPECTED_FIELD_COUNTS:
        raise RepairGuardError(f"REPAIR_ARTIFACT_FIELD_COUNTS_INVALID expected={EXPECTED_FIELD_COUNTS!r} actual={dict(field_counts)!r}")
    for repair in repairs:
        if not repair["repair_proposed_vi"]:
            raise RepairGuardError(
                f"REPAIR_PROPOSAL_EMPTY sheet={repair['sheet']} record_id={repair['record_id']} field={repair['field']}"
            )
        if repair.get("qa") != "PASS":
            raise RepairGuardError(
                f"REPAIR_ROW_QA_NOT_PASS sheet={repair['sheet']} record_id={repair['record_id']} qa={repair.get('qa')!r}"
            )
        key = (repair["sheet"], repair["field"])
        if key not in SOURCE_FIELD_BY_TARGET:
            raise RepairGuardError(f"REPAIR_FIELD_NOT_AUTHORIZED repair={key!r} id={repair['record_id']!r}")
    duplicate_keys = [key for key, count in Counter((r["sheet"], r["record_id"], r["field"]) for r in repairs).items() if count > 1]
    if duplicate_keys:
        raise RepairGuardError(f"REPAIR_ARTIFACT_DUPLICATE_CELLS {duplicate_keys!r}")


def validate_repair_qa(ws: Any) -> None:
    headers = headers_for(ws)
    required = {"check", "result", "details"}
    if not required.issubset(headers):
        raise RepairGuardError("REPAIR_QA_HEADERS_MISSING")
    qa = {
        str(ws.cell(row, headers["check"]).value or ""): {
            "result": str(ws.cell(row, headers["result"]).value or ""),
            "details": str(ws.cell(row, headers["details"]).value or ""),
        }
        for row in range(2, ws.max_row + 1)
    }
    for check in ("rich_text_color_token_parity", "rich_text_placeholder_parity"):
        if qa.get(check, {}).get("result") != "PASS":
            raise RepairGuardError(f"REPAIR_QA_FAILED check={check!r} actual={qa.get(check)!r}")
    han = qa.get("rich_text_han_leaks", {})
    if han.get("result") != "PASS" or not han.get("details", "").startswith("0"):
        raise RepairGuardError(f"REPAIR_QA_FAILED check='rich_text_han_leaks' actual={han!r}")
    count_check = qa.get("rich_text_repair_count", {})
    if count_check.get("result") != "PASS" or count_check.get("details") != "42":
        raise RepairGuardError(f"REPAIR_QA_FAILED check='rich_text_repair_count' actual={count_check!r}")


def master_rows(master_path: Path) -> dict[str, tuple[dict[str, int], dict[str, dict[str, Any]]]]:
    workbook = openpyxl.load_workbook(master_path, data_only=False, read_only=True)
    try:
        result: dict[str, tuple[dict[str, int], dict[str, dict[str, Any]]]] = {}
        for sheet in SOURCE_FIELD_BY_TARGET:
            sheet_name = sheet[0]
            if sheet_name in result:
                continue
            ws = workbook[sheet_name]
            headers = headers_for(ws)
            records = {}
            for values in ws.iter_rows(min_row=2, values_only=True):
                record_id = "" if not values or values[0] is None else str(values[0])
                if record_id:
                    records[record_id] = {
                        header: values[column - 1] if column - 1 < len(values) else None
                        for header, column in headers.items()
                    }
            result[sheet_name] = (headers, records)
        return result
    finally:
        workbook.close()


def validate_current_master(master_path: Path, repairs: list[dict[str, str]]) -> None:
    workbook_data = master_rows(master_path)
    failures: list[str] = []
    for repair in repairs:
        sheet, record_id, target_field = repair["sheet"], repair["record_id"], repair["field"]
        headers, records = workbook_data[sheet]
        source_field = SOURCE_FIELD_BY_TARGET[(sheet, target_field)]
        if target_field not in headers or source_field not in headers:
            failures.append(f"RICH_TEXT_REPAIR_SCHEMA_INVALID sheet={sheet} target={target_field} source={source_field}")
            continue
        current = records.get(record_id)
        if current is None:
            failures.append(f"RICH_TEXT_REPAIR_RECORD_MISSING sheet={sheet} record_id={record_id}")
            continue
        if current[source_field] != repair["source_cn"]:
            failures.append(
                f"RICH_TEXT_REPAIR_SOURCE_CHANGED sheet={sheet} record_id={record_id} field={source_field} "
                f"master={current[source_field]!r} artifact={repair['source_cn']!r}"
            )
        if current[target_field] != repair["current_vi"]:
            failures.append(
                f"RICH_TEXT_REPAIR_TARGET_CHANGED sheet={sheet} record_id={record_id} field={target_field} "
                f"master={current[target_field]!r} artifact_expected_current_vi={repair['current_vi']!r}"
            )
    if failures:
        raise RepairGuardError("\n".join(failures))


def validate_repair_parity(repairs: list[dict[str, str]]) -> None:
    failures: list[str] = []
    for repair in repairs:
        source = repair["source_cn"]
        target = repair["repair_proposed_vi"]
        for label, pattern in (("placeholder", PLACEHOLDER_RE), ("color_tag", COLOR_TAG_RE)):
            if sorted(ordered_tokens(pattern, source)) != sorted(ordered_tokens(pattern, target)):
                failures.append(
                    f"REPAIR_PROPOSAL_{label.upper()}_MISMATCH sheet={repair['sheet']} "
                    f"record_id={repair['record_id']} field={repair['field']}"
                )
        if HAN_RE.search(target):
            failures.append(
                f"REPAIR_PROPOSAL_HAN_LEAK sheet={repair['sheet']} record_id={repair['record_id']} field={repair['field']}"
            )
    if failures:
        raise RepairGuardError("\n".join(failures))


def mutate_master(workbook: Any, repairs: list[dict[str, str]]) -> None:
    by_sheet: dict[str, dict[str, dict[str, str]]] = {}
    for repair in repairs:
        by_sheet.setdefault(repair["sheet"], {})[repair["record_id"]] = repair
    for sheet, by_id in by_sheet.items():
        ws = workbook[sheet]
        headers = headers_for(ws)
        for row_number in range(2, ws.max_row + 1):
            record_id = "" if ws.cell(row_number, 1).value is None else str(ws.cell(row_number, 1).value)
            repair = by_id.get(record_id)
            if repair is None:
                continue
            target_field = repair["field"]
            source_field = SOURCE_FIELD_BY_TARGET[(sheet, target_field)]
            if ws.cell(row_number, headers[source_field]).value != repair["source_cn"]:
                raise RepairGuardError(f"RICH_TEXT_REPAIR_SOURCE_CHANGED_DURING_MUTATION {sheet} {record_id} {source_field}")
            if ws.cell(row_number, headers[target_field]).value != repair["current_vi"]:
                raise RepairGuardError(f"RICH_TEXT_REPAIR_TARGET_CHANGED_DURING_MUTATION {sheet} {record_id} {target_field}")
            ws.cell(row_number, headers[target_field]).value = repair["repair_proposed_vi"]


def validate_applied_master(master_path: Path, repairs: list[dict[str, str]]) -> None:
    workbook_data = master_rows(master_path)
    failures: list[str] = []
    for repair in repairs:
        sheet, record_id, target_field = repair["sheet"], repair["record_id"], repair["field"]
        _, records = workbook_data[sheet]
        actual = records[record_id][target_field]
        if actual != repair["repair_proposed_vi"]:
            failures.append(f"REPAIR_APPLY_VALUE_MISMATCH {sheet} {record_id} {target_field} actual={actual!r}")
            continue
        source_field = SOURCE_FIELD_BY_TARGET[(sheet, target_field)]
        source = records[record_id][source_field]
        for label, pattern in (("placeholder", PLACEHOLDER_RE), ("color_tag", COLOR_TAG_RE)):
            if sorted(ordered_tokens(pattern, source)) != sorted(ordered_tokens(pattern, actual)):
                failures.append(f"REPAIR_APPLY_{label.upper()}_MISMATCH {sheet} {record_id} {target_field}")
        if HAN_RE.search(str(actual)):
            failures.append(f"REPAIR_APPLY_HAN_LEAK {sheet} {record_id} {target_field}")
        if ordered_tokens(BUFF_MARKER_RE, repair["current_vi"]) != ordered_tokens(BUFF_MARKER_RE, actual):
            failures.append(f"REPAIR_APPLY_BUFF_MARKER_CHANGED {sheet} {record_id} {target_field}")
    if failures:
        raise RepairGuardError("\n".join(failures))


def validate_candidate_exact_delta(before_path: Path, candidate_path: Path, repairs: list[dict[str, str]]) -> None:
    """Require candidate to differ from before workbook in EXACTLY 42 cells."""
    authorized = {(r["sheet"], r["record_id"], r["field"]) for r in repairs}
    current = openpyxl.load_workbook(before_path, data_only=False, read_only=True)
    candidate = openpyxl.load_workbook(candidate_path, data_only=False, read_only=True)
    try:
        if current.sheetnames != candidate.sheetnames:
            raise RepairGuardError("CANDIDATE_SHEET_TOPOLOGY_CHANGED")
        changes: set[tuple[str, str, str]] = set()
        for sheet_name in current.sheetnames:
            source_ws, candidate_ws = current[sheet_name], candidate[sheet_name]
            source_headers = [cell.value for cell in next(source_ws.iter_rows(min_row=1, max_row=1))]
            candidate_headers = [cell.value for cell in next(candidate_ws.iter_rows(min_row=1, max_row=1))]
            if source_headers != candidate_headers or source_ws.max_row != candidate_ws.max_row:
                raise RepairGuardError(f"CANDIDATE_TOPOLOGY_CHANGED sheet={sheet_name}")
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
                        raise RepairGuardError(f"CANDIDATE_UNAUTHORIZED_DELTA {key!r} before={source_value!r} after={candidate_value!r}")
                    changes.add(key)
        if changes != authorized:
            raise RepairGuardError(
                f"CANDIDATE_DELTA_COUNT_INVALID expected={len(authorized)} actual={len(changes)}"
            )
    finally:
        current.close()
        candidate.close()


def generate_candidate(master_path: Path, repairs: list[dict[str, str]]) -> Path:
    """Generate and save a checked candidate workbook without touching master."""
    candidate_path = master_path.with_name(master_path.name + ".candidate.tmp.xlsx")
    wb = openpyxl.load_workbook(master_path)
    try:
        mutate_master(wb, repairs)
        wb.save(candidate_path)
    finally:
        wb.close()
    return candidate_path


def guarded_in_place_fallback(master_path: Path, candidate_path: Path, pre_repair_backup: Path, repairs: list[dict[str, str]]) -> Path:
    """Use verified non-atomic overwrite after a lock failure."""
    if workbook_semantic_fingerprint(master_path) != EXPECTED_MASTER_SEMANTIC_FINGERPRINT:
        raise RepairGuardError("FALLBACK_CURRENT_MASTER_SEMANTIC_GUARD_FAILED")
    candidate_fingerprint = workbook_semantic_fingerprint(candidate_path)
    if candidate_fingerprint == workbook_semantic_fingerprint(master_path):
        raise RepairGuardError("FALLBACK_CANDIDATE_HAS_NO_REPAIR_DELTA")
    validate_candidate_exact_delta(master_path, candidate_path, repairs)
    validate_applied_master(candidate_path, repairs)
    current_sha = sha256(master_path)
    current_fingerprint = workbook_semantic_fingerprint(master_path)

    # Use existing pre_repair_backup or create a verified timestamped backup
    fallback_backup = pre_repair_backup
    if sha256(fallback_backup) != current_sha or workbook_semantic_fingerprint(fallback_backup) != current_fingerprint:
        raise RepairGuardError("FALLBACK_BACKUP_VERIFICATION_FAILED")
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
        raise RepairGuardError(f"FALLBACK_EXCLUSIVE_WRITE_FAILED winerror={ctypes.get_last_error()}")

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
            raise RepairGuardError("FALLBACK_SHA_VERIFICATION_FAILED")
        if workbook_semantic_fingerprint(master_path) != candidate_fingerprint:
            raise RepairGuardError("FALLBACK_SEMANTIC_VERIFICATION_FAILED")
        validate_applied_master(master_path, repairs)
        validate_candidate_exact_delta(fallback_backup, master_path, repairs)
    except Exception as exc:
        restore_handle = create_file(str(master_path), 0xC0000000, 0, None, 3, 0x80, None)
        if restore_handle == invalid_handle:
            raise RepairGuardError(
                f"FALLBACK_FAILED_AND_RESTORE_HANDLE_UNAVAILABLE winerror={ctypes.get_last_error()}"
            ) from exc
        try:
            overwrite(restore_handle, fallback_backup.read_bytes())
            if sha256(master_path) != sha256(fallback_backup):
                raise RepairGuardError("FALLBACK_RESTORE_SHA_VERIFICATION_FAILED")
            if workbook_semantic_fingerprint(master_path) != workbook_semantic_fingerprint(fallback_backup):
                raise RepairGuardError("FALLBACK_RESTORE_SEMANTIC_VERIFICATION_FAILED")
        except Exception as restore_exc:
            raise RepairGuardError(f"FALLBACK_FAILED_AND_RESTORE_FAILED {restore_exc!r}") from exc
        raise RepairGuardError(f"FALLBACK_FAILED_RESTORED_FROM={fallback_backup} cause={exc!r}") from exc
    return fallback_backup


def main() -> int:
    if getattr(sys.stdout, "encoding", "").lower() != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact", type=Path, default=DEFAULT_ARTIFACT)
    parser.add_argument("--master", type=Path, default=DEFAULT_MASTER)
    parser.add_argument("--dry-run", action="store_true", help="Validate without mutating the master.")
    args = parser.parse_args()
    artifact_path, master_path = args.artifact.resolve(), args.master.resolve()
    try:
        result = validate_hashes(artifact_path, master_path)
        result.update(validate_pre_repair_semantics(master_path))
        repairs = load_repairs(artifact_path)
        validate_repair_parity(repairs)
        validate_current_master(master_path, repairs)
        result.update(
            repair_rows=len(repairs),
            repair_breakdown=dict(Counter(repair["sheet"] for repair in repairs)),
            repair_field_breakdown={f"{k[0]}.{k[1]}": v for k, v in Counter((r["sheet"], r["field"]) for r in repairs).items()},
            source_current_guard="PASS",
            qa_guard="PASS 42/42",
        )

        # Generate candidate first and inspect exact delta before any mutation
        candidate_path = generate_candidate(master_path, repairs)
        try:
            validate_candidate_exact_delta(master_path, candidate_path, repairs)
            validate_applied_master(candidate_path, repairs)
            result["candidate_exact_delta"] = "EXACTLY 42 CELLS"
            result["candidate_unrelated_delta"] = "0 CELLS"

            if args.dry_run:
                result["dry_run"] = True
                print(json.dumps(result, ensure_ascii=False, indent=2))
                return 0

            # Before any mutation, create a timestamped backup of the current master
            backup_path = Path(create_workbook_backup(str(BASE_DIR)))
            backup_sha = sha256(backup_path)
            result["backup_path"] = str(backup_path)
            result["backup_sha256"] = backup_sha

            gc.collect()
            authorized_cells = {(r["sheet"], r["record_id"], r["field"]) for r in repairs}

            # Attempt safe atomic mutation first
            try:
                safe_mutate_workbook(
                    str(BASE_DIR),
                    lambda workbook: mutate_master(workbook, repairs),
                    authorized_deps={},
                    authorized_cells=authorized_cells,
                )
                result["write_method"] = "ATOMIC_REPLACE"
            except AtomicReplaceLockError as lock_error:
                print("[INFO] Atomic replace hit Windows lock (WinError 32); engaging GUARDED_IN_PLACE_FALLBACK...", file=sys.stderr)
                guarded_in_place_fallback(master_path, candidate_path, backup_path, repairs)
                result["write_method"] = "GUARDED_IN_PLACE_FALLBACK"

            validate_applied_master(master_path, repairs)
            validate_candidate_exact_delta(backup_path, master_path, repairs)

            result.update(
                master_sha256_after=sha256(master_path),
                applied_modified_cell_count=42,
                target_richtext_parity="PASS 42/42",
            )
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0
        finally:
            if candidate_path.is_file():
                try:
                    candidate_path.unlink()
                except Exception:
                    pass
    except RepairGuardError as exc:
        print(f"GUARD_ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
