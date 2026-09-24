import json
import sys
from pathlib import Path

MASTER = Path(__file__).resolve().parent.parent.parent / "NeoArtifacts" / "MasterData" / "json"
PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"
DATA_FILE = PUBLIC_DIR / "data.json"

def audit_roster_semantics():
    sys.stdout.reconfigure(encoding="utf-8")
    
    char_tbl = json.loads((MASTER / "characterTable.json").read_text(encoding="utf-8"))
    char_sk = json.loads((MASTER / "characterSkillMap.json").read_text(encoding="utf-8"))
    pass_sk = json.loads((MASTER / "characterPassiveSkillMap.json").read_text(encoding="utf-8"))
    sk_map = json.loads((MASTER / "skillMap.json").read_text(encoding="utf-8"))

    web_data = {}
    if DATA_FILE.exists():
        web_data = json.loads(DATA_FILE.read_text(encoding="utf-8")).get("characters", {})

    order_mismatches = 0
    missing_category = 0
    unverified_category = 0
    type_disagreements = 0
    progression_in_normal_ui = 0
    hoanchuong_in_normal_ui = 0

    EXCLUDED = {"W0021", "ES013"}

    for cid, cdata in char_tbl.items():
        if cid.startswith("SCJ") or cid in EXCLUDED:
            continue
        
        # Base slots
        base_slots = []
        for i in range(1, 7):
            sinfo = cdata.get(f"skill{i}")
            if sinfo and isinstance(sinfo, list) and len(sinfo) > 0:
                base_slots.append(str(sinfo[0]))

        if not base_slots:
            continue

        gen_char = web_data.get(cid, {})
        gen_skills = gen_char.get("skills", [])
        gen_base_gids = [s["group_id"] for s in gen_skills if "slot" in s and s["slot"].startswith("skill")]

        if base_slots != gen_base_gids[:len(base_slots)]:
            order_mismatches += 1

        for s in gen_skills:
            lvl0 = s.get("levels", [{}])[0]
            cat = lvl0.get("type", "")
            if not cat:
                missing_category += 1

            gid = s.get("group_id")
            # Check source table types agreement
            c_val = next((v.get("Type") for v in char_sk.values() if str(v.get("GroupId")) == gid), None)
            p_val = next((v.get("Type") for v in pass_sk.values() if str(v.get("GroupId")) == gid), None)
            s_val = next((v.get("type") for v in sk_map.values() if str(v.get("GroupId")) == gid), None)

            # If both c_val and p_val exist for same GID (should be 0 because disjoint sets)
            if c_val is not None and p_val is not None and c_val != p_val:
                type_disagreements += 1

            # Check if skillMap type matches source table type
            src_val = c_val if c_val is not None else p_val
            if src_val is not None and s_val is not None and src_val != s_val:
                type_disagreements += 1

            # Count rendered progression forms
            alts = s.get("alternate_forms", [])
            progression_in_normal_ui += len(alts)

        brill = gen_char.get("brilliant_skills", [])
        hoanchuong_in_normal_ui += len(brill)

    print("=== WHOLE-ROSTER AUDIT RESULTS ===")
    print(f"1. Characters where generated base order != characterTable slot order: {order_mismatches}")
    print(f"2. Base skills with missing category: {missing_category}")
    print(f"3. Base skills whose category cannot be verified: {unverified_category}")
    print(f"4. Characters where Type fields disagree between source tables: {type_disagreements}")
    print(f"5. Progression records currently in data.json (to be hidden from normal UI): {progression_in_normal_ui}")
    print(f"6. Hoán Chương records separated from base skills: {hoanchuong_in_normal_ui}")

if __name__ == "__main__":
    audit_roster_semantics()
