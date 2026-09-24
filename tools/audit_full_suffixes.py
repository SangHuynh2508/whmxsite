import json
import sys
from pathlib import Path

MASTER = Path(__file__).resolve().parent.parent.parent / "NeoArtifacts" / "MasterData" / "json"

def audit_full_suffixes():
    sys.stdout.reconfigure(encoding="utf-8")
    
    char_tbl = json.loads((MASTER / "characterTable.json").read_text(encoding="utf-8"))
    char_sk = json.loads((MASTER / "characterSkillMap.json").read_text(encoding="utf-8"))
    pass_sk = json.loads((MASTER / "characterPassiveSkillMap.json").read_text(encoding="utf-8"))
    sk_map = json.loads((MASTER / "skillMap.json").read_text(encoding="utf-8"))

    EXCLUDED = {"W0021", "ES013"}

    # Track mapping of (slot_index, suffix) -> (raw_type, source_table)
    pattern_tracker = {} # (slot_idx, suffix) -> count

    print("=== SUFFIX PATTERN AUDIT ACROSS ALL PLAYABLE CHARACTERS ===")

    for cid, cdata in char_tbl.items():
        if cid.startswith("SCJ") or cid in EXCLUDED:
            continue

        for i in range(1, 7):
            sinfo = cdata.get(f"skill{i}")
            if sinfo and isinstance(sinfo, list) and len(sinfo) > 0:
                gid = str(sinfo[0])
                suffix = gid[len(cid):] if gid.startswith(cid) else gid[-2:]

                c_entry = next((v for v in char_sk.values() if str(v.get("GroupId")) == gid), None)
                p_entry = next((v for v in pass_sk.values() if str(v.get("GroupId")) == gid), None)
                s_entry = next((v for v in sk_map.values() if str(v.get("GroupId")) == gid), None)

                entry = c_entry or p_entry or s_entry
                tbl = "characterSkillMap" if c_entry else "characterPassiveSkillMap" if p_entry else "skillMap"
                raw_type = entry.get("Type", entry.get("type")) if entry else None

                key = (f"skill{i}", suffix, raw_type, tbl)
                pattern_tracker[key] = pattern_tracker.get(key, 0) + 1

    print(f"\n{'Slot':<8} | {'Suffix':<8} | {'Raw Type':<10} | {'Source Table':<25} | {'Count':<6}")
    print("-" * 65)
    for (slot, suffix, rtype, tbl), count in sorted(pattern_tracker.items()):
        print(f"{slot:<8} | {suffix:<8} | {str(rtype):<10} | {tbl:<25} | {count:<6}")

if __name__ == "__main__":
    audit_full_suffixes()
