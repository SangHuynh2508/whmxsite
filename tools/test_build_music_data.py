import unittest

import build_music_data as m

JUKE = {"id": "20106", "name": "春华如梦", "cover": "bia/ui_jj_yy_pic_cd_26.png",
        "source": "通过【人间千古】活动获取", "unlock_item": "71014", "default": False}


def track(file, jukebox=(), stories=(), stages=(), areas=()):
    return {"file": file, "jukebox": list(jukebox), "stories": list(stories), "stages": list(stages), "areas": list(areas)}


class BuildMusicTest(unittest.TestCase):
    def test_id_is_lowercase_stem(self):
        self.assertEqual(m.track_id("BGM_THST.mp3"), "bgm_thst")

    def test_groups_presence_and_priority(self):
        t = track("x.mp3", stories=["e022002"], stages=[{"id": "A", "name": "甲"}])
        self.assertEqual(m.groups_of(t), ["story", "stage"])
        self.assertEqual(m.groups_of(track("y.mp3")), ["other"])

    def test_story_groups_fall_back_to_code(self):
        g = m.story_groups(["e022002", "e022004", "e099001"], {"e022002": "人间千古", "e022004": "人间千古"})
        self.assertEqual(g, [{"group_cn": "人间千古", "group_vi": "", "count": 2}, {"group_cn": "e099", "group_vi": "", "count": 1}])

    def test_character_story_group_keeps_story_name_and_reviewed_vi_name(self):
        raw = {"b001": "乳鸭图 — truyện của 莲塘乳鸭图 · Liên Đường Nhũ Áp Đồ [S0088]", "b002": "蛙锣 — truyện của 蛙锣 · Oa La [V0023]"}
        g = m.story_groups(["b001", "b002"], raw, {"S0088": "Nhũ Áp Đồ"})  # V0023 has no reviewed name here
        self.assertEqual(g, [{"group_cn": "乳鸭图", "group_vi": "Nhũ Áp Đồ", "count": 1}, {"group_cn": "蛙锣", "group_vi": "", "count": 1}])

    def test_story_label_carries_vi_name(self):
        out = m.build_track(track("bgm_x.mp3", stories=["b001"]), {"b001": "乳鸭图 — truyện của 莲塘乳鸭图 · Liên Đường Nhũ Áp Đồ [S0088]"}, {}, {"S0088": "Nhũ Áp Đồ"})
        self.assertEqual((out["label_kind"], out["label_cn"], out["label_vi"]), ("story", "乳鸭图", "Nhũ Áp Đồ"))

    def test_stage_summary_dedupes_and_caps(self):
        st = [{"id": str(i), "name": n} for i, n in enumerate(["甲", "甲", "乙", "丙", "丁"])]
        self.assertEqual(m.stage_summary(st), {"names_cn": ["甲", "乙", "丙"], "count": 5})

    def test_named_track(self):
        out = m.build_track(track("novel_E2202.mp3", jukebox=[JUKE], stories=["e022002"]), {}, {"novel_e2202": "Xuân Hoa Như Mộng"})
        self.assertEqual(out["id"], "novel_e2202")
        self.assertEqual(out["file"], "music/bgm/novel_e2202.mp3")
        self.assertEqual(out["cover"], "music/covers/ui_jj_yy_pic_cd_26.webp")
        self.assertEqual((out["group"], out["name_cn"], out["name_vi"], out["label_kind"]), ("jukebox", "春华如梦", "Xuân Hoa Như Mộng", ""))
        self.assertEqual(out["source_cn"], JUKE["source"])

    def test_unnamed_track_gets_label_from_first_use(self):
        out = m.build_track(track("Bgm_Battle_M01_01.mp3", stages=[{"id": "A", "name": "远击的进阶：子"}]), {}, {})
        self.assertEqual((out["group"], out["label_kind"], out["label_cn"], out["cover"]), ("stage", "stage", "远击的进阶：子", None))
        other = m.build_track(track("gacha_bgm.mp3"), {}, {})
        self.assertEqual((other["group"], other["label_kind"], other["label_cn"]), ("other", "", ""))

    def test_placeholder_jukebox_is_ignored(self):
        out = m.build_track(track("foundationMusic_1.mp3", jukebox=[{**JUKE, "name": "预留位置"}]), {}, {})
        self.assertEqual((out["name_cn"], out["group"]), ("", "other"))

    def test_document_sorts_jukebox_first(self):
        doc = m.build_document({"version": "r1", "tracks": [track("b.mp3"), track("a.mp3", jukebox=[JUKE])]}, {}, {}, "https://x")
        self.assertEqual([t["id"] for t in doc["tracks"]], ["a", "b"])
        self.assertEqual((doc["version"], doc["asset_base_url"]), ("r1", "https://x"))


if __name__ == "__main__":
    unittest.main()
