#!/usr/bin/env python3
"""WHMX - Repeatable Skin Series Logo Extractor.

Extracts official SkinLogo sprites from:
NeoArtifacts/Assets/bundles/33bad397ca560864dbb01d535f55f26e.ab

Outputs:
1. All 20 sprites (102, 202..220) to NeoArtifacts/Assets/SkinLogo/
2. The 19 actual skin series badges (202..220) to WhmxCalc/public/assets/series/ (lowercase)
"""

import os
import sys
from pathlib import Path
from PIL import Image
import UnityPy

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

PROJECT_ROOT = Path(__file__).resolve().parent.parent
NEO_ROOT = PROJECT_ROOT.parent / "NeoArtifacts"
BUNDLE_PATH = NEO_ROOT / "Assets" / "bundles" / "33bad397ca560864dbb01d535f55f26e.ab"

NEO_OUTPUT_DIR = NEO_ROOT / "Assets" / "SkinLogo"
WEB_OUTPUT_DIR = PROJECT_ROOT / "public" / "assets" / "series"

ACTUAL_SERIES_IDS = set(range(202, 221))  # 202..220


def extract_skin_logos():
    print("==================================================")
    print("WHMX - OFFICIAL SKIN SERIES LOGO EXTRACTION")
    print("==================================================")

    if not BUNDLE_PATH.exists():
        print(f"ERROR: Bundle not found: {BUNDLE_PATH}")
        sys.exit(1)

    NEO_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    WEB_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Loading bundle: {BUNDLE_PATH.name} ({BUNDLE_PATH.stat().st_size} bytes)")
    env = UnityPy.load(str(BUNDLE_PATH))

    extracted_neo = {}
    extracted_web = {}

    for obj in env.objects:
        if obj.type.name == "Sprite":
            data = obj.read()
            sprite_name = getattr(data, "m_Name", getattr(data, "name", ""))
            if not sprite_name.startswith("SkinLogo_"):
                continue

            # Extract image
            img = data.image  # PIL Image in RGBA
            suffix = sprite_name.split("SkinLogo_")[-1]

            # 1. Save to NeoArtifacts
            neo_file = NEO_OUTPUT_DIR / f"{sprite_name}.png"
            img.save(neo_file, format="PNG")
            extracted_neo[sprite_name] = neo_file

            # 2. If one of 202..220, save to web public assets in canonical lowercase
            try:
                series_id = int(suffix)
            except ValueError:
                series_id = None

            if series_id in ACTUAL_SERIES_IDS:
                web_filename = f"skinlogo_{series_id}.png"
                web_file = WEB_OUTPUT_DIR / web_filename
                img.save(web_file, format="PNG")
                extracted_web[series_id] = web_file

    print(f"\nExtracted {len(extracted_neo)} sprites to NeoArtifacts: {NEO_OUTPUT_DIR}")
    for name, path in sorted(extracted_neo.items()):
        sz = path.stat().st_size
        print(f"  - {name}.png ({sz} bytes)")

    print(f"\nExported {len(extracted_web)} actual skin series badges to web: {WEB_OUTPUT_DIR}")
    for sid, path in sorted(extracted_web.items()):
        sz = path.stat().st_size
        print(f"  - skinlogo_{sid}.png ({sz} bytes)")

    assert len(extracted_neo) == 20, f"Expected 20 sprites in NeoArtifacts, got {len(extracted_neo)}"
    assert len(extracted_web) == 19, f"Expected 19 badges in web assets, got {len(extracted_web)}"
    print("\n[SUCCESS] Official SkinLogo extraction & productionization complete!")


if __name__ == "__main__":
    extract_skin_logos()
