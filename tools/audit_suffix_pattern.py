import json
import sys
from pathlib import Path

MASTER = Path(__file__).resolve().parent.parent.parent / "NeoArtifacts" / "MasterData" / "json"

def audit_suffixes():
    sys.stdout.reconfigure(encoding="utf-8")
    
    char_tbl = json.loads((MASTER / "characterTable.json").read_text(encoding="utf-8"))
    char_sk = json.loads((MASTER / "characterSkillMap.json").read_text(encoding="utf-8"))
    pass_sk = json.loads((MASTER / "characterPassiveSkillMap.json").read_text(encoding="utf-8"))
    sk_map = json.loads((MASTER / "skillMap.json").read_text(encoding="utf-8"))

    EXCLUDED = {"W0021", "ES013"}

    suffix_to_slots = {}
    suffix_to_types = {}
    suffix_to_source_table = {}
    suffix_samples = {}

    all_rows = []

    for cid, cdata in char_tbl.items():
        if cid.startswith("SCJ") or cid in EXCLUDED:
            continue
        
        has_skills = False
        for slot_idx in range(1, 7):
            sinfo = cdata.get(f"skill{slot_idx}")
            if sinfo and isinstance(sinfo, list) and len(sinfo) > 0:
                has_skills = True
                gid = str(sinfo[0])
                
                # Extract suffix
                suffix = gid[len(cid):] if gid.startswith(cid) else gid[-2:]
                
                # Look up source table
                c_entry = next((v for v in char_sk.values() if str(v.get("GroupId")) == gid), None)
                p_entry = next((v for v in pass_sk.values() if str(v.get("GroupId")) == gid), None)
                s_entry = next((v for v in sk_map.values() if str(v.get("GroupId")) == gid), None)

                src_table = "None"
                raw_type = "None"
                name_cn = "Unknown"

                if c_entry:
                    src_table = "characterSkillMap"
                    raw_type = c_entry.get("Type")
                    name_cn = c_entry.get("NameLanText", "")
                elif p_entry:
                    src_table = "characterPassiveSkillMap"
                    raw_type = p_entry.get("Type")
                    name_cn = p_entry.get("NameLanText", "")
                elif s_entry:
                    src_table = "skillMap"
                    raw_type = s_entry.get("type")
                    name_cn = s_entry.get("NameLanText", "")

                slot_name = f"skill{slot_idx}"
                all_rows.append({
                    "cid": cid,
                    "slot": slot_name,
                    "gid": gid,
                    "suffix": suffix,
                    "name_cn": name_cn,
                    "src_table": src_table,
                    "raw_type": raw_type
                })

                if suffix not in suffix_to_slots:
                    suffix_to_slots[suffix] = set()
                    suffix_to_types[suffix] = set()
                    suffix_to_source_table[suffix] = set()
                    suffix_samples[suffix] = []

                suffix_to_slots[suffix].add(slot_name)
                suffix_to_types[suffix].add(raw_type)
                suffix_to_source_table[suffix].add(src_table)
                if len(suffix_samples[suffix]) < 5:
                    suffix_samples[suffix].append((cid, gid, name_cn, raw_type, src_table))

    print("=== 1. AUDIT SAMPLE FOR FIRST 5 PLAYABLE CHARACTERS ===")
    print(f"{'Char ID':<8} | {'Slot':<8} | {'GroupId':<10} | {'Suffix':<8} | {'Name (CN)':<12} | {'Source Table':<24} | {'Raw Type':<8}")
    print("-" * 95)
    for r in all_rows[:30]:
        print(f"{r['cid']:<8} | {r['slot']:<8} | {r['gid']:<10} | {r['suffix']:<8} | {r['name_cn']:<12} | {r['src_table']:<24} | {str(r['raw_type']):<8}")

    print("\n=== 2. UNIQUE SUFFIXES SUMMARY ACROSS ALL PLAYABLE CHARACTERS ===")
    for suffix in sorted(suffix_to_slots.keys()):
        slots = sorted(list(suffix_to_slots[suffix]))
        types = sorted(list(suffix_to_types[suffix]))
        tables = sorted(list(suffix_to_source_table[suffix]))
        print(f"Suffix '{suffix}': Slots={slots}, Raw Types={types}, Source Tables={tables}, Total Instances={sum(1 for r in all_rows if r['suffix']==suffix)}")

    print("\n=== 3. SUFFIX SAMPLES ===")
    for suffix in sorted(suffix_to_slots.keys()):
        print(f"\n--- Suffix '{suffix}' Samples ---")
        for sample in suffix_samples[suffix]:
            print(f"  Char {sample[0]} | GID: {sample[1]} | Name: {sample[2]} | Raw Type: {sample[3]} | Table: {sample[4]}")

if __name__ == "__main__":
    audit_suffixes()
