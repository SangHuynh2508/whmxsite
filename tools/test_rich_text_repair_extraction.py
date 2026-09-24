import unittest
from pathlib import Path
import sys
import uuid

from openpyxl import Workbook

sys.path.insert(0, str(Path(__file__).resolve().parent))

from extract_batch2_richtext_repair import repair_rows


def save_book(path: Path, desc_vi: str):
    wb = Workbook()
    ws = wb.active
    ws.title = "SKILL"
    ws.append([
        "skill_id",
        "character_id",
        "skill_name_cn",
        "skill_name_vi",
        "desc_cn",
        "desc_vi",
        "translation_review_status",
    ])
    source = "造成<color=#158bdb>50%</color>伤害。" + ("长文本" * 400)
    ws.append(["S1", "A0001", "技能", "Kỹ Năng", source, desc_vi, "CHATGPT_REVIEWED"])
    wb.save(path)


class RichTextRepairExtractionTests(unittest.TestCase):
    def test_extracts_changed_failure_without_truncation(self):
        long_vi = "Gây 50% sát thương. " + ("nội dung dài " * 399) + "nội dung dài"
        output_dir = Path(__file__).resolve().parent / "test_fixtures" / "richtext_extraction" / uuid.uuid4().hex
        output_dir.mkdir(parents=True, exist_ok=True)
        before = output_dir / "before.xlsx"
        current = output_dir / "current.xlsx"
        save_book(before, "Bản cũ")
        save_book(current, long_vi)
        rows, _, _ = repair_rows(current, before)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["record_id"], "S1")
        self.assertEqual(rows[0]["current_vi"], long_vi)
        self.assertEqual(rows[0]["error_type"], "MISSING_COLOR_TAG")


if __name__ == "__main__":
    unittest.main()
