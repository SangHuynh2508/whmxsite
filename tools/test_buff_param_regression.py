"""Regression: buff popup numbers in public/data.json.

[EffectParam,n] in a buff description is the buff's raw argument #(n-1): the Effect row
"Buff_X,#1,#2" passes (#1, #2) and the buff text reads them as [EffectParam,2], [EffectParam,3]
(462/521 buffMap placeholders line up with a #(n-1) in the same buff's Attr).
"""

import json
import unittest
from pathlib import Path

DATA_JSON_PATH = Path(__file__).resolve().parent.parent / "public" / "data.json"

# (character, buff, placeholder) -> the per-level values every card of that character may show
# (checked against the game text / wiki.biligame.com/whmx 器者图鉴)
EXPECTED = {
    # V014102 Effect3 "Buff_V0141_1,#1,#2" Para "2,20|30|40": attack +20/30/40% (was 2%)
    ("V0141", "Buff_V0141_1", "[EffectParam,3]"): {"20/30/40"},
    # e140ade: attack 10/20/30 (was 1/2/3)
    ("V0053", "Buff_V0053_1", "[EffectParam,2]"): {"10/20/30"},
    # A card that only stacks / removes / triggers a status (ModifyBuffLayer, CleanBuff, …) shows the
    # values of the card that grants it (wiki), not the layer delta ("-1%", "kéo dài 56 lượt").
    ("A0090", "Buff_A0090_3_1", "[EffectParam,2]"): {"4/6/8"},
    ("A0156", "Buff_A0156_1", "[EffectParam,2]"): {"10/15/20"},
    ("V0091", "Buff_V0091_8", "[EffectParam,2]"): {"40/60/80", "80"},  # Hoán Chương card passes 80
    ("V0146", "Buff_V0146_15", "[EffectParam,2]"): {"12/16/20"},
    ("W0011", "Buff_W0011_1", "[EffectParam,2]"): {"10/20/30"},
    ("W0056", "Buff_W0056_1", "[EffectParam,2]"): {"20"},
    ("W0081", "Buff_W0081_1", "[EffectParam,2]"): {"20/30/40"},
    ("W0165", "Buff_W0165_19", "[EffectParam,2]"): {"30/35/40"},
    ("S0174", "Buff_S0174_3_2_1", "[EffectParam,2]"): {"2/4/6", "4/8/12"},
    ("V0112", "Buff_V0112_5_1", "[EffectParam,3]"): {"10/15/20"},
    ("A0061", "Buff_A0061_1", "[EffectParam,2]"): {"1"},
    ("A0061", "Buff_A0061_1", "[EffectParam,4]"): {"30/40/50"},
    ("A0160", "Buff_A0160_10", "[EffectParam,2]"): {"70/85/100"},
    ("D0092", "Buff_D0092_19", "[EffectParam,4]"): {"80"},
    ("D0127", "Buff_D0127_16", "[EffectParam,2]"): {"60/80/100"},
    ("V0049", "Buff_V0049_1", "[EffectParam,3]"): {"60/80/100"},
    ("W0143", "Buff_W0143_1", "[EffectParam,2]"): {"30"},
    # A negative raw value right after 提高/降低/减少… is the direction the game stores for "Res/Reduce"
    # properties: the text already says tăng/giảm, so the number shows without its sign (wiki: 未琢 30%).
    ("V0177", "Buff_V0177_8", "[EffectParam,2]"): {"30", "50"},
    ("W0002", "Buff_W0002_1", "[EffectParam,3]"): {"30"},
    ("A0063", "Buff_Mov_Down", "[EffectParam,3]"): {"1/1/2"},
    ("A0144", "Buff_A0144_14_1", "[EffectParam,2]"): {"30/40/50"},
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
            with self.subTest(char_id=char_id, buff_id=buff_id, token=token):
                self.assertTrue(found and found <= expected, f"{found} not within {expected}")


if __name__ == "__main__":
    unittest.main()
