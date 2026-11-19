import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import publish_voice as p

LINE = {"skin": "A0100001", "type": "regardsLine", "order": 2, "file": "NhanVat/A/audio/character_regardsline_a0100001.mp3"}
VOICE = {"version": "r3177", "items": {"A0100": {"id": "A0100", "langs": [
    {"lang": "1001", "lines": [LINE, {**LINE, "type": "dropLine", "file": None}]},
    {"lang": "1007", "lines": [{**LINE, "file": "NhanVat/A/audio_1007/character_regardsline_a0100001.mp3"}]}]}}}


class FilesTest(unittest.TestCase):
    def test_each_exported_line_once(self):
        got = p.files(VOICE, Path("audio"))
        self.assertEqual(got, [
            (Path("audio/NhanVat/A/audio/character_regardsline_a0100001.mp3"), "voice/a0100/1001/a0100001_regardsLine.mp3"),
            (Path("audio/NhanVat/A/audio_1007/character_regardsline_a0100001.mp3"), "voice/a0100/1007/a0100001_regardsLine.mp3"),
        ])

    def test_stage_and_dry_run_need_no_r2_env(self):
        with tempfile.TemporaryDirectory() as tmp:
            audio = Path(tmp, "audio")
            for f, _ in p.files(VOICE, audio):
                f.parent.mkdir(parents=True, exist_ok=True)
                f.write_bytes(b"ID3")
            (audio / "voice_nhanvat.json").write_text(json.dumps(VOICE), encoding="utf-8")
            stage = Path(tmp, "stage")
            tool = Path(p.__file__)
            for extra in (["--dry-run"], ["--stage", str(stage)]):
                r = subprocess.run([sys.executable, str(tool), "--audio", str(audio), *extra], capture_output=True,
                                   text=True, encoding="utf-8", env={"PATH": "", "SYSTEMROOT": os.environ.get("SYSTEMROOT", "")})
                self.assertEqual(r.returncode, 0, r.stderr)
            self.assertTrue((stage / "voice/a0100/1007/a0100001_regardsLine.mp3").is_file())


if __name__ == "__main__":
    unittest.main()
