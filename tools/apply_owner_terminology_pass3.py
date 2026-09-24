"""Transactional Pass #3 owner terminology apply.

This is deliberately narrow: exact reviewed BUFF IDs are read from the V3
review workbook, not from its decision_id, and only the one pre-identified
source-anchored SKILL occurrence is changed.
"""

from __future__ import annotations

import argparse
from copy import copy
from datetime import datetime
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys

import openpyxl


ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "localization" / "localization_master.xlsx"
REVIEW = ROOT / "localization" / "reviews" / "buff_semantic_review_20260911_v3.xlsx"
BACKUPS = ROOT / "localization" / "backups"
REPORTS = ROOT / "localization" / "batch_reports"

DECISIONS = {
    "金戈": "Kim Qua",
    "速羽": "Tốc Vũ",
    "截招": "Tiệt Chiêu",
    "业障": "Nghiệp Chướng",
    "烟雾": "Yên Vụ",
    "炎夏": "Viêm Hạ",
    "雾隐": "Vụ Ẩn",
    "困兽": "Khốn Thú",
    "断肢": "Đoạn Chi",
    "过滤": "Quá Lự",
    "追游": "Truy Du",
    "额剑": "Ngạch Kiếm",
    "业火灼身": "Nghiệp Hỏa Chước Thân",
}

# These exact identities have a reviewed source-to-public-SKILL binding (or an
# existing owner-approved row).  Other V3 identities receive the approved name
# but remain PENDING, so the term-lock registry cannot treat unresolved scope as
# a player-facing lock.
AUTHORITATIVE_IDS = {
    "Buff_HitRate_Down",
    "Buff_Critical_Up",
    "Buff_Mov_Up",
    "Buff_V0117_2_1",
    "Buff_W0165_19",
    "Buff_S0174_4_2_1",
}

# Targeted, exact anchor only; this repairs a raw-CN leak without translating
# surrounding unfinished prose.
SKILL_TERM_PATCHES = {
    "V000803ex": ("Buff_Critical_Up", "金戈", "Kim Qua"),
}
TAG_RE = re.compile(r"^(<color=[^>]+>)(.*)(</color>)$")
STRIP_TAG_RE = re.compile(r"<[^>]+>")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def visible(value: object) -> str:
    return STRIP_TAG_RE.sub("", str(value or "")).strip()


def replace_visible_name(value: object, expected_cn: str, canonical_vi: str) -> str:
    text = str(value or "")
    match = TAG_RE.fullmatch(text)
    if match and visible(match.group(2)) == expected_cn:
        return f"{match.group(1)}{canonical_vi}{match.group(3)}"
    if text == expected_cn:
        return canonical_vi
    raise ValueError(f"unsafe rich-text/source mismatch: {text!r} expected {expected_cn!r}")


def sheet_index(ws):
    headers = [cell.value for cell in next(ws.iter_rows(min_row=1, max_row=1))]
    return {name: index + 1 for index, name in enumerate(headers)}


def reviewed_ids() -> dict[str, set[str]]:
    wb = openpyxl.load_workbook(REVIEW, read_only=True, data_only=False)
    try:
        ws = wb["IDENTITY_DETAIL"]
        idx = sheet_index(ws)
        values: dict[str, set[str]] = {cn: set() for cn in DECISIONS}
        for row in ws.iter_rows(min_row=2, values_only=True):
            cn = visible(row[idx["cn_name"] - 1])
            buff_id = str(row[idx["buff_id"] - 1] or "")
            if cn in values and buff_id:
                values[cn].add(buff_id)
        return values
    finally:
        wb.close()


def make_plan() -> dict:
    ids_by_cn = reviewed_ids()
    wb = openpyxl.load_workbook(MASTER, read_only=True, data_only=False)
    try:
        buff_ws = wb["BUFF_STATUS"]
        buff_idx = sheet_index(buff_ws)
        rows_by_id = {
            str(row[buff_idx["buff_id"] - 1]): row_no
            for row_no, row in enumerate(buff_ws.iter_rows(min_row=2, values_only=True), 2)
        }
        missing = sorted({buff_id for ids in ids_by_cn.values() for buff_id in ids} - set(rows_by_id))
        skill_ws = wb["SKILL"]
        skill_idx = sheet_index(skill_ws)
        skill_rows = {}
        for row_no, row in enumerate(skill_ws.iter_rows(min_row=2, values_only=True), 2):
            skill_id = str(row[skill_idx["skill_id"] - 1] or "")
            if skill_id in SKILL_TERM_PATCHES:
                skill_rows[skill_id] = {
                    "row": row_no,
                    "desc_cn": row[skill_idx["desc_cn"] - 1],
                    "desc_vi": row[skill_idx["desc_vi"] - 1],
                }
        return {
            "decisions": DECISIONS,
            "reviewed_ids": {cn: sorted(ids) for cn, ids in ids_by_cn.items()},
            "buff_rows": {buff_id: rows_by_id[buff_id] for ids in ids_by_cn.values() for buff_id in sorted(ids) if buff_id in rows_by_id},
            "missing_reviewed_buff_rows": missing,
            "skill_rows": skill_rows,
            "authoritative_ids": sorted(AUTHORITATIVE_IDS),
        }
    finally:
        wb.close()


