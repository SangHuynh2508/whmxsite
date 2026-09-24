import json
import os
import re
import sys

def validate_public_output(manifest_path="localization/batches/phase3_batch1.json", data_path="public/data.json"):
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    full_manifest_path = os.path.join(base_dir, manifest_path) if not os.path.isabs(manifest_path) else manifest_path
    full_data_path = os.path.join(base_dir, data_path) if not os.path.isabs(data_path) else data_path

    if not os.path.exists(full_manifest_path):
        return False, [f"Manifest file not found: {full_manifest_path}"]
    if not os.path.exists(full_data_path):
        return False, [f"Data file not found: {full_data_path}"]

    with open(full_manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)

    with open(full_data_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    batch_chars = manifest.get('character_ids', [])
    chars_data = data.get('characters', {})

    errors = []

    # Regex patterns for leaks
    RAW_PLACEHOLDER_PAT = re.compile(r'\[(Effect|Para|Attr|BuffParam)[^\]]*\]')
    RAW_BUFF_PAT = re.compile(r'\{?Buff_[A-Za-z0-9_]+\}?')
    DEV_STAT_PAT = re.compile(r'(_PERCENT|_FIX|SkillUP|^Công$|^HP$)')
    LITERAL_BAD_PAT = re.compile(r'\b(None|null|undefined)\b', re.IGNORECASE)
    HAN_PAT = re.compile(r'[\u4e00-\u9fff]')

    def check_string(val, context):
        if not val or not isinstance(val, str):
            return
        if RAW_PLACEHOLDER_PAT.search(val):
            errors.append(f"[{context}] Contains unresolved raw placeholder: '{val}'")
        if RAW_BUFF_PAT.search(val):
            errors.append(f"[{context}] Contains raw buff ID/marker: '{val}'")
        if LITERAL_BAD_PAT.search(val):
            # Exclude valid words if any, but None/null/undefined in game text is leak
            errors.append(f"[{context}] Contains literal bad string (None/null/undefined): '{val}'")

    for cid in batch_chars:
        char_obj = chars_data.get(cid)
        if not char_obj:
            errors.append(f"Batch character {cid} missing from public/data.json!")
            continue

        # 1. Skills
        for sk in char_obj.get('skills', []):
            gid = sk.get('group_id', '')
            for lvl in sk.get('levels', []):
                lvl_num = lvl.get('level', 1)
                ctx = f"Char {cid} Skill {gid} Lv{lvl_num}"
                check_string(lvl.get('name_vi'), f"{ctx} name_vi")
                check_string(lvl.get('desc_vi'), f"{ctx} desc_vi")
                
                # Check mechanics
                for m in lvl.get('mechanics', []):
                    m_ctx = f"{ctx} Mech {m.get('key')}"
                    check_string(m.get('name_vi'), f"{m_ctx} name_vi")
                    check_string(m.get('desc_vi'), f"{m_ctx} desc_vi")

        # 2. Zhizhi
        for zz in char_obj.get('zhizhi', []):
            star = zz.get('star', 0)
            ctx = f"Char {cid} Zhizhi Star {star}"
            for b in zz.get('bonuses', []):
                lbl = b.get('label_vi', '')
                if DEV_STAT_PAT.search(lbl):
                    errors.append(f"[{ctx}] Uncanonical or raw dev stat label in Zhizhi bonus: '{lbl}'")
                check_string(lbl, f"{ctx} bonus label_vi")

            if zz.get('type') == 'skill_upgrade' and zz.get('skill_upgrade'):
                enh = zz['skill_upgrade'].get('enhanced_skill', {})
                check_string(enh.get('name_vi'), f"{ctx} enhanced_skill name_vi")
                check_string(enh.get('desc_vi'), f"{ctx} enhanced_skill desc_vi")
                if not enh.get('desc_vi'):
                    errors.append(f"[{ctx}] Enhanced skill desc_vi is empty/None!")
                elif HAN_PAT.search(enh.get('desc_vi', '')):
                    errors.append(f"[{ctx}] Enhanced skill desc_vi contains Chinese text: '{enh.get('desc_vi')}'")

        # 3. Huanzhang
        binfo = char_obj.get('brilliant_info')
        if binfo:
            ctx = f"Char {cid} Huanzhang BInfo"
            check_string(binfo.get('name_vi'), f"{ctx} name_vi")
            check_string(binfo.get('info_vi'), f"{ctx} info_vi")
            check_string(binfo.get('buff_show_vi'), f"{ctx} buff_show_vi")

        for bsk in char_obj.get('brilliant_skills', []):
            gid = bsk.get('group_id', '')
            for lvl in bsk.get('levels', []):
                ctx = f"Char {cid} Huanzhang Skill {gid}"
                check_string(lvl.get('name_vi'), f"{ctx} name_vi")
                check_string(lvl.get('desc_vi'), f"{ctx} desc_vi")

    success = len(errors) == 0
    return success, errors

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    success, errors = validate_public_output()
    print(f"=== PUBLIC OUTPUT LEAK VALIDATION REPORT ===")
    if success:
        print("[SUCCESS] 0 PUBLIC OUTPUT LEAKS FOUND IN RELEASED BATCH DATA!")
    else:
        print(f"[FAIL] FOUND {len(errors)} PUBLIC OUTPUT LEAK(S):")
        for e in errors:
            print(f"  - {e}")
    sys.exit(0 if success else 1)
