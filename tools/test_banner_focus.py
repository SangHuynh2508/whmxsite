import unittest

import banner_focus as f


class PickFaceTest(unittest.TestCase):
    def test_biggest_face_in_the_top_part_normalised(self):
        faces = [(100, 100, 50, 50), (300, 200, 100, 100), (0, 900, 300, 300)]  # last: too low (held object)
        self.assertEqual(f.pick_face(faces, 1000, 1000), {"x": 0.35, "y": 0.25, "h": 0.1})

    def test_no_face(self):
        self.assertIsNone(f.pick_face([], 10, 10))
        self.assertIsNone(f.pick_face([(0, 900, 10, 10)], 1000, 1000))


if __name__ == "__main__":
    unittest.main()
