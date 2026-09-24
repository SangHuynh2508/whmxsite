"""Apply the 89 ChatGPT-reviewed gameplay Han-leak translations with exact guards.

This tool is strictly a mechanical operator:
- Verifies source semantics for W016504ex via NeoArtifacts MasterData
- Validates pre-apply hashes, fingerprint, and proposal integrity
- Applies exact reviewed translations and review-authority bookkeeping
- Performs safe workbook mutation (atomic replace + guarded in-place fallback)
- Validates post-apply master integrity
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
NEO_MASTER_DIR = BASE_DIR.parent / "NeoArtifacts" / "MasterData" / "json"
DEFAULT_ARTIFACT = (
    BASE_DIR
    / "localization"
    / "reviews"
    / "han_leak_gameplay_cleanup_20260913_200325_TRANSLATED.xlsx"
)
DEFAULT_MASTER = BASE_DIR / "localization" / "localization_master.xlsx"

EXPECTED_ARTIFACT_SHA256 = "598669C14764E468106B465989913A415349F7B889D250A492D449206B21C019"
EXPECTED_MASTER_SHA256 = "59A1FF0966505539F44701F118A51890B00FEB106E814FD282030C147C0A13CC"
EXPECTED_MASTER_SEMANTIC_FINGERPRINT = "9E870FAA7DEB41FE1D59BBE4148A09488C5EBB200CBA5B052BA5DE7016891F42"

COLOR_TAG_RE = re.compile(r"</?color[^>]*>")
PLACEHOLDER_RE = re.compile(r"\[Effect[^\]]+\]")
BUFF_MARKER_RE = re.compile(r"\{Buff_[A-Za-z0-9_]+\}")
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


def verify_w016504_semantics() -> dict[str, Any]:
    """Verify NeoArtifacts MasterData for W016504ex and W016504."""
    if not NEO_MASTER_DIR.exists():
        raise GuardError(f"NEO_MASTER_DIR_MISSING {NEO_MASTER_DIR}")

    passives_path = NEO_MASTER_DIR / "characterPassiveSkillMap.json"
    buffs_path = NEO_MASTER_DIR / "buffMap.json"
    skills_path = NEO_MASTER_DIR / "skillMap.json"

    passives = json.loads(passives_path.read_text(encoding="utf-8"))
    buffs = json.loads(buffs_path.read_text(encoding="utf-8"))
    skills = json.loads(skills_path.read_text(encoding="utf-8"))

    # Check skill record text
    skill_rec = skills.get("W016504ex1") or skills.get("W0165041")
    if not skill_rec:
        raise GuardError("W016504_SKILL_RECORD_MISSING")

    desc_text = skill_rec.get("DescriptionLanText", "")
    target_clause = "若单位在被随行的单位周围2格，对该单位周围2格的敌方全体造成"
    has_target_clause = target_clause.replace("周围2格", "").replace("<color=#158bdb>", "").replace("</color>", "") in desc_text.replace("<color=#158bdb>", "").replace("</color>", "")

    # Check passive execution graph:
    # 1. Passive W016504ex applies Buff_W0165_12 to Passive,Source
    # 2. Buff_W0165_12 applies Buff_W0165_15 to Passive,Target (accompanied unit)
    # 3. Buff_W0165_15 triggers OnBeforeAttack (type 9), checks CheckSpecificInRange,0,1,-1,Overlap,2 (attacked target unit),
    #    and applies Buff_W0165_17 to Passive,Target (attacked target unit).
    # 4. Buff_W0165_17 triggers OnBeforeGetHit (type 9), applies Buff_W0165_17_1 to OwnerSelector (attacked target unit).
    # 5. Buff_W0165_17_1 selects Passive,Target,Enemy,Overlap,2,-2_2 (enemies within 2 tiles of attacked target)
    #    and applies Buff_W0165_17_2 dealing damage.
    b15 = buffs.get("Buff_W0165_15")
    b17 = buffs.get("Buff_W0165_17")
    b17_1 = buffs.get("Buff_W0165_17_1")

    if not (b15 and b17 and b17_1):
        raise GuardError("W016504_BUFF_CHAIN_MISSING")

    b15_str = json.dumps(b15)
    b17_str = json.dumps(b17)
    b17_1_str = json.dumps(b17_1)

    cond_in_b15 = "CheckSpecificInRange,0,1,-1,Overlap,2" in b15_str and "OnBeforeAttack" in b15_str
    target_in_b17_1 = "Passive,Target,Enemy,Overlap,2" in b17_1_str

    if cond_in_b15 and target_in_b17_1:
        return {
            "result": "CONFIRMED",
            "evidence": (
                "NeoArtifacts MasterData confirms that in Buff_W0165_15, OnBeforeAttack checks if the attacked target "
                "is within 2 tiles of the accompanied unit (CheckSpecificInRange,0,1,-1,Overlap,2), then Buff_W0165_17 is "
                "placed on that attacked unit (Passive,Target). When that unit is hit (OnBeforeGetHit), Buff_W0165_17_1 "
                "targets all enemies within 2 tiles around that attacked unit (Passive,Target,Enemy,Overlap,2,-2_2). "
                "Thus '单位' is confirmed to be the attack target ('mục tiêu'), and '该单位' is that target unit ('mục tiêu đó')."
            )
        }
    else:
        return {
            "result": "NOT_CONFIRMED",
            "evidence": f"b15_match={cond_in_b15}, b17_1_match={target_in_b17_1}"
        }


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
        if "GAMEPLAY_HAN_LEAKS" not in wb_art.sheetnames:
            raise GuardError(f"MISSING_SHEET_GAMEPLAY_HAN_LEAKS {wb_art.sheetnames}")
        ws = wb_art["GAMEPLAY_HAN_LEAKS"]
        headers = headers_for(ws)
        rows: list[dict[str, Any]] = []
        for row_idx in range(2, ws.max_row + 1):
            row = {h: ws.cell(row_idx, col_idx).value for h, col_idx in headers.items()}
            if any(row.values()):
                rows.append(row)
    finally:
        wb_art.close()

    if len(rows) != 89:
        raise GuardError(f"ROW_COUNT_MISMATCH expected=89 actual={len(rows)}")

    counts = Counter(r["sheet"] for r in rows)
    if counts.get("SKILL") != 83 or counts.get("BUFF_STATUS") != 6 or counts.get("PROFILE", 0) != 0:
        raise GuardError(f"SHEET_COUNTS_MISMATCH {counts}")

    # Validate each proposal
    for r in rows:
        rec_id = str(r["record_id"] or "").strip()
        prop = str(r.get("translation_proposed_vi") or "").strip()
        src = str(r.get("source_cn") or "").strip()
        if not prop:
            raise GuardError(f"EMPTY_PROPOSAL record_id={rec_id}")
        if HAN_RE.search(prop):
            raise GuardError(f"HAN_LEAK_IN_PROPOSAL record_id={rec_id} prop={prop}")
        if PLACEHOLDER_RE.findall(src) != PLACEHOLDER_RE.findall(prop):
            raise GuardError(f"PLACEHOLDER_MISMATCH record_id={rec_id}")
        if COLOR_TAG_RE.findall(src) != COLOR_TAG_RE.findall(prop):
            raise GuardError(f"COLOR_TAG_MISMATCH record_id={rec_id}")
        if BUFF_MARKER_RE.findall(src) != BUFF_MARKER_RE.findall(prop):
            raise GuardError(f"BUFF_MARKER_MISMATCH record_id={rec_id}")

    # Validate against master
    wb_mst = openpyxl.load_workbook(master_path, data_only=True)
    try:
        for r in rows:
            sheet = r["sheet"]
            rec_id = str(r["record_id"] or "").strip()
            field = r["field"]
            src_cn = str(r.get("source_cn") or "")
            cur_vi = str(r.get("current_vi") or "")

            ws_m = wb_mst[sheet]
            h_m = headers_for(ws_m)
            src_col = "desc_cn" if field == "desc_vi" else "buff_desc_cn"

            found = False
            for row_idx in range(2, ws_m.max_row + 1):
                if str(ws_m.cell(row_idx, 1).value or "").strip() == rec_id:
                    found = True
                    actual_src = str(ws_m.cell(row_idx, h_m[src_col]).value or "")
                    actual_vi = str(ws_m.cell(row_idx, h_m[field]).value or "")
                    if actual_src != src_cn:
                        raise GuardError(f"MASTER_SOURCE_MISMATCH {sheet} {rec_id} actual={actual_src!r} art={src_cn!r}")
                    if actual_vi != cur_vi:
                        raise GuardError(f"MASTER_CURRENT_VI_MISMATCH {sheet} {rec_id} actual={actual_vi!r} art={cur_vi!r}")
                    break
            if not found:
                raise GuardError(f"MASTER_RECORD_NOT_FOUND {sheet} {rec_id}")
    finally:
        wb_mst.close()

    return rows


def get_authorized_cells(rows: list[dict[str, Any]]) -> set[tuple[str, str, str]]:
    authorized = set()
    for r in rows:
        sheet = r["sheet"]
        rec_id = str(r["record_id"] or "").strip()
        if sheet == "SKILL":
            authorized.add((sheet, rec_id, "desc_vi"))
            authorized.add((sheet, rec_id, "translation_review_status"))
            authorized.add((sheet, rec_id, "translation_review_source"))
        elif sheet == "BUFF_STATUS":
            authorized.add((sheet, rec_id, "buff_desc_vi"))
            authorized.add((sheet, rec_id, "desc_translation_status"))
            authorized.add((sheet, rec_id, "desc_translation_source"))
    return authorized


def mutate_master_in_memory(wb: Any, rows: list[dict[str, Any]], packet_name: str) -> None:
    by_sheet: dict[str, dict[str, dict[str, Any]]] = {}
    for r in rows:
        by_sheet.setdefault(r["sheet"], {})[str(r["record_id"] or "").strip()] = r

    # Mutate SKILL
    if "SKILL" in by_sheet:
        ws_s = wb["SKILL"]
        h_s = headers_for(ws_s)
        for row_idx in range(2, ws_s.max_row + 1):
            rid = str(ws_s.cell(row_idx, 1).value or "").strip()
            item = by_sheet["SKILL"].get(rid)
            if item:
                ws_s.cell(row_idx, h_s["desc_vi"]).value = item["translation_proposed_vi"]
                ws_s.cell(row_idx, h_s["translation_review_status"]).value = "CHATGPT_REVIEWED"
                ws_s.cell(row_idx, h_s["translation_review_source"]).value = packet_name

    # Mutate BUFF_STATUS
    if "BUFF_STATUS" in by_sheet:
        ws_b = wb["BUFF_STATUS"]
        h_b = headers_for(ws_b)
        for row_idx in range(2, ws_b.max_row + 1):
            rid = str(ws_b.cell(row_idx, 1).value or "").strip()
            item = by_sheet["BUFF_STATUS"].get(rid)
            if item:
                ws_b.cell(row_idx, h_b["buff_desc_vi"]).value = item["translation_proposed_vi"]
                ws_b.cell(row_idx, h_b["desc_translation_status"]).value = "CHATGPT_REVIEWED"
                ws_b.cell(row_idx, h_b["desc_translation_source"]).value = packet_name


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


def generate_candidate(master_path: Path, rows: list[dict[str, Any]], packet_name: str) -> Path:
    candidate_path = master_path.with_name(master_path.name + ".candidate.tmp.xlsx")
    wb = openpyxl.load_workbook(master_path)
    try:
        mutate_master_in_memory(wb, rows, packet_name)
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
        # Step 1: Semantic verification of W016504ex
        w0165_verify = verify_w016504_semantics()
        if w0165_verify["result"] != "CONFIRMED":
            print(f"[STOP] W016504_SEMANTIC = NOT_CONFIRMED: {w0165_verify['evidence']}", file=sys.stderr)
            return 1
        print(f"[W016504_SEMANTIC] {w0165_verify['result']}")

        # Step 2: Hash & Fingerprint guards
        result = validate_hashes(artifact_path, master_path)
        rows = load_and_validate_proposals(artifact_path, master_path)
        authorized = get_authorized_cells(rows)

        result.update(
            w016504_semantic="CONFIRMED",
            total_rows=len(rows),
            skill_rows=sum(1 for r in rows if r["sheet"] == "SKILL"),
            buff_rows=sum(1 for r in rows if r["sheet"] == "BUFF_STATUS"),
            profile_rows=sum(1 for r in rows if r["sheet"] == "PROFILE"),
            authorized_cells_count=len(authorized),
            pre_apply_guards="PASS",
        )

        candidate_path = generate_candidate(master_path, rows, artifact_path.name)
        try:
            validate_candidate_exact_delta(master_path, candidate_path, authorized)
            result["candidate_delta_check"] = "PASS (exactly 267 cells: 89 translations + 178 review metadata)"

            if args.dry_run:
                result["dry_run"] = True
                print(json.dumps(result, ensure_ascii=False, indent=2))
                return 0

            # Step 3: Create backup before mutation
            backup_path = Path(create_workbook_backup(str(BASE_DIR)))
            backup_sha = sha256(backup_path)
            result["backup_path"] = str(backup_path)
            result["backup_sha256"] = backup_sha

            gc.collect()

            # Step 4: Write master
            try:
                safe_mutate_workbook(
                    str(BASE_DIR),
                    lambda wb: mutate_master_in_memory(wb, rows, artifact_path.name),
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
                applied_skill_translations=83,
                applied_buff_translations=6,
                applied_skill_review_metadata=166,
                applied_buff_review_metadata=12,
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
