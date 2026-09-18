import json
import openpyxl
from pathlib import Path

from asset_publish_manifest import load_manifest, manifest_path, require_asset_url

from export_localization_json import export as export_master_localization

MASTER = Path(__file__).resolve().parent.parent.parent / "NeoArtifacts" / "MasterData" / "json"
MASTER_JSON = Path(__file__).resolve().parent.parent / "localization" / "generated_localization.json"
PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"
OUT_FILE = PUBLIC_DIR / "data.json"
EXCLUDED_CHARACTER_IDS = {"W0021", "ES013"}


def build_skill_icon_index(skills_dir):
    """Index real skill filenames without relying on a case-insensitive disk.

    Raw MasterData names are useful lookup candidates only.  Every generated
    URL must retain the exact spelling of the filename that is actually
    published under ``public/assets/skills``.  A casefold collision cannot be
    represented safely on Linux, so fail before producing ambiguous output.
    """
    exact = {}
    casefold = {}
    for path in sorted(skills_dir.iterdir(), key=lambda item: item.name.casefold()):
        if not path.is_file():
            continue
        name = path.name
        folded = name.casefold()
        other = casefold.get(folded)
        if other is not None and other != name:
            raise RuntimeError(
                f"Casefold collision in skill assets: {other!r} and {name!r}"
            )
        exact[name] = name
        casefold[folded] = name
    return exact, casefold


def build_exact_filename_index(asset_dir, asset_label):
    """Return exact/casefold filename lookup and reject ambiguous disk state."""
    exact = {}
    casefold = {}
    for path in sorted(asset_dir.iterdir(), key=lambda item: item.name.casefold()):
        if not path.is_file():
            continue
        name = path.name
        folded = name.casefold()
        other = casefold.get(folded)
        if other is not None and other != name:
            raise RuntimeError(
                f"Casefold collision in {asset_label} assets: {other!r} and {name!r}"
            )
        exact[name] = name
        casefold[folded] = name
    return exact, casefold

def load_json(name):
    return json.loads((MASTER / name).read_text(encoding="utf-8"))

