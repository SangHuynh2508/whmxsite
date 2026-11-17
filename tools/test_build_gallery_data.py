import unittest

import build_gallery_data as b

VERS = [{"label": "2.5上", "start": 100, "end": 200}, {"label": "3.4上", "start": 300, "end": 400}]
STARTS = {"花朝昔时": 50, "镂忆琢名": 320}


def it(kind, id_, png=True, **kw):
    return {"kind": kind, "id": id_, "png": f"{kind}/{id_}.png" if png else None, "w": 1920, "h": 1080,
            "name_cn": "", "note_cn": "", "place_cn": "", **kw}


class StoryGroupTest(unittest.TestCase):
    def test_event_with_version(self):
        x = it("story", "cg_9", section="Events", category="e040", group_cn="镂忆琢名")
        self.assertEqual(b.story_group(x, STARTS, VERS), ("v3", "3.4上"))

    def test_event_before_versions_or_undated_is_old_by_event_name(self):
        self.assertEqual(b.story_group(it("story", "a", section="Events", category="e001", group_cn="花朝昔时"), STARTS, VERS), ("old", "花朝昔时"))
        self.assertEqual(b.story_group(it("story", "c", section="Events", category="e099", group_cn=""), STARTS, VERS), ("old", "未知活动"))

    def test_character_story_name_is_cleaned(self):
        raw = "上阳台帖 — truyện của 上阳台帖 · Thượng Dương Đài Thiếp [V0075]"
        x = it("story", "g", section="Other_Stories", category="c075", group_cn=raw)
        self.assertEqual(b.story_group(x, STARTS, VERS), ("other", "上阳台帖"))
        doc = b.build_document({"items": [x]}, {}, "", STARTS, VERS, {"V0075": "Thượng Dương Đài Thiếp"})
        self.assertEqual(doc["items"][0]["sub_vi"], "Thượng Dương Đài Thiếp")

    def test_unnamed_event_uses_event_cn(self):
        x = it("story", "d", section="Events", category="e035", group_cn="")
        self.assertEqual(b.story_group(x, {"釉生净土": 150}, VERS), ("v2", "2.5上"))

    def test_main_story_by_chapter(self):
        x = it("story", "e", section="Main_Story", category="m001", group_cn="来古 (原洛阳)")
        self.assertEqual(b.story_group(x, STARTS, VERS), ("main", "来古"))

    def test_other(self):
        self.assertEqual(b.story_group(it("story", "f", section="Side_Stories_B", category="b001", group_cn="火车之上"), STARTS, VERS), ("other", "火车之上"))


class DocumentTest(unittest.TestCase):
    def setUp(self):
        idx = {"version": "r3173", "items": [
            it("loading", "CG1", name_cn="一尊江月", note_cn="活动获取"),
            it("loading", "CG2", png=False, name_cn="缺图"),
            it("story", "hotelyard_bg", section="Main_Story", category="m001", group_cn="来古 (原洛阳)"),
            it("loading", "hotelyard_bg", name_cn="酒店"),
        ]}
        self.doc = b.build_document(idx, {"一尊江月": "Một Chén Giang Nguyệt", "来古": "Lai Cổ"}, "https://cdn", {}, [])
        self.by = {(i["kind"], i["id"]): i for i in self.doc["items"]}

    def test_missing_png_dropped_and_same_id_different_kind_kept(self):
        self.assertNotIn(("loading", "CG2"), self.by)
        self.assertIn(("story", "hotelyard_bg"), self.by)
        self.assertIn(("loading", "hotelyard_bg"), self.by)

    def test_fields_and_translation(self):
        x = self.by[("loading", "CG1")]
        self.assertEqual(x["file"], "gallery/loading/CG1")
        self.assertEqual((x["name_vi"], x["note_vi"], x["w"], x["h"]), ("Một Chén Giang Nguyệt", "", 1920, 1080))
        self.assertEqual(self.doc["asset_base_url"], "https://cdn")
        self.assertEqual(self.by[("story", "hotelyard_bg")]["sub_vi"], "Lai Cổ")

    def test_placeholder_name_dropped_and_version_labels_not_translated(self):
        idx = {"items": [it("loading", "CG61006", name_cn="名字测试6"), it("kv", "2502", name_cn="2.5下"),
                         it("story", "s", section="Events", category="e040", group_cn="镂忆琢名")]}
        doc = b.build_document(idx, {}, "", STARTS, VERS)
        self.assertEqual(doc["items"][0]["name_cn"], "")
        self.assertEqual(doc["items"][1]["name_cn"], "2.5下")
        self.assertEqual(b.untranslated(doc), ["镂忆琢名"])  # the version label is not asked for; the story name is

    def test_untranslated_and_strings(self):
        self.assertIn("活动获取", b.untranslated(self.doc))
        full = b.build_document(b.with_all({"items": [it("loading", "CG2", png=False, name_cn="缺图")]}), {}, "", {}, [])
        self.assertEqual(b.untranslated(full), ["缺图"])


