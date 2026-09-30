"""Banner key art (PoolBg_<id>) and the current hero KV → NeoArtifacts/Assets/banners → WebP → R2.

  python tools/publish_banner_art.py --extract-only   # bundles of the authoritative snapshot → raw PNGs (no network)
  python tools/publish_banner_art.py --dry-run        # + optimize, list the R2 objects that would be uploaded
  python tools/publish_banner_art.py                  # ⚠️ upload (owner yes)
Bundles are picked by FileMD5 (MD5Name is stable across versions, so the first cache hit can be an old copy).
"""
from __future__ import annotations

import argparse
import glob
import hashlib
import json
import os
import re
import sys
import tempfile
import time
from pathlib import Path

from PIL import Image

from publish_assets import POLICY, REQUIRED_ENV, create_s3_client, load_dotenv_without_logging, sha256_file

ROOT = Path(__file__).resolve().parent.parent
NEO = ROOT.parent / "NeoArtifacts"
ART_DIR = NEO / "Assets" / "banners"


def object_key(png_name: str) -> str | None:
    if m := re.fullmatch(r"PoolBg_(\d+)\.png", png_name):
        return f"banners/{m.group(1)}.webp"
    if m := re.fullmatch(r"(KV[0-9A-Za-z]+)\.png", png_name):
        return f"kv/{m.group(1)}.webp"
    return None


def _load_bundle(N, idx: dict, name: str):
    import UnityPy
    entry = idx[name]
    for hit in sorted(glob.glob(str(NEO / "Assets" / "runtime_bundle_cache" / "*" / "bundles" / entry["MD5Name"])), reverse=True):
        raw = Path(hit).read_bytes()
        if hashlib.md5(raw).hexdigest() == entry["FileMD5"]:
            data, _ = N.decrypt_unityfs_ab(raw, name)
            return UnityPy.load(data)
    raise RuntimeError(f"{name}: no cached copy with the snapshot's FileMD5 — pull it first (runtime-update)")


def extract() -> list[Path]:
    sys.path.insert(0, str(NEO))
    sys.argv = sys.argv[:1]
    import NeoArtifacts as N
    import UnityPy
    UnityPy.config.FALLBACK_UNITY_VERSION = N.UNITY_VERSION
    pointer = json.loads((NEO / "Assets" / "runtime_snapshots" / "current_authoritative_snapshot.json").read_text(encoding="utf-8"))
    idx = {e["Name"]: e for e in N.load_build_ab_json(NEO / "Assets" / "runtime_snapshots" / pointer["snapshot_id"] / "data.dat")["ABList"]}
    master = NEO / "MasterData" / "json"
    logins = json.loads((master / "LoginBackgroundMap.json").read_text(encoding="utf-8"))
    now = int(time.time())  # only the hero KV active now (older ui_kv bundles are usually not in the local cache)
    kvs = {r["KV"] for r in (logins if isinstance(logins, list) else logins.values())
           if r.get("KV") and int(r["StartTime"]) <= now < int(r["EndTime"])}
    wanted = {"images_cardpool.ab": lambda n: n.startswith("PoolBg_")}
    for kv in kvs:
        if f"ui_{kv.lower()}.ab" in idx:
            wanted[f"ui_{kv.lower()}.ab"] = lambda n, kv=kv: n == kv
    ART_DIR.mkdir(parents=True, exist_ok=True)
    written = []
    for bundle, keep in wanted.items():
        for obj in _load_bundle(N, idx, bundle).objects:
            if obj.type.name != "Texture2D":
                continue
            tex = obj.read()
            dst = ART_DIR / f"{tex.m_Name}.png"
            if keep(tex.m_Name) and not dst.exists():
                tex.image.save(dst)
                written.append(dst)
    return written


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--extract-only", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    new = extract()
    print(f"extracted {len(new)} new PNGs into {ART_DIR}")
    if args.extract_only:
        return 0
    load_dotenv_without_logging(ROOT / ".env")
    client = bucket = None
    if not args.dry_run:
        missing = [n for n in REQUIRED_ENV if not os.environ.get(n)]
        if missing:
            raise RuntimeError("Missing required environment variable names: " + ", ".join(missing))
        client, bucket = create_s3_client(), os.environ["R2_BUCKET"]
    uploaded = skipped = 0
    with tempfile.TemporaryDirectory() as tmp:
        for png in sorted(ART_DIR.glob("*.png")):
            key = object_key(png.name)
            if not key:
                continue
            source = sha256_file(png)
            if client:
                try:
                    head = client.head_object(Bucket=bucket, Key=key)
                    if head.get("Metadata", {}).get("source-sha256") == source:
                        skipped += 1
                        continue
                except Exception as exc:  # 404 = new object; anything else is re-raised without endpoint detail
                    if getattr(exc, "response", {}).get("Error", {}).get("Code") not in {"404", "NoSuchKey", "NotFound"}:
                        raise RuntimeError(f"Could not verify remote object {key}") from exc
            webp = Path(tmp) / (png.stem + ".webp")
            Image.open(png).save(webp, "WEBP", quality=POLICY["quality"], method=POLICY["method"])
            if client:
                client.upload_file(str(webp), bucket, key, ExtraArgs={"ContentType": "image/webp", "Metadata": {
                    "source-sha256": source, "policy-version": POLICY["version"]}})
            uploaded += 1
            print(("would upload " if not client else "uploaded ") + key)
    print(f"{'planned' if not client else 'uploaded'} {uploaded}, unchanged {skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