def build():
    remote_asset_manifest = load_manifest(manifest_path(Path(__file__).resolve().parent.parent))
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    SKILLS_DIR = PUBLIC_DIR / "assets" / "skills"
    skill_icon_exact, skill_icon_casefold = build_skill_icon_index(SKILLS_DIR)
    HUANZHANG_DIR = PUBLIC_DIR / "assets" / "huanzhang"
    huanzhang_icon_exact, huanzhang_icon_casefold = build_exact_filename_index(HUANZHANG_DIR, "Hoán Chương")
    
    print("Loading master localization...")
    gen_loc = export_master_localization()
    
    def safe_str(val):
        if val is None:
            return ""
        return str(val).strip()

    def raw_record_level(record, raw_key=""):
        """Read the level encoded by the raw table's record identity.

        Some MasterData skill records omit a ``Level`` field, but their primary
        raw key is exactly ``<GroupId><level>``.  This is a table-level identity
        relation (not a gameplay-semantic suffix guess), and is accepted only
        when the whole prefix exactly equals the record's GroupId.
        """
        explicit = record.get("Level", record.get("level"))
        if explicit not in (None, ""):
            try:
                return int(explicit)
            except (TypeError, ValueError):
                return 1
        group_id = safe_str(record.get("GroupId"))
        key = safe_str(raw_key or record.get("Id"))
        suffix = key[len(group_id):] if group_id and key.startswith(group_id) else ""
        return int(suffix) if suffix.isdigit() and int(suffix) > 0 else 1

    char_loc = gen_loc.get("characters", {})
    item_loc = gen_loc.get("items", {})
    node_loc = gen_loc.get("talents", {})
    skill_loc = gen_loc.get("skills", {})
    profile_loc = gen_loc.get("profiles", {})
    buff_loc = gen_loc.get("buffs", {})
    hz_loc_dict = gen_loc.get("huanzhang", {})
    
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

    def clean_rich_text(value):
        """Return a comparable player-facing term without changing source text."""
        return re.sub(r'<[^>]+>', '', safe_str(value)).strip()

    def normalize_buff_name(value):
        """Exact-only comparison key; this deliberately performs no fuzzy matching."""
        return re.sub(r'\s+', '', unicodedata.normalize("NFKC", clean_rich_text(value)))

    def usable_vi(value):
        """Do not publish an incomplete CN/VI mash-up as a Vietnamese translation."""
        text = safe_str(value)
        return text if text and not re.search(r'[\u3400-\u9fff]', text) else ""

    popup_param_re = re.compile(r'\[(?:EffectParam|EffectPara|BuffParam|Effect[1-5]Para|Condition[1-5]Para),\d+\]')
    # This deliberately recognises only a standalone positional raw argument.
    # It cannot match hex colours such as <color=#158bdb>.
    raw_hash_param_re = re.compile(r'(?<![A-Za-z0-9_])#(\d+)\b')

    def contains_unresolved_player_parameter(value):
        text = safe_str(value)
        return bool(popup_param_re.search(text) or raw_hash_param_re.search(text))

    def valid_named_popup_anchor(value):
        """A popup title is a named term, never a resolved value or parameter."""
        text = clean_rich_text(value)
        return bool(text and not contains_unresolved_player_parameter(text)
                    and not re.fullmatch(r"[\d\s.,/%+\-]+", text))

    def resolve_vi_from_resolved_cn(template_cn, resolved_cn, template_vi):
        """Project exact resolved values from the CN template into its VI template."""
        if not template_vi or not popup_param_re.search(template_vi):
            return template_vi
        parts = popup_param_re.split(template_cn)
        tokens = popup_param_re.findall(template_cn)
        if not tokens:
            return template_vi
        pattern = '^' + ''.join(
            re.escape(part) + (r'(.*?)' if idx < len(tokens) else '')
            for idx, part in enumerate(parts)
        ) + '$'
        match = re.match(pattern, resolved_cn, flags=re.DOTALL)
        if not match or len(match.groups()) != len(tokens):
            return ""
        values_by_token = {}
        for token, value in zip(tokens, match.groups()):
            values_by_token.setdefault(token, []).append(value)
        positions = {token: 0 for token in values_by_token}
        def replace(match_obj):
            token = match_obj.group(0)
            values = values_by_token.get(token, [])
            pos = positions.get(token, 0)
            if not values:
                return token
            positions[token] = pos + 1
            return values[min(pos, len(values) - 1)]
        return popup_param_re.sub(replace, template_vi)

    # A source description can name a status without carrying its {Buff_ID} marker.
    # Such a relation is usable only when the raw buff table has exactly one matching
    # normalized Chinese name.  Ambiguous names intentionally receive no popup.
    buff_ids_by_name = {}
    for buff_id, buff_data in buff_loc.items():
        if not isinstance(buff_data, dict):
            continue
        normalized_name = normalize_buff_name(buff_data.get("buff_name_cn") or buff_data.get("name_cn", ""))
        if normalized_name:
            buff_ids_by_name.setdefault(normalized_name, []).append(str(buff_id))

    # BrilliantMap ownership comes from the HUANZHANG record's explicit
    # character_id, never from an ID prefix or a global group-name convention.
    brilliant_skill_gids_by_character = {}
    if isinstance(brilliant_raw, dict):
        for b_id, b_val in brilliant_raw.items():
            owner_id = safe_str((hz_loc_dict.get(b_id) or {}).get("character_id"))
            if owner_id and isinstance(b_val, dict):
                groups = brilliant_skill_gids_by_character.setdefault(owner_id, set())
                for sk_id in b_val.get("Buff", []) + b_val.get("Skill1", []) + b_val.get("Skill2", []):
                    if sk_id:
                        groups.add(str(sk_id))

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
                lvl = raw_record_level(v, k)
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


    def walk_strings(value):
        if isinstance(value, str):
            yield value
        elif isinstance(value, dict):
            for item in value.values():
                yield from walk_strings(item)
        elif isinstance(value, list):
            for item in value:
                yield from walk_strings(item)

    # Character-owned raw relations provide a deterministic tiebreaker for the
    # rare case where a card names a status without a marker and the global name is
    # duplicated.  The tiebreaker is still only used as a final exact-name fallback.
    hero_buff_ids = {}
    hero_skill_records = {}
    for skill_source in (char_skill_raw, passive_map_raw):
        for raw_skill in skill_source.values():
            hero_id = safe_str(raw_skill.get("HeroId"))
            if not hero_id:
                continue
            refs = set(re.findall(r'\{(Buff_[^}\s]+)\}', safe_str(raw_skill.get("DescriptionLanText"))))
            refs.update(re.findall(r'\b(Buff_[A-Za-z0-9_]+)\b', "\n".join(walk_strings(raw_skill.get("Attr", [])))))
            hero_buff_ids.setdefault(hero_id, set()).update(refs)
            hero_skill_records.setdefault(hero_id, []).append(raw_skill)

    raw_closure_text_cache = {}

    def raw_skill_closure_text(raw_skill_records):
        """Return source text from the exact Buff closure of one card/group."""
        roots = set()
        for raw_skill in raw_skill_records or ():
            roots.update(re.findall(r'\{(Buff_[^}\s]+)\}', safe_str(raw_skill.get("DescriptionLanText"))))
            roots.update(re.findall(r'\b(Buff_[A-Za-z0-9_]+)\b', "\n".join(walk_strings(raw_skill.get("Attr", [])))))
        cache_key = tuple(sorted(roots))
        if cache_key in raw_closure_text_cache:
            return raw_closure_text_cache[cache_key]
        texts, seen, pending = [], set(), list(cache_key)
        while pending:
            buff_id = pending.pop()
            if buff_id in seen:
                continue
            seen.add(buff_id)
            buff = buff_map_raw.get(buff_id) or {}
            texts.extend((safe_str(buff.get("NameLanText")), safe_str(buff.get("DescriptionLanText"))))
            child_source = "\n".join(walk_strings(buff.get("Attr", []))) + "\n" + safe_str(buff.get("DescriptionLanText"))
            pending.extend(
                child for child in re.findall(r'\b(Buff_[A-Za-z0-9_]+)\b', child_source)
                if child not in seen
            )
        result = "\n".join(texts)
        raw_closure_text_cache[cache_key] = result
        return result

    def resolve_positional_arg(value, local_args, inherited_args):
        """Resolve raw #n only through the exact EffectNPara/inherited edge."""
        token = safe_str(value)
        if not token.startswith("#") or not token[1:].isdigit():
            return value
        index = int(token[1:]) - 1
        for candidates in (local_args, inherited_args):
            if 0 <= index < len(candidates):
                candidate = candidates[index]
                if safe_str(candidate) and safe_str(candidate) != token:
                    return candidate
        return None

    def resolve_buff_tree(buff_key, passed_args, depth=0, visited=None, path=None):
        if visited is None: visited = set()
        if path is None: path = []
        if buff_key in visited or depth > 5: return []
        visited.add(buff_key)
        
        b_def = buff_map_raw.get(buff_key)
        if not b_def: return []
        
        b_name = b_def.get("NameLanText", "").strip()
        b_desc_raw = b_def.get("DescriptionLanText", "")
        b_attr = parse_attr(b_def.get("Attr", []))
        child_buff_ids = set(re.findall(r'\b(Buff_[A-Za-z0-9_]+)\b', "\n".join(walk_strings(b_def.get("Attr", [])))))
        child_buff_ids.update(re.findall(r'\{(Buff_[^}\s]+)\}', b_desc_raw))
        child_buff_ids.discard(buff_key)
        
        results = []
        if b_name and b_desc_raw:
            name_clean = re.sub(r'<[^>]+>', '', b_name).strip()
            results.append({
                "key": buff_key,
                "name_cn": name_clean,
                "template": b_desc_raw,
                "attr_dict": b_attr,
                "args": passed_args,
                "raw_path": path + [buff_key],
                "child_buff_ids": sorted(child_buff_ids),
            })
            
        for key, params in b_attr.items():
            if key.startswith("Effect") and not key.endswith("Para") and not key.endswith("Tips"):
                if not params: continue
                # An Effect can deterministically reference more than one child buff.
                # Follow every raw Buff_ operand rather than silently keeping only the
                # first one; this is required for nested, per-card popup closure.
                for buff_idx, child_key in enumerate(params):
                    if not str(child_key).startswith("Buff_"):
                        continue
                    next_buff_idx = next(
                        (i for i in range(buff_idx + 1, len(params))
                         if str(params[i]).startswith("Buff_")),
                        len(params),
                    )
                    arg_tokens = params[buff_idx + 1:next_buff_idx]
                    para_key = f"{key}Para"
                    para_vals = b_attr.get(para_key, [])
                    child_args = []
                    for arg in arg_tokens:
                        resolved_arg = resolve_positional_arg(arg, para_vals, passed_args)
                        if resolved_arg not in (None, ""):
                            child_args.append(resolved_arg)
                    if not child_args: child_args = para_vals
                    results.extend(resolve_buff_tree(child_key, child_args, depth + 1, visited.copy(), path + [buff_key]))
                    
        return results

    def extract_skill_level_mechs(sk):
        if not sk: return []
        raw_desc = sk.get("DescriptionLanText", "")
        s_attr = parse_attr(sk.get("Attr", []))
        mechs = []
        candidates_by_key = {}
        source_text = clean_rich_text(raw_desc)
        direct_buff_keys = set(re.findall(r'\{(Buff_[^}\s]+)\}', raw_desc))
        direct_buff_keys.update(re.findall(r'\b(Buff_[A-Za-z0-9_]+)\b', "\n".join(walk_strings(sk.get("Attr", [])))))
        
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
                        resolved_arg = resolve_positional_arg(arg, para_vals, [])
                        if resolved_arg not in (None, ""):
                            resolved_b_args.append(resolved_arg)
                    if not resolved_b_args: resolved_b_args = para_vals
                    
                    sub_m = resolve_buff_tree(b_key, resolved_b_args)
                    for m in sub_m:
                        # Raw Effect roots are often invisible controller buffs.  The
                        # first player-facing descendant is direct only when its own
                        # authored name is present in this card's source text.
                        if (m["key"] == b_key or
                                (clean_rich_text(m.get("name_cn", "")) and
                                 clean_rich_text(m.get("name_cn", "")) in source_text)):
                            m["is_direct_popup_target"] = True
                        candidates_by_key.setdefault(m["key"], []).append(m)
                        
        buff_matches = re.finditer(r'\{([A-Za-z0-9_]+)\}', raw_desc)
        for match in buff_matches:
            buff_key = match.group(1)
            if not buff_key.startswith("Buff_"): continue
            
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
                            resolved_arg = resolve_positional_arg(arg, para_vals, [])
                            if resolved_arg not in (None, ""):
                                match_args.append(resolved_arg)
                        if not match_args: match_args = para_vals
                        break
            sub_m = resolve_buff_tree(buff_key, match_args)
            for m in sub_m:
                if (m["key"] == buff_key or
                        (clean_rich_text(m.get("name_cn", "")) and
                         clean_rich_text(m.get("name_cn", "")) in source_text)):
                    m["is_direct_popup_target"] = True
                candidates_by_key.setdefault(m["key"], []).append(m)
                    
        # A raw card can reach the same leaf through a parameterless controller
        # and through a parameterised edge.  Select only the exact candidate whose
        # edge vector is fully resolved; never keep the first Buff_ID encountered.
        mechs = []
        for key, candidates in candidates_by_key.items():
            def candidate_score(candidate):
                args = [safe_str(x) for x in candidate.get("args", [])]
                return (
                    not any(raw_hash_param_re.search(x) for x in args),
                    len([x for x in args if x]),
                    len(candidate.get("raw_path", [])),
                )
            mechs.append(max(candidates, key=candidate_score))
        for mechanic in mechs:
            if mechanic.get("key") in direct_buff_keys:
                mechanic["is_direct_popup_target"] = True
        return mechs

    def attach_popup_terms(raw_desc, mechanics, hero_id="", display_desc_vi="", raw_skill_records=()):
        """Attach only deterministic, displayable buff references to each mechanic.

        The frontend must never infer a popup from an arbitrary matching word.  A term
        is linkable when its buff was reached through the skill's raw relation, or when
        its exact normalized Chinese name maps to exactly one BUFF_STATUS record.
        In both cases the source description must actually contain that name.
        """
        source_text = clean_rich_text(raw_desc)
        if not source_text:
            return mechanics
        highlighted_names = {
            normalize_buff_name(match.group(1))
            for match in re.finditer(r'<color=[^>]+>(.*?)</color>', raw_desc, flags=re.IGNORECASE | re.DOTALL)
        }
        # If a canonical BUFF_STATUS name has no VI, a card may still expose a
        # deterministic display alias from its own localized description.  Pair
        # coloured source/display terms by position only; this alias is never
        # persisted and never used to discover a global buff relation.
        source_coloured_terms = [clean_rich_text(match.group(1)) for match in re.finditer(
            r'<color=[^>]+>(.*?)</color>', raw_desc, flags=re.IGNORECASE | re.DOTALL,
        )]
        vi_coloured_terms = [clean_rich_text(match.group(1)) for match in re.finditer(
            r'<color=[^>]+>(.*?)</color>', display_desc_vi, flags=re.IGNORECASE | re.DOTALL,
        )]
        display_aliases = {}
        if len(source_coloured_terms) == len(vi_coloured_terms):
            for source_term, vi_term in zip(source_coloured_terms, vi_coloured_terms):
                if source_term and vi_term and source_term != vi_term:
                    display_aliases.setdefault(normalize_buff_name(source_term), []).append(vi_term)

        by_key = {m.get("key"): m for m in mechanics if isinstance(m, dict) and m.get("key")}

        def add_unique_name_fallback(normalized_name, is_direct=False):
            """Add one displayable BUFF_STATUS only for an exact, unique name match.

            This is deliberately a last fallback: raw marker/Attr relations are
            collected before this function is used.  It is also kept inside the
            current card's mechanics list, so a successful match cannot populate a
            global popup index or leak to another skill card.
            """
            placeholder_re = r'\[(?:EffectParam|EffectPara|BuffParam|[A-Za-z0-9_]+Para),\d+\]'
            buff_ids = buff_ids_by_name.get(normalized_name, [])
            if len(buff_ids) != 1:
                # Resolve only through the current character's independently raw
                # referenced set.  If it is still not unique, do not create a popup.
                buff_ids = [buff_id for buff_id in buff_ids if buff_id in hero_buff_ids.get(hero_id, set())]
            if len(buff_ids) != 1:
                return None
            buff_id = buff_ids[0]
            if buff_id in by_key:
                return by_key[buff_id]
            buff_data = buff_loc.get(buff_id, {})
            name_cn = clean_rich_text(buff_data.get("buff_name_cn") or buff_data.get("name_cn", ""))
            if not name_cn:
                return None
            resolved = resolve_buff_tree(buff_id, [])
            node = next((m for m in resolved if m.get("key") == buff_id), None)
            if not node:
                return None
            # A fallback must never publish an unbound [EffectParam,*].  When the
            # same character has a raw, marked skill that supplies this status's
            # arguments, use that deterministic instance; otherwise leave it as
            # normal text and let the audit report the unresolved nested target.
            if re.search(placeholder_re, node.get("template", "")):
                rendered = None
                marker = "{" + buff_id + "}"
                grouped_sources = {}
                for hero_skill in hero_skill_records.get(hero_id, []):
                    if marker in safe_str(hero_skill.get("DescriptionLanText")):
                        grouped_sources.setdefault(safe_str(hero_skill.get("GroupId")), []).append(hero_skill)
                candidates = []
                for group_levels in grouped_sources.values():
                    group_levels.sort(key=raw_record_level)
                    resolved_group = merge_mechs_across_levels([
                        extract_skill_level_mechs(skill) for skill in group_levels
                    ])
                    candidate = next((entry for entry in resolved_group if entry.get("key") == buff_id), None)
                    if candidate and not re.search(placeholder_re, candidate.get("desc_cn", "")):
                        candidates.append(candidate)
                unique_candidates = {candidate.get("desc_cn", ""): candidate for candidate in candidates}
                if len(unique_candidates) == 1:
                    rendered = next(iter(unique_candidates.values()))
                if rendered and not re.search(placeholder_re, rendered.get("desc_cn", "")):
                    node = rendered
                else:
                    return None
            loc = buff_loc.get(buff_id, {})
            node["name_vi"] = usable_vi(loc.get("buff_name_vi") or loc.get("name_vi", ""))
            node["desc_cn"] = node.get("desc_cn") or node.get("template", "")
            # A card-local candidate produced by merge_mechs_across_levels already
            # carries the exact level/argument vector.  Preserve that resolved VI;
            # rebuilding it from another CN string can lose tag/unit placement.
            localized_desc = usable_vi(node.get("desc_vi", ""))
            if not localized_desc:
                localized_desc = usable_vi(loc.get("buff_desc_vi") or loc.get("desc_vi", ""))
            if re.search(placeholder_re, localized_desc):
                localized_desc = resolve_vi_from_resolved_cn(
                    safe_str(loc.get("buff_desc_cn") or loc.get("desc_cn", "")),
                    node.get("desc_cn", ""),
                    localized_desc,
                )
            node["desc_vi"] = localized_desc if localized_desc and not re.search(placeholder_re, localized_desc) else ""
            node["canonical_vi_missing"] = not bool(usable_vi(loc.get("buff_desc_vi") or loc.get("desc_vi", "")))
            node["is_direct_popup_target"] = is_direct
            node["name_match_fallback"] = True
            mechanics.append(node)
            by_key[buff_id] = node
            return node

        # Add unambiguous source-name-only references.  This covers conditions such as
        # 寒天/霜冻 that the game text names without embedding a marker in that skill.
        # Some raw descriptions name an exact status without a <color> tag.  This is
        # still eligible only when the canonical BUFF_STATUS name is unique and is
        # literally present both in this card's raw description and in the exact raw
        # Buff closure reached from this card's Attr/marker edges.
        raw_closure_text = clean_rich_text(raw_skill_closure_text(raw_skill_records))
        exact_plain_names = set()
        for normalized_name, buff_ids in buff_ids_by_name.items():
            if len(buff_ids) != 1:
                continue
            source_name = clean_rich_text((buff_loc.get(buff_ids[0]) or {}).get("buff_name_cn", ""))
            if source_name and source_name in source_text and source_name in raw_closure_text:
                exact_plain_names.add(normalized_name)
        for normalized_name in highlighted_names | exact_plain_names:
            add_unique_name_fallback(normalized_name, is_direct=True)

        # Complete the same card-local closure for rich-text names in a buff popup.
        # A nested name is eligible only when the raw buff table/localization gives a
        # single exact ID; otherwise it remains ordinary text and is reported by audit.
        active_keys = {
            key for key, mechanic in by_key.items()
            if mechanic.get("is_direct_popup_target")
        }
        pending_keys = list(active_keys)
        while pending_keys:
            parent_key = pending_keys.pop()
            parent = by_key.get(parent_key)
            if not isinstance(parent, dict):
                continue
            parent_names = {
                normalize_buff_name(match.group(1))
                for match in re.finditer(
                    r'<color=[^>]+>(.*?)</color>',
                    parent.get("template") or parent.get("desc_cn", ""), flags=re.IGNORECASE | re.DOTALL,
                )
            }
            for normalized_name in parent_names:
                child = add_unique_name_fallback(normalized_name)
                if not child or child.get("key") == parent.get("key"):
                    continue
                child_ids = parent.setdefault("child_buff_ids", [])
                if child["key"] not in child_ids:
                    child_ids.append(child["key"])
                    child_ids.sort()
                if child["key"] not in active_keys:
                    active_keys.add(child["key"])
                    pending_keys.append(child["key"])
            # Follow deterministic raw child edges too.  Invisible controller
            # buffs remain in the graph but never become text popup targets.
            for child_id in parent.get("child_buff_ids", []):
                if child_id in by_key and child_id not in active_keys:
                    active_keys.add(child_id)
                    pending_keys.append(child_id)

        for mechanic in mechanics:
            if not isinstance(mechanic, dict):
                continue
            mechanic["popup_terms"] = []
            name_cn = clean_rich_text(mechanic.get("name_cn", ""))
            name_vi = clean_rich_text(mechanic.get("name_vi", ""))
            if not name_vi and name_cn:
                aliases = display_aliases.get(normalize_buff_name(name_cn), [])
                if aliases and len(set(aliases)) == 1:
                    name_vi = aliases[0]
            mechanic["display_alias_vi"] = name_vi
            popup_body = mechanic.get("desc_vi") or (
                mechanic.get("desc_cn") if mechanic.get("canonical_vi_missing") else ""
            )
            popup_body_ready = bool(popup_body) and not popup_param_re.search(popup_body)
            mechanic["popup_body_ready"] = popup_body_ready
            # A controller may be raw-reachable and share the visible CN term of
            # its localized child.  It is not, however, a player-facing popup
            # authority until it has its own canonical VI template.  Leaving it
            # linkable would make the frontend select a CN-only body before the
            # exact localized descendant (for example A0001_2_1 -> A0001_2).
            if (not mechanic.get("is_direct_popup_target")
                    or mechanic.get("canonical_vi_missing")
                    or not popup_body_ready
                    or not valid_named_popup_anchor(name_cn)
                    or not valid_named_popup_anchor(name_vi or name_cn)
                    or name_cn not in source_text):
                continue
            mechanic["popup_terms"].append({
                "buff_id": mechanic.get("key"),
                "binding_key": mechanic.get("key"),
                "name_cn": name_cn,
                "name_vi": name_vi,
            })

        # Every buff node carries only its own deterministic child edges.  These
        # terms are consumed when that node's tooltip is rendered; the frontend
        # never discovers a new buff from a global name index.
        for mechanic in mechanics:
            if mechanic.get("key") not in active_keys:
                continue
            parent_text = clean_rich_text(mechanic.get("template") or mechanic.get("desc_cn", ""))
            known_ids = {term.get("buff_id") for term in mechanic.get("popup_terms", [])}
            for child_id in mechanic.get("child_buff_ids", []):
                child = by_key.get(child_id)
                child_name = clean_rich_text((child or {}).get("name_cn", ""))
                child_body = (child or {}).get("desc_vi") or (
                    (child or {}).get("desc_cn") if (child or {}).get("canonical_vi_missing") else ""
                )
                child_body_ready = bool(child_body) and not popup_param_re.search(child_body)
                child_name_vi = clean_rich_text((child or {}).get("display_alias_vi") or (child or {}).get("name_vi", ""))
                if (child and child_body_ready and valid_named_popup_anchor(child_name)
                        and valid_named_popup_anchor(child_name_vi or child_name)
                        and child_name in parent_text and child_id not in known_ids):
                    mechanic["popup_terms"].append({
                        "buff_id": child_id,
                        "binding_key": child_id,
                        "name_cn": child_name,
                        "name_vi": child_name_vi,
                    })
                    known_ids.add(child_id)

        # A highlighted generic term can represent several exact player-facing
        # descendants of the *same card-local raw closure* (profession, state or
        # mode variants).  Keep those IDs separate and export one composite
        # binding; this is never a global name lookup and never chooses a child.
        composite_bindings = []
        existing_keys = {mechanic.get("key") for mechanic in mechanics if mechanic.get("key")}
        for source_term in source_coloured_terms:
            normalized_term = normalize_buff_name(source_term)
            if not normalized_term:
                continue
            children = []
            for mechanic in mechanics:
                name_cn = clean_rich_text(mechanic.get("name_cn", ""))
                body = mechanic.get("desc_vi") or (mechanic.get("desc_cn") if mechanic.get("canonical_vi_missing") else "")
                if (mechanic.get("is_direct_popup_target") and name_cn.startswith(f"{source_term}·")
                        and body and not contains_unresolved_player_parameter(body)):
                    children.append(mechanic)
            # At least two raw-reachable exact children are required. A normal
            # single buff remains on the standard exact-binding path above.
            child_ids = sorted({child.get("key") for child in children if child.get("key")})
            if len(child_ids) < 2:
                continue
            composite_key = f"__multi__:{normalized_term}:{'|'.join(child_ids)}"
            if composite_key in existing_keys:
                continue
            aliases = display_aliases.get(normalized_term, [])
            name_vi = aliases[0] if len(set(aliases)) == 1 else ""
            composite_bindings.append({
                "key": composite_key,
                "kind": "MULTI_VARIANT_CONTROLLER",
                "name_cn": source_term,
                "name_vi": name_vi,
                "desc_cn": "", "desc_vi": "", "canonical_vi_missing": True,
                "is_direct_popup_target": True,
                "variant_children": [
                    {"binding_key": child.get("key"), "buff_id": child.get("key"),
                     "name_cn": clean_rich_text(child.get("name_cn", "")),
                     "name_vi": clean_rich_text(child.get("display_alias_vi") or child.get("name_vi", "")),
                     "raw_paths": child.get("raw_paths", [])}
                    for child in sorted(children, key=lambda item: clean_rich_text(item.get("name_cn", "")))
                ],
                "popup_terms": [{"buff_id": composite_key, "binding_key": composite_key,
                                 "name_cn": source_term, "name_vi": name_vi}],
            })
            existing_keys.add(composite_key)
        mechanics.extend(composite_bindings)
        return mechanics

    def get_buff_param_val(pname, idx_str, args, b_attr_dict, unit="", closing_tags="", placeholder_to_pos=None):
        if placeholder_to_pos is None: placeholder_to_pos = {}
        pos = placeholder_to_pos.get(idx_str, int(idx_str) - 1)
        val = None
        if pname in ["EffectParam", "EffectPara", "BuffParam"]:
            if 0 <= pos < len(args) and args[pos] != '':
                candidate = str(args[pos])
                val = candidate if not raw_hash_param_re.search(candidate) else None
            elif 1 <= int(idx_str) <= len(args) and args[int(idx_str) - 1] != '':
                candidate = str(args[int(idx_str) - 1])
                val = candidate if not raw_hash_param_re.search(candidate) else None
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
            child_buff_ids = sorted({child for _, mech in entries for child in mech.get("child_buff_ids", []) if child != key})
            # Preserve every raw edge path that contributed to this card-local
            # binding. A binding key identifies its target; these paths retain
            # controller/parent provenance for audits and composite popups.
            raw_paths = sorted({tuple(mech.get("raw_path", [])) for _, mech in entries if mech.get("raw_path")})
            raw_paths = [list(path) for path in raw_paths]
            is_direct_popup_target = any(mech.get("is_direct_popup_target", False) for _, mech in entries)
            
            b_loc = buff_loc.get(key, {})
            b_name_vi = usable_vi(b_loc.get("buff_name_vi") or b_loc.get("name_vi", ""))
            b_desc_vi_raw = usable_vi(b_loc.get("buff_desc_vi") or b_loc.get("desc_vi", ""))
            canonical_vi_missing = not bool(b_desc_vi_raw)
            
            args_per_lvl = [m["args"] for _, m in entries]
            same_template = all(m["template"] == template for _, m in entries)
            
            param_matches = re.findall(r'\[(?:EffectParam|EffectPara|BuffParam),(?:(\d+))?\]', template)
            placeholder_to_pos = {}
            for pos, idx_str in enumerate(param_matches):
                if idx_str not in placeholder_to_pos:
                    placeholder_to_pos[idx_str] = pos

            # Keep the exact parameter provenance on the card-local binding.  This
            # is diagnostic metadata, not a second resolver or a global value cache.
            effect_param_values_by_level = {}
            for placeholder_match in re.finditer(pattern, template):
                pname = placeholder_match.group(2)
                idx_str = placeholder_match.group(3) or "1"
                token = f"[{pname},{idx_str}]"
                if token in effect_param_values_by_level:
                    continue
                values = []
                for args in args_per_lvl:
                    value = get_buff_param_val(
                        pname, idx_str, args, b_attr_dict,
                        placeholder_to_pos=placeholder_to_pos,
                    )
                    values.append(str(value) if value is not None else token)
                effect_param_values_by_level[token] = values
            aggregated_effect_param_values = {
                token: (values[0] if len(set(values)) == 1 else "/".join(values))
                for token, values in effect_param_values_by_level.items()
                if values
            }
                    
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

            def replace_raw_hash_args(text, args):
                def replace_hash(match):
                    index = int(match.group(1)) - 1
                    if 0 <= index < len(args):
                        value = safe_str(args[index])
                        if value and not raw_hash_param_re.search(value):
                            return value
                    return match.group(0)
                return raw_hash_param_re.sub(replace_hash, text)

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
                clean_desc = replace_raw_hash_args(clean_desc, args_per_lvl[0])
                clean_desc = re.sub(r'\{Buff_[^}]+\}', '', clean_desc).strip()
                
                clean_desc_vi = re.sub(pattern, multi_replacer, b_desc_vi_raw) if b_desc_vi_raw else ""
                clean_desc_vi = replace_raw_hash_args(clean_desc_vi, args_per_lvl[0]) if clean_desc_vi else ""
                clean_desc_vi = re.sub(r'\{Buff_[^}]+\}', '', clean_desc_vi).strip()
                
                merged_list.append({
                    "key": key,
                    "name_cn": name_cn,
                    "name_vi": b_name_vi,
                    "desc_cn": clean_desc,
                    "desc_vi": clean_desc_vi,
                    "child_buff_ids": child_buff_ids,
                    "raw_paths": raw_paths,
                    "is_direct_popup_target": is_direct_popup_target,
                    "canonical_vi_missing": canonical_vi_missing,
                    "effect_param_values_by_level": effect_param_values_by_level,
                    "aggregated_effect_param_values": aggregated_effect_param_values,
                })
            elif len(entries) == 1:
                clean_desc = re.sub(pattern, replacer_for_lvl(args_per_lvl[0]), template)
                clean_desc = replace_raw_hash_args(clean_desc, args_per_lvl[0])
                clean_desc = re.sub(r'\{Buff_[^}]+\}', '', clean_desc).strip()
                
                clean_desc_vi = re.sub(pattern, replacer_for_lvl(args_per_lvl[0]), b_desc_vi_raw) if b_desc_vi_raw else ""
                clean_desc_vi = replace_raw_hash_args(clean_desc_vi, args_per_lvl[0]) if clean_desc_vi else ""
                clean_desc_vi = re.sub(r'\{Buff_[^}]+\}', '', clean_desc_vi).strip()
                
                merged_list.append({
                    "key": key,
                    "name_cn": name_cn,
                    "name_vi": b_name_vi,
                    "desc_cn": clean_desc,
                    "desc_vi": clean_desc_vi,
                    "child_buff_ids": child_buff_ids,
                    "raw_paths": raw_paths,
                    "is_direct_popup_target": is_direct_popup_target,
                    "canonical_vi_missing": canonical_vi_missing,
                    "effect_param_values_by_level": effect_param_values_by_level,
                    "aggregated_effect_param_values": aggregated_effect_param_values,
                })
            else:
                parts = []
                for l_idx, m in entries:
                    parts.append(f"Lv.{l_idx + 1}: {m['template']}")
                merged_list.append({
                    "key": key,
                    "name_cn": name_cn,
                    "name_vi": b_name_vi,
                    "desc_cn": "\n".join(parts),
                    "desc_vi": b_desc_vi_raw,
                    "child_buff_ids": child_buff_ids,
                    "raw_paths": raw_paths,
                    "is_direct_popup_target": is_direct_popup_target,
                    "canonical_vi_missing": canonical_vi_missing,
                    "effect_param_values_by_level": effect_param_values_by_level,
                    "aggregated_effect_param_values": aggregated_effect_param_values,
                })
                
        return merged_list

    # Provenance is serialized with Trí Tri/EX output.  It lets audits prove
    # every displayed vector value back to a raw skill level and parameter.
    level_vector_provenance_by_group = {}

    def resolve_desc(skill_obj, sk_entry=None):
        if not skill_obj: return "", "", []
        raw_desc = skill_obj.get("DescriptionLanText", "")
        raw_desc_vi = ""
        if sk_entry:
            raw_desc_vi = usable_vi(sk_entry.get("skill_desc_vi") or sk_entry.get("desc_vi"))
        attr_dict = parse_attr(skill_obj.get("Attr", []))
        mechanics = merge_mechs_across_levels([extract_skill_level_mechs(skill_obj)])
        mechanics = attach_popup_terms(raw_desc, mechanics, safe_str(skill_obj.get("HeroId")), raw_desc_vi, [skill_obj])
        
        pattern = r'(\[([A-Za-z0-9_]+),(?:(\d+))?\])(\s*(?:<\/span>|<\/color>)*\s*)(%|倍|格|回合|点|层|次)?'

        def single_replacer(m):
            full_p = m.group(1)
            pname = m.group(2)
            idx = int(m.group(3)) if m.group(3) else 1
            closing_tags = m.group(4) or ""
            unit = m.group(5) or ""
            val = None
            if pname in attr_dict:
                params = attr_dict[pname]
                if 1 <= idx <= len(params): val = str(params[idx - 1])
            full_match = f"{pname},{idx}"
            if val is None and full_match in attr_dict: val = str(attr_dict[full_match][0])
            if val is None and pname.endswith("Para"):
                if pname in attr_dict:
                    params = attr_dict[pname]
                    if 1 <= idx <= len(params): val = str(params[idx - 1])
            if val is None: val = full_p
            return f"{val}{unit}{closing_tags}"

        clean_desc = re.sub(pattern, single_replacer, raw_desc)
        clean_desc = re.sub(r'\{Buff_[^}]+\}', '', clean_desc).strip()
        
        clean_desc_vi = ""
        if raw_desc_vi:
            clean_desc_vi = re.sub(pattern, single_replacer, raw_desc_vi)
            clean_desc_vi = re.sub(r'\{Buff_[^}]+\}', '', clean_desc_vi).strip()
            
        return clean_desc, clean_desc_vi, mechanics

    def resolve_multi_level_desc(gid):
        lvls = []
        lvl = 1
        while True:
            sk = all_skills.get((gid, lvl))
            if not sk: break
            lvls.append(sk)
            lvl += 1

        if not lvls: return "", "", [], True

        mechs_by_lvl = [extract_skill_level_mechs(sk) for sk in lvls]
        multi_mechs = merge_mechs_across_levels(mechs_by_lvl)
        vi_entries = []
        for l_idx in range(1, len(lvls) + 1):
            sk_id = f"{gid}_{l_idx}"
            sk_entry = skill_loc.get(sk_id, {}) or skill_loc.get(gid, {}) or skill_loc.get(f"{gid}{l_idx}", {})
            vi_entries.append(sk_entry)

        multi_mechs = attach_popup_terms(
            "\n".join(sk.get("DescriptionLanText", "") for sk in lvls),
            multi_mechs,
            safe_str(lvls[0].get("HeroId")),
            "\n".join(usable_vi(entry.get("skill_desc_vi") or entry.get("desc_vi")) for entry in vi_entries),
            lvls,
        )

        if len(lvls) == 1:
            d_clean, d_clean_vi, _ = resolve_desc(lvls[0], vi_entries[0] if vi_entries else None)
            return d_clean, d_clean_vi, multi_mechs, True

        raw_descs = [sk.get("DescriptionLanText", "") for sk in lvls]
        is_template_same = len(set(raw_descs)) == 1

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

        provenance = []
        for token_match in re.finditer(pattern, raw_descs[0]):
            pname = token_match.group(2)
            index = int(token_match.group(3)) if token_match.group(3) else 1
            for source_level, attr_dict in enumerate(attr_dicts, 1):
                value = get_param_val(pname, index, attr_dict)
                if value is not None:
                    provenance.append({
                        "source_skill_id": gid,
                        "source_level": source_level,
                        "parameter_index": f"{pname},{index}",
                        "value": value,
                        "raw_path": [gid, f"level:{source_level}", f"{pname},{index}"],
                    })
        level_vector_provenance_by_group[gid] = provenance

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

        vi_raw_descs = [usable_vi(e.get("skill_desc_vi") or e.get("desc_vi")) for e in vi_entries]
        non_empty_vi = [v for v in vi_raw_descs if v]

        if is_template_same:
            clean_desc = re.sub(pattern, multi_replacer, raw_descs[0])
            clean_desc = re.sub(r'\{Buff_[^}]+\}', '', clean_desc).strip()

            clean_desc_vi = ""
            if non_empty_vi:
                clean_desc_vi = re.sub(pattern, multi_replacer, non_empty_vi[0])
                clean_desc_vi = re.sub(r'\{Buff_[^}]+\}', '', clean_desc_vi).strip()

            return clean_desc, clean_desc_vi, multi_mechs, True
        else:
            parts_cn = []
            parts_vi = []
            for l_idx, sk in enumerate(lvls, 1):
                sk_entry = vi_entries[l_idx - 1] if l_idx <= len(vi_entries) else None
                d_cn, d_vi, _ = resolve_desc(sk, sk_entry)
                parts_cn.append(f"Lv.{l_idx}: {d_cn}")
                if d_vi:
                    parts_vi.append(f"Lv.{l_idx}: {d_vi}")
            return "\n".join(parts_cn), "\n".join(parts_vi) if parts_vi else "", multi_mechs, False

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

    print("Resolving published character cards...")
    char_cards = {}
    for cid in sorted(char_table_raw):
        card_dir = MASTER.parent.parent / "Assets" / "characters" / cid / "card"
        if card_dir.exists():
            char_cards[cid] = [
                require_asset_url(remote_asset_manifest, cid, "card", card.name)
                for card in sorted(card_dir.glob("*.png"), key=lambda item: item.name)
            ]

    SERIES_MAP_CN = {
        202: "新春",
        203: "花朝",
        204: "节气",
        205: "非遗",
        206: "闲趣",
        207: "长安",
        208: "绮梦",
        209: "幸食",
        210: "纪念",
        211: "异象",
        212: "幻景",
        213: "行者",
        214: "裁样",
        215: "聆律",
        216: "秦音",
        217: "织彩",
        218: "异世",
        219: "消暑",
        220: "云想新裳"
    }

    print("Processing character drawings & skins...")
    char_skins_processed = {}
    for cid, cskins in skins_raw.items():
        # characterSkins can retain visual-only records that have no current
        # characterTable entity. They are not part of public web data and must
        # not create a remote-publish requirement.
        if cid not in char_table_raw or cid in EXCLUDED_CHARACTER_IDS or cid.startswith("SCJ"):
            continue
        if not isinstance(cskins, list): continue
        valid_skins = []
        for sk in cskins:
            sid = sk.get("skinID", "")
            drawing_filename = f"{sid}.png"
            if sid:
                image_url = require_asset_url(remote_asset_manifest, cid, "drawing", drawing_filename)
                sdata = gen_loc.get("skins", {}).get(sid, {})

                # Authoritative Series mapping for actual skins (skinType == 3)
                raw_logo = sk.get("skinLOGO")
                series_id = None
                series_name_cn = ""
                series_name_vi = ""
                series_badge = None

                cand_id = sdata.get("series_id")
                if cand_id is None and raw_logo and raw_logo in SERIES_MAP_CN:
                    cand_id = raw_logo

                if cand_id and cand_id in SERIES_MAP_CN:
                    series_id = cand_id
                    series_name_cn = sdata.get("series_name_cn") or SERIES_MAP_CN[cand_id]
                    series_name_vi = sdata.get("series_name_vi", "")
                    series_badge = f"/assets/series/skinlogo_{series_id}.png"

                valid_skins.append({
                    "skinID": sid,
                    "name_cn": sk.get("skinNamelanText", sk.get("skinName", "")),
                    "name_vi": skin_loc_clean.get(sid, skin_loc_clean.get(sk.get("skinNamelanText", ""), ("Ảnh Gốc" if sk.get("bIsBaseSkin") else sk.get("skinNamelanText", "Trang Phục")))),
                    "is_base": bool(sk.get("bIsBaseSkin")),
                    "description_cn": sk.get("getdescriptionLanText", ""),
                    "story_cn": sdata.get("desc_cn", "") or sk.get("skinFileLanText", ""),
                    "story_vi": sdata.get("desc_vi", ""),
                    "obtain_cn": sdata.get("obtain_cn", "") or sk.get("getdescriptionLanText", ""),
                    "obtain_vi": sdata.get("obtain_vi", ""),
                    "skin_type": sdata.get("skin_type", sk.get("skinType", 3)),
                    "unlock_date": sdata.get("unlock_date") or (sk.get("UnlockDate") if sk.get("UnlockDate") != 0 else None),
                    "price": sdata.get("price"),
                    "currency": sdata.get("currency", ""),
                    "is_high_skin": sdata.get("is_high_skin", False),
                    "skin_rare": sdata.get("skin_rare", sk.get("skinRare")),
                    "cv_name": sdata.get("cv_name", "") or sk.get("CvName", ""),
                    "series_id": series_id,
                    "series_name_cn": series_name_cn,
                    "series_name_vi": series_name_vi,
                    "series_badge": series_badge,
                    "image": image_url
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

    def resolve_skill_icon(gid, raw_icon_name, allow_generated_fallback=True):
        def real_filename(candidate):
            """Return a disk filename, never a synthesized/case-normalized name."""
            candidate = safe_str(candidate)
            if not candidate or "/" in candidate or "\\" in candidate:
                return ""
            if not Path(candidate).suffix:
                candidate += ".png"
            return skill_icon_exact.get(candidate) or skill_icon_casefold.get(candidate.casefold(), "")

        actual = real_filename(raw_icon_name)
        if actual:
            return f"assets/skills/{actual}"
        if not allow_generated_fallback:
            return ""
        actual = real_filename(f"skillicon_{safe_str(gid)}")
        if actual:
            return f"assets/skills/{actual}"
        base_gid = safe_str(gid).lower().replace("ex", "").upper()
        actual = real_filename(f"skillicon_{base_gid}")
        if actual:
            return f"assets/skills/{actual}"
        return ""

    STAT_NAME_VI = {
        'Atk_FIX': 'Tấn Công', 'Atk_PERCENT': 'Tấn Công', 'Hp_FIX': 'Sinh Mệnh', 'Hp_PERCENT': 'Sinh Mệnh',
        'PhysicDef_FIX': 'Phòng Ngự Vật Lý', 'PhysicDef_PERCENT': 'Phòng Ngự Vật Lý',
        'MagicDef_FIX': 'Phòng Ngự Cấu Thuật', 'MagicDef_PERCENT': 'Phòng Ngự Cấu Thuật',
        'Speed_FIX': 'Tốc Độ', 'Mov_FIX': 'Sức Di Chuyển', 'Critical_FIX': 'Tỷ Lệ Bạo Kích',
        'CritDmg_FIX': 'Sát Thương Bạo Kích', 'Block_FIX': 'Tỷ Lệ Đỡ Đòn', 'MissRate_FIX': 'Tỷ Lệ Né Tránh',
        'HealIncrease_FIX': 'Tăng Cường Trị Liệu', 'HealedIncrease_FIX': 'Hiệu Quả Trị Liệu Nhận Được',
        'AllDmgIncrease_FIX': 'Tăng Tất Cả Sát Thương', 'AllDmgReductionIncrease_FIX': 'Giảm Sát Thương Nhận Vào',
        'PhysicalDmgIncrease_FIX': 'Tăng Sát Thương Vật Lý', 'MagicDmgIncrease_FIX': 'Tăng Sát Thương Cấu Thuật',
        'PhyDmgReductionIncrease_FIX': 'Giảm Sát Thương Vật Lý Nhận Vào', 'MagDmgReductionIncrease_FIX': 'Giảm Sát Thương Cấu Thuật Nhận Vào',
        'CommonAttackDmgIncrease_FIX': 'Tăng Sát Thương Đánh Thường', 'SkillDmgIncrease_FIX': 'Tăng Sát Thương Kỹ Năng',
        'AlertAttackDmgIncrease_FIX': 'Tăng Sát Thương Cảnh Giới', 'AlertAttackExtraBullet_FIX': 'Đạn Cảnh Giới Bổ Sung',
        'DotDamageIncrease_FIX': 'Tăng Sát Thương Theo Thời Gian', 'DoubleHitDmgIncrease_FIX': 'Tăng Sát Thương Liên Kích',
        'FightBackDmgIncrease_FIX': 'Tăng Sát Thương Phản Kích', 'BeCommonAttackedDmgReduce_FIX': 'Giảm Sát Thương Đánh Thường Nhận Vào',
        'BeSkilledDmgReduce_FIX': 'Giảm Sát Thương Kỹ Năng Nhận Vào', 'DefPenetrationRate_FIX': 'Xuyên Phòng Ngự',
        'AllDefPenetrationRate_FIX': 'Xuyên Toàn Bộ Phòng Ngự', 'PenetrationRate_FIX': 'Tỷ Lệ Xuyên Giáp',
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

    SLOT_UPGRADE_LABEL_MAP = {
        "01": "CƯỜNG HÓA ĐÁNH THƯỜNG",
        "11": "CƯỜNG HÓA KỸ NÂNG NGHỀ",
        "02": "CƯỜNG HÓA TUYỆT KỸ",
        "03": "CƯỜNG HÓA NỘI TẠI 1",
        "04": "CƯỜNG HÓA NỘI TẠI 2",
        "05": "CƯỜNG HÓA NỘI TẠI 3"
    }

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
                    
                    base_sk_entry = skill_loc.get(base_id, {}) or skill_loc.get(f"{base_id}_1", {})
                    ex_sk_entry = skill_loc.get(ex_id, {}) or skill_loc.get(f"{ex_id}_1", {})
                    
                    base_name_vi = usable_vi(base_sk_entry.get("skill_name_vi") or base_sk_entry.get("name_vi", ""))
                    base_name_cn = base_sk_val.get("NameLanText", "") if base_sk_val else ""
                    base_type_id = int(base_sk_val.get("Type", 1)) if base_sk_val and str(base_sk_val.get("Type", "")).isdigit() else 1
                    base_cat_label, _ = resolve_skill_category(base_id, base_type_id)
                    base_raw_icon = safe_str(base_sk_val.get("SkillIcon")) if base_sk_val else ""
                    base_icon = resolve_skill_icon(base_id, base_raw_icon)
                    
                    ex_desc_clean, ex_desc_vi, ex_mechanics, is_merged = resolve_multi_level_desc(ex_id)
                    # A SkillUP edge supplies upgrade and parameter semantics,
                    # never display identity.  The EX row is an atomic display
                    # record: title, localized title and description must all be
                    # read from that exact row, even when its CN name is shared
                    # with its base counterpart.
                    raw_ex_name_cn = ex_sk_val.get("NameLanText", "") if ex_sk_val else ""
                    # The raw exact EX record is the display-CN authority.  A
                    # legacy master row may retain a shared base CN label, but
                    # that must not collapse the enhanced record's identity.
                    ex_name_cn = raw_ex_name_cn or safe_str(ex_sk_entry.get("skill_name_cn") or ex_sk_entry.get("name_cn"))
                    ex_name_vi = usable_vi(ex_sk_entry.get("skill_name_vi") or ex_sk_entry.get("name_vi", ""))
                    
                    raw_ex_desc_vi = usable_vi(ex_sk_entry.get("skill_desc_vi") or ex_sk_entry.get("desc_vi", ""))
                    # ``resolve_multi_level_desc`` is the player-facing source
                    # because it preserves every exact raw level.  The fallback
                    # below is only for an EX record whose raw relation genuinely
                    # exposes one level; it must never replace an established
                    # vector with level 1.
                    if not ex_desc_vi and raw_ex_desc_vi and ex_sk_val:
                        ex_ad = parse_attr(ex_sk_val.get("Attr", []))
                        pattern = r'(\[([A-Za-z0-9_]+),(?:(\d+))?\])(\s*(?:<\/span>|<\/color>)*\s*)(%|倍|格|回合|点|层|次)?'
                        def ex_rep(m):
                            pname = m.group(2)
                            idx = int(m.group(3)) if m.group(3) else 1
                            unit = m.group(5) or ""
                            closing = m.group(4) or ""
                            val = None
                            if pname in ex_ad:
                                params = ex_ad[pname]
                                if 1 <= idx <= len(params): val = str(params[idx - 1])
                            full_match = f"{pname},{idx}"
                            if val is None and full_match in ex_ad: val = str(ex_ad[full_match][0])
                            if val is None and pname.endswith("Para"):
                                if pname in ex_ad:
                                    params = ex_ad[pname]
                                    if 1 <= idx <= len(params): val = str(params[idx - 1])
                            if val is None: val = m.group(1)
                            return f"{val}{unit}{closing}"
                        ex_desc_vi = re.sub(pattern, ex_rep, raw_ex_desc_vi)
                        ex_desc_vi = re.sub(r'\{Buff_[^}]+\}', '', ex_desc_vi).strip()

                    ex_raw_icon = safe_str(ex_sk_val.get("SkillIcon")) if ex_sk_val else ""
                    ex_icon = resolve_skill_icon(ex_id, ex_raw_icon) or base_icon
                    
                    base_suffix = base_id[-2:] if len(base_id) >= 2 else "01"
                    upgrade_badge_vi = SLOT_UPGRADE_LABEL_MAP.get(base_suffix, "CƯỜNG HÓA KỸ NÂNG")

                    row["type"] = "skill_upgrade"
                    row["skill_upgrade"] = {
                        "base_skill_id": base_id,
                        "enhanced_skill_id": ex_id,
                        "upgrade_badge_vi": upgrade_badge_vi,
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
                            "desc_vi": ex_desc_vi,
                            "mechanics": ex_mechanics,
                            "level_vector_provenance": [
                                {**entry, "raw_edge": f"SkillUP,{base_id}->{ex_id}"}
                                for entry in level_vector_provenance_by_group.get(ex_id, [])
                            ],
                            "display_source": {
                                "skill_id": ex_id,
                                "name_record_id": ex_id,
                                "description_record_id": ex_id,
                                "provenance": "exact SkillUP enhanced SKILL record",
                            },
                            "parameter_source": {
                                "skill_id": ex_id,
                                "provenance": f"exact raw skill levels; SkillUP,{base_id}->{ex_id}",
                            },
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
            if safe_str((hz_loc_dict.get(b_id) or {}).get("character_id")) == cid and isinstance(b_val, dict):
                matches.append((b_id, b_val))
        if not matches: return None
        matches.sort(key=lambda x: x[0])
        b_id, entry = matches[-1]

        hz_loc = hz_loc_dict.get(b_id, {})
        name_cn = safe_str(entry.get("IconNameLanText") or entry.get("IconNameLan") or entry.get("IconName"))
        name_vi = usable_vi(hz_loc.get("icon_name_vi") or hz_loc.get("name_vi", ""))
        icon_name = safe_str(entry.get("Icon")) or f"brilliant_{cid}"
        icon_candidate = icon_name if Path(icon_name).suffix else f"{icon_name}.png"
        if "/" in icon_candidate or "\\" in icon_candidate:
            raise RuntimeError(f"Invalid Hoán Chương icon filename in {b_id}: {icon_name!r}")
        icon_actual = (huanzhang_icon_exact.get(icon_candidate)
                       or huanzhang_icon_casefold.get(icon_candidate.casefold(), ""))
        icon_asset = f"assets/huanzhang/{icon_actual}" if icon_actual else ""
        info_cn = safe_str(entry.get("IconInfoLanText") or entry.get("IconInfoLan") or entry.get("IconInfo"))
        info_vi = usable_vi(hz_loc.get("icon_info_vi") or hz_loc.get("info_vi", ""))
        buff_show_cn = safe_str(entry.get("BuffShowLanText") or entry.get("BuffShowLan") or entry.get("BuffShow"))
        buff_show_vi = usable_vi(hz_loc.get("buff_show_vi", ""))
        gameplay_group_ids = []
        for field in ("Buff", "Skill1", "Skill2"):
            values = entry.get(field, [])
            for value in values if isinstance(values, list) else [values]:
                if value and str(value) not in gameplay_group_ids:
                    gameplay_group_ids.append(str(value))

        stat_labels_vi = {
            "Hp_FIX": "Sinh Mệnh (HP)",
            "Atk_FIX": "Tấn Công (ATK)",
            "PhysicDef_PERCENT": "Phòng Ngự Vật Lý",
            "MagicDef_PERCENT": "Phòng Ngự Cấu Thuật",
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
            "name_vi": name_vi,
            "icon": icon_asset,
            "info_cn": info_cn,
            "info_vi": info_vi,
            "buff_show_cn": buff_show_cn,
            "buff_show_vi": buff_show_vi,
            "_gameplay_group_ids": gameplay_group_ids,
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
                        lvl = raw_record_level(sk_val, sk_key)
                        if lvl in seen_levels: continue
                        seen_levels.add(lvl)
                        
                        sk_id = f"{gid}_{lvl}"
                        sk_entry = skill_loc.get(sk_id, {}) or skill_loc.get(gid, {}) or skill_loc.get(f"{gid}{lvl}", {})
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
                            "name_vi": usable_vi(sk_entry.get("skill_name_vi") or sk_entry.get("name_vi")),
                            "desc_vi": usable_vi(sk_entry.get("skill_desc_vi") or sk_entry.get("desc_vi")),
                            "desc_cn": resolve_desc(sk_val)[0],
                            "mechanics": resolve_desc(sk_val)[2],
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

            if levels:
                multi_desc_cn, multi_desc_vi, multi_mechs, is_template_same = resolve_multi_level_desc(gid)
                for lvl_item in levels:
                    if is_template_same:
                        lvl_item["desc_cn"] = multi_desc_cn
                        if multi_desc_vi:
                            lvl_item["desc_vi"] = multi_desc_vi
                    else:
                        l_num = lvl_item["level"]
                        sk_val_l = all_skills.get((gid, l_num), {})
                        sk_id_l = f"{gid}_{l_num}"
                        sk_entry_l = skill_loc.get(sk_id_l, {}) or skill_loc.get(gid, {}) or skill_loc.get(f"{gid}{l_num}", {})
                        d_cn_l, d_vi_l, _ = resolve_desc(sk_val_l, sk_entry_l)
                        lvl_item["desc_cn"] = d_cn_l
                        lvl_item["desc_vi"] = d_vi_l if d_vi_l else ""

                    if lvl_item.get("desc_vi"):
                        ad = parse_attr(all_skills.get((gid, lvl_item["level"]), {}).get("Attr", []))
                        pattern = r'(\[([A-Za-z0-9_]+),(?:(\d+))?\])(\s*(?:<\/span>|<\/color>)*\s*)(%|倍|格|回合|点|层|次)?'
                        def single_rep(m):
                            pname = m.group(2)
                            idx = int(m.group(3)) if m.group(3) else 1
                            unit = m.group(5) or ""
                            closing = m.group(4) or ""
                            val = None
                            if pname in ad:
                                params = ad[pname]
                                if 1 <= idx <= len(params): val = str(params[idx - 1])
                            full_match = f"{pname},{idx}"
                            if val is None and full_match in ad: val = str(ad[full_match][0])
                            if val is None and pname.endswith("Para"):
                                if pname in ad:
                                    params = ad[pname]
                                    if 1 <= idx <= len(params): val = str(params[idx - 1])
                            if val is None: val = m.group(1)
                            return f"{val}{unit}{closing}"
                        lvl_item["desc_vi"] = re.sub(pattern, single_rep, lvl_item["desc_vi"])
                        lvl_item["desc_vi"] = re.sub(r'\{Buff_[^}]+\}', '', lvl_item["desc_vi"]).strip()
                    lvl_item["mechanics"] = multi_mechs

                raw_skills_dict[gid] = {
                    "group_id": gid,
                    "max_level": len(levels),
                    "levels": levels,
                    "alternate_forms": [],
                    "summon_skills": []
                }
                
        # Structural classification and linking
        brilliant_info = extract_char_brilliant_info(cid)
        def huanzhang_gameplay_fallback(raw_desc, source_cn, source_vi):
            """Return only the HZ paragraphs that correspond to a SKILL source.

            BrilliantMap can expose a BuffShow composed of the linked gameplay
            text followed by an expanded status definition.  The latter belongs
            in its BUFF_STATUS popup, never in the gameplay card body.
            """
            if not raw_desc or not source_cn or not source_vi:
                return ""
            raw_parts = [part.strip() for part in re.split(r"\n+", re.sub(r"\{Buff_[^}]+\}", "", raw_desc)) if part.strip()]
            source_cn_parts = [part.strip() for part in re.split(r"\n\s*\n", source_cn) if part.strip()]
            source_vi_parts = [part.strip() for part in re.split(r"\n\s*\n", source_vi) if part.strip()]
            if not raw_parts or len(source_cn_parts) < len(raw_parts) or len(source_vi_parts) < len(raw_parts):
                return ""
            norm = lambda text: re.sub(r"\s+", "", text)
            if norm("\n".join(raw_parts)) != norm("\n".join(source_cn_parts[:len(raw_parts)])):
                return ""
            return "\n".join(source_vi_parts[:len(raw_parts)])

        # BuffShow is an authored Hoán Chương effect.  A linked gameplay group may
        # temporarily borrow its valid VI only when BrilliantMap explicitly joins
        # the two records.  The card remains the SKILL entity and retains its raw
        # Chinese source and mechanics/popup references.
        if brilliant_info and brilliant_info.get("buff_show_vi"):
            source_id = brilliant_info.get("id", "")
            for gameplay_gid in brilliant_info.get("_gameplay_group_ids", []):
                skill = raw_skills_dict.get(gameplay_gid)
                if not skill:
                    continue
                for level in skill.get("levels", []):
                    fallback_vi = huanzhang_gameplay_fallback(
                        level.get("desc_raw", ""), brilliant_info.get("buff_show_cn", ""), brilliant_info["buff_show_vi"]
                    )
                    if not level.get("desc_vi") and fallback_vi:
                        level["desc_vi"] = fallback_vi

        independent_skills = []
        alternate_forms_map = {} # parent_id -> list of skills
        summon_skills_map = {} # parent_id -> list of skills
        brilliant_skills_list = []
        
        for gid, sk in raw_skills_dict.items():
            name = sk["levels"][0]["name_cn"]
            stype = sk["levels"][0]["type_id"]
            
            # Check 1: Hoán Chương (Brilliant) skills
            if gid in brilliant_skill_gids_by_character.get(cid, set()):
                sk_copy = sk.copy()
                for level in sk_copy.get("levels", []):
                    # BrilliantMap proves gameplay ownership, but a normal skill
                    # Type/icon fallback does not prove a Hoán Chương tag or icon.
                    raw_skill = all_skills.get((gid, level.get("level", 1)), {})
                    raw_icon = safe_str(raw_skill.get("SkillIcon")) if raw_skill else ""
                    level["icon"] = resolve_skill_icon(gid, raw_icon, allow_generated_fallback=False)
                    level["type"] = "Hoán Chương"
                    level["type_id"] = 0
                brilliant_skills_list.append(sk_copy)
                continue

            category = "Base"
            parent_id = None
            
            # Check 2: EX variants (inferred progression variants)
            if "ex" in gid.lower() or "-超群" in name:
                category = "EX"
                parent_id = gid.lower().replace("ex", "").upper()
            # Check 3: Summon skills (ONLY if "summon" is explicitly in gid.lower())
            elif "summon" in gid.lower():
                category = "Summon"
                idx = gid.lower().find("summon")
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
        # Note: independent_skills contains internal helper/NPC/battle-logic records (e.g. A016005npc01)
        # that are not part of the public 6 base skill cards (skill1..skill6).
        # They remain available internally via raw_skills_dict if needed, but are excluded from the public base skills list.
            
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

    def extract_character_attack_style_type(char_record):
        """Derive attack style classification (1=Cận chiến, 2=Tầm xa, 0=Chưa xác định)

        Derived SOLELY from exact textual tokens in CharacterTagLanText:
          - Contains '近战' and not '远程' -> 1 (Cận chiến)
          - Contains '远程' and not '近战' -> 2 (Tầm xa)
          - Neither or both -> 0 (Chưa xác định)
        No job fallback, no attack range / SelectRange inference, no numeric attacktype inference.
        """
        raw_tags = char_record.get("CharacterTagLanText") or ""
        tokens = [t.strip() for t in raw_tags.replace("；", ";").replace(",", ";").split(";") if t.strip()]
        has_melee = "近战" in tokens
        has_ranged = "远程" in tokens
        if has_melee and not has_ranged:
            return 1
        elif has_ranged and not has_melee:
            return 2
        return 0

    chars_db = {}
    slug_counts = {}

    for cid in char_talents:
        char_talents[cid] = sorted(char_talents[cid], key=lambda x: x["id"])

    for cid, data in char_table_raw.items():
        # A Switch=0 record is only a preload when it has neither a raw visual
        # reference nor a published avatar/drawing. Older released records
        # retain Switch=0, so both asset checks are deliberately required.
        raw_visual_reference = any(data.get(field) not in (None, "", 0, []) for field in (
            "mainAvatar", "trainingAvatar", "setCharacterAvatar",
            "beforeFullImage", "afterFullImage",
        ))
        avatar_available = (PUBLIC_DIR / "assets" / "characters" / "avatars" / f"{cid}.png").exists()
        drawing_available = any(skin.get("is_base") for skin in char_skins_processed.get(cid, []))
        if data.get("Switch") == 0 and not raw_visual_reference and not (avatar_available or drawing_available):
            continue
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

        brilliant_info = extract_char_brilliant_info(cid)
        if brilliant_info:
            brilliant_info.pop("_gameplay_group_ids", None)

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
            "attack_style_type": extract_character_attack_style_type(data),
            "is_limited": bool(data.get("Linkage")),
            "icon": f"assets/characters/avatars/{cid}.png",
            "cards": char_cards.get(cid, []),
            "skins": char_skins_processed.get(cid, []),
            "talents": talents,
            "skills": char_skills.get(cid, []),
            "brilliant_skills": char_brilliant_skills.get(cid, []),
            "brilliant_info": brilliant_info,
            "has_huanzhang": bool(brilliant_info or char_brilliant_skills.get(cid, [])),
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
        
    # Popup text is canonical per exact Buff_ID.  Card mechanics below only carry
    # the proven local closure and term-to-ID bindings; they are never a second
    # competing source of localized popup text.
    canonical_buff_registry = {}
    for buff_id, buff_data in buff_loc.items():
        if not isinstance(buff_data, dict):
            continue
        name_cn = safe_str(buff_data.get("buff_name_cn") or buff_data.get("name_cn"))
        desc_cn = safe_str(buff_data.get("buff_desc_cn") or buff_data.get("desc_cn"))
        if not name_cn and not desc_cn:
            continue
        canonical_buff_registry[str(buff_id)] = {
            "name_cn": name_cn,
            "name_vi": usable_vi(buff_data.get("buff_name_vi") or buff_data.get("name_vi")),
            "desc_cn": re.sub(r'\{Buff_[^}]+\}', '', desc_cn).strip(),
            "desc_vi": re.sub(r'\{Buff_[^}]+\}', '', usable_vi(buff_data.get("buff_desc_vi") or buff_data.get("desc_vi"))).strip(),
        }

    web_data = {
        "asset_base_url": remote_asset_manifest["public_base_url"],
        "characters": chars_db,
        "items": items_db,
        "expCurve": exp_curve,
        "rankUpRules": rank_up_rules,
        "buff_registry": canonical_buff_registry,
    }
    
    OUT_FILE.write_text(json.dumps(web_data, ensure_ascii=False, separators=(',', ':')), encoding="utf-8")
    print(f"Generated {OUT_FILE} ({len(chars_db)} chars, {len(items_db)} items)")

if __name__ == "__main__":
    build()
