"""Validate public serving and representative image decoding for published artwork."""

from __future__ import annotations

import argparse
import io
import json
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from PIL import Image

from asset_publish_manifest import load_manifest, manifest_path, public_url


PROJECT_ROOT = Path(__file__).resolve().parent.parent
REQUEST_HEADERS = {"User-Agent": "Mozilla/5.0"}


def check_head(base_url: str, key: str, entry: dict) -> tuple[str, str | None]:
    if key != key.lower() or entry.get("key") != key:
        return key, "non-canonical manifest key"
    url = public_url(base_url, key)
    try:
        with urlopen(Request(url, headers=REQUEST_HEADERS, method="HEAD"), timeout=30) as response:
            if response.status != 200:
                return key, f"HTTP {response.status}"
            if response.headers.get_content_type() != "image/webp":
                return key, f"Content-Type {response.headers.get_content_type()}"
    except HTTPError as exc:
        return key, f"HTTP {exc.code}"
    except URLError as exc:
        return key, f"network error: {exc.reason}"
    except Exception as exc:
        return key, f"unexpected {type(exc).__name__}: {exc}"
    return key, None


def decode_sample(base_url: str, key: str) -> dict:
    url = public_url(base_url, key)
    with urlopen(Request(url, headers=REQUEST_HEADERS), timeout=60) as response:
        if response.status != 200 or response.headers.get_content_type() != "image/webp":
            raise RuntimeError(f"{key}: HTTP {response.status}, {response.headers.get_content_type()}")
        content = response.read()
    with Image.open(io.BytesIO(content)) as image:
        image.load()
        if image.format != "WEBP" or image.width < 1 or image.height < 1:
            raise RuntimeError(f"{key}: invalid decoded image")
        return {"key": key, "url": url, "bytes": len(content), "dimensions": [image.width, image.height], "format": image.format}


def required_samples(assets: dict[str, dict]) -> list[str]:
    keys = sorted(assets)
    required = [
        "characters/a0001/cards/a0001001.webp",
        "characters/a0001/drawings/a0001001.webp",
        "characters/d0183/cards/d0183001.webp",
        "characters/d0183/drawings/d0183001.webp",
    ]
    missing = [key for key in required if key not in assets]
    if missing:
        raise RuntimeError("Required representative assets are missing: " + ", ".join(missing))
    by_character = Counter(entry.get("character_id", "") for entry in assets.values())
    multi_character = sorted(by_character, key=lambda cid: (-by_character[cid], cid))[0]
    for category in ("cards", "drawings"):
        key = next(key for key in keys if key.startswith(f"characters/{multi_character.lower()}/{category}/"))
        required.append(key)
    return required


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=4, help="Low-concurrency public endpoint checks.")
    parser.add_argument("--report", type=Path, help="Optional JSON report path for CI or long-running shells.")
    args = parser.parse_args()
    manifest = load_manifest(manifest_path(PROJECT_ROOT))
    assets = manifest["assets"]
    keys = sorted(assets)
    failures: list[dict[str, str]] = []
    with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 8))) as executor:
        futures = [executor.submit(check_head, manifest["public_base_url"], key, assets[key]) for key in keys]
        for future in as_completed(futures):
            key, error = future.result()
            if error:
                failures.append({"key": key, "error": error})

    samples: list[dict] = []
    if not failures:
        for key in required_samples(assets):
            samples.append(decode_sample(manifest["public_base_url"], key))
    report = {
        "manifest_assets": len(keys),
        "public_pass": len(keys) - len(failures),
        "public_fail": len(failures),
        "lowercase_manifest_keys": all(key == key.lower() and assets[key].get("key") == key for key in keys),
        "failures": sorted(failures, key=lambda item: item["key"]),
        "decoded_samples": samples,
    }
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.report:
        args.report.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
