import json
import sys
from pathlib import Path

PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"
DATA_FILE = PUBLIC_DIR / "data.json"
SKILLS_DIR = PUBLIC_DIR / "assets" / "skills"

def audit_skill_icons():
    sys.stdout.reconfigure(encoding="utf-8")
    if not DATA_FILE.exists():
        print(f"Error: {DATA_FILE} does not exist.")
        sys.exit(1)

    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    characters = data.get("characters", {})

    print(f"=== SKILL ICON ASSET AUDIT ({len(characters)} Characters) ===")

    total_icons_checked = 0
    missing_assets = []
    itemicon_fallbacks = []

    def check_icon(gid, icon_path):
        nonlocal total_icons_checked
        total_icons_checked += 1
        if "itemicon_3" in icon_path:
            itemicon_fallbacks.append((gid, icon_path))
        if icon_path:
            rel_path = icon_path.replace("assets/", "")
            full_path = PUBLIC_DIR / "assets" / rel_path
            if not full_path.exists():
                missing_assets.append((gid, icon_path))

    for cid, char in characters.items():
        for sk in char.get("skills", []):
            gid = sk.get("group_id", "")
            for lvl in sk.get("levels", []):
                check_icon(gid, lvl.get("icon", ""))

            for alt in sk.get("alternate_forms", []):
                alt_gid = alt.get("group_id", "")
                for lvl in alt.get("levels", []):
                    check_icon(alt_gid, lvl.get("icon", ""))

            for sm in sk.get("summon_skills", []):
                sm_gid = sm.get("group_id", "")
                for lvl in sm.get("levels", []):
                    check_icon(sm_gid, lvl.get("icon", ""))

        for br in char.get("brilliant_skills", []):
            br_gid = br.get("group_id", "")
            for lvl in br.get("levels", []):
                check_icon(br_gid, lvl.get("icon", ""))

    print(f"Total Skill Icons Checked: {total_icons_checked}")
    print(f"Missing Icon Image Assets on Disk: {len(missing_assets)}")
    print(f"Donggu Coin (itemicon_3.png) Fallbacks: {len(itemicon_fallbacks)}")

    if missing_assets:
        print("\n[MISSING ASSETS]")
        for gid, path in missing_assets[:10]:
            print(f" - {gid}: {path}")

    if itemicon_fallbacks:
        print("\n[ITEMICON_3 FALLBACKS FOUND - MUST BE ZERO!]")
        for gid, path in itemicon_fallbacks:
            print(f" - {gid}: {path}")

if __name__ == "__main__":
    audit_skill_icons()
