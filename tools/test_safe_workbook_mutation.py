"""Regression test: a valid safe mutation must reach atomic replacement."""
from __future__ import annotations

import gc
import shutil
import sys
import unittest
from unittest import mock
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import openpyxl

import safe_workbook_mutation


class SafeWorkbookMutationTest(unittest.TestCase):
    def test_successful_mutation_reaches_atomic_replace(self):
        root = Path(__file__).resolve().parent / "test_fixtures" / "safe_mutation"
        localization = root / "localization"
        master = localization / "localization_master.xlsx"
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.title = "SKILL"
        sheet.append(["skill_id", "skill_name_vi"])
        sheet.append(["S1", "old"])
        workbook.save(master)
        workbook.close()
        del workbook
        gc.collect()

        def mutate(wb):
            wb["SKILL"]["B2"] = "new"

        calls = []
        def successful_atomic_replace(source, destination):
            calls.append((source, destination))
            shutil.copy2(source, destination)
        # The CI desktop profile can leave an external AV handle on a freshly
        # saved .xlsx. This verifies that a valid mutation reaches the atomic
        # replacement call (the regression point for the former NameError).
        with mock.patch.object(safe_workbook_mutation.os, "replace", side_effect=successful_atomic_replace):
            backup = safe_workbook_mutation.safe_mutate_workbook(
                str(root), mutate, {"skill_ids": {"S1"}}, authorized_new_columns={}
            )
        self.assertTrue(Path(backup).is_file())
        self.assertEqual(len(calls), 1)
        checked = openpyxl.load_workbook(master, read_only=True)
        self.assertEqual(checked["SKILL"]["B2"].value, "new")
        checked.close()

    def test_duplicate_primary_key_invariant_fails(self):
        root = Path(__file__).resolve().parent / "test_fixtures" / "safe_mutation_dup"
        localization = root / "localization"
        master = localization / "localization_master.xlsx"
        localization.mkdir(parents=True, exist_ok=True)
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.title = "SKILL"
        sheet.append(["skill_id", "skill_name_vi"])
        sheet.append(["S1", "name1"])
        sheet.append(["S2", "name2"])
        workbook.save(master)
        workbook.close()
        del workbook
        gc.collect()

        def mutate_intro_dup(wb):
            # Change S2 to S1, introducing duplicate S1
            wb["SKILL"]["A3"] = "S1"

        with self.assertRaises(PermissionError) as ctx:
            safe_workbook_mutation.safe_mutate_workbook(
                str(root), mutate_intro_dup, {"skill_ids": {"S1", "S2"}}, authorized_new_columns={}
            )
        self.assertIn("Duplicate primary key invariant violated", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
