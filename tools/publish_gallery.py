"""Thư viện ảnh images → R2 (spec 2026-11-17-gallery-page-design.md): gallery/<kind>/<id>/{t.webp,v.webp,o.png}.
--dry-run counts only; --stage DIR writes the same objects under DIR (local check, no network); no flag uploads
(owner approval first)."""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import tempfile
from pathlib import Path

from PIL import Image

from build_gallery_data import OUT as GALLERY_JSON, TOOL, _latest
from publish_assets import REQUIRED_ENV, create_s3_client, load_dotenv_without_logging, sha256_file
from publish_music import _unchanged

ROOT = Path(__file__).resolve().parent.parent
THUMB_W = 480
QUALITY = {"t": 85, "v": 90}  # v ≈ 90 (spec); the 480 px thumb needs less
CTYPE = {"t": "image/webp", "v": "image/webp", "o": "image/png"}
SAFE = re.compile(r"gallery/(story|loading|home|kv|postcard)/(?!\.)[A-Za-z0-9_.-]+")
CACHE = "public, max-age=604800"


def objects(item: dict) -> list[tuple[str, str]]:
    """(R2 key, variant) for one gallery.json item; refuses anything that is not gallery/<kind>/<id>."""
    if not SAFE.fullmatch(item["file"]):
        raise ValueError(f"unsafe R2 key: {item['file']!r}")
    return [(f"{item['file']}/{v}.{'png' if v == 'o' else 'webp'}", v) for v in ("t", "v", "o")]


def render(src: Path, variant: str, out: Path) -> Path:
    """o = the original png as is; v = same-size webp; t = 480 px wide webp."""
    if variant == "o":
        return src
    with Image.open(src) as im:
        im = im if im.mode in ("RGB", "RGBA") else im.convert("RGBA")
        if variant == "t" and im.width > THUMB_W:
            im = im.resize((THUMB_W, round(im.height * THUMB_W / im.width)), Image.Resampling.LANCZOS)
        im.save(out, "WEBP", quality=QUALITY[variant], method=4)
    return out


def extra_args(item: dict, variant: str, source: str) -> dict:
    a = {"ContentType": CTYPE[variant], "CacheControl": CACHE,
         "Metadata": {"source-sha256": source, "policy-version": f"gallery-{variant}-w{THUMB_W}-q{QUALITY.get(variant, 0)}"}}
    if variant == "o":  # <a download> is ignored across origins (R2 ≠ the site): the header makes "Tải ảnh" save the file
        a["ContentDisposition"] = f'attachment; filename="{item["kind"]}_{item["id"]}.png"'
    return a


def publish(items: list[dict], export: Path, *, client=None, bucket: str = "", stage: Path | None = None,
            force: bool = False) -> dict:
    """No client and no stage = dry run. ponytail: the skip compares the source png only; after changing THUMB_W or
    QUALITY run with --force."""
    n = {"sent": 0, "skipped": 0, "missing": [], "bytes": 0}
    with tempfile.TemporaryDirectory() as tmp:
        for item in items:
            src = export / item["kind"] / f"{item['id']}.png"
            if not src.is_file():
                n["missing"].append(f"{item['kind']}/{item['id']}")
                continue
            source = sha256_file(src)
            for key, v in objects(item):
                if client and not force and _unchanged(client, bucket, key, source):
                    n["skipped"] += 1
                    continue
                if client is None and stage is None:
                    n["sent"] += 1
                    continue
                body = render(src, v, Path(tmp) / f"{v}.webp")
                n["bytes"] += body.stat().st_size
                if stage is not None:
                    dest = stage / key
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(body, dest)
                else:
                    client.upload_file(str(body), bucket, key, ExtraArgs=extra_args(item, v, source))
                n["sent"] += 1
    return n


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--gallery", type=Path, default=GALLERY_JSON)
    ap.add_argument("--export", type=Path, default=_latest("Xuat/Gallery_r*") or TOOL / "Xuat" / "Gallery")
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="chỉ đếm, không ghi gì")
    mode.add_argument("--stage", type=Path, help="ghi object ra thư mục này thay vì R2 (thử cục bộ)")
    ap.add_argument("--force", action="store_true", help="đẩy lại cả object không đổi (sau khi đổi THUMB_W / QUALITY)")
    args = ap.parse_args()
    items = json.loads(args.gallery.read_text(encoding="utf-8"))["items"]
    client, bucket = None, ""
    if not args.dry_run and args.stage is None:
        load_dotenv_without_logging(ROOT / ".env")
        missing = [k for k in REQUIRED_ENV if not os.environ.get(k)]
        if missing:
            raise RuntimeError("Missing required environment variable names: " + ", ".join(missing))
        client, bucket = create_s3_client(), os.environ["R2_BUCKET"]
    n = publish(items, args.export, client=client, bucket=bucket, stage=args.stage, force=args.force)
    verb = "would upload" if args.dry_run else f"staged → {args.stage}" if args.stage else "uploaded"
    print(f"{verb}: {n['sent']} objects ({n['bytes'] / 2**20:.0f} MB), unchanged {n['skipped']}, missing png {len(n['missing'])}")
    for m in n["missing"][:20]:
        print("  thiếu", m)
    return 1 if n["missing"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
