import unittest

import build_voice_data as b

LINE = {"skin": "A0100001", "type": "regardsLine", "order": 2, "label": "问候", "text": "今日吹的是北风。",
        "file": "NhanVat/A0100_Lotus Chalice/audio/character_regardsline_a0100001.mp3"}
VOICE = {"version": "r3177", "items": {
    "A0100": {"id": "A0100", "langs": [{"lang": "1001", "name": "中文-普通话", "cv": "井琉", "lines": [
        LINE,
        {**LINE, "type": "timeLine_1", "order": 10, "zone": "6,0,18,0"},
        {**LINE, "type": "touchLine_4", "order": 7, "unlock": "感应达到投契解锁", "text": ""},
        {**LINE, "type": "dropLine", "order": 1, "file": None},
    ]}]},
    "A0200": {"id": "A0200", "langs": [{"lang": "1001", "name": "中文-普通话", "cv": "", "lines": [{**LINE, "skin": "A0200001", "file": None}]}]},
}}


class BuildVoiceTest(unittest.TestCase):
    def setUp(self):
        self.index, self.docs = b.build(VOICE, "https://r2.example/")

    def test_key(self):
        self.assertEqual(b.line_key("A0100", "1001", LINE), "voice/a0100/1001/a0100001_regardsLine.mp3")
        self.assertIsNone(b.line_key("A0100", "1001", {**LINE, "file": None}))

    def test_zone_text(self):
        self.assertEqual(b.zone_text("6,0,18,0"), "6:00–18:00")
        self.assertEqual(b.zone_text("18,0,23,59"), "18:00–23:59")
        self.assertEqual(b.zone_text("bad"), "")

    def test_index_only_characters_with_audio(self):
        self.assertEqual(self.index, {"version": "r3177", "ids": ["A0100"]})
        self.assertEqual(list(self.docs), ["A0100"])

    def test_doc_lines(self):
        doc = self.docs["A0100"]
        self.assertEqual(doc["asset_base_url"], "https://r2.example/")
        lines = {l["type"]: l for l in doc["langs"][0]["lines"]}
        self.assertEqual(lines["timeLine_1"]["zone"], "6:00–18:00")
        self.assertEqual(lines["touchLine_4"]["unlock"], "感应达到投契解锁")
        self.assertEqual(lines["touchLine_4"]["text"], "")  # no text in game data: kept, still playable
        self.assertIsNone(lines["dropLine"]["key"])  # not exported: text only
        self.assertNotIn("file", lines["regardsLine"])


if __name__ == "__main__":
    unittest.main()
