"""Regression: buff popup numbers in public/data.json.

[EffectParam,n] in a buff description is the buff's raw argument #(n-1): the Effect row
"Buff_X,#1,#2" passes (#1, #2) and the buff text reads them as [EffectParam,2], [EffectParam,3]
(462/521 buffMap placeholders line up with a #(n-1) in the same buff's Attr).
"""

import json
import unittest
from pathlib import Path

DATA_JSON_PATH = Path(__file__).resolve().parent.parent / "public" / "data.json"

# (character, buff, placeholder) -> per-level values, checked against the game text / wiki
EXPECTED = {
    # V014102 Effect3 "Buff_V0141_1,#1,#2" Para "2,20|30|40": attack +20/30/40% (was 2%)
    ("V0141", "Buff_V0141_1", "[EffectParam,3]"): "20/30/40",
    # e140ade: attack 10/20/30 (was 1/2/3)
    ("V0053", "Buff_V0053_1", "[EffectParam,2]"): "10/20/30",
}


def mechanics(node):
    if isinstance(node, dict):
        if "aggregated_effect_param_values" in node:
            yield node
        for value in node.values():
            yield from mechanics(value)
    elif isinstance(node, list):
        for value in node:
            yield from mechanics(value)


class TestBuffParamRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.characters = json.loads(DATA_JSON_PATH.read_text(encoding="utf-8"))["characters"]

    def test_known_values(self):
        for (char_id, buff_id, token), expected in EXPECTED.items():
            found = {m["aggregated_effect_param_values"].get(token)
                     for m in mechanics(self.characters[char_id]) if m.get("key") == buff_id}
            self.assertEqual(found, {expected}, f"{char_id} {buff_id} {token}")


if __name__ == "__main__":
    unittest.main()
