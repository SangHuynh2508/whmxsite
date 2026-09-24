import unittest
from pathlib import Path

try:  # Supports both `python tools/test_term_lock.py` and unittest discovery.
    from term_lock import (
        LockedTerm, SourceBinding, TermLockRegistry, _is_locked_authority, protect_terms, restore_terms,
        token_for, validate_locked_terms,
    )
except ModuleNotFoundError:
    from tools.term_lock import (
        LockedTerm, SourceBinding, TermLockRegistry, _is_locked_authority, protect_terms, restore_terms,
        token_for, validate_locked_terms,
    )


class TermLockTests(unittest.TestCase):
    def setUp(self):
        self.registry = TermLockRegistry(
            {
                "Buff_Bleed": LockedTerm("Buff_Bleed", "流失", "Mất Máu", "OWNER_APPROVED"),
                "Buff_Weakness": LockedTerm("Buff_Weakness", "咒溃", "Suy Kiệt", "OWNER_APPROVED"),
                "Buff_Incapacitate": LockedTerm("Buff_Incapacitate", "眩晕", "Choáng", "OWNER_APPROVED"),
                "Buff_Intervene": LockedTerm("Buff_Intervene", "援护", "Hộ vệ", "OWNER_APPROVED"),
                "Buff_W0165_19": LockedTerm("Buff_W0165_19", "烟雾", "Yên Vụ", "OWNER_APPROVED"),
                "Buff_Mov_Up": LockedTerm("Buff_Mov_Up", "速羽", "Tốc Vũ", "OWNER_APPROVED"),
                "Buff_Mov_UUUUp": LockedTerm("Buff_Mov_UUUUp", "速羽", "Tốc Vũ", "OWNER_APPROVED"),
            },
            {"Buff_A0069_7"},
        )

    def test_approved_round_trip_examples(self):
        cases = [
            ("Buff_Bleed", "流失", "Mất Máu"),
            ("Buff_Weakness", "咒溃", "Suy Kiệt"),
            ("Buff_Incapacitate", "眩晕", "Choáng"),
            ("Buff_Intervene", "援护", "Hộ vệ"),
            ("Buff_W0165_19", "烟雾", "Yên Vụ"),
        ]
        for buff_id, cn, vi in cases:
            with self.subTest(buff_id=buff_id):
                source = f"获得<color=#ff6724>{cn}</color>状态。{{{buff_id}}}"
                protected = protect_terms(source, self.registry)
                self.assertEqual(protected.locked_ids, (buff_id,))
                self.assertEqual(restore_terms(protected.text.replace("获得", "Nhận"), self.registry), f"Nhận<color=#ff6724>{vi}</color>状态。{{{buff_id}}}")

    def test_same_cn_keeps_exact_id(self):
        first = protect_terms("获得速羽。{Buff_Mov_Up}", self.registry)
        second = protect_terms("获得速羽。{Buff_Mov_UUUUp}", self.registry)
        self.assertIn(token_for("Buff_Mov_Up"), first.text)
        self.assertIn(token_for("Buff_Mov_UUUUp"), second.text)

    def test_unresolved_identity_is_not_locked(self):
        source = "获得金戈。{Buff_A0069_7}"
        protected = protect_terms(source, self.registry)
        self.assertEqual(protected.locked_ids, ())
        self.assertEqual(protected.skipped_unresolved_ids, ("Buff_A0069_7",))
        issues = validate_locked_terms(source, token_for("Buff_A0069_7"), self.registry, protected_phase=True)
        self.assertEqual(issues[0].code, "UNRESOLVED_IDENTITY_NOT_LOCKED")

    def test_corrupted_token_is_reported(self):
        source = "获得流失。{Buff_Bleed}"
        issues = validate_locked_terms(source, "Nhận [[WHMX_TERM:Buff_Bleed]", self.registry, protected_phase=True)
        self.assertEqual(issues[0].code, "LOCK_TOKEN_CORRUPTED")

    def test_cn_leak_alias_and_drift_are_reported(self):
        registry = TermLockRegistry({"Buff_Bleed": LockedTerm("Buff_Bleed", "流失", "Mất Máu", "OWNER_APPROVED", ("Chảy Máu",))})
        source = "获得流失。{Buff_Bleed}"
        issues = validate_locked_terms(source, "Nhận Chảy Máu và 流失", registry, protected_phase=False)
        self.assertEqual({issue.code for issue in issues}, {"CANONICAL_TERM_MISMATCH", "CN_LEAK_FOR_LOCKED_TERM", "LEGACY_ALIAS_FOR_LOCKED_TERM"})

    def test_rich_text_and_explicit_binding(self):
        source = "<color=#ff6724>流失</color>状态。{Buff_Bleed}"
        protected = protect_terms(source, self.registry)
        self.assertEqual(protected.text, f"<color=#ff6724>{token_for('Buff_Bleed')}</color>状态。{{Buff_Bleed}}")

    def test_no_safe_binding_does_not_replace_cn_substring(self):
        source = "流失的生命无法恢复。"
        protected = protect_terms(source, self.registry)
        self.assertEqual(protected.text, source)
        self.assertEqual(protected.locked_ids, ())

    def test_verified_relationship_binding_without_marker(self):
        source = "获得流失状态。"
        protected = protect_terms(source, self.registry, [SourceBinding("Buff_Bleed")])
        self.assertIn(token_for("Buff_Bleed"), protected.text)

    def test_registry_is_loaded_from_workbook(self):
        registry = TermLockRegistry.from_workbook(Path("localization/localization_master.xlsx"))
        self.assertEqual(registry.get("Buff_Bleed").canonical_vi, "Mất Máu")
        self.assertIsNone(registry.get("Buff_A0069_7"))
        self.assertIn("Buff_A0069_7", registry.unresolved_ids)

    def test_name_authority_precedes_legacy_row_status(self):
        self.assertTrue(_is_locked_authority("OWNER_APPROVED", "TRANSLATED"))
        self.assertFalse(_is_locked_authority("PENDING", "OWNER_APPROVED"))
        self.assertTrue(_is_locked_authority("", "OWNER_APPROVED"))


if __name__ == "__main__":
    unittest.main()
