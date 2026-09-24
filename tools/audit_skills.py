import json
import sys
from pathlib import Path

PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"
DATA_FILE = PUBLIC_DIR / "data.json"

def audit_skills():
    sys.stdout.reconfigure(encoding="utf-8")
    if not DATA_FILE.exists():
        print(f"Error: {DATA_FILE} does not exist. Run build_web_data.py first.")
        sys.exit(1)

    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    characters = data.get("characters", {})

    print(f"=== WHOLE-ROSTER SKILL AUDIT ({len(characters)} Characters) ===")

    total_base_skills = 0
    total_ex_variants = 0
    total_summon_skills = 0
    total_brilliant_skills = 0
    unresolved_ex_count = 0
    missing_icon_count = 0
    type_mismatch_count = 0
    loc_crash_risks = 0

    TYPE_EXPECTED = {
        1: "Đánh Thường",
        2: "Kỹ Năng Nghề",
        3: "Tuyệt Kỹ",
        4: "Nội Tại",
        5: "Nội Tại",
        6: "Nội Tại",
        11: "Nội Tại"
    }

    for cid, char in characters.items():
        # 1. Localization / String type safety audit
        for field in ["name_vi", "fullname_vi", "nickname_vi", "tags_vi"]:
            val = char.get(field)
            if val is not None and not isinstance(val, str):
                loc_crash_risks += 1
                print(f"[WARNING] {cid} field '{field}' is type {type(val).__name__}: {val}")

        # 2. Base skills audit
        skills = char.get("skills", [])
        total_base_skills += len(skills)

        for sk in skills:
            gid = sk.get("group_id", "")
            levels = sk.get("levels", [])
            if not levels:
                print(f"[ERROR] {cid} skill {gid} has no levels!")
                continue

            lvl0 = levels[0]
            stype = lvl0.get("type_id", 1)
            stype_str = lvl0.get("type", "")
            expected_str = TYPE_EXPECTED.get(stype, "Nội Tại")

            if stype_str != expected_str:
                type_mismatch_count += 1
                print(f"[TYPE MISMATCH] {cid} skill {gid} type_id {stype} is '{stype_str}', expected '{expected_str}'")

            icon = lvl0.get("icon", "")
            if not icon:
                # Skill icon is missing
                missing_icon_count += 1

            # EX / Alternate forms
            alts = sk.get("alternate_forms", [])
            total_ex_variants += len(alts)
            for alt in alts:
                alt_gid = alt.get("group_id", "")
                if "ex" in alt_gid.lower() and not alt.get("provenance"):
                    unresolved_ex_count += 1

            # Summon skills
            summons = sk.get("summon_skills", [])
            total_summon_skills += len(summons)

        # 3. Brilliant skills audit
        brilliants = char.get("brilliant_skills", [])
        total_brilliant_skills += len(brilliants)

    print("\n--- AUDIT SUMMARY ---")
    print(f"Total Playable Characters: {len(characters)}")
    print(f"Total Base Skills: {total_base_skills}")
    print(f"Total Inferred EX Variants: {total_ex_variants}")
    print(f"Total Summon/NPC Skills: {total_summon_skills}")
    print(f"Total Hoán Chương (Brilliant) Skills: {total_brilliant_skills}")
    print(f"Unresolved EX Variants: {unresolved_ex_count}")
    print(f"Missing Icon Paths: {missing_icon_count}")
    print(f"Skill Type Mismatches: {type_mismatch_count}")
    print(f"Localization Type Crash Risks: {loc_crash_risks}")

    print("\n--- SPECIFIC CHARACTER VERIFICATION ---")
    for test_cid in ["V0055", "S0132", "W0182"]:
        if test_cid in characters:
            c = characters[test_cid]
            b_count = len(c.get("skills", []))
            ex_count = sum(len(s.get("alternate_forms", [])) for s in c.get("skills", []))
            brill_count = len(c.get("brilliant_skills", []))
            nick = c.get("nickname_vi", "")
            print(f"[{test_cid} / {c.get('name_vi')}] Base: {b_count}, EX: {ex_count}, Hoán Chương: {brill_count}, nickname_vi: {repr(nick)} ({type(nick).__name__})")
        else:
            print(f"[ERROR] Test character {test_cid} not found in database!")

if __name__ == "__main__":
    audit_skills()
