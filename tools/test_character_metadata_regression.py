"""Regression tests for Character Job and Attack Style Type sourcing.

Authoritative presentation rule:
- UI "Kiểu tấn công" is derived SOLELY from exact textual tokens in CharacterTagLanText:
    近战 -> 1 (Cận chiến)
    远程 -> 2 (Tầm xa)
    neither / both -> 0 (Chưa xác định)
- Raw characterTable.json.attacktype is an opaque engine field (preserved without semantic mapping).
- No job/class inference.
- No SelectRange / attack range inference.
- No historical names_vi.xlsx semantic authority (names_vi only copied the raw engine field).
"""

import json
import unittest
from pathlib import Path
import openpyxl

WHMXCALC_ROOT = Path(__file__).resolve().parent.parent
NEO_MASTER = WHMXCALC_ROOT.parent / "NeoArtifacts" / "MasterData" / "json"
DATA_JSON_PATH = WHMXCALC_ROOT / "public" / "data.json"
NAMES_VI_PATH = WHMXCALC_ROOT / "localization" / "names_vi.xlsx"


class TestCharacterMetadataRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(DATA_JSON_PATH, "r", encoding="utf-8") as f:
            cls.web_data = json.load(f)
        cls.characters = cls.web_data.get("characters", {})

        with open(NEO_MASTER / "characterTable.json", "r", encoding="utf-8-sig") as f:
            cls.raw_characters = json.load(f)

        cls.historical_oracle = {}
        if NAMES_VI_PATH.exists():
            wb = openpyxl.load_workbook(NAMES_VI_PATH, read_only=True, data_only=True)
            for sheetname in wb.sheetnames:
                ws = wb[sheetname]
                first_row = [str(c).strip().lower() if c is not None else "" for c in next(ws.iter_rows(values_only=True))]
                if "id" in first_row and "attacktype" in first_row:
                    id_idx = first_row.index("id")
                    at_idx = first_row.index("attacktype")
                    for row in ws.iter_rows(min_row=2, values_only=True):
                        cid = row[id_idx]
                        if cid and str(cid).strip():
                            cls.historical_oracle[str(cid).strip()] = row[at_idx]
                    break
            wb.close()

    def test_roster_count_and_keys(self):
        self.assertEqual(len(self.characters), 133, "Expected exactly 133 public characters")
        for cid, char in self.characters.items():
            self.assertIn("job", char, f"Char [{cid}] missing 'job'")
            self.assertIn("attacktype", char, f"Char [{cid}] missing 'attacktype'")
            self.assertIn("attack_style_type", char, f"Char [{cid}] missing 'attack_style_type'")

    def test_job_validity_and_provenance(self):
        valid_jobs = {1, 2, 3, 4, 5}
        for cid, char in self.characters.items():
            job = char.get("job")
            self.assertIn(job, valid_jobs, f"Char [{cid}] has invalid job {job}")
            raw_job = self.raw_characters.get(cid, {}).get("job")
            self.assertEqual(job, raw_job, f"Char [{cid}] job {job} does not match raw {raw_job}")

    def test_raw_attacktype_engine_field_preserved(self):
        """Preserve raw characterTable.json.attacktype as an engine field without semantic overloading."""
        for cid, char in self.characters.items():
            raw_at = self.raw_characters.get(cid, {}).get("attacktype")
            self.assertEqual(char.get("attacktype"), raw_at,
                             f"Char [{cid}] attacktype does not match raw characterTable.attacktype")

    def test_attack_style_type_derived_solely_from_tags(self):
        """attack_style_type must derive SOLELY from CharacterTagLanText tokens 近战 / 远程."""
        for cid, char in self.characters.items():
            ast = char.get("attack_style_type")
            self.assertIn(ast, {0, 1, 2}, f"Char [{cid}] invalid attack_style_type {ast}")

            raw_tags = self.raw_characters.get(cid, {}).get("CharacterTagLanText") or ""
            tokens = [t.strip() for t in raw_tags.replace("；", ";").replace(",", ";").split(";") if t.strip()]
            has_melee = "近战" in tokens
            has_ranged = "远程" in tokens

            if has_melee and not has_ranged:
                expected = 1
            elif has_ranged and not has_melee:
                expected = 2
            else:
                expected = 0

            self.assertEqual(ast, expected,
                             f"Char [{cid}] attack_style_type {ast} != expected {expected} from tags {raw_tags!r}")

    def test_attack_style_distribution(self):
        """Exact distribution across 133 public characters: Melee=50, Ranged=81, Unknown=2, Both=0."""
        c0 = sum(1 for c in self.characters.values() if c.get("attack_style_type") == 0)
        c1 = sum(1 for c in self.characters.values() if c.get("attack_style_type") == 1)
        c2 = sum(1 for c in self.characters.values() if c.get("attack_style_type") == 2)
        other = sum(1 for c in self.characters.values() if c.get("attack_style_type") not in (0, 1, 2))

        self.assertEqual(c1, 50, f"Expected exactly 50 melee characters, got {c1}")
        self.assertEqual(c2, 81, f"Expected exactly 81 ranged characters, got {c2}")
        self.assertEqual(c0, 2, f"Expected exactly 2 unknown characters, got {c0}")
        self.assertEqual(other, 0, f"Expected 0 other attack_style_type values, got {other}")

    def test_special_tag_characters_neither_melee_nor_ranged(self):
        """Characters with 职业切换 / 形态切换 have neither 近战 nor 远程 and must resolve to 0 (Chưa xác định)."""
        # V0172: tags=['职业切换', '输出', '爆发']
        self.assertEqual(self.characters["V0172"]["attack_style_type"], 0)
        # W0178: tags=['形态切换', '输出', '技能伤害', '范围伤害']
        self.assertEqual(self.characters["W0178"]["attack_style_type"], 0)

    def test_known_counterexamples_decoupled_from_job_and_range(self):
        """Proves job, SelectRange/tile distance, and raw numeric attacktype are decoupled from attack_style_type."""
        # W0182: Job 4 (Cấu Thuật) with 1-tile attack range, tag '远程' -> attack_style_type = 2 (Tầm xa)
        self.assertEqual(self.characters["W0182"]["attack_style_type"], 2)

        # D0183: Job 1 (Túc Vệ) with 2-tile attack range, tag '近战' -> attack_style_type = 1 (Cận chiến)
        self.assertEqual(self.characters["D0183"]["attack_style_type"], 1)

        # D0017: Job 1 (Túc Vệ), tag '近战', raw attacktype=2 -> attack_style_type = 1 (Cận chiến, NOT Ranged)
        self.assertEqual(self.characters["D0017"]["attack_style_type"], 1)
        self.assertEqual(self.characters["D0017"]["attacktype"], 2)

        # V0065: Job 2 (Khinh Nhuệ), tag '近战', raw attacktype=2 -> attack_style_type = 1 (Cận chiến, NOT Ranged)
        self.assertEqual(self.characters["V0065"]["attack_style_type"], 1)
        self.assertEqual(self.characters["V0065"]["attacktype"], 2)

        # S0083: Job 5 (Chiến Lược), tag '远程', raw attacktype=2 -> attack_style_type = 2 (Tầm xa)
        self.assertEqual(self.characters["S0083"]["attack_style_type"], 2)

    def test_frontend_fallback_behavior(self):
        """Verify overviewView.js logic maps 1->Cận chiến, 2->Tầm xa, else->Chưa xác định."""
        attack_style_map = {
            1: "Cận chiến",
            2: "Tầm xa"
        }
        self.assertEqual(attack_style_map.get(1, "Chưa xác định"), "Cận chiến")
        self.assertEqual(attack_style_map.get(2, "Chưa xác định"), "Tầm xa")
        self.assertEqual(attack_style_map.get(0, "Chưa xác định"), "Chưa xác định")
        self.assertEqual(attack_style_map.get(3, "Chưa xác định"), "Chưa xác định")
        self.assertEqual(attack_style_map.get(-1, "Chưa xác định"), "Chưa xác định")
        self.assertEqual(attack_style_map.get(99, "Chưa xác định"), "Chưa xác định")
        self.assertEqual(attack_style_map.get(None, "Chưa xác định"), "Chưa xác định")

    def test_historical_names_vi_provenance_only(self):
        """Historical names_vi.xlsx is an oracle for raw engine data flow only, NOT semantic melee/ranged."""
        self.assertEqual(len(self.historical_oracle), 132)
        overlap = 0
        matches = 0
        for cid, oracle_at in self.historical_oracle.items():
            if cid in self.characters:
                overlap += 1
                if self.characters[cid].get("attacktype") == oracle_at:
                    matches += 1
        self.assertEqual(overlap, 132)
        self.assertEqual(matches, 132, "names_vi.xlsx should match raw engine attacktype data flow")


if __name__ == "__main__":
    unittest.main()
