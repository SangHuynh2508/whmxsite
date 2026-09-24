"""Publish optimized character cards and drawings to any S3-compatible store.

This tool reads raw NeoArtifacts PNGs but never changes them.  It is deliberately
separate from the web build: publishing is explicit and a normal build remains
offline and deterministic from asset-publish-manifest.json.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import nullcontext
from pathlib import Path
from typing import Any

from PIL import Image

from asset_publish_manifest import (
    MANIFEST_SCHEMA_VERSION,
    REMOTE_CATEGORIES,
    manifest_path,
    normalize_public_base_url,
    object_key,
)


PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_CHARACTERS_ROOT = PROJECT_ROOT.parent / "NeoArtifacts" / "Assets" / "characters"
STAGING_PARENT = PROJECT_ROOT / ".asset-publish-tmp"
POLICY = {
    "format": "webp",
    "quality": 88,
    "method": 4,
    "preserve_dimensions": True,
    "preserve_alpha": True,
    "version": "webp-q88-m4-original-dimensions-v1",
}
REQUIRED_ENV = ("R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT", "R2_BUCKET", "R2_PUBLIC_BASE_URL")


def load_dotenv_without_logging(path: Path) -> None:
    """Load simple .env assignments without a dependency or secret-bearing output."""
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if not key or key in os.environ:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        os.environ[key] = value


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_complete_character_ids() -> list[str]:
    ids: list[str] = []
    for character_dir in sorted(RAW_CHARACTERS_ROOT.iterdir(), key=lambda item: item.name):
        if not character_dir.is_dir():
            continue
        try:
            status = json.loads((character_dir / "manifest.json").read_text(encoding="utf-8")).get("character_status")
        except (FileNotFoundError, json.JSONDecodeError):
            continue
        if str(status).upper() == "COMPLETE":
            ids.append(character_dir.name)
    return ids


def discover_assets() -> list[dict[str, Any]]:
    assets: list[dict[str, Any]] = []
    for character_id in read_complete_character_ids():
        character_dir = RAW_CHARACTERS_ROOT / character_id
        for category in REMOTE_CATEGORIES:
            for source in sorted((character_dir / category).glob("*.png"), key=lambda item: item.name):
                assets.append({
                    "character_id": character_id,
                    "category": category,
                    "source": source,
                    "key": object_key(character_id, category, source.name),
                    "source_sha256": sha256_file(source),
                    "source_bytes": source.stat().st_size,
                })
    return assets


def optimize_asset(asset: dict[str, Any], staging_dir: Path) -> dict[str, Any]:
    source = asset["source"]
    destination = staging_dir / f"{hashlib.sha256(asset['key'].encode()).hexdigest()}.webp"
    with Image.open(source) as image:
        original_size = image.size
        prepared = image.convert("RGBA") if image.mode in ("RGBA", "LA") or "transparency" in image.info else image.convert("RGB")
        prepared.save(destination, "WEBP", quality=POLICY["quality"], method=POLICY["method"], exact=True)
    with Image.open(destination) as check:
        if check.size != original_size:
            raise RuntimeError(f"Dimension mismatch for {source.name}: {original_size} != {check.size}")
    return {
        **asset,
        "optimized_path": destination,
        "optimized_bytes": destination.stat().st_size,
        "optimized_sha256": sha256_file(destination),
        "width": original_size[0],
        "height": original_size[1],
    }


def load_existing_manifest() -> dict[str, Any]:
    path = manifest_path(PROJECT_ROOT)
    if not path.exists():
        return {"assets": {}}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data.get("assets"), dict) else {"assets": {}}
    except json.JSONDecodeError:
        raise RuntimeError(f"Existing publish manifest is invalid JSON: {path}")


def manifest_entry(asset: dict[str, Any]) -> dict[str, Any]:
    return {
        "key": asset["key"],
        "character_id": asset["character_id"],
        "category": asset["category"],
        "source_filename": asset["source"].name,
        "source_sha256": asset["source_sha256"],
        "optimized_sha256": asset["optimized_sha256"],
        "source_bytes": asset["source_bytes"],
        "optimized_bytes": asset["optimized_bytes"],
        "width": asset["width"],
        "height": asset["height"],
        "content_type": "image/webp",
        "policy_version": POLICY["version"],
    }


def create_s3_client() -> Any:
    try:
        import boto3
        from botocore.config import Config
    except ModuleNotFoundError as exc:
        raise RuntimeError("boto3 is required for upload; install it with: python -m pip install boto3") from exc
    return boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=Config(connect_timeout=15, read_timeout=60, retries={"max_attempts": 2, "mode": "standard"}),
    )


def remote_matches(client: Any, bucket: str, asset: dict[str, Any]) -> bool:
    try:
        response = client.head_object(Bucket=bucket, Key=asset["key"])
    except Exception as exc:  # ClientError is intentionally not echoed: it can include endpoint detail.
        code = getattr(exc, "response", {}).get("Error", {}).get("Code")
        if code in {"404", "NoSuchKey", "NotFound"}:
            return False
        raise RuntimeError(f"Could not verify remote object {asset['key']}") from exc
    metadata = response.get("Metadata", {})
    return (
        metadata.get("source-sha256") == asset["source_sha256"]
        and metadata.get("optimized-sha256") == asset["optimized_sha256"]
        and metadata.get("policy-version") == POLICY["version"]
    )


def write_manifest(public_base_url: str, entries: dict[str, dict[str, Any]]) -> None:
    payload = {
        "schema_version": MANIFEST_SCHEMA_VERSION,
        "public_base_url": normalize_public_base_url(public_base_url),
        "optimization_policy": POLICY,
        "assets": {key: entries[key] for key in sorted(entries)},
    }
    path = manifest_path(PROJECT_ROOT)
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def connection_check(client: Any, bucket: str) -> None:
    key = "_whmx_publish_healthcheck/temporary.txt"
    try:
        client.put_object(Bucket=bucket, Key=key, Body=b"ok", ContentType="text/plain")
        client.head_object(Bucket=bucket, Key=key)
    except Exception as exc:
        raise RuntimeError("S3-compatible connectivity check failed") from exc
    finally:
        try:
            client.delete_object(Bucket=bucket, Key=key)
        except Exception as exc:
            raise RuntimeError("Connectivity test object could not be cleaned up") from exc


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Optimize and report without contacting object storage or writing a manifest.")
    parser.add_argument("--check-connection", action="store_true", help="Create, verify, then delete a tiny temporary remote object.")
    parser.add_argument("--check-connection-only", action="store_true", help="Run only the temporary remote connectivity check, then exit.")
    parser.add_argument("--workers", type=int, default=max(1, min(8, os.cpu_count() or 1)))
    args = parser.parse_args()

    load_dotenv_without_logging(PROJECT_ROOT / ".env")
    if not args.dry_run:
        missing = [name for name in REQUIRED_ENV if not os.environ.get(name)]
        if missing:
            raise RuntimeError("Missing required environment variable names: " + ", ".join(missing))
        public_base_url = normalize_public_base_url(os.environ["R2_PUBLIC_BASE_URL"])
        if args.check_connection_only:
            client = create_s3_client()
            connection_check(client, os.environ["R2_BUCKET"])
            print("Remote connectivity check passed; temporary object was removed.")
            return 0
    else:
        public_base_url = ""

    existing = load_existing_manifest()
    existing_assets = existing.get("assets", {})
    discovered = discover_assets()
    if not discovered:
        raise RuntimeError("No COMPLETE character card/drawing assets were found in NeoArtifacts")

    unchanged, needs_optimization = [], []
    for asset in discovered:
        old = existing_assets.get(asset["key"], {})
        if old.get("source_sha256") == asset["source_sha256"] and old.get("policy_version") == POLICY["version"]:
            unchanged.append(asset)
        else:
            needs_optimization.append(asset)

    client = None
    bucket = ""
    if not args.dry_run:
        client = create_s3_client()
        bucket = os.environ["R2_BUCKET"]
        if args.check_connection:
            connection_check(client, bucket)
            print("Remote connectivity check passed; temporary object was removed.")
        verified_unchanged = []
        for asset in unchanged:
            old = existing_assets[asset["key"]]
            candidate = {**asset, **{
                "optimized_sha256": old["optimized_sha256"],
                "optimized_bytes": old["optimized_bytes"],
                "width": old["width"], "height": old["height"],
            }}
            if remote_matches(client, bucket, candidate):
                verified_unchanged.append(asset)
            else:
                needs_optimization.append(asset)
        unchanged = verified_unchanged

    optimized: list[dict[str, Any]] = []
    failures: list[str] = []
    staging_context = nullcontext(None)
    if needs_optimization:
        STAGING_PARENT.mkdir(exist_ok=True)
        staging_context = tempfile.TemporaryDirectory(prefix="run-", dir=STAGING_PARENT, ignore_cleanup_errors=True)
    with staging_context as temp:
        if temp is not None:
            staging_dir = Path(temp)
            with ThreadPoolExecutor(max_workers=args.workers) as executor:
                futures = [executor.submit(optimize_asset, asset, staging_dir) for asset in needs_optimization]
                for future in as_completed(futures):
                    try:
                        optimized.append(future.result())
                    except Exception as exc:
                        failures.append(str(exc))
        if failures:
            for failure in failures:
                print(f"FAILED optimization: {failure}", file=sys.stderr)
            return 1

        source_bytes = sum(asset["source_bytes"] for asset in discovered)
        known_optimized = sum(int(existing_assets[asset["key"]].get("optimized_bytes", 0)) for asset in unchanged)
        optimized_bytes = known_optimized + sum(asset["optimized_bytes"] for asset in optimized)
        print(json.dumps({
            "complete_characters": len(read_complete_character_ids()),
            "assets": len(discovered),
            "unchanged_candidates": len(unchanged),
            "needs_optimization": len(needs_optimization),
            "source_bytes": source_bytes,
            "estimated_optimized_bytes": optimized_bytes,
            "policy": POLICY,
        }, ensure_ascii=False, indent=2))
        if args.dry_run:
            return 0

        entries: dict[str, dict[str, Any]] = {}
        uploaded = skipped = 0
        optimized_by_key = {asset["key"]: asset for asset in optimized}
        for asset in discovered:
            candidate = optimized_by_key.get(asset["key"])
            if candidate is None:
                old = existing_assets[asset["key"]]
                candidate = {**asset, **{
                    "optimized_sha256": old["optimized_sha256"], "optimized_bytes": old["optimized_bytes"],
                    "width": old["width"], "height": old["height"],
                }}
            try:
                if remote_matches(client, bucket, candidate):
                    skipped += 1
                else:
                    client.upload_file(
                        str(candidate["optimized_path"]) if "optimized_path" in candidate else str(optimized_by_key[asset["key"]]["optimized_path"]),
                        bucket,
                        candidate["key"],
                        ExtraArgs={"ContentType": "image/webp", "Metadata": {
                            "source-sha256": candidate["source_sha256"],
                            "optimized-sha256": candidate["optimized_sha256"],
                            "policy-version": POLICY["version"],
                        }},
                    )
                    uploaded += 1
                entries[candidate["key"]] = manifest_entry(candidate)
            except Exception as exc:
                failures.append(f"{candidate['key']}: {exc}")

        if failures:
            for failure in failures:
                print(f"FAILED upload: {failure}", file=sys.stderr)
            return 1
        write_manifest(public_base_url, entries)
        print(json.dumps({"uploaded": uploaded, "skipped": skipped, "failed": 0, "manifest": str(manifest_path(PROJECT_ROOT))}, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
