"""compare_existing must flag only real Chinese source changes (2026-10-21: the W0185 sync demoted OWNER_APPROVED
shared buffs because the game's names carry <color> tags the workbook stores without, and because
classification metadata differed)."""
import unittest

from sync_masterdata_incremental import compare_existing


class CompareExistingTest(unittest.TestCase):
    def test_color_tags_and_metadata_are_not_source_changes(self):
        current = {"buff_id": "Buff_Disarm", "buff_name_cn": "止戈", "classification_scope": "UNKNOWN", "group_root_id": "4"}
        proposed = {"buff_id": "Buff_Disarm", "buff_name_cn": "<color=#ff6724>止戈</color>",
                    "classification_scope": "PLAYER_FACING", "group_root_id": "Buff_Disarm"}
        self.assertIsNone(compare_existing("BUFF_STATUS", current, proposed, 534))

    def test_real_chinese_change_is_reported(self):
        current = {"buff_id": "Buff_Disarm", "buff_name_cn": "止戈"}
        proposed = {"buff_id": "Buff_Disarm", "buff_name_cn": "<color=#ff6724>止兵</color>"}
        conflict = compare_existing("BUFF_STATUS", current, proposed, 534)
        self.assertIsNotNone(conflict)
        self.assertIn("buff_name_cn", conflict["differences"])


if __name__ == "__main__":
    unittest.main()
