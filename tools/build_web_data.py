import json
import openpyxl
from pathlib import Path

MASTER = Path(__file__).resolve().parent.parent.parent / "NeoArtifacts" / "MasterData" / "json"
EXCEL_PATH = Path(__file__).resolve().parent.parent / "localization" / "names_vi.xlsx"
PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"
OUT_FILE = PUBLIC_DIR / "data.json"

def load_json(name):
    return json.loads((MASTER / name).read_text(encoding="utf-8"))

def build():
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    
    print("Loading localization...")
    wb = openpyxl.load_workbook(EXCEL_PATH)
    
    def get_sheet(wb, possible_names, default_idx=0):
        for name in possible_names:
            if name in wb.sheetnames:
                return wb[name]
        if len(wb.worksheets) > default_idx:
            return wb.worksheets[default_idx]
        return wb.active

    char_loc = {}
    ws_char = get_sheet(wb, ["characters", "Khán Giả", "Khan Gia"], 0)
    for r in range(2, ws_char.max_row + 1):
        cid = ws_char.cell(r, 1).value
        if cid:
            char_loc[cid] = {
                "name_vi": ws_char.cell(r, 8).value or "",
                "fullname_vi": ws_char.cell(r, 9).value or "",
                "nickname_vi": ws_char.cell(r, 10).value or "",
                "tags_vi": ws_char.cell(r, 11).value or ""
            }
            
    item_loc = {}
    ws_item = get_sheet(wb, ["items", "Vật Phẩm", "Vat Pham"], 1)
    for r in range(2, ws_item.max_row + 1):
        iid = str(ws_item.cell(r, 1).value)
        if iid:
            item_loc[iid] = {
                "name_vi": ws_item.cell(r, 7).value or "",
                "category": ws_item.cell(r, 6).value or "other"
            }
            
    node_loc = {}
    ws_node = get_sheet(wb, ["talent_nodes"], 2)
    for r in range(2, ws_node.max_row + 1):
        ncn = ws_node.cell(r, 1).value
        if ncn:
            node_loc[ncn] = {
                "desc_vi": ws_node.cell(r, 2).value or "",
                "name_vi": ws_node.cell(r, 3).value or ""
            }

    # EXP books that may not be in the excel but exist in game
    EXP_BOOKS = {
        "2101": {"exp": 500,  "name_vi": "Sơ Cấp Xã Hội Học"},
        "2102": {"exp": 1000, "name_vi": "Trung Cấp Xã Hội Học"},
        "2103": {"exp": 2000, "name_vi": "Cao Cấp Xã Hội Học"},
        "2104": {"exp": 4000, "name_vi": "Tiến Cấp Xã Hội Học"},
        "2105": {"exp": 8000, "name_vi": "Thâm Độ Xã Hội Học"},
    }
    # Categories for items not in excel but used in talent costs - override map
    CATEGORY_OVERRIDES = {str(i): "skill_material" for i in range(1011, 1016)}
    CATEGORY_OVERRIDES.update({str(i): "skill_material" for i in range(1001, 1006)})

    print("Processing items...")
    item_map = load_json("itemMap.json")
    items_db = {}
    for iid, data in item_map.items():
        if iid in item_loc or iid == "3" or iid in EXP_BOOKS:
            category = CATEGORY_OVERRIDES.get(iid, item_loc.get(iid, {}).get("category", "other"))
            if iid in EXP_BOOKS:
                category = "exp_book"
            items_db[iid] = {
                "id": iid,
                "name_cn": data.get("nameLanText", ""),
                "name_vi": item_loc.get(iid, {}).get("name_vi", "") or EXP_BOOKS.get(iid, {}).get("name_vi", ""),
                "category": category,
                "exp": EXP_BOOKS[iid]["exp"] if iid in EXP_BOOKS else None,
                "icon": f"assets/items/itemicon_{iid}.png"
            }

    print("Processing EXP curve...")
    level_up = load_json("characterLevelUp.json")
    exp_curve = {}
    for lv, exp in level_up.items():
        exp_curve[int(lv)] = int(exp)

    print("Processing skill maps...")
    char_table_raw = load_json("characterTable.json")
    skill_map_raw = load_json("skillMap.json")
    char_skill_raw = load_json("characterSkillMap.json")
    passive_map_raw = load_json("characterPassiveSkillMap.json")

    import re
    all_skills = {}
    for src in [char_skill_raw, passive_map_raw, skill_map_raw]:
        if isinstance(src, dict):
            for k, v in src.items():
                gid = v.get("GroupId")
                lvl = v.get("Level", v.get("level", 1))
                if gid:
                    key = (str(gid), int(lvl))
                    if key not in all_skills:
                        all_skills[key] = v

    def resolve_desc(skill_obj):
        if not skill_obj: return ""
        raw_desc = skill_obj.get("DescriptionLanText", "")
        attr_list = skill_obj.get("Attr", [])
        attr_dict = {}
        if isinstance(attr_list, list):
            for entry in attr_list:
                if isinstance(entry, list) and len(entry) >= 3:
                    attr_dict[entry[0]] = entry[2]
                elif isinstance(entry, str) and ',' in entry:
                    parts = entry.split(',')
                    if len(parts) >= 3:
                        attr_dict[parts[0]] = parts[2]
        
        def replacer(m):
            pname = m.group(1)
            return str(attr_dict.get(pname, m.group(0)))
        
        clean_desc = re.sub(r'\[([A-Za-z0-9_]+),\d+\]', replacer, raw_desc)
        clean_desc = re.sub(r'\{Buff_[^}]+\}', '', clean_desc)
        return clean_desc.strip()

    print("Processing talent tree...")
    talent_bank = load_json("talentBankMap.json")
    talent_map = load_json("characterTalentMap.json")
    char_talents = {}
    for tid, node in talent_map.items():
        cid = node.get("roleid")
        if not cid:
            # Some nodes might be named CID+idx, e.g. W018201
            # If not provided, we extract from ID
            cid = tid[:-2]
            
        if cid not in char_talents:
            char_talents[cid] = []
            
        cost = []
        if isinstance(node.get("requireCoin"), list):
            for entry in node["requireCoin"]:
                if isinstance(entry, dict) and "id" in entry:
                    cost.append({"id": str(entry["id"]), "count": entry.get("count", 0)})
        if isinstance(node.get("requireItems"), list):
            for entry in node["requireItems"]:
                if isinstance(entry, dict) and "id" in entry:
                    cost.append({"id": str(entry["id"]), "count": entry.get("count", 0)})
                    
        req_level = node.get("requireLevel", 1)
        req_talent = node.get("requireTalent", [])
        if isinstance(req_talent, str):
            req_talent = [req_talent]
            
        bank_id = node.get("talentBankId", "")
        bank_info = talent_bank.get(bank_id, {})
        icon_name = bank_info.get("icon", "")
        desc_cn = bank_info.get("DescriptionLanText", "")
        p1 = bank_info.get("talentParam1")
        p2 = bank_info.get("talentParam2")
        
        name_cn = node.get("namelanText", node.get("name", ""))
        loc_entry = node_loc.get(name_cn, {})
        name_vi = loc_entry.get("name_vi", "") if isinstance(loc_entry, dict) else loc_entry
        desc_vi = loc_entry.get("desc_vi", "") if isinstance(loc_entry, dict) else ""

        # Skill & Passive Icon Mapping
        skill_meta = None
        if isinstance(p1, str) and p1 in ["skill1", "skill2", "skill3", "skill4", "skill5", "skill6"]:
            char_raw = char_table_raw.get(cid, {})
            skill_info = char_raw.get(p1)
            if skill_info and isinstance(skill_info, list) and len(skill_info) > 0:
                gid = str(skill_info[0])
                upgraded_lvl = int(p2) if p2 else 1
                prev_lvl = max(1, upgraded_lvl - 1)
                
                s_up = all_skills.get((gid, upgraded_lvl)) or all_skills.get((gid, 1))
                s_prev = all_skills.get((gid, prev_lvl)) if upgraded_lvl > 1 else None

                if s_up:
                    s_icon_name = s_up.get("SkillIcon", "")
                    skill_meta = {
                        "skill_id": gid,
                        "skill_icon": f"assets/skills/{s_icon_name}.png" if s_icon_name else "",
                        "skill_name_cn": s_up.get("NameLanText", ""),
                        "level": upgraded_lvl,
                        "prev_level": prev_lvl if s_prev else None,
                        "desc_cn": resolve_desc(s_up),
                        "prev_desc_cn": resolve_desc(s_prev) if s_prev else ""
                    }
        
        char_talents[cid].append({
            "id": tid,
            "name_cn": name_cn,
            "name_vi": name_vi,
            "desc_vi": desc_vi,
            "desc_cn": desc_cn,
            "icon": f"assets/talents/{icon_name}.png" if icon_name else "",
            "req_level": req_level,
            "req_talent": req_talent,
            "cost": cost,
            "skill_meta": skill_meta
        })

    print("Processing rank up...")
    rank_up_raw = load_json("characterRankUpMap.json")
    rank_up_rules = {}
    for rare, levels in rank_up_raw.items():
        if not isinstance(levels, dict):
            continue
        rule_list = []
        # Sort levels by star (1 to 6)
        for star in sorted([int(k) for k in levels.keys() if k.isdigit()]):
            sdata = levels[str(star)]
            mat = sdata.get("matItem", {})
            req_coin = sdata.get("coin", 0)
            rule_list.append({
                "star": star,
                "itemId": str(mat.get("id", "")),
                "count": mat.get("count", 0),
                "coin": req_coin
            })
        rank_up_rules[rare] = rule_list

    print("Processing character cards...")
    cards_dir = PUBLIC_DIR / "assets" / "cards"
    char_cards = {}
    if cards_dir.exists():
        for f in cards_dir.glob("*.png"):
            cid = f.name[:5]
            if cid not in char_cards:
                char_cards[cid] = []
            char_cards[cid].append(f.name)
        for cid in char_cards:
            char_cards[cid].sort()

    print("Processing characters...")
    char_table = load_json("characterTable.json")
    chars_db = {}
    
    # Pre-sort talents for each character by id so they are ordered properly
    for cid in char_talents:
        char_talents[cid] = sorted(char_talents[cid], key=lambda x: x["id"])

    EXCLUDED_CHARACTER_IDS = {"W0021", "ES013"}

    for cid, data in char_table.items():
        # Exclude non-playable characters (SCJ costumes, explicit excluded IDs, and characters without talents)
        talents = char_talents.get(cid, [])
        if cid.startswith("SCJ") or cid in EXCLUDED_CHARACTER_IDS or len(talents) == 0:
            continue

        rare = data.get("rare", 3)
        
        chars_db[cid] = {
            "id": cid,
            "name_cn": data.get("namelanText", data.get("name", "")),
            "fullname_cn": data.get("FullnameLanText", ""),
            "name_vi": char_loc.get(cid, {}).get("name_vi", ""),
            "fullname_vi": char_loc.get(cid, {}).get("fullname_vi", ""),
            "nickname_vi": char_loc.get(cid, {}).get("nickname_vi", ""),
            "tags_vi": char_loc.get(cid, {}).get("tags_vi", ""),
            "rare": rare,
            "job": data.get("job", 0),
            "attacktype": data.get("attacktype", 0),
            "icon": f"assets/avatars/{cid}.png",
            "cards": char_cards.get(cid, [f"{cid}001.png"]),
            "talents": talents,
            "rankUpRule": rare
        }
        
    web_data = {
        "characters": chars_db,
        "items": items_db,
        "expCurve": exp_curve,
        "rankUpRules": rank_up_rules
    }
    
    OUT_FILE.write_text(json.dumps(web_data, ensure_ascii=False, separators=(',', ':')), encoding="utf-8")
    print(f"Generated {OUT_FILE} ({len(chars_db)} chars, {len(items_db)} items)")

if __name__ == "__main__":
    build()
