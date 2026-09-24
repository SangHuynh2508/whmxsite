import json
import sys
from pathlib import Path

MASTER = Path(__file__).resolve().parent.parent.parent / "NeoArtifacts" / "MasterData" / "json"
PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"
DATA_FILE = PUBLIC_DIR / "data.json"

def run_investigation():
    sys.stdout.reconfigure(encoding="utf-8")
    
    char_tbl = json.loads((MASTER / "characterTable.json").read_text(encoding="utf-8"))
    char_sk = json.loads((MASTER / "characterSkillMap.json").read_text(encoding="utf-8"))
    pass_sk = json.loads((MASTER / "characterPassiveSkillMap.json").read_text(encoding="utf-8"))
    sk_map = json.loads((MASTER / "skillMap.json").read_text(encoding="utf-8"))

    web_data = {}
    if DATA_FILE.exists():
        web_data = json.loads(DATA_FILE.read_text(encoding="utf-8")).get("characters", {})

    print("==================================================")
    print("1. RAW V0055 BASE SLOTS FROM characterTable")
    print("==================================================")

    v55 = char_tbl.get("V0055", {})
    gids_v55 = []
    for i in range(1, 7):
        sinfo = v55.get(f"skill{i}")
        if sinfo and isinstance(sinfo, list) and len(sinfo) > 0:
            gids_v55.append((f"skill{i}", str(sinfo[0])))

    print(f"{'Slot':<8} | {'GroupId':<10} | {'Name (CN)':<12} | {'charSkill.Type':<15} | {'charPass.Type':<15} | {'skillMap.type':<15} | {'Generated Cat':<15} | {'Rendered Pos'}")
    print("-" * 115)

    gen_v55 = web_data.get("V0055", {}).get("skills", [])
    gen_pos_map = {s["group_id"]: idx + 1 for idx, s in enumerate(gen_v55)}

    for slot, gid in gids_v55:
        # Check characterSkillMap
        c_entry = None
        for k, v in char_sk.items():
            if str(v.get("GroupId")) == gid and str(v.get("HeroId")) == "V0055":
                c_entry = v
                break
        if not c_entry:
            for k, v in char_sk.items():
                if str(v.get("GroupId")) == gid:
                    c_entry = v
                    break

        # Check characterPassiveSkillMap
        p_entry = None
        for k, v in pass_sk.items():
            if str(v.get("GroupId")) == gid and str(v.get("HeroId")) == "V0055":
                p_entry = v
                break
        if not p_entry:
            for k, v in pass_sk.items():
                if str(v.get("GroupId")) == gid:
                    p_entry = v
                    break

        # Check skillMap
        s_entry = None
        for k, v in sk_map.items():
            if str(v.get("GroupId")) == gid:
                s_entry = v
                break

        name_cn = (c_entry or p_entry or s_entry or {}).get("NameLanText", "N/A")
        c_type = str(c_entry.get("Type")) if c_entry and "Type" in c_entry else "None"
        p_type = str(p_entry.get("Type")) if p_entry and "Type" in p_entry else "None"
        s_type = str(s_entry.get("type")) if s_entry and "type" in s_entry else "None"

        gen_skill = next((s for s in gen_v55 if s["group_id"] == gid), {})
        gen_cat = gen_skill.get("levels", [{}])[0].get("type", "N/A") if gen_skill else "N/A"
        rend_pos = gen_pos_map.get(gid, "N/A")

        print(f"{slot:<8} | {gid:<10} | {name_cn:<12} | {c_type:<15} | {p_type:<15} | {s_type:<15} | {gen_cat:<15} | {rend_pos}")

    print("\n==================================================")
    print("2. BASE SKILL ORDER VERIFICATION ACROSS ROSTER")
    print("==================================================")

    test_chars = ["V0055", "W0182", "S0132"]
    # Add 10 unrelated playable chars
    other_chars = [cid for cid in char_tbl.keys() if cid not in test_chars and not cid.startswith("SCJ") and len(char_tbl[cid].get("skill1", [])) > 0][:10]
    all_test = test_chars + other_chars

    mismatch_count = 0
    for cid in all_test:
        c_data = char_tbl[cid]
        expected_slots = []
        for i in range(1, 7):
            sinfo = c_data.get(f"skill{i}")
            if sinfo and isinstance(sinfo, list) and len(sinfo) > 0:
                expected_slots.append(str(sinfo[0]))

        gen_skills = web_data.get(cid, {}).get("skills", [])
        gen_order = [s["group_id"] for s in gen_skills[:len(expected_slots)]]

        is_match = (expected_slots == gen_order)
        if not is_match:
            mismatch_count += 1
            print(f"[{cid}] MISMATCH: characterTable slots={expected_slots} vs Generated={gen_order}")
        else:
            print(f"[{cid}] MATCH: slots={expected_slots}")

    print(f"\nTotal characters tested: {len(all_test)}, Mismatches: {mismatch_count}")

    print("\n==================================================")
    print("3. TYPE SEMANTICS & SOURCE TABLES ANALYSIS")
    print("==================================================")
    
    # Audit how many skills exist in characterSkillMap vs characterPassiveSkillMap
    c_gids = set(str(v.get("GroupId")) for v in char_sk.values() if v.get("GroupId"))
    p_gids = set(str(v.get("GroupId")) for v in pass_sk.values() if v.get("GroupId"))
    s_gids = set(str(v.get("GroupId")) for v in sk_map.values() if v.get("GroupId"))

    print(f"Unique GroupIds in characterSkillMap: {len(c_gids)}")
    print(f"Unique GroupIds in characterPassiveSkillMap: {len(p_gids)}")
    print(f"Unique GroupIds in skillMap: {len(s_gids)}")
    print(f"Intersection of characterSkillMap and characterPassiveSkillMap: {len(c_gids & p_gids)}")

    # Check raw Type values in characterSkillMap vs characterPassiveSkillMap
    c_types = set(v.get("Type") for v in char_sk.values() if "Type" in v)
    p_types = set(v.get("Type") for v in pass_sk.values() if "Type" in v)
    s_types = set(v.get("type") for v in sk_map.values() if "type" in v)

    print(f"Raw 'Type' values in characterSkillMap: {c_types}")
    print(f"Raw 'Type' values in characterPassiveSkillMap: {p_types}")
    print(f"Raw 'type' values in skillMap: {s_types}")

if __name__ == "__main__":
    run_investigation()
