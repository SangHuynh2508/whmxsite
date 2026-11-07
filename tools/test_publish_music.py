import unittest
from pathlib import Path

import publish_music as p


class ObjectKeyTest(unittest.TestCase):
    def test_mp3_key_is_lowercase(self):
        self.assertEqual(p.object_key(Path("bgm/BGM_THST.mp3")), "music/bgm/bgm_thst.mp3")

    def test_cover_key(self):
        self.assertEqual(p.object_key(Path("bgm/bia/ui_jj_yy_pic_cd_01.png")), "music/covers/ui_jj_yy_pic_cd_01.webp")

    def test_other_files_ignored(self):
        self.assertIsNone(p.object_key(Path("bgm/bgm_index.json")))
        self.assertIsNone(p.object_key(Path("bgm/_xong_audio.txt")))


if __name__ == "__main__":
    unittest.main()
