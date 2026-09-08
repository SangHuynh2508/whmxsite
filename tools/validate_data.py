import json
import os
import sys
import re
from pathlib import Path

if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

HAN_RE = re.compile(r'[\u3400-\u9fff]')

def clean_text(value):
    return re.sub(r'<[^>]+>', '', str(value or '')).strip()

def valid_vi(value):
    text = clean_text(value)
    return bool(text) and not HAN_RE.search(text)

def iter_public_skill_records(characters):
    """Yield every player-facing skill record, including Hoán Chương and Trí Tri EX."""
    for cid, char in characters.items():
        for bucket in ("skills", "brilliant_skills"):
            for skill in char.get(bucket, []) or []:
                gid = str(skill.get("group_id", ""))
                for level in skill.get("levels", []) or []:
                    yield cid, gid, int(level.get("level", 1)), level
        for row in char.get("zhizhi", []) or []:
            upgrade = row.get("skill_upgrade") or {}
            enhanced = upgrade.get("enhanced_skill") or {}
            if enhanced.get("group_id"):
                yield cid, str(enhanced["group_id"]), 1, enhanced

def validate_localization_integrity(data, errors, warnings):
    """Cross-check generated localization against the post-build public contract."""
    generated_path = Path("localization") / "generated_localization.json"
    if not generated_path.exists():
        errors.append("Missing localization/generated_localization.json for localization integrity audit")
        return
    with generated_path.open("r", encoding="utf-8") as handle:
        generated = json.load(handle)

    public_index = {}
    public_records = []
    for cid, gid, level, record in iter_public_skill_records(data.get("characters", {})):
        public_index.setdefault((cid, gid, level), record)
        public_records.append((cid, gid, level, record))

    # A valid workbook/exported VI skill field must not silently fall through to CN.
    for source_id, source in (generated.get("skills") or {}).items():
        cid = str(source.get("character_id", ""))
        match = re.match(r"^(.*)_(\d+)$", str(source_id))
        gid, level = (match.group(1), int(match.group(2))) if match else (str(source_id), 1)
        target = public_index.get((cid, gid, level))
        if not target:
            if valid_vi(source.get("skill_name_vi", "")) or valid_vi(source.get("desc_vi", "")):
                warnings.append(f"Localization skill [{source_id}] has valid VI but no public skill record")
            continue
        for source_field, public_field in (("skill_name_vi", "name_vi"), ("desc_vi", "desc_vi")):
            value = source.get(source_field, "")
            if valid_vi(value) and not valid_vi(target.get(public_field, "")):
                errors.append(f"Skill [{source_id}] has valid VI {source_field} but public {public_field} falls back to CN")
            elif value and not valid_vi(value):
                warnings.append(f"Skill [{source_id}] {source_field} is mixed CN/VI; public output correctly falls back to CN")

    # Hoán Chương metadata is independent from its gameplay SKILL record.
    for hz_id, source in (generated.get("huanzhang") or {}).items():
        cid = str(source.get("character_id", ""))
        target = (data.get("characters", {}).get(cid, {}).get("brilliant_info") or {})
        for source_field, public_field in (("icon_name_vi", "name_vi"), ("icon_info_vi", "info_vi"), ("buff_show_vi", "buff_show_vi")):
            if valid_vi(source.get(source_field, "")) and not valid_vi(target.get(public_field, "")):
                errors.append(f"Hoán Chương [{hz_id}] has valid VI {source_field} but public {public_field} falls back to CN")

    buffs = generated.get("buffs") or {}
    for cid, gid, level, record in public_records:
        desc_cn = clean_text(record.get("desc_cn", ""))
        desc_vi = clean_text(record.get("desc_vi", ""))
        for mechanic in record.get("mechanics", []) or []:
            if not isinstance(mechanic, dict):
                continue
            buff_id = mechanic.get("key")
            popup_terms = mechanic.get("popup_terms", []) or []
            if popup_terms and buff_id not in buffs:
                warnings.append(f"Skill [{gid}] references buff [{buff_id}] without a BUFF_STATUS localization record")
            for term in popup_terms:
                if term.get("buff_id") != buff_id:
                    errors.append(f"Skill [{gid}] popup target [{term.get('buff_id')}] does not match mechanic buff [{buff_id}]")
                    continue
                buff = buffs.get(buff_id, {})
                expected_cn = clean_text(buff.get("buff_name_cn", ""))
                expected_vi = clean_text(buff.get("buff_name_vi", ""))
                if expected_cn and term.get("name_cn") != expected_cn:
                    errors.append(f"Skill [{gid}] popup [{buff_id}] uses a name from another buff")
                if desc_vi and not expected_vi:
                    warnings.append(f"Skill [{gid}] buff [{buff_id}] has no BUFF_STATUS VI name, so the coloured VI term has no popup target")
                if desc_vi and expected_vi and expected_vi not in desc_vi:
                    warnings.append(f"Skill [{gid}] popup [{buff_id}] cannot be rendered by exact BUFF_STATUS VI name")

            # A coloured source buff name with an exported mechanic must have an explicit
            # popup term.  Colour alone is never sufficient to create one.
            colored_names = [clean_text(x) for x in re.findall(r'<color=[^>]+>(.*?)</color>', record.get("desc_cn", ""), flags=re.I | re.S)]
            if clean_text(mechanic.get("name_cn", "")) in colored_names and not popup_terms:
                warnings.append(f"Skill [{gid}] coloured buff [{buff_id}] has no deterministic popup target")

    # Zhizhi must retain the exact raw SkillUP base -> enhanced relationship.
    raw_roleattr = Path("..") / "NeoArtifacts" / "MasterData" / "json" / "roleattrMap.json"
    if raw_roleattr.exists():
        with raw_roleattr.open("r", encoding="utf-8") as handle:
            roleattrs = json.load(handle)
        for raw in roleattrs.values():
            cid = str(raw.get("id", ""))
            if cid not in data.get("characters", {}):
                continue
            star = raw.get("star")
            attrs = raw.get("starUpAttr") or []
            values = attrs if isinstance(attrs, list) else [attrs]
            for value in values:
                if not str(value).startswith("SkillUP,"):
                    continue
                base = str(value).split(",", 1)[1]
                row = next((x for x in (data.get("characters", {}).get(cid, {}).get("zhizhi") or []) if x.get("star") == star), {})
                upgrade = row.get("skill_upgrade") or {}
                if upgrade.get("base_skill_id") != base or upgrade.get("enhanced_skill_id") != f"{base}ex":
                    errors.append(f"Zhizhi [{cid} star {star}] does not match raw SkillUP relation {base} -> {base}ex")

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
            norm_icon = icon_path.replace("assets/avatars/", "assets/characters/avatars/")
            full_icon_path = os.path.join("public", norm_icon.replace("/", os.sep))
            if not os.path.exists(full_icon_path):
                errors.append(f"Char [{cid}]: Missing icon file 'public/{norm_icon}'")

        # Check cards / gallery
        cards = char.get("cards", [])
        for cname in cards:
            card_path = os.path.join("public", "assets", "characters", "cards", cname)
            if not os.path.exists(card_path):
                warnings.append(f"Char [{cid}]: Missing card image 'public/assets/characters/cards/{cname}'")

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

        # Check multi-level skills & buff progression
        skills = char.get("skills", [])
        for sk in skills:
            mechs = sk.get("mechanics", [])
            for m in mechs:
                if not isinstance(m, dict):
                    errors.append(f"Char [{cid}] Skill [{sk.get('gid')}]: mechanic is not a dict")

        # Scan for unresolved placeholders or malformed formatting across all skill & zhizhi descriptions
        all_descs = []
        for sk in (char.get("skills") or []):
            all_descs.append((f"Skill {sk.get('gid')}", sk.get("desc_cn", "")))
            for m in (sk.get("mechanics") or []):
                all_descs.append((f"Skill {sk.get('gid')} Mechanic {m.get('key')}", m.get("desc_cn", "")))
        for zz in (char.get("zhizhi") or []):
            sk_up = zz.get("skill_upgrade")
            if sk_up and isinstance(sk_up, dict):
                enh = sk_up.get("enhanced_skill")
                if enh and isinstance(enh, dict):
                    all_descs.append((f"Zhizhi {enh.get('group_id')}", enh.get("desc_cn", "")))
                    for m in enh.get("mechanics", []):
                        all_descs.append((f"Zhizhi {enh.get('group_id')} Mechanic {m.get('key')}", m.get("desc_cn", "")))

        for ctx, text in all_descs:
            if not text: continue
            # Catch raw unreplaced placeholders
            ph_matches = re.findall(r'\[(?:EffectParam|EffectPara|BuffParam|Effect\d+Para|Condition\d+Para),\d+\]', text)
            if ph_matches:
                errors.append(f"Char [{cid}] {ctx} contains unresolved placeholders: {ph_matches}")

            # Catch malformed percentage progression like 10/20/30% or 10 / 20 / 30%
            if re.search(r'\d+/\d+/\d+%', text) or re.search(r'\d+\s*/\s*\d+\s*/\s*\d+%', text):
                errors.append(f"Char [{cid}] {ctx} contains malformed percentage progression: {text}")

            # Catch repeated non-percentage unit suffixes like 1倍/1.2倍/1.3倍 or 1格/2格/3格
            if re.search(r'\d+(?:倍|格|层|次)/\d+(?:倍|格|层|次)', text):
                errors.append(f"Char [{cid}] {ctx} contains repeated suffix progression: {text}")

        # Audit S0174 (太阳神鸟) specifically
        if cid == "S0174":
            s0174_mechs = []
            for sk in (char.get("skills") or []):
                s0174_mechs.extend(sk.get("mechanics") or [])
            for zz in (char.get("zhizhi") or []):
                sk_up = zz.get("skill_upgrade")
                if sk_up and isinstance(sk_up, dict):
                    enh = sk_up.get("enhanced_skill")
                    if enh and isinstance(enh, dict):
                        s0174_mechs.extend(enh.get("mechanics", []))
            
            s0174_names = {m.get("name_cn") for m in s0174_mechs}
            expected_statuses = {"阳春-超群", "炎夏-超群", "暮秋-超群", "凛冬-超群", "恒时-超群"}
            missing = expected_statuses - s0174_names
            if missing:
                errors.append(f"S0174 missing expected statuses: {missing}")

            for m in s0174_mechs:
                name = m.get("name_cn")
                if name in expected_statuses:
                    desc = m.get("desc_cn", "")
                    if "/" not in desc:
                        errors.append(f"S0174 status [{name}] does not contain multi-level slash progression! Got: {desc}")

            # Audit S017403ex specifically for battle logic condition correction
            s017403ex_found = False
            for zz in (char.get("zhizhi") or []):
                sk_up = zz.get("skill_upgrade")
                if sk_up and isinstance(sk_up, dict):
                    enh = sk_up.get("enhanced_skill")
                    if enh and isinstance(enh, dict) and enh.get("group_id") == "S017403ex":
                        s017403ex_found = True
                        desc = enh.get("desc_cn", "")
                        clean_d = re.sub(r'<[^>]+>', '', desc)
                        if "不少于3层灿金" not in clean_d or "周围2格" not in clean_d or "累计至3层" not in clean_d or "额外行动1次" not in clean_d:
                            errors.append(f"S017403ex description validation failed! Got: {desc}")
                        if "不少于2层灿金" in clean_d:
                            errors.append(f"S017403ex still contains uncorrected stale text '不少于2层灿金'! Got: {desc}")
            if not s017403ex_found:
                errors.append("S017403ex not found in S0174 zhizhi skill upgrades!")


    # Check Items
    for iid, item in items.items():
        if item.get("id") and str(item.get("id")) != str(iid):
            errors.append(f"Item key '{iid}' mismatch with item.id '{item.get('id')}'")
        icon_path = item.get("icon")
        if icon_path:
            full_icon_path = os.path.join("public", icon_path.replace("/", os.sep))
            if not os.path.exists(full_icon_path):
                warnings.append(f"Item [{iid}] ({item.get('name_vi', 'Unknown')}): Missing icon file 'public/{icon_path}'")

    validate_localization_integrity(data, errors, warnings)

    # Multi-level records share descriptions; report each unique issue once.
    errors[:] = list(dict.fromkeys(errors))
    warnings[:] = list(dict.fromkeys(warnings))

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
