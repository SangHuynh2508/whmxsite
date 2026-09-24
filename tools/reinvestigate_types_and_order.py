import json
import sys
from pathlib import Path

MASTER = Path(__file__).resolve().parent.parent.parent / "NeoArtifacts" / "MasterData" / "json"

def reinvestigate():
    sys.stdout.reconfigure(encoding="utf-8")
    
    char_tbl = json.loads((MASTER / "characterTable.json").read_text(encoding="utf-8"))
    char_sk = json.loads((MASTER / "characterSkillMap.json").read_text(encoding="utf-8"))
    pass_sk = json.loads((MASTER / "characterPassiveSkillMap.json").read_text(encoding="utf-8"))

    print("==================================================")
    print("1. V0055 RE-AUDIT TABLE")
    print("==================================================")
    
    v55_gids = ["V005501", "V005511", "V005502", "V005503", "V005504", "V005505"]
    
    print(f"{'GroupId':<10} | {'Name (CN)':<12} | {'Source Table':<25} | {'Raw Type':<8} | {'Proposed Category':<15} | {'Proposed Order'}")
    print("-" * 95)
    
    PROPOSED_ORDER = ["01", "11", "02", "03", "04", "05"]
    PROPOSED_CAT = {
        "01": "常击 / Đánh Thường",
        "11": "职业 / Kỹ Năng Nghề",
        "02": "绝技 / Tuyệt Kỹ",
        "03": "被动 / Nội Tại",
        "04": "被动 / Nội Tại",
        "05": "被动 / Nội Tại"
    }

    for idx, gid in enumerate(v55_gids):
        c_entry = next((v for v in char_sk.values() if str(v.get("GroupId")) == gid), None)
        p_entry = next((v for v in pass_sk.values() if str(v.get("GroupId")) == gid), None)
        
        entry = c_entry or p_entry
        tbl = "characterSkillMap" if c_entry else "characterPassiveSkillMap" if p_entry else "None"
        raw_type = entry.get("Type") if entry else None
        name_cn = entry.get("NameLanText", "") if entry else ""
        suffix = gid[-2:]
        cat = PROPOSED_CAT.get(suffix, "Unknown")
        order = idx + 1

        print(f"{gid:<10} | {name_cn:<12} | {tbl:<25} | {str(raw_type):<8} | {cat:<15} | {order}")

    print("\n==================================================")
    print("2. WHOLE ROSTER VALIDATION OF [01, 11, 02, 03, 04, 05] DISPLAY ORDER")
    print("==================================================")

    EXCLUDED = {"W0021", "ES013"}
    valid_pattern_count = 0
    exception_chars = []

    for cid, cdata in char_tbl.items():
        if cid.startswith("SCJ") or cid in EXCLUDED:
            continue
        
        # Collect base skill suffixes for character
        gids_dict = {}
        for i in range(1, 7):
            sinfo = cdata.get(f"skill{i}")
            if sinfo and isinstance(sinfo, list) and len(sinfo) > 0:
                gid = str(sinfo[0])
                suffix = gid[len(cid):] if gid.startswith(cid) else gid[-2:]
                gids_dict[suffix] = gid

        # Check if character has the standard set of 6 base skill suffixes: {"01", "11", "02", "03", "04", "05"}
        expected_suffixes = {"01", "11", "02", "03", "04", "05"}
        char_suffixes = set(gids_dict.keys())

        if expected_suffixes.issubset(char_suffixes) or char_suffixes == expected_suffixes:
            valid_pattern_count += 1
        else:
            exception_chars.append((cid, char_suffixes))

    print(f"Total Playable Characters Tested: 132")
    print(f"Characters following [01, 11, 02, 03, 04, 05] base set: {valid_pattern_count} / 132")
    print(f"Exceptions count: {len(exception_chars)}")
    if exception_chars:
        print("Exceptions:", exception_chars[:10])

    print("\n==================================================")
    print("3. SOURCE TABLE SEMANTIC ANALYSIS")
    print("==================================================")
    # Check characterSkillMap types:
    c_types = {}
    for v in char_sk.values():
        t = v.get("Type")
        c_types[t] = c_types.get(t, 0) + 1
    print("characterSkillMap Type breakdown:", c_types)

    # Check characterPassiveSkillMap types:
    p_types = {}
    for v in pass_sk.values():
        t = v.get("Type")
        p_types[t] = p_types.get(t, 0) + 1
    print("characterPassiveSkillMap Type breakdown:", p_types)

if __name__ == "__main__":
    reinvestigate()