class StoryNameTest(unittest.TestCase):
    def test_story_name_per_section(self):
        self.assertEqual(b.story_name(it("story", "a", section="Events", category="e040", group_cn="镂忆琢名")), "镂忆琢名")
        self.assertEqual(b.story_name(it("story", "d", section="Events", category="e035", group_cn="")), "釉生净土")  # EVENT_CN
        self.assertEqual(b.story_name(it("story", "x", section="Events", category="e099", group_cn="")), "")  # lore names none: none invented
        self.assertEqual(b.story_name(it("story", "c", section="Main_Story", category="m001", group_cn="来古 (原洛阳)")), "来古")
        raw = "上阳台帖 — truyện của 上阳台帖 · Thượng Dương Đài Thiếp [V0075]"
        self.assertEqual(b.story_name(it("story", "g", section="Other_Stories", category="c075", group_cn=raw)), "上阳台帖")

    def test_document_carries_story_and_its_translation(self):
        idx = {"items": [it("story", "s", section="Events", category="e040", group_cn="镂忆琢名"),
                         it("story", "t", section="Events", category="e041", group_cn="协韵行歌"),
                         it("loading", "L", name_cn="静谧小院")]}
        doc = b.build_document(idx, {"镂忆琢名": "Lũ Ức Trác Danh", "静谧小院": "Tĩnh Mịch Tiểu Viện"}, "", STARTS, VERS)
        s_, t_, l_ = doc["items"]
        self.assertEqual((s_["group"], s_["sub_cn"], s_["story_cn"], s_["story_vi"]), ("v3", "3.4上", "镂忆琢名", "Lũ Ức Trác Danh"))
        self.assertEqual((l_["story_cn"], l_["story_vi"]), ("", ""))
        self.assertIn("协韵行歌", b.untranslated(doc))


class VariantsTest(unittest.TestCase):
    def test_groups_keep_present_ids_in_order_and_drop_singletons(self):
        items = [{"kind": "story", "id": i} for i in ("a", "b", "c")] + [{"kind": "loading", "id": "a"}]
        got = b.variant_groups([["story", ["b", "a", "gone"]], ["story", ["c", "gone2"]], ["loading", ["a", "zz"]]], items)
        self.assertEqual(got, [["story", ["b", "a"]]])

    def test_an_image_in_two_groups_stops_the_build(self):
        items = [{"kind": "story", "id": i} for i in ("a", "b", "c")]
        with self.assertRaises(SystemExit):
            b.variant_groups([["story", ["a", "b"]], ["story", ["c", "a"]]], items)

    def test_document_carries_variants(self):
        idx = {"items": [it("story", "a", section="Other", group_cn="x"), it("story", "b", section="Other", group_cn="x")]}
        self.assertEqual(b.build_document(idx, {}, "", {}, [], variants=[["story", ["a", "b"]]])["variants"], [["story", ["a", "b"]]])
        self.assertEqual(b.build_document(idx, {}, "", {}, [])["variants"], [])


if __name__ == "__main__":
    unittest.main()
