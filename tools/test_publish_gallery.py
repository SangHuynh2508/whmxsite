import tempfile
import unittest
from pathlib import Path

from PIL import Image

import publish_gallery as p

ITEM = {"id": "cg_1_20", "kind": "story", "file": "gallery/story/cg_1_20"}


def png(folder: Path, kind: str, id_: str, size=(1680, 720)) -> Path:
    (folder / kind).mkdir(parents=True, exist_ok=True)
    f = folder / kind / f"{id_}.png"
    Image.new("RGB", size, (200, 10, 10)).save(f)
    return f


class ObjectsTest(unittest.TestCase):
    def test_three_keys_per_image(self):
        self.assertEqual(p.objects(ITEM), [("gallery/story/cg_1_20/t.webp", "t"), ("gallery/story/cg_1_20/v.webp", "v"),
                                           ("gallery/story/cg_1_20/o.png", "o")])
        self.assertEqual(p.objects({"id": "18.2", "kind": "kv", "file": "gallery/kv/18.2"})[0][0], "gallery/kv/18.2/t.webp")

    def test_unsafe_keys_are_refused(self):
        for bad in ("gallery/story/..", "gallery/story/../x", "music/bgm/x", "gallery/other/x", "gallery/story/a b"):
            with self.assertRaises(ValueError, msg=bad):
                p.objects({**ITEM, "file": bad})


class RenderTest(unittest.TestCase):
    def test_thumb_480_wide_view_full_size_original_as_is(self):
        with tempfile.TemporaryDirectory() as d:
            src = png(Path(d), "story", "a")
            with Image.open(p.render(src, "t", Path(d) / "t.webp")) as im:
                self.assertEqual((im.size, im.format), ((480, 206), "WEBP"))
            with Image.open(p.render(src, "v", Path(d) / "v.webp")) as im:
                self.assertEqual((im.size, im.format), ((1680, 720), "WEBP"))
            self.assertEqual(p.render(src, "o", Path(d) / "o"), src)


class ArgsTest(unittest.TestCase):
    def test_original_downloads_as_attachment(self):
        a = p.extra_args({"kind": "kv", "id": "2301"}, "o", "abc")
        self.assertEqual(a["ContentDisposition"], 'attachment; filename="kv_2301.png"')
        self.assertEqual((a["ContentType"], a["Metadata"]["source-sha256"]), ("image/png", "abc"))
        t = p.extra_args({"kind": "kv", "id": "2301"}, "t", "abc")
        self.assertNotIn("ContentDisposition", t)
        self.assertEqual(t["ContentType"], "image/webp")


class FakeClient:
    def __init__(self, sha):
        self.sha, self.sent = sha, []

    def head_object(self, Bucket, Key):
        return {"Metadata": {"source-sha256": self.sha}}

    def upload_file(self, f, bucket, key, ExtraArgs):
        self.sent.append((key, ExtraArgs["ContentType"]))


class PublishTest(unittest.TestCase):
    def test_stage_writes_the_r2_layout_and_lists_missing_png(self):
        with tempfile.TemporaryDirectory() as d:
            png(Path(d) / "exp", "story", "cg_1_20")
            stage = Path(d) / "stage"
            n = p.publish([ITEM, {"id": "gone", "kind": "story", "file": "gallery/story/gone"}], Path(d) / "exp", stage=stage)
            self.assertEqual((n["sent"], n["missing"]), (3, ["story/gone"]))
            for f in ("t.webp", "v.webp", "o.png"):
                self.assertTrue((stage / "gallery/story/cg_1_20" / f).is_file(), f)

    def test_dry_run_writes_nothing(self):
        with tempfile.TemporaryDirectory() as d:
            png(Path(d) / "exp", "story", "cg_1_20")
            n = p.publish([ITEM], Path(d) / "exp")
            self.assertEqual((n["sent"], n["bytes"]), (3, 0))

    def test_unchanged_source_is_skipped_unless_forced(self):
        with tempfile.TemporaryDirectory() as d:
            src = png(Path(d) / "exp", "story", "cg_1_20")
            same = FakeClient(p.sha256_file(src))
            self.assertEqual(p.publish([ITEM], Path(d) / "exp", client=same, bucket="b")["skipped"], 3)
            self.assertEqual(same.sent, [])
            p.publish([ITEM], Path(d) / "exp", client=same, bucket="b", force=True)
            self.assertEqual([k for k, _ in same.sent], [k for k, _ in p.objects(ITEM)])


if __name__ == "__main__":
    unittest.main()
