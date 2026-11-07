"""Upload the BGM export (mp3 + jukebox covers) to R2 under music/ (spec 2026-11-08 §6). --dry-run lists only."""
from __future__ import annotations

import argparse
import os
import tempfile
from pathlib import Path

from PIL import Image

from build_music_data import DEFAULT_BGM, track_id
from publish_assets import POLICY, REQUIRED_ENV, create_s3_client, load_dotenv_without_logging, sha256_file

ROOT = Path(__file__).resolve().parent.parent


def object_key(path: Path) -> str | None:
    if path.suffix.lower() == ".mp3":
        return f"music/bgm/{track_id(path.name)}.mp3"
    if path.suffix.lower() == ".png" and path.parent.name == "bia":
        return f"music/covers/{path.stem.lower()}.webp"
    return None


def _unchanged(client, bucket: str, key: str, source: str) -> bool:
    try:
        return client.head_object(Bucket=bucket, Key=key).get("Metadata", {}).get("source-sha256") == source
    except Exception as exc:  # 404 = new object; anything else is re-raised without endpoint detail
        if getattr(exc, "response", {}).get("Error", {}).get("Code") in {"404", "NoSuchKey", "NotFound"}:
            return False
        raise RuntimeError(f"Could not verify remote object {key}") from exc


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--bgm", type=Path, default=DEFAULT_BGM)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    files = sorted(p for p in [*args.bgm.glob("*.mp3"), *(args.bgm / "bia").glob("*.png")] if object_key(p))
    if not files:
        raise SystemExit(f"Không thấy mp3/bìa trong {args.bgm}")
    load_dotenv_without_logging(ROOT / ".env")
    client = bucket = None
    if not args.dry_run:
        missing = [n for n in REQUIRED_ENV if not os.environ.get(n)]
        if missing:
            raise RuntimeError("Missing required environment variable names: " + ", ".join(missing))
        client, bucket = create_s3_client(), os.environ["R2_BUCKET"]
    sent = skipped = size = 0
    with tempfile.TemporaryDirectory() as tmp:
        for f in files:
            key, source = object_key(f), sha256_file(f)
            if client and _unchanged(client, bucket, key, source):
                skipped += 1
                continue
            body, ctype = f, "audio/mpeg"
            if f.suffix.lower() == ".png":
                body, ctype = Path(tmp) / (f.stem + ".webp"), "image/webp"
                Image.open(f).save(body, "WEBP", quality=POLICY["quality"], method=POLICY["method"])
            size += body.stat().st_size
            if client:
                client.upload_file(str(body), bucket, key, ExtraArgs={
                    "ContentType": ctype, "CacheControl": "public, max-age=604800",
                    "Metadata": {"source-sha256": source, "policy-version": POLICY["version"]}})
            sent += 1
    verb = "would upload" if not client else "uploaded"
    print(f"{verb} {sent} objects ({size / 2**20:.0f} MB), unchanged {skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
