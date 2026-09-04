import json
import os
import sys

def validate():
    print("=== STARTING DATA VALIDATION ===")
    data_path = os.path.join("public", "data.json")
    if not os.path.exists(data_path):
        print(f"CRITICAL ERROR: {data_path} does not exist!")
        sys.exit(1)
        
    with open(data_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    errors = []
    warnings = []

    # Top-level keys
    required_keys = ["characters", "items", "expCurve"]
    for k in required_keys:
        if k not in data:
            errors.append(f"Missing top-level key: {k}")

    characters = data.get("characters", {})
    items = data.get("items", {})
    exp_curve = data.get("expCurve", {})

    print(f"Total Characters: {len(characters)}")
    print(f"Total Items: {len(items)}")

    # Valid jobs and rarities
    valid_jobs = {1, 2, 3, 4, 5}
    job_names = {1: 'Túc Vệ', 2: 'Khinh Nhuệ', 3: 'Viễn Kích', 4: 'Cấu Thuật', 5: 'Chiến Lược'}
    valid_rarities = {1, 2, 3, 4, 5} # 4=SSR, 3=SR, 2=R, 5=EXTRA

    seen_char_ids = set()
    EXCLUDED_CHARACTER_IDS = {"W0021", "ES013"}

    for cid, char in characters.items():
        if cid in EXCLUDED_CHARACTER_IDS or cid.startswith("SCJ"):
            errors.append(f"Non-playable character ID '{cid}' found in playable characters dataset!")

        # Check ID match
        if char.get("id") != cid:
            errors.append(f"Character key '{cid}' mismatch with char.id '{char.get('id')}'")

        if cid in seen_char_ids:
            errors.append(f"Duplicate character ID: {cid}")
        seen_char_ids.add(cid)

        # Check essential fields
        for field in ["name_vi", "job", "rare", "icon"]:
            if field not in char or char[field] is None:
                errors.append(f"Char [{cid}] ({char.get('name_vi', 'Unknown')}): Missing or null required field '{field}'")

        job = char.get("job")
        if job not in valid_jobs:
            errors.append(f"Char [{cid}]: Invalid job value '{job}'")

        rare = char.get("rare")
        if rare not in valid_rarities:
            errors.append(f"Char [{cid}]: Invalid rarity value '{rare}'")

        # Check Icon image existence
        icon_path = char.get("icon")
        if icon_path:
            full_icon_path = os.path.join("public", icon_path.replace("/", os.sep))
            if not os.path.exists(full_icon_path):
                errors.append(f"Char [{cid}]: Missing icon file 'public/{icon_path}'")

        # Check cards / gallery
        cards = char.get("cards", [])
        for cname in cards:
            card_path = os.path.join("public", "assets", "cards", cname)
            if not os.path.exists(card_path):
                warnings.append(f"Char [{cid}]: Missing card image 'public/assets/cards/{cname}'")

        # Check talents
        talents = char.get("talents", [])
        talent_ids = set()
        for t in talents:
            tid = t.get("id")
            if not tid:
                errors.append(f"Char [{cid}]: Talent has no ID")
                continue
            if tid in talent_ids:
                errors.append(f"Char [{cid}]: Duplicate talent ID '{tid}'")
            talent_ids.add(tid)

            # Check talent icon
            ticon = t.get("icon")
            if ticon:
                full_ticon_path = os.path.join("public", ticon.replace("/", os.sep))
                if not os.path.exists(full_ticon_path):
                    errors.append(f"Char [{cid}] Talent [{tid}]: Missing icon file 'public/{ticon}'")

            # Check costs item references
            for c in t.get("cost", []):
                item_id = str(c.get("id"))
                if item_id != "3" and item_id not in items:
                    errors.append(f"Char [{cid}] Talent [{tid}]: Material item ID '{item_id}' not found in items dictionary")

            # Check prerequisites
            for req in t.get("req_talent", []):
                if req not in [x.get("id") for x in talents]:
                    errors.append(f"Char [{cid}] Talent [{tid}]: Prerequisite talent '{req}' does not exist in character's talents")

    # Check Items
    for iid, item in items.items():
        if item.get("id") and str(item.get("id")) != str(iid):
            errors.append(f"Item key '{iid}' mismatch with item.id '{item.get('id')}'")
        icon_path = item.get("icon")
        if icon_path:
            full_icon_path = os.path.join("public", icon_path.replace("/", os.sep))
            if not os.path.exists(full_icon_path):
                warnings.append(f"Item [{iid}] ({item.get('name_vi', 'Unknown')}): Missing icon file 'public/{icon_path}'")

    print(f"\nValidation complete.")
    print(f"Total Errors: {len(errors)}")
    print(f"Total Warnings: {len(warnings)}")

    if errors:
        print("\n--- ERRORS ---")
        for e in errors[:30]:
            print(f"[ERROR] {e}")
        if len(errors) > 30:
            print(f"... and {len(errors) - 30} more errors")

    if warnings:
        print("\n--- WARNINGS ---")
        for w in warnings[:30]:
            print(f"[WARN] {w}")

    if errors:
        sys.exit(1)
    else:
        print("[SUCCESS] DATA VALIDATION PASSED PERFECTLY!")
        sys.exit(0)

if __name__ == "__main__":
    validate()
