# tools/apply_profile_overlay.py
"""Apply a {characterId: profile} overlay (JSON on stdin) to public/data.json.

Python does the write because it preserves key order exactly (Node reorders
integer-like keys such as items["3"]). The write is atomic: temp file + os.replace.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

DEFAULT = Path(__file__).resolve().parent.parent / "public" / "data.json"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--in", dest="src", default=str(DEFAULT))
    parser.add_argument("--out", dest="dst", default=str(DEFAULT))
    args = parser.parse_args()
    overlay = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    data = json.loads(Path(args.src).read_text(encoding="utf-8"))
    characters = data["characters"]
    unknown = sorted(set(overlay) - set(characters))
    if unknown:
        raise SystemExit(f"overlay has characters missing from data.json: {unknown}")
    for character_id, profile in overlay.items():
        characters[character_id]["profile"] = profile
    dst = Path(args.dst)
    tmp = dst.with_name(dst.name + ".overlay.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    os.replace(tmp, dst)
    print(f"applied {len(overlay)} profiles; {len(characters) - len(overlay)} characters kept their build profile", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
