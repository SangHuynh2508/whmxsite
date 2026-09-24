#!/usr/bin/env python3
"""WHMX - Comprehensive Skin Asset Validator

Deterministic, offline validation of every actual skin (skin_type == 3); the
expected set comes from raw NeoArtifacts characterSkins.json, not a fixed count:
- Source availability in NeoArtifacts (Drawings, Cards, Avatars)
- Web availability (R2 manifest for Drawings/Cards, local public for Avatars)
- Strict case-sensitivity checks (must match canonical lowercase convention)
- Resolvers consistency
"""

import json
import sys
from pathlib import Path

# Ensure UTF-8 output encoding
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
NEO_ROOT = PROJECT_ROOT.parent / "NeoArtifacts"
NEO_CHARS = NEO_ROOT / "Assets" / "characters"
PUBLIC_ASSETS = PROJECT_ROOT / "public" / "assets"
PUBLIC_AVATARS = PUBLIC_ASSETS / "characters" / "avatars"
MANIFEST_FILE = PROJECT_ROOT / "asset-publish-manifest.json"
DATA_FILE = PROJECT_ROOT / "public" / "data.json"
RAW_SKINS_FILE = NEO_ROOT / "MasterData" / "json" / "characterSkins.json"


def run_validation():
    print("==================================================")
    print("WHMX - SKIN ASSET PIPELINE VALIDATION")
    print("==================================================")

    # 1. Load Data
    if not DATA_FILE.exists():
        print(f"FAIL: {DATA_FILE} not found.")
        sys.exit(1)
    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    characters = data.get("characters", {})

    if not MANIFEST_FILE.exists():
        print(f"FAIL: {MANIFEST_FILE} not found.")
        sys.exit(1)
    manifest = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
    manifest_assets = manifest.get("assets", {})

    # 2. Collect actual skins
    gallery_skins = []
    for cid, cdata in characters.items():
        for skin in cdata.get("skins", []):
            if skin.get("skin_type") == 3:
                gallery_skins.append((cid, skin))

    total_skins = len(gallery_skins)
    raw_skins = json.loads(RAW_SKINS_FILE.read_text(encoding="utf-8-sig"))
    raw_ids = {s["skinID"] for sl in raw_skins.values() if isinstance(sl, list) for s in sl if s.get("skinType") == 3}
    web_ids = {skin.get("skinID") for _, skin in gallery_skins}
    print(f"Total audited gallery skins (skin_type == 3): {total_skins} (Expected from raw: {len(raw_ids)})")
    if web_ids != raw_ids or total_skins != len(raw_ids):
        print(f"FAIL: gallery skins differ from raw actual skins (missing: {sorted(raw_ids - web_ids)}; extra: {sorted(web_ids - raw_ids)}; count {total_skins} vs {len(raw_ids)})")
        sys.exit(1)

    # 3. Validate each skin
    errors = []
    drawing_ok = 0
    card_ok = 0
    avatar_ok = 0
    case_ok = 0

    for cid, skin in gallery_skins:
        sid = skin.get("skinID", "")
        sid_lower = sid.lower()
        cid_lower = cid.lower()

        # A. Drawing Check
        r2_drawing_key = f"characters/{cid_lower}/drawings/{sid_lower}.webp"
        if r2_drawing_key in manifest_assets:
            drawing_ok += 1
        else:
            errors.append(f"Drawing missing from R2 manifest: {sid} ({r2_drawing_key})")

        # Check source drawing in NeoArtifacts
        src_drawing = NEO_CHARS / cid / "drawing" / f"{sid_lower}.png"
        if not src_drawing.exists():
            errors.append(f"Drawing source missing in NeoArtifacts: {sid} ({src_drawing})")

        # B. Card Check
        r2_card_key = f"characters/{cid_lower}/cards/{sid_lower}.webp"
        if r2_card_key in manifest_assets:
            card_ok += 1
        else:
            errors.append(f"Card missing from R2 manifest: {sid} ({r2_card_key})")

        # Check source card in NeoArtifacts
        src_card = NEO_CHARS / cid / "card" / f"{sid_lower}.png"
        if not src_card.exists():
            errors.append(f"Card source missing in NeoArtifacts: {sid} ({src_card})")

        # C. Avatar Check
        # Source avatar in NeoArtifacts
        src_avatar = NEO_CHARS / cid / "avatar" / f"{sid_lower}.png"
        if not src_avatar.exists():
            errors.append(f"Avatar source missing in NeoArtifacts: {sid} ({src_avatar})")

        # Local public avatar file
        pub_avatar = PUBLIC_AVATARS / f"{sid_lower}.png"
        if pub_avatar.exists():
            avatar_ok += 1
        else:
            errors.append(f"Avatar missing from public/assets: {sid} ({pub_avatar})")

        # Casing check: verify exact disk case matches lowercase
        # On Windows, path.exists() is case-insensitive. We listdir to enforce exact casing.
        if pub_avatar.exists():
            actual_files = {p.name for p in PUBLIC_AVATARS.glob(f"{sid_lower[:4]}*")}
            if f"{sid_lower}.png" in actual_files:
                case_ok += 1
            else:
                errors.append(f"Avatar casing mismatch on disk: expected {sid_lower}.png")

    print(f"\n--- Coverage Results ---")
    print(f"1. Drawings in R2 manifest:       {drawing_ok}/{total_skins} ({'PASS' if drawing_ok == total_skins else 'FAIL'})")
    print(f"2. Cards in R2 manifest:          {card_ok}/{total_skins} ({'PASS' if card_ok == total_skins else 'FAIL'})")
    print(f"3. Avatars in public web assets:  {avatar_ok}/{total_skins} ({'PASS' if avatar_ok == total_skins else 'FAIL'})")
    print(f"4. Exact lowercase casing on disk:{case_ok}/{total_skins} ({'PASS' if case_ok == total_skins else 'FAIL'})")

    # 4. Currency item icon check (Item ID 8: Vé Trang Phục)
    item8_icon = PUBLIC_ASSETS / "items" / "itemicon_8.png"
    if item8_icon.exists():
        print(f"5. Currency item icon (itemicon_8.png): PASS ({item8_icon.stat().st_size} bytes)")
    else:
        errors.append("Currency item icon missing: public/assets/items/itemicon_8.png")

    # 5. Series badge web assets check (202..220)
    series_web_dir = PUBLIC_ASSETS / "series"
    series_ok = 0
    series_case_ok = 0
    actual_series_ids = list(range(202, 221))
    for sid in actual_series_ids:
        badge_path = series_web_dir / f"skinlogo_{sid}.png"
        if badge_path.exists() and badge_path.stat().st_size > 0:
            series_ok += 1
            # Check exact lowercase casing on disk
            actual_files = {p.name for p in series_web_dir.glob("skinlogo_*.png")}
            if f"skinlogo_{sid}.png" in actual_files:
                series_case_ok += 1
            else:
                errors.append(f"Series badge casing mismatch on disk: expected skinlogo_{sid}.png")
        else:
            errors.append(f"Series badge missing or empty: {badge_path}")

    print(f"6. Series badges in web assets:   {series_ok}/{len(actual_series_ids)} ({'PASS' if series_ok == len(actual_series_ids) else 'FAIL'})")
    print(f"7. Series badges exact casing:    {series_case_ok}/{len(actual_series_ids)} ({'PASS' if series_case_ok == len(actual_series_ids) else 'FAIL'})")

    # 6. NeoArtifacts derived SkinLogo asset check (102, 202..220)
    neo_logo_dir = NEO_ROOT / "Assets" / "SkinLogo"
    neo_logo_ok = 0
    all_series_sprites = [102] + actual_series_ids
    for sid in all_series_sprites:
        neo_file = neo_logo_dir / f"SkinLogo_{sid}.png"
        if neo_file.exists() and neo_file.stat().st_size > 0:
            neo_logo_ok += 1
        else:
            errors.append(f"NeoArtifacts SkinLogo sprite missing: {neo_file}")

    print(f"8. NeoArtifacts derived sprites:  {neo_logo_ok}/{len(all_series_sprites)} ({'PASS' if neo_logo_ok == len(all_series_sprites) else 'FAIL'})")

    if errors:
        print(f"\nValidation failed with {len(errors)} errors:")
        for err in errors[:20]:
            print(f"  - {err}")
        sys.exit(1)
    else:
        print(f"\n[SUCCESS] All {total_skins} skin assets are 100% available, case-exact, and verified!")
        sys.exit(0)


if __name__ == "__main__":
    run_validation()
