import json
import sys
from pathlib import Path

PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"
DATA_FILE = PUBLIC_DIR / "data.json"

def trace_character(char_query):
    sys.stdout.reconfigure(encoding="utf-8")
    if not DATA_FILE.exists():
        print(f"Error: {DATA_FILE} does not exist.")
        sys.exit(1)

    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    characters = data.get("characters", {})

    target_char = None
    for cid, c in characters.items():
        if char_query.upper() == cid.upper() or char_query.lower() == c.get("slug", "").lower() or char_query in c.get("name_vi", "") or char_query in c.get("name_cn", ""):
            target_char = c
            break

    if not target_char:
        print(f"Character '{char_query}' not found.")
        sys.exit(1)

    cid = target_char["id"]
    name_vi = target_char.get("name_vi")
    name_cn = target_char.get("name_cn")
    nickname = target_char.get("nickname_vi")
    rare = target_char.get("rare")

    print(f"=== CHARACTER TRACE: {cid} | {name_vi} ({name_cn}) ===")
    print(f"Rarity: ★{rare} | Nickname: {repr(nickname)} (type: {type(nickname).__name__})")
    print(f"Profile: Department={target_char.get('profile',{}).get('department')}, RecordID={target_char.get('profile',{}).get('record_id')}")

    skills = target_char.get("skills", [])
    print(f"\n--- BASE SKILLS ({len(skills)}) ---")
    for s in skills:
        gid = s.get("group_id")
        slot = s.get("slot")
        lvl0 = s.get("levels", [{}])[0]
        stype = lvl0.get("type")
        name = lvl0.get("name_vi") or lvl0.get("name_cn")
        icon = lvl0.get("icon")
        print(f" [{slot}] {gid} | {name} | {stype} | Icon: {icon}")

        alts = s.get("alternate_forms", [])
        if alts:
            for alt in alts:
                alt_gid = alt.get("group_id")
                alt_lvl0 = alt.get("levels", [{}])[0]
                alt_name = alt_lvl0.get("name_vi") or alt_lvl0.get("name_cn")
                alt_icon = alt_lvl0.get("icon")
                prov = alt.get("provenance", {})
                print(f"    └─ [EX Variant] {alt_gid} | {alt_name} | Icon: {alt_icon} | Prov: {prov}")

        summons = s.get("summon_skills", [])
        if summons:
            for sm in summons:
                sm_gid = sm.get("group_id")
                sm_lvl0 = sm.get("levels", [{}])[0]
                sm_name = sm_lvl0.get("name_vi") or sm_lvl0.get("name_cn")
                sm_icon = sm_lvl0.get("icon")
                print(f"    └─ [Summon/NPC] {sm_gid} | {sm_name} | Icon: {sm_icon}")

    brilliants = target_char.get("brilliant_skills", [])
    if brilliants:
        print(f"\n--- HOÁN CHƯƠNG (BRILLIANT) SKILLS ({len(brilliants)}) ---")
        for b in brilliants:
            bgid = b.get("group_id")
            blvl0 = b.get("levels", [{}])[0]
            bname = blvl0.get("name_vi") or blvl0.get("name_cn")
            bicon = blvl0.get("icon")
            print(f" [Hoán Chương] {bgid} | {bname} | Icon: {bicon}")

if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else "V0055"
    trace_character(query)
