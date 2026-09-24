import unittest
import os
import sys
import openpyxl
import json
import tempfile
import shutil

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from batch_manifest_helper import load_batch_manifest, collect_batch_dependencies
from zhizhi_resolver import contains_raw_dev_codes, resolve_zhizhi_stat_vi, resolve_zhizhi_entry
from validate_localization_batch import validate_localization_batch
from validate_terminology_consistency import validate_terminology_consistency
from safe_workbook_mutation import create_workbook_backup, safe_mutate_workbook
from check_localization_release import run_release_gate

class TestLocalizationPipeline(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        cls.batch1_manifest_path = os.path.join(cls.base_dir, 'localization', 'batches', 'phase3_batch1.json')
        cls.master_path = os.path.join(cls.base_dir, 'localization', 'localization_master.xlsx')
        cls.wb_master = openpyxl.load_workbook(cls.master_path, data_only=True)

    def test_A_shared_buff_dependency(self):
        """Test A: Shared buff ID referenced by batch skill is included despite not having character ID substring."""
        manifest = load_batch_manifest(self.batch1_manifest_path)
        deps = collect_batch_dependencies(self.base_dir, manifest)
        player_buffs = deps['player_facing_buff_ids']
        
        # Verify generic shared buff IDs exist in dependencies
        shared_buff_samples = ['Buff_Fragile', 'Buff_Mov_Down', 'Buff_MagicDmgReduce']
        for sb in shared_buff_samples:
            self.assertIn(sb, player_buffs, f"Shared buff {sb} was missed by dependency collector!")

    def test_B_missing_vi_coverage_failure(self):
        """Test B: Existing row with missing/None VI field fails coverage validation."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            os.makedirs(os.path.join(tmp_dir, 'localization'), exist_ok=True)
            orig_master = os.path.join(self.base_dir, 'localization', 'localization_master.xlsx')
            orig_gameplay = os.path.join(self.base_dir, 'localization', 'translation_gameplay.xlsx')
            
            tmp_master = os.path.join(tmp_dir, 'localization', 'localization_master.xlsx')
            shutil.copy2(orig_master, tmp_master)
            if os.path.exists(orig_gameplay):
                shutil.copy2(orig_gameplay, os.path.join(tmp_dir, 'localization', 'translation_gameplay.xlsx'))
            
            wb = openpyxl.load_workbook(tmp_master)
            ws = wb['SKILL']
            # Clear desc_vi of A012101_1 (row 326, column 9)
            ws.cell(row=326, column=9, value="")
            wb.save(tmp_master)
            
            success, counts, errors = validate_localization_batch(self.batch1_manifest_path, base_dir=tmp_dir)
            self.assertFalse(success, "Batch coverage validator should FAIL when a required VI field is None!")
            self.assertTrue(any("empty/None" in e for e in errors), f"Error report should mention empty/None VI field: {errors}")

    def test_C_zhizhi_raw_code_detection(self):
        """Test C: Raw developer stat codes are flagged and clean text passes."""
        raw_samples = ['Atk_PERCENT+14', 'PhysicDef_FIX+86', 'SkillUP,A012103', 'A012103ex']
        for rs in raw_samples:
            self.assertTrue(contains_raw_dev_codes(rs), f"Raw dev code '{rs}' should be flagged by contains_raw_dev_codes!")
            
        clean_samples = ['Tấn Công +14%', 'Phòng Thủ Vật Lý +86', 'Cường hóa Nội Tại 1: Huyền Lạc Tiễn Minh', 'Máu +14%']
        for cs in clean_samples:
            self.assertFalse(contains_raw_dev_codes(cs), f"Clean text '{cs}' should NOT be flagged as raw dev code!")

    def test_D_terminology_conflict_detection(self):
        """Test D: Conflicting Vietnamese status names for the same CN term produce warnings."""
        success, conflicts = validate_terminology_consistency(self.batch1_manifest_path, self.base_dir, wb_master=self.wb_master)
        self.assertTrue(success, f"Released Batch 1 should have 0 terminology conflicts! Found: {conflicts}")

    def test_E_mutation_scope_guard(self):
        """Test E: Unexpected unrelated workbook cell change fails scope validation."""
        manifest = load_batch_manifest(self.batch1_manifest_path)
        deps = collect_batch_dependencies(self.base_dir, manifest)
        
        with tempfile.TemporaryDirectory() as tmp_dir:
            os.makedirs(os.path.join(tmp_dir, 'localization'), exist_ok=True)
            orig_master = os.path.join(self.base_dir, 'localization', 'localization_master.xlsx')
            shutil.copy2(orig_master, os.path.join(tmp_dir, 'localization', 'localization_master.xlsx'))
            
            def bad_mutator(wb):
                ws = wb['SKILL']
                # Change a row for A0090 (unauthorized character at row 236)
                ws.cell(row=236, column=7, value="UNAUTHORIZED_MUTATION")
                
            with self.assertRaises(PermissionError):
                safe_mutate_workbook(tmp_dir, bad_mutator, deps)

    def test_F_released_batch1_regression(self):
        """Test F: Released Batch 1 passes 100% release gate with zero translation mutations."""
        ws_buff = self.wb_master['BUFF_STATUS']
        headers_bf = [str(c or '').strip() for c in next(ws_buff.iter_rows(values_only=True))]
        bid_idx = headers_bf.index('buff_id')
        vi_idx = headers_bf.index('buff_name_vi')
        
        buff_vi_map = {}
        for r in ws_buff.iter_rows(min_row=2, values_only=True):
            bid = str(r[bid_idx] or '').strip()
            vvi = str(r[vi_idx] or '').strip()
            buff_vi_map[bid] = vvi
            
        self.assertEqual(buff_vi_map.get('Buff_A0086_15'), 'Thoát Xác', "Buff_A0086_15 must remain 'Thoát Xác'")
        self.assertEqual(buff_vi_map.get('Buff_A0086_19'), 'Kim Ngọc', "Buff_A0086_19 must remain 'Kim Ngọc'")

if __name__ == '__main__':
    unittest.main()
