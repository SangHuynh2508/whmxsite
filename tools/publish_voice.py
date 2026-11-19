"""Upload character voice mp3 to R2 under voice/ (spec 2026-11-19-voice-tab-design.md §3).

--dry-run lists only; --stage DIR copies the files into DIR at their R2 keys (local test, serve DIR as asset_base_url).
Upload only with the owner's yes.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path

from build_voice_data import DEFAULT_AUDIO, line_key

ROOT = Path(__file__).resolve().parent.parent


def files(voice: dict, audio: Path) -> list[tuple[Path, str]]:
    """(local mp3, R2 key) for every exported line."""
    out = []
    for cid, c in sorted(voice["items"].items()):
        for L in c["langs"]:
            for line in L["lines"]:
                key = line_key(cid, L["lang"], line)
                if key:
                    out.append((audio / line["file"], key))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--audio", type=Path, default=DEFAULT_AUDIO)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--stage", type=Path, help="copy into this folder at the R2 keys instead of uploading")
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    voice = json.loads((args.audio / "voice_nhanvat.json").read_text(encoding="utf-8"))
    todo = files(voice, args.audio)
    missing = [str(f) for f, _ in todo if not f.is_file()]
    if missing:
        raise SystemExit(f"Thiếu {len(missing)} file mp3, ví dụ {missing[0]}")
    if args.dry_run or args.stage:
        if args.stage:
            for f, key in todo:
                (args.stage / key).parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(f, args.stage / key)
        size = sum(f.stat().st_size for f, _ in todo)
        print(f"{'staged' if args.stage else 'would upload'} {len(todo)} objects ({size / 2**20:.0f} MB)")
        return 0

    from publish_assets import POLICY, REQUIRED_ENV, create_s3_client, load_dotenv_without_logging, sha256_file
    from publish_music import _unchanged

    load_dotenv_without_logging(ROOT / ".env")
    missing_env = [n for n in REQUIRED_ENV if not os.environ.get(n)]
    if missing_env:
        raise RuntimeError("Missing required environment variable names: " + ", ".join(missing_env))
    client, bucket = create_s3_client(), os.environ["R2_BUCKET"]
    sent = skipped = size = 0
    for f, key in todo:
        source = sha256_file(f)
        if _unchanged(client, bucket, key, source):
            skipped += 1
            continue
        client.upload_file(str(f), bucket, key, ExtraArgs={
            "ContentType": "audio/mpeg", "CacheControl": "public, max-age=604800",
            "Metadata": {"source-sha256": source, "policy-version": POLICY["version"]}})
        sent += 1
        size += f.stat().st_size
    print(f"uploaded {sent} objects ({size / 2**20:.0f} MB), unchanged {skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
