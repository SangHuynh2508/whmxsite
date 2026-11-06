import tempfile
import unittest
from pathlib import Path

from build_web_data import archive_urls, card_urls

BASE = "https://example.r2.dev"


def manifest_for(*keys):
    return {"public_base_url": BASE, "assets": {k: {"key": k} for k in keys}}


class ArchiveUrlsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def make(self, cid, *names):
        folder = self.root / "characters" / cid / "archive"
        folder.mkdir(parents=True)
        for name in names:
            (folder / name).write_bytes(b"x")

    def test_both_files_published(self):
        self.make("A0024", "a0024.png", "head_a0024.png")
        manifest = manifest_for("characters/a0024/archives/a0024.webp", "characters/a0024/archives/head_a0024.webp")
        self.assertEqual(archive_urls(self.root, "A0024", manifest), {
            "image": f"{BASE}/characters/a0024/archives/a0024.webp",
            "head": f"{BASE}/characters/a0024/archives/head_a0024.webp",
        })

    def test_no_folder_or_one_file_missing_is_none(self):
        self.assertIsNone(archive_urls(self.root, "A0001", manifest_for()))
        self.make("A0003", "a0003.png")
        self.assertIsNone(archive_urls(self.root, "A0003", manifest_for("characters/a0003/archives/a0003.webp")))

    def test_local_file_without_manifest_entry_fails_loudly(self):
        self.make("A0024", "a0024.png", "head_a0024.png")
        with self.assertRaises(RuntimeError):
            archive_urls(self.root, "A0024", manifest_for())

    def test_published_without_local_files_still_resolves(self):
        manifest = manifest_for("characters/a0024/archives/a0024.webp", "characters/a0024/archives/head_a0024.webp")
        self.assertEqual(archive_urls(self.root, "A0024", manifest)["head"], f"{BASE}/characters/a0024/archives/head_a0024.webp")


class CardUrlsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_cards_come_from_manifest_sorted(self):
        manifest = manifest_for("characters/a0001/cards/a0001002.webp", "characters/a0001/cards/a0001001.webp",
                                "characters/a0001/drawings/a0001001.webp", "characters/a0010/cards/a0010001.webp")
        self.assertEqual(card_urls(self.root, "A0001", manifest), [
            f"{BASE}/characters/a0001/cards/a0001001.webp", f"{BASE}/characters/a0001/cards/a0001002.webp"])

    def test_local_card_without_manifest_entry_fails_loudly(self):
        folder = self.root / "characters" / "A0001" / "card"
        folder.mkdir(parents=True)
        (folder / "a0001001.png").write_bytes(b"x")
        with self.assertRaises(RuntimeError):
            card_urls(self.root, "A0001", manifest_for())


if __name__ == "__main__":
    unittest.main()
