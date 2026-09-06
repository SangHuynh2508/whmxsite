import json
import openpyxl
from pathlib import Path

from export_localization_json import export as export_master_localization

MASTER = Path(__file__).resolve().parent.parent.parent / "NeoArtifacts" / "MasterData" / "json"
MASTER_JSON = Path(__file__).resolve().parent.parent / "localization" / "generated_localization.json"
PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"
OUT_FILE = PUBLIC_DIR / "data.json"

def load_json(name):
    return json.loads((MASTER / name).read_text(encoding="utf-8"))

def build():
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    
    print("Loading master localization...")
    gen_loc = export_master_localization()
    
    def safe_str(val):
        if val is None:
            return ""
        return str(val).strip()

    char_loc = gen_loc.get("characters", {})
    item_loc = gen_loc.get("items", {})
    node_loc = gen_loc.get("talents", {})
    skill_loc = gen_loc.get("skills", {})
    profile_loc = gen_loc.get("profiles", {})
    
    # Skin localization map from master
    skin_loc_clean = {}
    for sid, sdata in gen_loc.get("skins", {}).items():
        vi_n = sdata.get("skin_name_vi", "")
        cn_n = sdata.get("skin_name_cn", "")
        if vi_n:
            skin_loc_clean[sid] = vi_n
            if cn_n:
                skin_loc_clean[cn_n] = vi_n

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
        if iid in item_loc or iid == "3" or iid in EXP_BOOKS or iid in ["1005", "1015", "1025", "1035", "1045", "1092", "2105"]:
            category = CATEGORY_OVERRIDES.get(iid, item_loc.get(iid, {}).get("category", "other"))
            if iid in EXP_BOOKS:
                category = "exp_book"
            name_vi_val = item_loc.get(iid, {}).get("name_vi", "") or EXP_BOOKS.get(iid, {}).get("name_vi", "")
            if not name_vi_val:
                if iid == "1092":
                    name_vi_val = "Sở Ngộ Chi Hân"
                else:
                    name_vi_val = data.get("nameLanText", "") or data.get("nameLan", "")
            items_db[iid] = {
                "id": iid,
                "name_cn": data.get("nameLanText", ""),
                "name_vi": name_vi_val,
                "category": category,
                "exp": EXP_BOOKS[iid]["exp"] if iid in EXP_BOOKS else None,
                "icon": f"assets/items/itemicon_{iid}.png"
            }

    print("Processing EXP curve...")
    level_up = load_json("characterLevelUp.json")
    exp_curve = {}
    for lv, exp in level_up.items():
        exp_curve[int(lv)] = int(exp)

    import re, unicodedata

    print("Processing skill maps & role attributes...")
    char_table_raw = load_json("characterTable.json")
    skill_map_raw = load_json("skillMap.json")
    char_skill_raw = load_json("characterSkillMap.json")
    passive_map_raw = load_json("characterPassiveSkillMap.json")
    skins_raw = load_json("characterSkins.json")
    roleattr_raw = load_json("roleattrMap.json")
    char_files_raw = load_json("characterFiles.json")
    char_file_text_raw = load_json("characterFileTextMap.json")
    relics_raw = load_json("historicalRelicsMap.json")
    buff_map_raw = load_json("buffMap.json")
    brilliant_raw = load_json("BrilliantMap.json")
    brilliant_up_raw = load_json("BrilliantUpMap.json")
    talent_bank_raw = load_json("talentBankMap.json")
    actor_raw = load_json("actor.json")

    # Build Brilliant Map skill lookup
    brilliant_skill_gids = set()
    if isinstance(brilliant_raw, dict):
        for b_id, b_val in brilliant_raw.items():
            if isinstance(b_val, dict):
                for sk_id in b_val.get("Buff", []) + b_val.get("Skill1", []) + b_val.get("Skill2", []):
                    if sk_id:
                        brilliant_skill_gids.add(str(sk_id))

    # Build Actor EX skill lookup: (char_id, skill_gid) -> CharactRank
    actor_ex_map = {}
    if isinstance(actor_raw, dict):
        for a_id, a_val in actor_raw.items():
            if isinstance(a_val, dict):
                cid = safe_str(a_val.get("CharacterId"))
                rank = a_val.get("CharactRank", 0)
                for i in range(1, 7):
                    sk_arr = a_val.get(f"Skill{i}")
                    if isinstance(sk_arr, list) and len(sk_arr) > 0:
                        sk_gid = str(sk_arr[0])
                        if "ex" in sk_gid.lower():
                            actor_ex_map[(cid, sk_gid)] = rank

    DEPT_KEYWORDS = {
        "商业部": "Bộ Thương Mại",
        "资料部": "Bộ Tư Liệu",
        "技术部": "Bộ Kỹ Thuật",
        "执行部": "Bộ Hành Chính",
        "航海家": "Liên Minh Hàng Hải",
        "塞纳回廊": "Hành Lang Seine",
        "不列颠": "Học Viện Anh Quốc",
        "方塔": "Liên Minh Tháp Phương",
        "繁星花": "Hiệp Hội Hoa Phồn Tinh"
    }

    STAFF_STATUS_MAP = {
        "已登记": "Đã đăng ký",
        "待登记": "Chờ đăng ký"
    }

    STORE_STATUS_MAP = {
        "安全": "An toàn",
        "观察": "Theo dõi",
        "特勤": "Đặc cần"
    }

    def extract_char_profile(cid):
        finfo = char_files_raw.get(cid, {})
        card_intro = finfo.get("cardIntrolanText", "").strip()

        dept = ""
        for k, v in DEPT_KEYWORDS.items():
            if k in card_intro:
                dept = v
                break

        staff_raw = finfo.get("stafflanText", "").strip()
        staff_status = STAFF_STATUS_MAP.get(staff_raw, staff_raw)

        store_raw = finfo.get("storelanText", "").strip()
        entity_status = STORE_STATUS_MAP.get(store_raw, store_raw)

        record_id = finfo.get("recordID", "").strip()

        reports = []
        basic_file_ids = finfo.get("basicFileID", [])
        if isinstance(basic_file_ids, list):
            for r_id in basic_file_ids:
                r_obj = char_file_text_raw.get(r_id, {})
                title = r_obj.get("titleLanText", "").strip()
                content = r_obj.get("textLanText", "").strip()
                if title or content:
                    reports.append({
                        "id": r_id,
                        "title": title,
                        "content": content
                    })

        relic_entry = relics_raw.get(cid, {})
        relic_info = {}
        if relic_entry:
            relic_info = {
                "relic_name": relic_entry.get("relicslanText", "").strip(),
                "dynasty": relic_entry.get("dynastylanText", "").strip(),
                "museum": relic_entry.get("museumlanText", "").strip(),
                "intro": relic_entry.get("introductionlanText", "").strip()
            }

        return {
            "record_id": record_id,
            "department": dept,
            "staff_status": staff_status,
            "entity_status": entity_status,
            "eval_intro": card_intro,
            "reports": reports,
            "relic_info": relic_info
        }

    def extract_char_stats(cid):
        key = f"{cid}0"
        entry = roleattr_raw.get(key)
        if not entry or not isinstance(entry.get("Attr"), list):
            return None
        
        attrs = {}
        for item in entry["Attr"]:
            if isinstance(item, list) and len(item) > 0 and isinstance(item[0], str):
                parts = item[0].split(",")
                if len(parts) >= 3 and parts[2].lstrip("-").isdigit():
                    attrs[parts[0]] = int(parts[2])

        hp_base = attrs.get("Hp")
        hp_grow = attrs.get("Hp_GROW", 0)
        atk_base = attrs.get("Atk")
        atk_grow = attrs.get("Atk_GROW", 0)
        pdef_base = attrs.get("PhysicDef")
        pdef_grow = attrs.get("PhysicDef_GROW", 0)
        mdef_base = attrs.get("MagicDef")
        mdef_grow = attrs.get("MagicDef_GROW", 0)
        
        return {
            "max_level": 120,
            "hp_base": hp_base,
            "hp_grow": hp_grow,
            "hp_max": (hp_base + hp_grow * 119) if hp_base is not None else None,
            "atk_base": atk_base,
            "atk_grow": atk_grow,
            "atk_max": (atk_base + atk_grow * 119) if atk_base is not None else None,
            "def_physic_base": pdef_base,
            "def_physic_grow": pdef_grow,
            "def_physic_max": (pdef_base + pdef_grow * 119) if pdef_base is not None else None,
            "def_magic_base": mdef_base,
            "def_magic_grow": mdef_grow,
            "def_magic_max": (mdef_base + mdef_grow * 119) if mdef_base is not None else None,
            "speed": attrs.get("Speed"),
            "mov": attrs.get("Mov"),
            "crit": attrs.get("Critical"),
            "crit_dmg": attrs.get("CritDmg"),
            "provenance": {
                "source_table": "roleattrMap.json",
                "source_key": key,
                "formula": "Stat(level) = Base + GROW * (level - 1)"
            }
        }

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
                    elif v.get("Attr") and not all_skills[key].get("Attr"):
                        all_skills[key] = v

    def parse_attr(attr_list):
        attr_dict = {}
        if not isinstance(attr_list, list): return attr_dict
        for item in attr_list:
            raw_str = ""
            if isinstance(item, list) and len(item) > 0:
                raw_str = item[0]
            elif isinstance(item, str):
                raw_str = item
            
            if "," in raw_str:
                parts = raw_str.split(",")
                if len(parts) >= 3:
                    attr_dict[parts[0]] = parts[2:]
                elif len(parts) >= 1:
                    attr_dict[parts[0]] = [parts[-1]]
        return attr_dict

    def apply_proven_semantic_corrections(skill_obj):
        """
        Applies semantic corrections ONLY for cases where full execution semantics have been
        rigorously traced and proven end-to-end:
        description condition -> exact referenced gameplay effect -> exact buff/status ->
        exact runtime condition -> exact branch semantics -> player-facing threshold.
        
        Unsafe generic heuristics that override player-facing descriptions based solely on
        unparsed CheckBuffLayers presence are disabled to prevent false positives.
        """
        if not skill_obj: return skill_obj
        gid = str(skill_obj.get("GroupId") or skill_obj.get("groupId") or "")
        raw_desc = skill_obj.get("DescriptionLanText", "")
        if not raw_desc: return skill_obj

        # S017403ex (光耀古今-超群):
        # Provenance:
        # - Clause: "自身存在不少于 2 层灿金状态时，追击对受击单位造成自身攻击力...额外构素伤害"
        # - Effect3 -> Buff_S0174_3_3ex -> Buff_S0174_3_3_1ex
        # - Condition1: CheckBuffLayers(Buff_S0174_3_2_1, op=4 (>=), threshold=3)
        # - Action gated: Special extra pursuit damage (Effect3Para,1 = 150/225/300% Atk)
        # - Semantics: Pursuit extra damage is directly gated by >= 3 layers of 灿金 (Buff_S0174_3_2_1).
        #   If layers < 3, no extra damage is dealt. Player-facing effective threshold is 3.
        if gid == "S017403ex":
            target_pattern = r'(不少于\s*<color=[^>]+>)\s*2\s*(</color>\s*层\s*<color=[^>]+>\s*灿金\s*</color>)'
            if re.search(target_pattern, raw_desc):
                skill_obj["DescriptionLanText"] = re.sub(target_pattern, r'\g<1>3\g<2>', raw_desc, count=1)
                skill_obj["provenance_corrections"] = [{
                    "skill_id": "S017403ex",
                    "target_buff": "灿金",
                    "target_buff_id": "Buff_S0174_3_2_1",
                    "effect_key": "Effect3",
                    "raw_text_value": 2,
                    "effective_value": 3,
                    "provenance": "Buff_S0174_3_3_1ex Condition1 CheckBuffLayers(Buff_S0174_3_2_1, op=4 (>=), threshold=3)",
                    "correction_reason": "Raw text '不少于2层灿金' conflicts with live engine gate requiring >= 3 layers of 灿金 for extra pursuit damage"
                }]
        return skill_obj

    for key, sk_val in list(all_skills.items()):
        apply_proven_semantic_corrections(sk_val)


    def resolve_buff_tree(buff_key, passed_args, depth=0, visited=None):
        if visited is None: visited = set()
        if buff_key in visited or depth > 5: return []
        visited.add(buff_key)
        
        b_def = buff_map_raw.get(buff_key)
        if not b_def: return []
        
        b_name = b_def.get("NameLanText", "").strip()
        b_desc_raw = b_def.get("DescriptionLanText", "")
        b_attr = parse_attr(b_def.get("Attr", []))
        
        results = []
        if b_name and b_desc_raw:
            name_clean = re.sub(r'<[^>]+>', '', b_name).strip()
            results.append({
                "key": buff_key,
                "name_cn": name_clean,
                "template": b_desc_raw,
                "attr_dict": b_attr,
                "args": passed_args
            })
            
        for key, params in b_attr.items():
            if key.startswith("Effect") and not key.endswith("Para") and not key.endswith("Tips"):
                if not params: continue
                buff_idx = -1
                for i, p in enumerate(params):
                    if str(p).startswith("Buff_"):
                        buff_idx = i
                        break
                if buff_idx != -1:
                    child_key = params[buff_idx]
                    arg_tokens = params[buff_idx + 1:]
                    para_key = f"{key}Para"
                    para_vals = b_attr.get(para_key, [])
                    child_args = []
                    for arg in arg_tokens:
                        if str(arg).startswith("#"):
                            arg_i = int(str(arg)[1:]) - 1
                            if 0 <= arg_i < len(para_vals): child_args.append(para_vals[arg_i])
                            elif 0 <= arg_i < len(passed_args): child_args.append(passed_args[arg_i])
                            else: child_args.append(arg)
                        else:
                            child_args.append(arg)
                    if not child_args: child_args = para_vals
                    results.extend(resolve_buff_tree(child_key, child_args, depth + 1, visited.copy()))
                    
        return results

    def extract_skill_level_mechs(sk):
        if not sk: return []
        raw_desc = sk.get("DescriptionLanText", "")
        s_attr = parse_attr(sk.get("Attr", []))
        mechs = []
        visited_keys = set()
        
        for key, params in s_attr.items():
            if key.startswith("Effect") and not key.endswith("Para") and not key.endswith("Tips"):
                if not params: continue
                buff_idx = -1
                for i, p in enumerate(params):
                    if str(p).startswith("Buff_"):
                        buff_idx = i
                        break
                if buff_idx != -1:
                    b_key = params[buff_idx]
                    arg_tokens = params[buff_idx + 1:]
                    para_key = f"{key}Para"
                    para_vals = s_attr.get(para_key, [])
                    resolved_b_args = []
                    for arg in arg_tokens:
                        if str(arg).startswith("#"):
                            arg_i = int(str(arg)[1:]) - 1
                            if 0 <= arg_i < len(para_vals): resolved_b_args.append(para_vals[arg_i])
                            else: resolved_b_args.append(arg)
                        else:
                            resolved_b_args.append(arg)
                    if not resolved_b_args: resolved_b_args = para_vals
                    
                    sub_m = resolve_buff_tree(b_key, resolved_b_args)
                    for m in sub_m:
                        if m["key"] not in visited_keys:
                            visited_keys.add(m["key"])
                            mechs.append(m)
                        
        buff_matches = re.finditer(r'\{([A-Za-z0-9_]+)\}', raw_desc)
        for match in buff_matches:
            buff_key = match.group(1)
            if not buff_key.startswith("Buff_"): continue
            if buff_key in visited_keys: continue
            
            match_args = []
            for k, v in s_attr.items():
                if k.startswith("Effect") and not k.endswith("Para") and not k.endswith("Tips"):
                    buff_idx = -1
                    for i, p in enumerate(v):
                        if str(p) == buff_key or buff_key in str(p):
                            buff_idx = i
                            break
                    if buff_idx != -1:
                        arg_tokens = v[buff_idx + 1:]
                        para_key = f"{k}Para"
                        para_vals = s_attr.get(para_key, [])
                        for arg in arg_tokens:
                            if str(arg).startswith("#"):
                                arg_i = int(str(arg)[1:]) - 1
                                if 0 <= arg_i < len(para_vals): match_args.append(para_vals[arg_i])
                                else: match_args.append(arg)
                            else:
                                match_args.append(arg)
                        if not match_args: match_args = para_vals
                        break
            sub_m = resolve_buff_tree(buff_key, match_args)
            for m in sub_m:
                if m["key"] not in visited_keys:
                    visited_keys.add(m["key"])
                    mechs.append(m)
                    
        return mechs

    def get_buff_param_val(pname, idx_str, args, b_attr_dict, unit="", closing_tags="", placeholder_to_pos=None):
        if placeholder_to_pos is None: placeholder_to_pos = {}
        pos = placeholder_to_pos.get(idx_str, int(idx_str) - 1)
        val = None
        if pname in ["EffectParam", "EffectPara", "BuffParam"]:
            if 0 <= pos < len(args) and args[pos] != '':
                val = str(args[pos])
            elif 1 <= int(idx_str) <= len(args) and args[int(idx_str) - 1] != '':
                val = str(args[int(idx_str) - 1])
        if val is None and pname in b_attr_dict:
            params = b_attr_dict[pname]
            if 1 <= int(idx_str) <= len(params):
                val = str(params[int(idx_str) - 1])
        if val is None:
            if "Timer" in b_attr_dict:
                t_params = b_attr_dict["Timer"]
                for tp in t_params:
                    if str(tp).startswith("#"):
                        arg_i = int(str(tp)[1:]) - 1
                        if 0 <= arg_i < len(args) and args[arg_i] != '':
                            val = str(args[arg_i])
                            break
                    elif str(tp).isdigit():
                        val = str(tp)
                        break
        if val is None:
            for eff_k in ["Effect1", "Effect2", "Effect3", "Effect4", "Effect5"]:
                if eff_k in b_attr_dict:
                    eff_params = b_attr_dict[eff_k]
                    for ep in eff_params:
                        if str(ep).startswith("#"):
                            arg_i = int(str(ep)[1:]) - 1
                            if 0 <= arg_i < len(args) and args[arg_i] != '':
                                val = str(args[arg_i])
                                break
                        elif str(ep).isdigit() and ep not in ["100", "99", "1", "0"]:
                            val = str(ep)
                            break
                    if val is not None: break
        if val is None:
            for para_k in ["Effect1Para", "Effect2Para", "Effect3Para", "EffectPara", "EffectParam"]:
                if para_k in b_attr_dict and b_attr_dict[para_k]:
                    val = str(b_attr_dict[para_k][0])
                    break
        if val is None:
            if unit == "%":
                val = "10"
            elif unit in ["回合", "层", "格", "次", "点", "倍"]:
                val = "1"
        return val

    def merge_mechs_across_levels(mechs_by_lvl):
        if not mechs_by_lvl: return []
        mech_groups = {}
        for l_idx, mechs in enumerate(mechs_by_lvl):
            for m in mechs:
                key = m["key"]
                if key not in mech_groups: mech_groups[key] = []
                mech_groups[key].append((l_idx, m))
                
        merged_list = []
        pattern = r'(\[([A-Za-z0-9_]+),(?:(\d+))?\])(\s*(?:<\/span>|<\/color>)*\s*)(%|倍|格|回合|点|层|次)?'
        
        for key, entries in mech_groups.items():
            first_m = entries[0][1]
            name_cn = first_m["name_cn"]
            template = first_m["template"]
            b_attr_dict = first_m["attr_dict"]
            
            args_per_lvl = [m["args"] for _, m in entries]
            same_template = all(m["template"] == template for _, m in entries)
            
            param_matches = re.findall(r'\[(?:EffectParam|EffectPara|BuffParam),(?:(\d+))?\]', template)
            placeholder_to_pos = {}
            for pos, idx_str in enumerate(param_matches):
                if idx_str not in placeholder_to_pos:
                    placeholder_to_pos[idx_str] = pos
                    
            def replacer_for_lvl(args):
                def single_replacer(m):
                    full_p = m.group(1)
                    pname = m.group(2)
                    idx_str = m.group(3) or "1"
                    closing_tags = m.group(4) or ""
                    unit = m.group(5) or ""
                    val = get_buff_param_val(pname, idx_str, args, b_attr_dict, unit, closing_tags, placeholder_to_pos)
                    if val is None: val = full_p
                    return f"{val}{unit}{closing_tags}"
                return single_replacer

            if same_template and len(entries) > 1:
                def multi_replacer(m):
                    full_p = m.group(1)
                    pname = m.group(2)
                    idx_str = m.group(3) or "1"
                    closing_tags = m.group(4) or ""
                    unit = m.group(5) or ""
                    
                    vals = []
                    for args in args_per_lvl:
                        val = get_buff_param_val(pname, idx_str, args, b_attr_dict, unit, closing_tags, placeholder_to_pos)
                        if val is None: val = full_p
                        vals.append(val)
                        
                    if len(set(vals)) == 1:
                        return f"{vals[0]}{unit}{closing_tags}"
                    else:
                        if unit == "%":
                            formatted = [f"{v}%" for v in vals]
                            return f"{'/'.join(formatted)}{closing_tags}"
                        elif unit:
                            return f"{'/'.join(vals)}{unit}{closing_tags}"
                        else:
                            return f"{'/'.join(vals)}{closing_tags}"
                        
                clean_desc = re.sub(pattern, multi_replacer, template)
                clean_desc = re.sub(r'\{Buff_[^}]+\}', '', clean_desc).strip()
                merged_list.append({
                    "key": key,
                    "name_cn": name_cn,
                    "desc_cn": clean_desc
                })
            elif len(entries) == 1:
                clean_desc = re.sub(pattern, replacer_for_lvl(args_per_lvl[0]), template)
                clean_desc = re.sub(r'\{Buff_[^}]+\}', '', clean_desc).strip()
                merged_list.append({
                    "key": key,
                    "name_cn": name_cn,
                    "desc_cn": clean_desc
                })
            else:
                parts = []
                for l_idx, m in entries:
                    parts.append(f"Lv.{l_idx + 1}: {m['template']}")
                merged_list.append({
                    "key": key,
                    "name_cn": name_cn,
                    "desc_cn": "\n".join(parts)
                })
                
        return merged_list

    def resolve_desc(skill_obj):
        if not skill_obj: return "", []
        raw_desc = skill_obj.get("DescriptionLanText", "")
        attr_dict = parse_attr(skill_obj.get("Attr", []))
        mechanics = merge_mechs_across_levels([extract_skill_level_mechs(skill_obj)])
        
        def global_replacer(m):
            pname = m.group(1)
            idx = int(m.group(2)) if m.group(2) else 1
            if pname in attr_dict:
                params = attr_dict[pname]
                if 1 <= idx <= len(params):
                    return str(params[idx - 1])
            full_match = f"{pname},{idx}" if m.group(2) else pname
            if full_match in attr_dict:
                return str(attr_dict[full_match][0])
            if pname.endswith("Para"):
                if pname in attr_dict:
                    params = attr_dict[pname]
                    if 1 <= idx <= len(params):
                        return str(params[idx - 1])
            return m.group(0)

        clean_desc = re.sub(r'\[([A-Za-z0-9_]+),(?:(\d+))?\]', global_replacer, raw_desc)
        clean_desc = re.sub(r'\{Buff_[^}]+\}', '', clean_desc)
        return clean_desc.strip(), mechanics

    def resolve_multi_level_desc(gid):
        lvls = []
        lvl = 1
        while True:
            sk = all_skills.get((gid, lvl))
            if not sk: break
            lvls.append(sk)
            lvl += 1

        if not lvls: return "", [], True

        mechs_by_lvl = [extract_skill_level_mechs(sk) for sk in lvls]
        multi_mechs = merge_mechs_across_levels(mechs_by_lvl)

        if len(lvls) == 1:
            d_clean, _ = resolve_desc(lvls[0])
            return d_clean, multi_mechs, True

        raw_descs = [sk.get("DescriptionLanText", "") for sk in lvls]
        is_template_same = len(set(raw_descs)) == 1

        if is_template_same:
            raw_template = raw_descs[0]
            attr_dicts = [parse_attr(sk.get("Attr", [])) for sk in lvls]

            def get_param_val(pname, idx, attr_dict):
                if pname in attr_dict:
                    params = attr_dict[pname]
                    if 1 <= idx <= len(params): return str(params[idx - 1])
                full_match = f"{pname},{idx}"
                if full_match in attr_dict: return str(attr_dict[full_match][0])
                if pname.endswith("Para"):
                    if pname in attr_dict:
                        params = attr_dict[pname]
                        if 1 <= idx <= len(params): return str(params[idx - 1])
                return None

            pattern = r'(\[([A-Za-z0-9_]+),(?:(\d+))?\])(\s*(?:<\/span>|<\/color>)*\s*)(%|倍|格|回合|点|层|次)?'

            def multi_replacer(m):
                full_p = m.group(1)
                pname = m.group(2)
                idx = int(m.group(3)) if m.group(3) else 1
                closing_tags = m.group(4) or ""
                unit = m.group(5) or ""

                vals = []
                for ad in attr_dicts:
                    v = get_param_val(pname, idx, ad)
                    if v is not None:
                        vals.append(v)
                    else:
                        vals.append(full_p)

                if len(set(vals)) == 1:
                    return f"{vals[0]}{unit}{closing_tags}"
                else:
                    if unit == "%":
                        formatted_items = [f"{v}%" for v in vals]
                        return f"{'/'.join(formatted_items)}{closing_tags}"
                    elif unit:
                        return f"{'/'.join(vals)}{unit}{closing_tags}"
                    else:
                        return f"{'/'.join(vals)}{closing_tags}"

            clean_desc = re.sub(pattern, multi_replacer, raw_template)
            clean_desc = re.sub(r'\{Buff_[^}]+\}', '', clean_desc)
            return clean_desc.strip(), multi_mechs, True
        else:
            parts = []
            for l_idx, sk in enumerate(lvls, 1):
                d_clean, _ = resolve_desc(sk)
                parts.append(f"Lv.{l_idx}: {d_clean}")
            return "\n".join(parts), multi_mechs, False

    print("Processing talent tree...")
    talent_bank = load_json("talentBankMap.json")
    talent_map = load_json("characterTalentMap.json")
    char_talents = {}
    for tid, node in talent_map.items():
        cid = node.get("roleid")
        if not cid:
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
                        "desc_cn": resolve_desc(s_up)[0],
                        "prev_desc_cn": resolve_desc(s_prev)[0] if s_prev else ""
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
    cards_dir = PUBLIC_DIR / "assets" / "characters" / "cards"
    char_cards = {}
    if cards_dir.exists():
        for f in cards_dir.glob("*.png"):
            cid = f.name[:5]
            if cid not in char_cards:
                char_cards[cid] = []
            char_cards[cid].append(f.name)
        for cid in char_cards:
            char_cards[cid].sort()

    print("Processing character drawings & skins...")
    drawings_dir = PUBLIC_DIR / "assets" / "characters" / "drawings"
    drawings_dir_alt = PUBLIC_DIR / "assets" / "drawings"
    painting_dir = MASTER.parent / "Painting"
    char_skins_processed = {}
    for cid, cskins in skins_raw.items():
        if not isinstance(cskins, list): continue
        valid_skins = []
        for sk in cskins:
            sid = sk.get("skinID", "")
            has_img = False
            ext = "webp"
            if (drawings_dir / f"{sid}.webp").exists() or (drawings_dir_alt / f"{sid}.webp").exists():
                has_img = True
                ext = "webp"
            elif (drawings_dir / f"{sid}.png").exists() or (drawings_dir_alt / f"{sid}.png").exists() or (painting_dir / f"{sid}.png").exists():
                has_img = True
                ext = "png"
            if sid and has_img:
                valid_skins.append({
                    "skinID": sid,
                    "name_cn": sk.get("skinNamelanText", sk.get("skinName", "")),
                    "name_vi": skin_loc_clean.get(sid, skin_loc_clean.get(sk.get("skinNamelanText", ""), ("Ảnh Gốc" if sk.get("bIsBaseSkin") else sk.get("skinNamelanText", "Trang Phục")))),
                    "is_base": bool(sk.get("bIsBaseSkin")),
                    "description_cn": sk.get("getdescriptionLanText", ""),
                    "image": f"assets/characters/drawings/{sid}.{ext}"
                })
        if valid_skins:
            char_skins_processed[cid] = valid_skins

    # VERIFIED GROUPID SUFFIX & PLAYER-FACING DISPLAY MAPPING:
    # 01 -> 常击 -> Đánh Thường (Type 1)
    # 11 -> 职业 -> Kỹ Năng Nghề (Type 2)
    # 02 -> 绝技 -> Tuyệt Kỹ (Type 3)
    # 03 -> 被动1 -> Nội Tại 1 (Type 4)
    # 04 -> 被动2 -> Nội Tại 2 (Type 5)
    # 05 -> 被动3 -> Nội Tại 3 (Type 6)
    SUFFIX_CATEGORY_MAP = {
        "01": ("Đánh Thường", 1),
        "11": ("Kỹ Năng Nghề", 2),
        "02": ("Tuyệt Kỹ", 3),
        "03": ("Nội Tại 1", 4),
        "04": ("Nội Tại 2", 5),
        "05": ("Nội Tại 3", 6)
    }

    SUFFIX_SLOT_LABEL_MAP = {
        "01": "Đánh Thường",
        "11": "Kỹ Năng Nghề",
        "02": "Tuyệt Kỹ",
        "03": "Nội Tại 1",
        "04": "Nội Tại 2",
        "05": "Nội Tại 3"
    }

    DISPLAY_ORDER_MAP = {
        "01": 1,
        "11": 2,
        "02": 3,
        "03": 4,
        "04": 5,
        "05": 6
    }

    TYPE_MAP = {
        1: "Đánh Thường",
        2: "Kỹ Năng Nghề",
        3: "Tuyệt Kỹ",
        4: "Nội Tại",
        5: "Nội Tại",
        6: "Nội Tại",
        11: "Nội Tại"
    }

    def resolve_skill_category(gid, raw_stype):
        suffix = gid[-2:] if len(gid) >= 2 else ""
        if suffix in SUFFIX_CATEGORY_MAP:
            return SUFFIX_CATEGORY_MAP[suffix]
        return (TYPE_MAP.get(raw_stype, "Kỹ Năng"), raw_stype)

    def resolve_skill_icon(gid, raw_icon_name):
        SKILLS_DIR = PUBLIC_DIR / "assets" / "skills"
        if raw_icon_name and (SKILLS_DIR / f"{raw_icon_name}.png").exists():
            return f"assets/skills/{raw_icon_name}.png"
        if (SKILLS_DIR / f"skillicon_{gid}.png").exists():
            return f"assets/skills/skillicon_{gid}.png"
        base_gid = gid.lower().replace("ex", "").upper()
        if (SKILLS_DIR / f"skillicon_{base_gid}.png").exists():
            return f"assets/skills/skillicon_{base_gid}.png"
        return ""

    STAT_NAME_VI = {
        'Atk_FIX': 'Công', 'Atk_PERCENT': 'Công', 'Hp_FIX': 'HP', 'Hp_PERCENT': 'HP',
        'PhysicDef_FIX': 'Phòng Thủ Vật Lý', 'PhysicDef_PERCENT': 'Phòng Thủ Vật Lý',
        'MagicDef_FIX': 'Phòng Thủ Cấu Thuật', 'MagicDef_PERCENT': 'Phòng Thủ Cấu Thuật',
        'Speed_FIX': 'Tốc Độ', 'Mov_FIX': 'Di Chuyển', 'Critical_FIX': 'Tỷ Lệ Bạo Kích',
        'Block_FIX': 'Tỷ Lệ Đỡ Đòn', 'MissRate_FIX': 'Tỷ Lệ Né Tránh',
        'HealIncrease_FIX': 'Tăng Cường Trị Liệu', 'HealedIncrease_FIX': 'Hiệu Quả Trị Liệu Nhận Được',
        'AllDmgIncrease_FIX': 'Tăng Sát Thương', 'AllDmgReductionIncrease_FIX': 'Giảm Sát Thương Nhận Vào',
        'PhysicalDmgIncrease_FIX': 'Tăng Sát Thương Vật Lý', 'MagicDmgIncrease_FIX': 'Tăng Sát Thương Cấu Thuật',
        'PhyDmgReductionIncrease_FIX': 'Giảm Sát Thương Vật Lý Nhận Vào', 'MagDmgReductionIncrease_FIX': 'Giảm Sát Thương Cấu Thuật Nhận Vào',
        'CommonAttackDmgIncrease_FIX': 'Tăng Sát Thương Đánh Thường', 'SkillDmgIncrease_FIX': 'Tăng Sát Thương Kỹ Năng',
        'AlertAttackDmgIncrease_FIX': 'Tăng Sát Thương Cảnh Giới', 'AlertAttackExtraBullet_FIX': 'Đạn Cảnh Giới Bổ Sung',
        'DotDamageIncrease_FIX': 'Tăng Sát Thương Theo Thời Gian', 'DoubleHitDmgIncrease_FIX': 'Tăng Sát Thương Liên Kích',
        'FightBackDmgIncrease_FIX': 'Tăng Sát Thương Phản Kích', 'BeCommonAttackedDmgReduce_FIX': 'Giảm Sát Thương Đánh Thường Nhận Vào',
        'BeSkilledDmgReduce_FIX': 'Giảm Sát Thương Kỹ Năng Nhận Vào', 'DefPenetrationRate_FIX': 'Xuyên Phòng Thủ',
        'AllDefPenetrationRate_FIX': 'Xuyên Toàn Bộ Phòng Thủ', 'PenetrationRate_FIX': 'Tỷ Lệ Xuyên Giáp',
        'HurtHealRate_FIX': 'Tỷ Lệ Hút Máu', 'EnergyRecoveryCycle_FIX': 'Hồi Phục Năng Lượng',
        'SnipeResetRate_FIX': 'Tỷ Lệ Bắn Tỉa Tái Lập'
    }

    PERCENT_KEYS = {
        'Atk_PERCENT', 'Hp_PERCENT', 'PhysicDef_PERCENT', 'MagicDef_PERCENT',
        'HurtHealRate_FIX', 'DoubleHitDmgIncrease_FIX', 'SkillDmgIncrease_FIX',
        'CommonAttackDmgIncrease_FIX', 'SnipeResetRate_FIX', 'Critical_FIX',
        'AllDefPenetrationRate_FIX', 'AllDmgIncrease_FIX', 'PhysicalDmgIncrease_FIX',
        'FightBackDmgIncrease_FIX', 'MagDmgReductionIncrease_FIX', 'BeSkilledDmgReduce_FIX',
        'MissRate_FIX', 'AllDmgReductionIncrease_FIX', 'PhyDmgReductionIncrease_FIX',
        'Block_FIX', 'HealedIncrease_FIX', 'AlertAttackDmgIncrease_FIX',
        'HealIncrease_FIX', 'MagicDmgIncrease_FIX', 'PenetrationRate_FIX',
        'DotDamageIncrease_FIX', 'DefPenetrationRate_FIX', 'BeCommonAttackedDmgReduce_FIX'
    }

    def extract_raw_attrs(entry):
        items = []
        if not entry:
            return items
        for field in ['starUpAttr', 'starUpAttr2']:
            vals = entry.get(field)
            if isinstance(vals, list):
                for v in vals:
                    if isinstance(v, str) and v.strip(): items.append(v.strip())
            elif isinstance(vals, str) and vals.strip():
                items.append(vals.strip())
        if not items and isinstance(entry.get('Attr'), list):
            for it in entry['Attr']:
                if isinstance(it, list) and len(it) > 0 and isinstance(it[0], str):
                    raw = it[0]
                    m = re.search(r'\[starUpAttr2?,string,\[(.*?)\]\]', raw)
                    if m: items.append(m.group(1))
        return items


    def extract_char_zhizhi(cid):
        zz_list = []
        for star in range(1, 7):
            entry = roleattr_raw.get(f"{cid}{star}")
            raw_items = extract_raw_attrs(entry)
            
            row = {
                "star": star,
                "type": "stat_bonus",
                "bonuses": [],
                "skill_upgrade": None
            }

            has_skill_up = False
            for item in raw_items:
                if item.startswith("SkillUP,"):
                    has_skill_up = True
                    base_id = item.split(",")[1]
                    ex_id = base_id + "ex"
                    
                    base_sk_val = all_skills.get((base_id, 1)) or all_skills.get((base_id, 0))
                    ex_sk_val = all_skills.get((ex_id, 1)) or all_skills.get((ex_id, 0))
                    
                    base_name_vi = skill_loc.get(base_id, {}).get("name_vi", "")
                    base_name_cn = base_sk_val.get("NameLanText", "") if base_sk_val else ""
                    base_type_id = int(base_sk_val.get("Type", 1)) if base_sk_val and str(base_sk_val.get("Type", "")).isdigit() else 1
                    base_cat_label, _ = resolve_skill_category(base_id, base_type_id)
                    base_raw_icon = safe_str(base_sk_val.get("SkillIcon")) if base_sk_val else ""
                    base_icon = resolve_skill_icon(base_id, base_raw_icon)
                    
                    ex_desc_clean, ex_mechanics, is_merged = resolve_multi_level_desc(ex_id)
                    ex_name_vi = skill_loc.get(ex_id, {}).get("name_vi", "")
                    ex_name_cn = ex_sk_val.get("NameLanText", "") if ex_sk_val else ""
                    ex_raw_icon = safe_str(ex_sk_val.get("SkillIcon")) if ex_sk_val else ""
                    ex_icon = resolve_skill_icon(ex_id, ex_raw_icon) or base_icon
                    
                    row["type"] = "skill_upgrade"
                    row["skill_upgrade"] = {
                        "base_skill_id": base_id,
                        "enhanced_skill_id": ex_id,
                        "base_skill": {
                            "name_vi": base_name_vi,
                            "name_cn": base_name_cn,
                            "type": base_cat_label,
                            "icon": base_icon
                        },
                        "enhanced_skill": {
                            "group_id": ex_id,
                            "name_vi": ex_name_vi,
                            "name_cn": ex_name_cn,
                            "desc_cn": ex_desc_clean,
                            "desc_vi": skill_loc.get(ex_id, {}).get("desc_vi", ""),
                            "mechanics": ex_mechanics,
                            "is_merged": is_merged,
                            "icon": ex_icon
                        }
                    }
                    break

            if not has_skill_up:
                for item in raw_items:
                    parts = item.split(",")
                    skey = parts[0]
                    val_num = parts[1] if len(parts) > 1 else ""
                    
                    label_vi = STAT_NAME_VI.get(skey, skey)
                    is_percent = skey in PERCENT_KEYS
                    val_formatted = f"+{val_num}%" if is_percent else f"+{val_num}"
                    
                    row["bonuses"].append({
                        "raw_key": skey,
                        "raw_val": val_num,
                        "label_vi": label_vi,
                        "val_formatted": val_formatted,
                        "is_percent": is_percent
                    })
                    
            zz_list.append(row)
            
        return zz_list

    def extract_char_brilliant_info(cid):
        if not isinstance(brilliant_raw, dict): return None
        matches = []
        for b_id, b_val in brilliant_raw.items():
            if b_id.startswith(cid) and isinstance(b_val, dict):
                matches.append((b_id, b_val))
        if not matches: return None
        matches.sort(key=lambda x: x[0])
        b_id, entry = matches[-1]

        name_cn = safe_str(entry.get("IconNameLanText") or entry.get("IconNameLan") or entry.get("IconName"))
        icon_name = safe_str(entry.get("Icon")) or f"brilliant_{cid}"
        icon_asset = f"assets/huanzhang/{icon_name}.png"
        info_cn = safe_str(entry.get("IconInfoLanText") or entry.get("IconInfoLan") or entry.get("IconInfo"))
        buff_show_cn = safe_str(entry.get("BuffShowLanText") or entry.get("BuffShowLan") or entry.get("BuffShow"))

        stat_labels_vi = {
            "Hp_FIX": "Sinh Mệnh (HP)",
            "Atk_FIX": "Tấn Công (ATK)",
            "PhysicDef_PERCENT": "Phòng Thủ Vật Lý",
            "MagicDef_PERCENT": "Phòng Thủ Cấu Thuật",
            "Speed_FIX": "Tốc Độ (SPD)",
            "Mov": "Di Chuyển (MOV)",
            "Crit_PERCENT": "Tỷ Lệ Bạo Kích",
            "CritDmg_PERCENT": "Sát Thương Bạo Kích"
        }

        property_up = []
        prop_stages = entry.get("PropertyUp", [])
        if prop_stages and isinstance(prop_stages, list):
            stat_keys = []
            stage_maps = []
            for stage in prop_stages:
                s_map = {}
                if isinstance(stage, list):
                    for t_id in stage:
                        tb = talent_bank_raw.get(t_id, {})
                        params = tb.get("talentParam1", [])
                        if params and isinstance(params, list) and len(params) > 0:
                            parts = str(params[0]).split(",")
                            if len(parts) >= 2:
                                k = parts[0]
                                try:
                                    v = float(parts[1]) if '.' in parts[1] else int(parts[1])
                                    s_map[k] = v
                                    if k not in stat_keys:
                                        stat_keys.append(k)
                                except ValueError:
                                    pass
                stage_maps.append(s_map)

            for k in stat_keys:
                is_percent = "PERCENT" in k
                label_vi = stat_labels_vi.get(k, k.replace("_FIX", "").replace("_PERCENT", ""))
                vals = []
                for s_map in stage_maps:
                    v = s_map.get(k, 0)
                    formatted = f"+{v}%" if is_percent else f"+{v}"
                    vals.append(formatted)
                property_up.append({
                    "raw_key": k,
                    "label_vi": label_vi,
                    "values": vals,
                    "is_percent": is_percent
                })

        # Collect deduplicated material item IDs used for upgrading this Hoán Chương
        raw_mats = []
        for cost_field in ["ItemCost1", "ItemCost2"]:
            cost_list = entry.get(cost_field) or []
            if isinstance(cost_list, list):
                for item in cost_list:
                    if isinstance(item, dict) and item.get("id"):
                        raw_mats.append(str(item["id"]))

        bu_entry = brilliant_up_raw.get(b_id) if isinstance(brilliant_up_raw, dict) else None
        if bu_entry and isinstance(bu_entry, dict):
            for res_item in (bu_entry.get("Res") or []):
                if isinstance(res_item, dict) and res_item.get("id"):
                    raw_mats.append(str(res_item["id"]))

        materials = []
        for m_id in raw_mats:
            if m_id != "3" and m_id not in materials:
                materials.append(m_id)

        return {
            "id": b_id,
            "name_cn": name_cn,
            "icon": icon_asset,
            "info_cn": info_cn,
            "buff_show_cn": buff_show_cn,
            "property_up": property_up,
            "materials": materials
        }

    print("Processing character skills...")
    char_skills = {}
    char_brilliant_skills = {}

    for cid, data in char_table_raw.items():
        base_slot_gids = set()
        expected_gids = set()
        
        # 1. Base slot skills explicitly listed (skill1..skill6)
        for i in range(1, 7):
            sinfo = data.get(f"skill{i}")
            if sinfo and isinstance(sinfo, list) and len(sinfo) > 0:
                sgid = str(sinfo[0])
                base_slot_gids.add(sgid)
                expected_gids.add(sgid)
                
        # 2. Non-concealed mapped skills
        for src in [char_skill_raw, passive_map_raw]:
            if not isinstance(src, dict): continue
            for k, v in src.items():
                if str(v.get("HeroId")) == cid and not v.get("IsConceal", False):
                    expected_gids.add(str(v.get("GroupId")))
                    
        # Collect level data for all expected gids
        raw_skills_dict = {}
        for gid in expected_gids:
            levels = []
            seen_levels = set()
            for src in [char_skill_raw, passive_map_raw, skill_map_raw]:
                if not isinstance(src, dict): continue
                for sk_key, sk_val in src.items():
                    if str(sk_val.get("GroupId")) == gid:
                        lvl = int(sk_val.get("Level", sk_val.get("level", 1)))
                        if lvl in seen_levels: continue
                        seen_levels.add(lvl)
                        
                        sk_id = f"{gid}_{lvl}"
                        sk_entry = skill_loc.get(sk_id, {})
                        stype = int(sk_val.get("Type", sk_val.get("type", 1))) if str(sk_val.get("Type", sk_val.get("type", ""))).isdigit() else 1
                        cat_label, cat_type_id = resolve_skill_category(gid, stype)
                        raw_icon = safe_str(sk_val.get("SkillIcon"))
                        resolved_icon = resolve_skill_icon(gid, raw_icon)
                        attr_d = parse_attr(sk_val.get("Attr", []))
                        
                        def get_attr_int(key, default=0):
                            vals = attr_d.get(key, [])
                            if vals and str(vals[0]).isdigit(): return int(vals[0])
                            return default
                        
                        def get_attr_str(key, default=""):
                            vals = attr_d.get(key, [])
                            return str(vals[0]) if vals else default

                        lvl_obj = {
                            "level": lvl,
                            "name_cn": safe_str(sk_val.get("NameLanText")),
                            "name_vi": safe_str(sk_entry.get("name_vi")),
                            "desc_vi": safe_str(sk_entry.get("desc_vi")),
                            "desc_cn": resolve_desc(sk_val)[0],
                            "mechanics": resolve_desc(sk_val)[1],
                            "desc_raw": safe_str(sk_val.get("DescriptionLanText")),
                            "icon": resolved_icon,
                            "type_id": cat_type_id,
                            "type": cat_label,
                            "select_range": get_attr_str("SelectRange", safe_str(sk_val.get("SelectRange"))),
                            "select_type": get_attr_str("SelectType", ""),
                            "select_range_type": get_attr_str("SelectRangeType", ""),
                            "effect_range": get_attr_int("EffectRange", sk_val.get("EffectRange", 0)),
                            "effect_range_type": get_attr_str("EffectRangeType", safe_str(sk_val.get("EffectRangeType"))),
                            "cooldown_rounds": get_attr_int("CoolDownRounds", 0),
                            "cost_energy": get_attr_int("CostEnergy", 0),
                            "recover_energy": get_attr_int("RecoverEnergy", 0),
                            "skill_tag_text": safe_str(sk_val.get("SkillTagText"))
                        }
                        if sk_val.get("provenance_corrections"):
                            lvl_obj["provenance_corrections"] = sk_val["provenance_corrections"]
                        levels.append(lvl_obj)

            levels.sort(key=lambda x: x["level"])
            if levels:
                multi_desc_cn, multi_mechs, _ = resolve_multi_level_desc(gid)
                for lvl_item in levels:
                    lvl_item["desc_cn"] = multi_desc_cn
                    lvl_item["mechanics"] = multi_mechs

                raw_skills_dict[gid] = {
                    "group_id": gid,
                    "max_level": len(levels),
                    "levels": levels,
                    "alternate_forms": [],
                    "summon_skills": []
                }
                
        # Structural classification and linking
        independent_skills = []
        alternate_forms_map = {} # parent_id -> list of skills
        summon_skills_map = {} # parent_id -> list of skills
        brilliant_skills_list = []
        
        for gid, sk in raw_skills_dict.items():
            name = sk["levels"][0]["name_cn"]
            stype = sk["levels"][0]["type_id"]
            
            # Check 1: Hoán Chương (Brilliant) skills
            if gid in brilliant_skill_gids:
                sk_copy = sk.copy()
                sk_copy["provenance"] = {
                    "relationship_type": "hoan_chuong",
                    "evidence": ["BrilliantMap.json reference"]
                }
                brilliant_skills_list.append(sk_copy)
                continue

            category = "Base"
            parent_id = None
            
            # Check 2: EX variants (inferred progression variants)
            if "ex" in gid.lower() or "-超群" in name:
                category = "EX"
                parent_id = gid.lower().replace("ex", "").upper()
            # Check 3: Summon / NPC skills
            elif "npc" in gid.lower() or "summon" in gid.lower():
                category = "Summon"
                idx = gid.lower().find("npc") if "npc" in gid.lower() else gid.lower().find("summon")
                parent_id = gid[:idx].upper()
            elif gid.endswith("A") or gid.endswith("B"):
                category = "Alternate"
                parent_id = gid[:-1]
            elif gid.endswith("51") and str(stype) == "1":
                category = "Alternate"
                parent_id = gid[:-2] + "01"
            
            if category == "EX" and parent_id:
                # Add internal provenance
                sk["provenance"] = {
                    "relationship_type": "inferred_progression_variant",
                    "evidence": [
                        "suffix match",
                        "actor.json reference" if (cid, gid) in actor_ex_map else "suffix match",
                        f"CharactRank {actor_ex_map.get((cid, gid), 6)}"
                    ]
                }
                if parent_id in raw_skills_dict:
                    if parent_id not in alternate_forms_map: alternate_forms_map[parent_id] = []
                    alternate_forms_map[parent_id].append(sk)
                else:
                    # Unresolved EX variant -> keep as independent
                    independent_skills.append(sk)
            elif category in ["Summon", "Alternate"] and parent_id:
                sk["provenance"] = {
                    "relationship_type": category.lower(),
                    "evidence": [f"{category} suffix match"]
                }
                if parent_id in raw_skills_dict:
                    if category == "Summon":
                        if parent_id not in summon_skills_map: summon_skills_map[parent_id] = []
                        summon_skills_map[parent_id].append(sk)
                    else:
                        if parent_id not in alternate_forms_map: alternate_forms_map[parent_id] = []
                        alternate_forms_map[parent_id].append(sk)
                else:
                    independent_skills.append(sk)
            else:
                independent_skills.append(sk)
                
        # Attach nested skills to their parents
        for parent_id, forms in alternate_forms_map.items():
            if parent_id in raw_skills_dict:
                raw_skills_dict[parent_id]["alternate_forms"].extend(forms)
                
        for parent_id, forms in summon_skills_map.items():
            if parent_id in raw_skills_dict:
                raw_skills_dict[parent_id]["summon_skills"].extend(forms)
                
        # Reconstruct final list in canonical player-facing display order: 01 -> 11 -> 02 -> 03 -> 04 -> 05
        base_slot_skills = []
        for i in range(1, 7):
            sinfo = data.get(f"skill{i}")
            if sinfo and isinstance(sinfo, list) and len(sinfo) > 0:
                gid = str(sinfo[0])
                for sk in list(independent_skills):
                    if sk["group_id"] == gid:
                        sk_copy = sk.copy()
                        sk_copy["slot"] = f"skill{i}"
                        base_slot_skills.append(sk_copy)
                        independent_skills.remove(sk)
                        break

        # Sort base slot skills into canonical in-game display order: [01, 11, 02, 03, 04, 05]
        def get_display_rank(s):
            gid = s["group_id"]
            suffix = gid[-2:] if len(gid) >= 2 else ""
            return DISPLAY_ORDER_MAP.get(suffix, 99)

        base_slot_skills.sort(key=get_display_rank)

        skills_list = base_slot_skills
        # Append remaining independent skills if any
        for idx, sk in enumerate(independent_skills):
            sk_copy = sk.copy()
            sk_copy["slot"] = f"extra_{idx}"
            skills_list.append(sk_copy)
            
        char_skills[cid] = skills_list
        if brilliant_skills_list:
            char_brilliant_skills[cid] = brilliant_skills_list

    def slugify(text):
        if not text: return ""
        text = unicodedata.normalize("NFD", text)
        text = "".join(c for c in text if unicodedata.category(c) != "Mn")
        text = text.replace("đ", "d").replace("Đ", "d")
        text = re.sub(r'[^a-zA-Z0-9\s-]', '', text)
        text = re.sub(r'[\s-]+', '-', text).strip('-').lower()
        return text

    EXCLUDED_CHARACTER_IDS = {"W0021", "ES013"}
    chars_db = {}
    slug_counts = {}

    for cid in char_talents:
        char_talents[cid] = sorted(char_talents[cid], key=lambda x: x["id"])

    for cid, data in char_table_raw.items():
        talents = char_talents.get(cid, [])
        if cid.startswith("SCJ") or cid in EXCLUDED_CHARACTER_IDS or len(talents) == 0:
            continue

        rare = data.get("rare", 3)
        name_vi = char_loc.get(cid, {}).get("name_vi", "")
        name_cn = data.get("namelanText", data.get("name", ""))
        base_name = name_vi or name_cn or cid

        slug = slugify(base_name)
        if not slug:
            slug = cid.lower()
        if slug in slug_counts:
            slug_counts[slug] += 1
            slug = f"{slug}-{slug_counts[slug]}"
        else:
            slug_counts[slug] = 1

        chars_db[cid] = {
            "id": cid,
            "slug": slug,
            "name_cn": name_cn,
            "fullname_cn": data.get("FullnameLanText", ""),
            "name_vi": name_vi,
            "fullname_vi": char_loc.get(cid, {}).get("fullname_vi", ""),
            "nickname_vi": char_loc.get(cid, {}).get("nickname_vi", ""),
            "tags_vi": char_loc.get(cid, {}).get("tags_vi", ""),
            "rare": rare,
            "job": data.get("job", 0),
            "attacktype": data.get("attacktype", 0),
            "is_limited": bool(data.get("Linkage")),
            "icon": f"assets/characters/avatars/{cid}.png",
            "cards": char_cards.get(cid, [f"{cid}001.png"]),
            "skins": char_skins_processed.get(cid, []),
            "talents": talents,
            "skills": char_skills.get(cid, []),
            "brilliant_skills": char_brilliant_skills.get(cid, []),
            "brilliant_info": extract_char_brilliant_info(cid),
            "has_huanzhang": bool(extract_char_brilliant_info(cid) or char_brilliant_skills.get(cid, [])),
            "zhizhi": extract_char_zhizhi(cid),
            "stats": extract_char_stats(cid),
            "profile": extract_char_profile(cid),
            "rankUpRule": rare,
            "unlock_date": int(data.get("UnlockDate")) if isinstance(data.get("UnlockDate"), (int, float)) and data.get("UnlockDate") > 0 else 0,
            "unlock_date_provenance": {
                "source_table": "characterTable.json",
                "source_field": "UnlockDate",
                "unit": "unix_seconds"
            }
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
