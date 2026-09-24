# tools/test_apply_profile_overlay.py
import json
import subprocess
import sys
import tempfile
from pathlib import Path

TOOL = Path(__file__).with_name("apply_profile_overlay.py")


def run(data: dict, overlay: dict) -> str:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "data.json"
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        subprocess.run([sys.executable, str(TOOL), "--in", str(path), "--out", str(path)],
                       input=json.dumps(overlay, ensure_ascii=False).encode("utf-8"), check=True)
        return path.read_text(encoding="utf-8")


def test_same_profile_is_byte_identical_and_keeps_integer_key_order():
    data = {"characters": {"A0001": {"name": "x", "profile": {"record_id": "1"}, "z": 1}}, "items": {"3": 1, "1001": 2}}
    original = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    assert run(data, {"A0001": {"record_id": "1"}}) == original


def test_profile_is_replaced_in_place():
    data = {"characters": {"A0001": {"name": "x", "profile": {"record_id": "1"}, "z": 1}}}
    out = json.loads(run(data, {"A0001": {"record_id": "2", "eval_intro_vi": None}}))
    assert list(out["characters"]["A0001"]) == ["name", "profile", "z"]
    assert out["characters"]["A0001"]["profile"] == {"record_id": "2", "eval_intro_vi": None}


def test_unknown_character_fails():
    data = {"characters": {"A0001": {"profile": {}}}}
    try:
        run(data, {"Z9999": {}})
    except subprocess.CalledProcessError:
        return
    raise AssertionError("expected failure for unknown character")


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
    print("OK")
