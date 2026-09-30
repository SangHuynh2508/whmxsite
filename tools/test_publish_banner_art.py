import unittest

import publish_banner_art as p


class ObjectKeyTest(unittest.TestCase):
    def test_pool_background_and_kv_keys(self):
        self.assertEqual(p.object_key("PoolBg_2114.png"), "banners/2114.webp")
        self.assertEqual(p.object_key("PoolBg_340001.png"), "banners/340001.webp")
        self.assertEqual(p.object_key("KV3401.png"), "kv/KV3401.webp")

    def test_pool_title_logo_key(self):
        self.assertEqual(p.object_key("PoolIcon_2114.png"), "banners/title/2114.webp")

    def test_other_files_are_ignored(self):
        self.assertIsNone(p.object_key("PoolSmall_2114.png"))
        self.assertIsNone(p.object_key("notes.txt"))


if __name__ == "__main__":
    unittest.main()
