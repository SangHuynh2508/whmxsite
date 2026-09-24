"""Conservative, key- and source-verified import for historical translation batches.

The command is dry-run by default.  It never overwrites a populated master VI
cell and never promotes imported text above TRANSLATED.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from collections import Counter, defaultdict
from copy import copy
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook, load_workbook


ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "localization" / "localization_master.xlsx"
DEFAULT_BATCH = ROOT / "localization" / "batches" / "character_translation_batch_skill_huanzhang_completed.xlsx"
BACKUPS = ROOT / "localization" / "backups"
REPORTS = ROOT / "localization" / "batch_reports"
NEW_BATCHES = ROOT / "localization" / "batches"

PRIMARY_KEYS = {
    "CHARACTER": ("character_id",),
    "SKILL": ("skill_id",),
    "BUFF_STATUS": ("buff_id",),
    "HUANZHANG": ("brilliant_id",),
    "ZHIZHI": ("character_id", "star"),
    "SKIN": ("skin_id",),
}
IMPORTABLE_STATUS = {"TRANSLATED"}
NEW_BATCH_STATUS = {"PENDING", "NEEDS_TRANSLATION", "REVIEW", "SOURCE_CHANGED"}
CANONICAL_TERMS = {
    "瞄准": ("Miêu Chuẩn", ("Nhắm Bắn", "Nhắm")),
    "脆弱": ("Thúy Nhược", ("Dễ Vỡ", "Tùy Nhược")),
    "蓄势": ("Súc Thế", ("Tích Thế",)),
}


def text(value) -> str:
    return "" if value is None else str(value).strip()


def key_value(value) -> str:
    value = text(value)
    return value[:-2].upper() if value.endswith(".0") else value.upper()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def headers(ws):
    return [text(cell.value) for cell in ws[1]]


def index_rows(ws, key_columns):
    head = headers(ws)
    positions = [head.index(name) for name in key_columns]
    result, duplicates = {}, []
    for row in range(2, ws.max_row + 1):
        key = tuple(key_value(ws.cell(row, position + 1).value) for position in positions)
        if not all(key) or key in result:
            duplicates.append(key)
        else:
            result[key] = row
    return head, result, duplicates


def row_dict(ws, row, head):
    return {name: ws.cell(row, idx + 1).value for idx, name in enumerate(head)}


def paired_source_column(vi_column: str, head: list[str]) -> str | None:
    if not vi_column.endswith("_vi"):
        return None
    candidate = vi_column[:-3] + "_cn"
    return candidate if candidate in head else None


def term_migrate(value: str, source_cn: str):
    changed = []
    output = value
    for cn, (canonical, legacy) in CANONICAL_TERMS.items():
        if cn not in source_cn:
            continue
        for old in legacy:
            if old in output:
                output = output.replace(old, canonical)
                changed.append({"cn": cn, "old": old, "new": canonical})
    return output, changed


def batch_status_counts(wb):
    result = {}
    for ws in wb.worksheets:
        head = headers(ws)
        if "status" not in head:
            continue
        pos = head.index("status") + 1
        result[ws.title] = dict(Counter(text(ws.cell(row, pos).value) for row in range(2, ws.max_row + 1)))
    return result


def scan(master, batch):
    report = {
        "batch_rows_by_status": batch_status_counts(batch),
        "by_sheet": {}, "term_migration": [], "duplicate_key": [],
    }
    for sheet, key_columns in PRIMARY_KEYS.items():
        if sheet not in batch.sheetnames or sheet not in master.sheetnames:
            continue
        mws, bws = master[sheet], batch[sheet]
        mh, mi, mdupes = index_rows(mws, key_columns)
        bh, bi, bdupes = index_rows(bws, key_columns)
        report["duplicate_key"].extend(
            [{"sheet": sheet, "workbook": "master", "key": list(key)} for key in mdupes]
            + [{"sheet": sheet, "workbook": "batch", "key": list(key)} for key in bdupes]
        )
        counts, decisions = Counter(), []
        status_col = bh.index("status") + 1 if "status" in bh else None
        for key, brow in bi.items():
            bdata = row_dict(bws, brow, bh)
            status = text(bws.cell(brow, status_col).value) if status_col else ""
            decision = {"key": list(key), "status": status, "fields": [], "action": ""}
            if status not in IMPORTABLE_STATUS:
                decision["action"] = "SKIP_PENDING"
            elif key not in mi:
                decision["action"] = "MISSING_TARGET"
            else:
                mrow = mi[key]
                mdata = row_dict(mws, mrow, mh)
                relevant = [
                    col for col in bh if col.endswith("_vi") and col in mh and text(bdata.get(col))
                ]
                source_changed = []
                for col in relevant:
                    source_col = paired_source_column(col, bh)
                    if source_col and source_col in mh and text(bdata.get(source_col)) != text(mdata.get(source_col)):
                        source_changed.append({"field": col, "old_cn": text(bdata.get(source_col)), "new_cn": text(mdata.get(source_col))})
                if source_changed:
                    decision["action"] = "SOURCE_CHANGED"
                    decision["source_changed"] = source_changed
                elif not relevant:
                    decision["action"] = "SKIP_PENDING"
                else:
                    conflicts, accepted, kept = [], [], []
                    for col in relevant:
                        incoming, migrations = term_migrate(text(bdata[col]), text(bdata.get(paired_source_column(col, bh) or "")))
                        current = text(mdata.get(col))
                        field = {"field": col, "incoming": incoming, "master": current}
                        if migrations:
                            field["term_migration"] = migrations
                            for item in migrations:
                                report["term_migration"].append({"sheet": sheet, "key": list(key), "field": col, **item})
                        if not current:
                            accepted.append(field)
                        elif current == incoming:
                            kept.append(field)
                        else:
                            conflicts.append(field)
                        decision["fields"].append(field)
                    if conflicts:
                        decision["action"] = "CONFLICT"
                    elif accepted:
                        decision["action"] = "ACCEPT"
                        decision["accepted_fields"] = [item["field"] for item in accepted]
                    else:
                        decision["action"] = "KEEP_MASTER"
            counts[decision["action"]] += 1
            decisions.append(decision)
        report["by_sheet"][sheet] = {"counts": dict(counts), "decisions": decisions}
    return report


def assert_unlocked():
    locks = list(MASTER.parent.glob(f"~${MASTER.name}"))
    if locks:
        raise RuntimeError(f"Workbook is locked by Excel: {locks}")


def apply_master_term_migration(master):
    """Migrate only paired CN/VI named references; never touch notes/history."""
    changes = []
    for ws in master.worksheets:
        head = headers(ws)
        for vi_column in (column for column in head if column.endswith("_vi")):
            source_column = paired_source_column(vi_column, head)
            if not source_column:
                continue
            vi_index, source_index = head.index(vi_column) + 1, head.index(source_column) + 1
            for row in range(2, ws.max_row + 1):
                current = text(ws.cell(row, vi_index).value)
                replacement, migrations = term_migrate(current, text(ws.cell(row, source_index).value))
                if replacement != current:
                    ws.cell(row, vi_index).value = replacement
                    changes.append({
                        "sheet": ws.title, "row": row, "field": vi_column,
                        "category": "NAMED_REFERENCE_TO_MIGRATE", "migrations": migrations,
                    })
    return changes


def apply(master, report, batch_path, migrate_master_terms=False):
    assert_unlocked()
    before_hash = sha256(MASTER)
    BACKUPS.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = BACKUPS / f"localization_master_pre_batch_import_{stamp}.xlsx"
    shutil.copy2(MASTER, backup)
    if sha256(backup) != before_hash:
        raise RuntimeError("Backup SHA-256 does not match master before mutation")
    changes = []
    for sheet, data in report["by_sheet"].items():
        ws, head = master[sheet], headers(master[sheet])
        _, indexed, _ = index_rows(ws, PRIMARY_KEYS[sheet])
        for decision in data["decisions"]:
            if decision["action"] != "ACCEPT":
                continue
            row = indexed[tuple(decision["key"])]
            for field in decision["fields"]:
                if field["master"]:
                    continue
                ws.cell(row, head.index(field["field"]) + 1).value = field["incoming"]
                changes.append({"sheet": sheet, "key": decision["key"], "field": field["field"]})
            if "status" in head:
                ws.cell(row, head.index("status") + 1).value = "TRANSLATED"
            if "notes" in head:
                notes = text(ws.cell(row, head.index("notes") + 1).value)
                provenance = f"Imported from {Path(batch_path).name}; requires review"
                if provenance not in notes:
                    ws.cell(row, head.index("notes") + 1).value = f"{notes}; {provenance}".strip("; ")
    if migrate_master_terms:
        report["master_term_migration"] = apply_master_term_migration(master)
    master.save(MASTER)
    report["master_backup"] = str(backup)
    report["backup_sha256"] = before_hash
    report["accepted_cell_changes"] = changes


def export_new_batch(master, output: Path):
    out = Workbook()
    out.remove(out.active)
    counts = {}
    for sheet, key_columns in PRIMARY_KEYS.items():
        if sheet not in master.sheetnames:
            continue
        source = master[sheet]
        head = headers(source)
        if "status" not in head:
            continue
        selected = [row for row in range(2, source.max_row + 1) if text(source.cell(row, head.index("status") + 1).value).upper() in NEW_BATCH_STATUS]
        if not selected:
            continue
        target = out.create_sheet(sheet)
        target.freeze_panes = source.freeze_panes
        target.auto_filter.ref = f"A1:{source.cell(1, source.max_column).coordinate}"
        for col, dimension in source.column_dimensions.items():
            target.column_dimensions[col].width = dimension.width
        for target_row, source_row in enumerate([1, *selected], 1):
            for column in range(1, source.max_column + 1):
                src = source.cell(source_row, column)
                dst = target.cell(target_row, column, src.value)
                # Do not transplant the private `_style` index across
                # workbooks: it points at the source workbook's style table.
                # Copy individual style components so the new review batch is
                # valid while master formatting remains untouched.
                if src.has_style:
                    dst.font = copy(src.font)
                    dst.fill = copy(src.fill)
                    dst.border = copy(src.border)
                    dst.alignment = copy(src.alignment)
                    dst.protection = copy(src.protection)
                dst.number_format = src.number_format
        counts[sheet] = len(selected)
    output.parent.mkdir(parents=True, exist_ok=True)
    out.save(output)
    return counts


def integrity(before, after, allowed):
    checks = {"sheet_topology": before.sheetnames == after.sheetnames, "duplicate_primary_keys": True, "unexpected_cell_changes": []}
    for sheet, key_cols in PRIMARY_KEYS.items():
        if sheet not in before.sheetnames:
            continue
        bh, bi, bd = index_rows(before[sheet], key_cols)
        ah, ai, ad = index_rows(after[sheet], key_cols)
        if bd or ad or set(bi) != set(ai):
            checks["duplicate_primary_keys"] = False
        for key, row in bi.items():
            for col, name in enumerate(bh, 1):
                if before[sheet].cell(row, col).value == after[sheet].cell(ai[key], col).value:
                    continue
                if (sheet, tuple(key), name) not in allowed and name not in {"status", "notes"}:
                    checks["unexpected_cell_changes"].append([sheet, list(key), name])
    checks["pass"] = checks["sheet_topology"] and checks["duplicate_primary_keys"] and not checks["unexpected_cell_changes"]
    return checks


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=Path, default=DEFAULT_BATCH)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--migrate-master-terms", action="store_true")
    parser.add_argument("--new-batch", type=Path)
    args = parser.parse_args()
    if not MASTER.exists() or not args.batch.exists():
        raise FileNotFoundError("Master or batch workbook is missing")
    before = load_workbook(MASTER, data_only=False)
    # `index_rows` deliberately uses exact cell coordinates.  A read-only
    # worksheet makes those lookups repeatedly re-stream the XLSX XML, which
    # is both slow and unsuitable for a deterministic merge audit.
    batch = load_workbook(args.batch, data_only=False)
    report = scan(before, batch)
    if args.apply:
        if report["duplicate_key"]:
            raise RuntimeError("Refusing apply with unresolved duplicate primary keys")
        apply(before, report, args.batch, migrate_master_terms=args.migrate_master_terms)
        after = load_workbook(MASTER, data_only=False)
        allowed = {(x["sheet"], tuple(x["key"]), x["field"]) for x in report["accepted_cell_changes"]}
        for item in report.get("master_term_migration", []):
            key_columns = PRIMARY_KEYS.get(item["sheet"])
            if not key_columns:
                continue
            ws = after[item["sheet"]]
            head, _, _ = index_rows(ws, key_columns)
            key = tuple(key_value(ws.cell(item["row"], head.index(column) + 1).value) for column in key_columns)
            allowed.add((item["sheet"], key, item["field"]))
        report["workbook_integrity"] = integrity(load_workbook(Path(report["master_backup"]), data_only=False), after, allowed)
        output = args.new_batch or NEW_BATCHES / f"translation_continue_from_master_{datetime.now():%Y%m%d_%H%M%S}.xlsx"
        report["new_batch_path"] = str(output)
        report["new_batch_row_counts"] = export_new_batch(after, output)
    REPORTS.mkdir(parents=True, exist_ok=True)
    report_path = REPORTS / f"batch_import_{datetime.now():%Y%m%d_%H%M%S}_{'apply' if args.apply else 'dry_run'}.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        "report": str(report_path), "duplicate_key": len(report["duplicate_key"]),
        "by_sheet": {s: x["counts"] for s, x in report["by_sheet"].items()},
        "backup": report.get("master_backup"), "new_batch": report.get("new_batch_path"),
        "integrity": report.get("workbook_integrity", {}).get("pass"),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
