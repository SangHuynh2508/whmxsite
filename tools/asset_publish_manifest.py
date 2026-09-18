"""Storage-neutral contract for remotely published character artwork.

The manifest deliberately stores logical object keys plus a public base URL.  The
web data builder resolves the two; no frontend code needs to know which object
storage provider owns the files.
"""

from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urljoin


MANIFEST_FILENAME = "asset-publish-manifest.json"
MANIFEST_SCHEMA_VERSION = 1
REMOTE_CATEGORIES = {"card": "cards", "drawing": "drawings"}


def manifest_path(project_root: Path) -> Path:
    return project_root / MANIFEST_FILENAME


def object_key(character_id: str, category: str, source_filename: str) -> str:
    """Return the deterministic, provider-independent key for an optimized file."""
    if category not in REMOTE_CATEGORIES:
        raise ValueError(f"Unsupported remote asset category: {category}")
    # Object stores are case-sensitive even though the local development volume
    # often is not.  Lowercase the full generated key at this single boundary.
    stem = Path(source_filename).stem.lower()
    return f"characters/{character_id.lower()}/{REMOTE_CATEGORIES[category]}/{stem}.webp"


def normalize_public_base_url(value: str) -> str:
    value = str(value or "").strip()
    if not value.startswith(("https://", "http://")):
        raise ValueError("asset public base URL must be an absolute http(s) URL")
    return value.rstrip("/")


def public_url(public_base_url: str, key: str) -> str:
    """Resolve a logical key without corrupting an already absolute URL."""
    key = str(key or "").strip()
    if key.startswith(("https://", "http://")):
        return key
    return urljoin(normalize_public_base_url(public_base_url) + "/", key.lstrip("/"))


def load_manifest(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise RuntimeError(
            f"Remote asset manifest is missing: {path}. Run tools/publish_assets.py first."
        ) from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Remote asset manifest is invalid JSON: {path}") from exc

    if data.get("schema_version") != MANIFEST_SCHEMA_VERSION:
        raise RuntimeError(f"Unsupported remote asset manifest schema in {path}")
    data["public_base_url"] = normalize_public_base_url(data.get("public_base_url", ""))
    if not isinstance(data.get("assets"), dict):
        raise RuntimeError(f"Remote asset manifest has no asset mapping: {path}")
    for key, entry in data["assets"].items():
        if key != key.lower() or not isinstance(entry, dict) or entry.get("key") != key:
            raise RuntimeError(f"Remote asset manifest contains a non-canonical object key: {key}")
    return data


def require_asset_url(manifest: dict, character_id: str, category: str, source_filename: str) -> str:
    key = object_key(character_id, category, source_filename)
    entry = manifest["assets"].get(key)
    if not isinstance(entry, dict) or entry.get("key") != key or key != key.lower():
        raise RuntimeError(
            f"Required published {category} asset is missing from the remote manifest: {key}"
        )
    return public_url(manifest["public_base_url"], key)
