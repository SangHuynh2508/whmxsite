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

    def test_story_groups_never_show_a_code(self):
        # a script missing from INDEX.tsv takes its event's name from a sibling, then from EVENT_CN, else "unknown"
        names = {"e022002": "人间千古", "e015001": "漫去访友", "e015": "漫去访友"}
        g = m.story_groups(["e022002", "e015009", "e009001", "e005001"], names)
        self.assertEqual([x["group_cn"] for x in g], ["人间千古", "漫去访友", "岁时迢迢", m.UNKNOWN_EVENT])

    def test_unused_event_track_is_named_after_its_event_never_its_file(self):
        t = m.build_track(track("FSMY.mp3"), {}, {"浮生觅源": "Phù Sinh Mịch Nguyên"})
        self.assertEqual((t["label_kind"], t["label_cn"], t["label_vi"]), ("", "浮生觅源", "Phù Sinh Mịch Nguyên"))
        doc = m.build_document({"tracks": [track("zz.mp3"), track("aa.mp3")]}, {}, {}, "")
        self.assertEqual([(x["id"], x["label_cn"], x["label_vi"]) for x in doc["tracks"]],
                         [("aa", "未命名曲目 1", "Bài chưa rõ tên 1"), ("zz", "未命名曲目 2", "Bài chưa rõ tên 2")])

    def test_group_names_map_each_event_code_to_its_named_scripts(self):
        rows = [{"SCRIPT_ID": "E015001", "GROUP_NAME_CN": "漫去访友"}, {"SCRIPT_ID": "e015002", "GROUP_NAME_CN": ""}]
        self.assertEqual(m.group_names(rows), {"e015001": "漫去访友", "e015002": "", "e015": "漫去访友"})

    def test_vi_map_fills_every_field(self):
        vi = {"甲": "Giáp", "来古": "Lai Cổ", "人间千古": "Nhân Gian Thiên Cổ", "春华如梦": "Xuân Hoa Như Mộng",
              "通过【人间千古】活动获取": "Nhận qua sự kiện 【Nhân Gian Thiên Cổ】"}
        t = m.build_track(track("a.mp3", jukebox=[JUKE], stories=["e022002"], stages=[{"id": "A", "name": "甲"}],
                                areas=[{"name": "来古"}]), {"e022002": "人间千古"}, vi)
        self.assertEqual((t["name_vi"], t["source_vi"], t["stories"][0]["group_vi"]),
                         ("Xuân Hoa Như Mộng", "Nhận qua sự kiện 【Nhân Gian Thiên Cổ】", "Nhân Gian Thiên Cổ"))
        self.assertEqual((t["stages"]["names_vi"], t["areas_vi"]), (["Giáp"], ["Lai Cổ"]))
        stage = m.build_track(track("b.mp3", stages=[{"id": "A", "name": "甲"}]), {}, vi)
        self.assertEqual((stage["label_cn"], stage["label_vi"]), ("甲", "Giáp"))

    def test_reviewed_character_name_wins_over_vi_map(self):
        raw = {"b001": "乳鸭图 — truyện của 莲塘乳鸭图 · Liên Đường Nhũ Áp Đồ [S0088]"}
        g = m.story_groups(["b001"], raw, {"S0088": "Nhũ Áp Đồ"}, {"乳鸭图": "Khác"})
        self.assertEqual(g[0]["group_vi"], "Nhũ Áp Đồ")

    def test_character_story_group_keeps_story_name_and_reviewed_vi_name(self):
        raw = {"b001": "乳鸭图 — truyện của 莲塘乳鸭图 · Liên Đường Nhũ Áp Đồ [S0088]", "b002": "蛙锣 — truyện của 蛙锣 · Oa La [V0023]"}
        g = m.story_groups(["b001", "b002"], raw, {"S0088": "Nhũ Áp Đồ"})  # V0023 has no reviewed name here
        self.assertEqual(g, [{"group_cn": "乳鸭图", "group_vi": "Nhũ Áp Đồ", "count": 1}, {"group_cn": "蛙锣", "group_vi": "", "count": 1}])

    def test_story_label_carries_vi_name(self):
        out = m.build_track(track("bgm_x.mp3", stories=["b001"]), {"b001": "乳鸭图 — truyện của 莲塘乳鸭图 · Liên Đường Nhũ Áp Đồ [S0088]"}, {}, {"S0088": "Nhũ Áp Đồ"})
        self.assertEqual((out["label_kind"], out["label_cn"], out["label_vi"]), ("story", "乳鸭图", "Nhũ Áp Đồ"))

    def test_stage_summary_dedupes_and_caps(self):
        st = [{"id": str(i), "name": n} for i, n in enumerate(["甲", "甲", "乙", "丙", "丁"])]
        self.assertEqual(m.stage_summary(st), {"names_cn": ["甲", "乙", "丙"], "names_vi": ["", "", ""], "count": 5})

    def test_named_track(self):
        out = m.build_track(track("novel_E2202.mp3", jukebox=[JUKE], stories=["e022002"]), {}, {"春华如梦": "Xuân Hoa Như Mộng"})
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
