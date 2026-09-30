import json
import tempfile
import unittest
from pathlib import Path

import build_banner_data as b

POOLS = [
    {"id": "2114", "nameLanText": "万嶂烟峦", "type": "limited", "kindNameLanText": "限定渠道", "hidden": False,
     "startTime": 200, "endTime": 900, "characterShow": ["A0184"], "characterSkinShow": "001"},
    {"id": "340001", "nameLanText": "孤岛螺旋", "type": "season", "kindNameLanText": "限时渠道", "hidden": False,
     "startTime": 200, "endTime": 2000, "characterShow": ["W0097"], "characterSkinShow": "009"},
    {"id": "5003", "nameLanText": "结伴同游", "type": "time", "kindNameLanText": "限时渠道", "hidden": False,
     "startTime": 200, "endTime": 900, "characterShow": [], "characterSkinShow": ""},
    {"id": "2017", "nameLanText": "歆铭长愿", "type": "time", "kindNameLanText": "限时渠道", "hidden": False,
     "startTime": 10, "endTime": 20, "characterShow": ["D0089"], "characterSkinShow": "002"},
    {"id": "1", "nameLanText": "", "type": "normal", "hidden": True, "startTime": 0, "endTime": 0},
]


class BuildBannerDataTest(unittest.TestCase):
    def test_only_timed_pools_newest_first(self):
        out = b.build_banners(POOLS, {"A0184001"}, Path("/nonexistent"))
        self.assertEqual([x["id"] for x in out], ["2114", "340001", "5003", "2017"])

    def test_banner_fields_and_up_skin_only_when_skin_exists(self):
        out = {x["id"]: x for x in b.build_banners(POOLS, {"A0184001"}, Path("/nonexistent"))}
        self.assertEqual(out["2114"], {"id": "2114", "name_cn": "万嶂烟峦", "name_vi": None, "type": "limited",
                                       "kind_cn": "限定渠道", "start": 200, "end": 900, "up": ["A0184"],
                                       "up_skin": "A0184001", "art": None})
        self.assertIsNone(out["340001"]["up_skin"])  # W0097009 is not in data.json
        self.assertEqual(out["5003"]["up"], [])

    def test_art_only_when_extracted_png_exists(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "PoolBg_2114.png").write_bytes(b"x")
            out = {x["id"]: x for x in b.build_banners(POOLS, set(), Path(tmp))}
        self.assertEqual(out["2114"]["art"], "banners/2114.webp")
        self.assertIsNone(out["5003"]["art"])

    def test_version_events_and_hero_follow_now(self):
        versions = [{"Version": "2018", "NameLanText": "3.3下版本热点活动总览", "StartTime": 0, "EndTime": 100},
                    {"Version": "2019", "NameLanText": "3.4上版本热点活动总览", "StartTime": 100, "EndTime": 1000}]
        v = b.pick_version(versions, 150)
        self.assertEqual(v, {"id": "2019", "label": "3.4上", "start": 100, "end": 1000})
        events = [{"ID": 1071, "Version": "2019", "NameLanText": "榑桑遗境", "DescLanText": "主题活动", "StartTime": 100, "EndTime": 900},
                  {"ID": 1000, "Version": "2018", "NameLanText": "old", "DescLanText": "x", "StartTime": 0, "EndTime": 50}]
        self.assertEqual(b.pick_events(events, v), [{"id": 1071, "name_cn": "榑桑遗境", "kind_cn": "主题活动", "start": 100, "end": 900}])
        logins = [{"KV": "KV3401", "NameLanText": "经以山海", "StartTime": "100", "EndTime": "1000"},
                  {"KV": "KVOB", "NameLanText": "", "StartTime": "1000", "EndTime": "5000"}]
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "KV3401.png").write_bytes(b"x")
            self.assertEqual(b.pick_hero(logins, 150, Path(tmp)),
                             {"kv": "KV3401", "name_cn": "经以山海", "art": "kv/KV3401.webp", "start": 100, "end": 1000})
        self.assertIsNone(b.pick_version(versions, 5000))
        self.assertIsNone(b.pick_hero(logins, 99, Path("/nonexistent")))

    def test_document_is_deterministic(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "cardPools.json").write_text(json.dumps(POOLS), encoding="utf-8")
            (root / "ActivityVersionMap.json").write_text("[]", encoding="utf-8")
            (root / "ActivityOverAllMap.json").write_text("[]", encoding="utf-8")
            (root / "LoginBackgroundMap.json").write_text("[]", encoding="utf-8")
            data = root / "data.json"
            data.write_text(json.dumps({"asset_base_url": "https://r2", "characters": {
                "A0184": {"skins": [{"skinID": "A0184001"}]}}}), encoding="utf-8")
            one = b.dumps(b.build_document(root, data, root, now=150, masterdata="abc"))
            two = b.dumps(b.build_document(root, data, root, now=150, masterdata="abc"))
        self.assertEqual(one, two)
        doc = json.loads(one)
        self.assertEqual(doc["asset_base_url"], "https://r2")
        self.assertEqual(doc["masterdata"], "abc")


if __name__ == "__main__":
    unittest.main()