def append_note(existing: object) -> str:
    note = "Owner approved terminology, 2026-09-12"
    text = str(existing or "").strip()
    return text if note in text else (f"{text} | {note}" if text else note)


def apply(plan: dict) -> dict:
    if plan["missing_reviewed_buff_rows"]:
        raise ValueError(f"Reviewed BUFF_STATUS rows missing: {plan['missing_reviewed_buff_rows']}")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    BACKUPS.mkdir(parents=True, exist_ok=True)
    backup = BACKUPS / f"localization_master_pass3_{timestamp}.xlsx"
    shutil.copy2(MASTER, backup)
    backup_hash = sha256(backup)
    wb = openpyxl.load_workbook(MASTER)
    try:
        buff_ws = wb["BUFF_STATUS"]
        buff_idx = sheet_index(buff_ws)
        applied_buff_rows: list[dict] = []
        for cn, ids in plan["reviewed_ids"].items():
            for buff_id in ids:
                row_no = plan["buff_rows"][buff_id]
                row = buff_ws[row_no]
                actual_cn = visible(row[buff_idx["buff_name_cn"] - 1].value)
                if actual_cn != cn:
                    raise ValueError(f"SOURCE_CHANGED {buff_id}: {actual_cn!r} != {cn!r}")
                old_value = row[buff_idx["buff_name_vi"] - 1].value
                new_value = replace_visible_name(row[buff_idx["buff_name_cn"] - 1].value, cn, DECISIONS[cn])
                row[buff_idx["buff_name_vi"] - 1].value = new_value
                row[buff_idx["notes"] - 1].value = append_note(row[buff_idx["notes"] - 1].value)
                if buff_id in AUTHORITATIVE_IDS:
                    row[buff_idx["status"] - 1].value = "OWNER_APPROVED"
                    row[buff_idx["confidence"] - 1].value = "HIGH"
                applied_buff_rows.append({"buff_id": buff_id, "row": row_no, "old": old_value, "new": new_value, "authoritative": buff_id in AUTHORITATIVE_IDS})

        skill_ws = wb["SKILL"]
        skill_idx = sheet_index(skill_ws)
        skill_changes = []
        for skill_id, (buff_id, cn, vi) in SKILL_TERM_PATCHES.items():
            detail = plan["skill_rows"].get(skill_id)
            if not detail:
                raise ValueError(f"Missing exact SKILL target {skill_id}")
            row = skill_ws[detail["row"]]
            desc_cn = str(row[skill_idx["desc_cn"] - 1].value or "")
            desc_vi = str(row[skill_idx["desc_vi"] - 1].value or "")
            if f"{{{buff_id}}}" not in desc_cn or f"<color=#ff6724>{cn}</color>" not in desc_cn:
                raise ValueError(f"SOURCE_CHANGED {skill_id} lacks exact anchor for {buff_id}")
            if desc_vi.count(cn) != 1:
                raise ValueError(f"Unsafe SKILL occurrence {skill_id}: expected one raw term")
            row[skill_idx["desc_vi"] - 1].value = desc_vi.replace(cn, vi, 1)
            skill_changes.append({"skill_id": skill_id, "row": detail["row"], "buff_id": buff_id})

        review_wb = openpyxl.load_workbook(REVIEW)
        try:
            review_ws = review_wb["FAMILY_REVIEW"]
            review_idx = sheet_index(review_ws)
            family_rows = []
            for row_no, row in enumerate(review_ws.iter_rows(min_row=2), 2):
                cn = str(row[review_idx["cn_name"] - 1].value or "")
                if cn not in DECISIONS:
                    continue
                row[review_idx["owner_decision"] - 1].value = "APPROVED"
                row[review_idx["owner_canonical_vi"] - 1].value = DECISIONS[cn]
                row[review_idx["owner_notes"] - 1].value = "Owner approved terminology, 2026-09-12"
                family_rows.append({"cn": cn, "row": row_no})
            review_wb.save(REVIEW)
        finally:
            review_wb.close()

        wb.save(MASTER)
    finally:
        wb.close()
    return {
        "backup": str(backup),
        "backup_sha256": backup_hash,
        "master_sha256_after": sha256(MASTER),
        "buff_rows": applied_buff_rows,
        "skill_rows": skill_changes,
        "family_rows": family_rows,
    }


def main() -> int:
    if getattr(sys.stdout, "encoding", "").lower() != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    plan = make_plan()
    before = sha256(MASTER)
    if not args.apply:
        print(json.dumps({"mode": "dry_run", "master_sha256_before": before, **plan}, ensure_ascii=False, indent=2))
        return 0
    result = apply(plan)
    REPORTS.mkdir(parents=True, exist_ok=True)
    report = REPORTS / f"pass3_owner_terminology_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    report.write_text(json.dumps({"plan": plan, "master_sha256_before": before, "result": result}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"report": str(report), "master_sha256_before": before, **result}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
