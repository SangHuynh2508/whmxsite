import json
import os
import sys
import re
from pathlib import Path

from asset_publish_manifest import load_manifest, manifest_path

if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

HAN_RE = re.compile(r'[\u3400-\u9fff]')
EFFECT_PARAM_RE = re.compile(r'\[(?:EffectParam|EffectPara|BuffParam|Effect[1-5]Para|Condition[1-5]Para)(?:,[^\]]*)?\]')
RAW_HASH_PARAM_RE = re.compile(r'(?<![A-Za-z0-9_])#\d+\b')

# This is intentionally small.  GLOSSARY is authority only for the shared
# terminology approved by the owner; per-character BUFF_STATUS rows remain
# outside this cross-project table.
OWNER_SHARED_GLOSSARY_TERMS = {
    "蓄势": "Súc Thế",
    "萧瑟": "Tiêu Sắt",
    "截招": "Tiệt Chiêu",
    "滞缓": "Trệ Hoãn",
    "瞄准": "Miêu Chuẩn",
    "脆弱": "Thúy Nhược",
    "降低命中率": "Giảm Tỷ Lệ Trúng",
}
OWNER_PRIVATE_BUFF_NAMES = {"铜锈", "隐蔽", "吉时", "避让", "临时干部"}

def contains_unresolved_player_parameter(value):
    return bool(EFFECT_PARAM_RE.search(str(value or '')) or RAW_HASH_PARAM_RE.search(str(value or '')))

def clean_text(value):
    return re.sub(r'<[^>]+>', '', str(value or '')).strip()

def valid_vi(value):
    text = clean_text(value)
    return bool(text) and not HAN_RE.search(text)

def iter_public_skill_records(characters):
    """Yield every player-facing skill record, including Hoán Chương and Trí Tri EX."""
    for cid, char in characters.items():
        for bucket in ("skills", "brilliant_skills"):
            for skill in char.get(bucket, []) or []:
                gid = str(skill.get("group_id", ""))
                for level in skill.get("levels", []) or []:
                    yield cid, gid, int(level.get("level", 1)), level
        for row in char.get("zhizhi", []) or []:
            upgrade = row.get("skill_upgrade") or {}
            enhanced = upgrade.get("enhanced_skill") or {}
            if enhanced.get("group_id"):
                yield cid, str(enhanced["group_id"]), 1, enhanced


def validate_skill_icon_integrity(data, errors):
    """Require exact filesystem casing for every emitted local skill icon URL."""
    skills_dir = Path("public") / "assets" / "skills"
    if not skills_dir.is_dir():
        errors.append("SKILL_ICON_INTEGRITY missing public/assets/skills directory")
        return
    exact_names = {path.name for path in skills_dir.iterdir() if path.is_file()}
    casefold_names = {}
    for name in exact_names:
        prior = casefold_names.setdefault(name.casefold(), name)
        if prior != name:
            errors.append(f"SKILL_ICON_INTEGRITY casefold collision: {prior!r} / {name!r}")

    checked = 0

    def check_icon(context, icon):
        nonlocal checked
        icon = str(icon or "")
        if not icon:
            return
        local = icon[1:] if icon.startswith("/") else icon
        if not local.startswith("assets/skills/"):
            return
        checked += 1
        filename = local.removeprefix("assets/skills/")
        if not filename or "/" in filename or "\\" in filename:
            errors.append(f"SKILL_ICON_INTEGRITY {context}: invalid local skill icon URL {icon!r}")
        elif filename not in exact_names:
            hint = casefold_names.get(filename.casefold())
            suffix = f"; actual filename is {hint!r}" if hint else ""
            errors.append(
                f"SKILL_ICON_INTEGRITY {context}: URL {icon!r} does not exactly match a published filename{suffix}"
            )

    for cid, char in (data.get("characters") or {}).items():
        for bucket in ("skills", "brilliant_skills"):
            for skill in char.get(bucket, []) or []:
                gid = skill.get("group_id", "")
                for level in skill.get("levels", []) or []:
                    check_icon(f"{cid} {bucket} {gid} Lv.{level.get('level', 1)}", level.get("icon"))
        for row in char.get("zhizhi", []) or []:
            upgrade = row.get("skill_upgrade") or {}
            for label in ("base_skill", "enhanced_skill"):
                skill = upgrade.get(label) or {}
                check_icon(f"{cid} zhizhi star {row.get('star')} {label}", skill.get("icon"))
    print(f"SKILL_ICON_INTEGRITY checked={checked} errors={sum('SKILL_ICON_INTEGRITY' in item for item in errors)}")


def validate_huanzhang_coverage(data, errors):
    """Audit every raw BrilliantMap record through localization, icon, and web output."""
    raw_root = Path("..") / "NeoArtifacts" / "MasterData" / "json"
    paths = {
        name: raw_root / name
        for name in ("BrilliantMap.json", "skillMap.json", "characterSkillMap.json", "characterPassiveSkillMap.json")
    }
    if not all(path.is_file() for path in paths.values()):
        errors.append("HUANZHANG_COVERAGE missing authoritative raw tables")
        return
    raw = {name: json.loads(path.read_text(encoding="utf-8")) for name, path in paths.items()}
    generated_path = Path("localization") / "generated_localization.json"
    generated = json.loads(generated_path.read_text(encoding="utf-8")) if generated_path.is_file() else {}
    localized = generated.get("huanzhang") or {}
    owners = {}
    for source in (raw["skillMap.json"], raw["characterSkillMap.json"], raw["characterPassiveSkillMap.json"]):
        for record in source.values():
            if not isinstance(record, dict):
                continue
            group, hero = str(record.get("GroupId") or ""), str(record.get("HeroId") or "")
            if group and hero:
                owners.setdefault(group, set()).add(hero)
    assets = Path("public") / "assets" / "huanzhang"
    exact_files = {path.name for path in assets.iterdir() if path.is_file()} if assets.is_dir() else set()
    casefold_files = {name.casefold(): name for name in exact_files}
    missing_localization = 0
    for brilliant_id, record in raw["BrilliantMap.json"].items():
        loc = localized.get(brilliant_id)
        if not loc:
            missing_localization += 1
            errors.append(f"HUANZHANG_COVERAGE raw [{brilliant_id}] has no localization row")
            continue
        groups = []
        for field in ("Buff", "Skill1", "Skill2"):
            value = record.get(field, [])
            groups.extend(value if isinstance(value, list) else [value])
        raw_owners = {hero for group in groups for hero in owners.get(str(group), set())}
        owner = str(loc.get("character_id") or "")
        if len(raw_owners) == 1 and owner not in raw_owners:
            errors.append(f"HUANZHANG_COVERAGE [{brilliant_id}] owner {owner!r} disagrees with exact raw groups {sorted(raw_owners)!r}")
        icon = str(record.get("Icon") or "")
        # Legacy/upgrade-only raw rows intentionally have no presentable Icon;
        # they remain in the matrix but must not be fabricated as web cards.
        if icon:
            expected = icon if Path(icon).suffix else f"{icon}.png"
            actual = casefold_files.get(expected.casefold())
            if not actual:
                errors.append(f"HUANZHANG_COVERAGE [{brilliant_id}] missing local icon {expected!r}")
            char = (data.get("characters") or {}).get(owner) or {}
            if (char.get("brilliant_info") or {}).get("id") != brilliant_id:
                errors.append(f"HUANZHANG_COVERAGE [{brilliant_id}] has no matching public brilliant_info for {owner}")
    print(f"HUANZHANG_COVERAGE raw={len(raw['BrilliantMap.json'])} localized={len(localized)} missing={missing_localization}")

def validate_localization_integrity(data, errors, warnings):
    """Cross-check generated localization against the post-build public contract."""
    generated_path = Path("localization") / "generated_localization.json"
    if not generated_path.exists():
        errors.append("Missing localization/generated_localization.json for localization integrity audit")
        return
    with generated_path.open("r", encoding="utf-8") as handle:
        generated = json.load(handle)

    public_index = {}
    public_records = []
    for cid, gid, level, record in iter_public_skill_records(data.get("characters", {})):
        public_index.setdefault((cid, gid, level), record)
        public_records.append((cid, gid, level, record))

    # A valid workbook/exported VI skill field must not silently fall through to CN.
    for source_id, source in (generated.get("skills") or {}).items():
        cid = str(source.get("character_id", ""))
        match = re.match(r"^(.*)_(\d+)$", str(source_id))
        # Workbook record IDs are not a reliable gameplay key (notably ...061
        # and ...ex); generated group_id is the deterministic source relation.
        source_key = str(source_id)
        gid = source_key if source_key.lower().endswith("ex") else str(source.get("group_id") or (match.group(1) if match else source_key))
        level = int(match.group(2)) if match else 1
        target = public_index.get((cid, gid, level))
        if not target:
            if valid_vi(source.get("skill_name_vi", "")) or valid_vi(source.get("desc_vi", "")):
                warnings.append(f"Localization skill [{source_id}] has valid VI but no public skill record")
            continue
        for source_field, public_field in (("skill_name_vi", "name_vi"), ("desc_vi", "desc_vi")):
            value = source.get(source_field, "")
            if valid_vi(value) and not valid_vi(target.get(public_field, "")):
                errors.append(f"Skill [{source_id}] has valid VI {source_field} but public {public_field} falls back to CN")
            elif value and not valid_vi(value):
                warnings.append(f"Skill [{source_id}] {source_field} is mixed CN/VI; public output correctly falls back to CN")

    # Hoán Chương metadata is independent from its gameplay SKILL record.
    for hz_id, source in (generated.get("huanzhang") or {}).items():
        cid = str(source.get("character_id", ""))
        target = (data.get("characters", {}).get(cid, {}).get("brilliant_info") or {})
        for source_field, public_field in (("icon_name_vi", "name_vi"), ("icon_info_vi", "info_vi"), ("buff_show_vi", "buff_show_vi")):
            if valid_vi(source.get(source_field, "")) and not valid_vi(target.get(public_field, "")):
                errors.append(f"Hoán Chương [{hz_id}] has valid VI {source_field} but public {public_field} falls back to CN")

    buffs = generated.get("buffs") or {}
    for cid, gid, level, record in public_records:
        desc_cn = clean_text(record.get("desc_cn", ""))
        desc_vi = clean_text(record.get("desc_vi", ""))
        mechanic_by_id = {
            mechanic.get("key"): mechanic for mechanic in (record.get("mechanics", []) or [])
            if isinstance(mechanic, dict) and mechanic.get("key")
        }

        def descendants(root_id):
            found, pending = set(), list((mechanic_by_id.get(root_id) or {}).get("child_buff_ids", []) or [])
            while pending:
                child_id = pending.pop()
                if child_id in found:
                    continue
                found.add(child_id)
                pending.extend((mechanic_by_id.get(child_id) or {}).get("child_buff_ids", []) or [])
            return found

        for mechanic in record.get("mechanics", []) or []:
            if not isinstance(mechanic, dict):
                continue
            buff_id = mechanic.get("key")
            popup_terms = mechanic.get("popup_terms", []) or []
            if mechanic.get("kind") == "MULTI_VARIANT_CONTROLLER":
                variants = mechanic.get("variant_children", []) or []
                if len(variants) < 2:
                    errors.append(f"Skill [{gid}] multi-variant binding [{buff_id}] has fewer than two exact children")
                for variant in variants:
                    child_key = variant.get("binding_key")
                    child = mechanic_by_id.get(child_key)
                    child_body = (child or {}).get("desc_vi") or ((child or {}).get("desc_cn") if (child or {}).get("canonical_vi_missing") else "")
                    if not child or not child_body:
                        errors.append(f"Skill [{gid}] multi-variant binding [{buff_id}] child [{child_key}] has no resolved body")
                    elif contains_unresolved_player_parameter(child_body):
                        errors.append(f"Skill [{gid}] multi-variant binding [{buff_id}] child [{child_key}] contains unresolved parameter")
            if popup_terms and buff_id not in buffs:
                warnings.append(f"Skill [{gid}] references buff [{buff_id}] without a BUFF_STATUS localization record")
            for term in popup_terms:
                target_id = term.get("buff_id")
                binding_key = term.get("binding_key") or target_id
                anchor = clean_text(term.get("name_vi") or term.get("name_cn"))
                if not anchor:
                    errors.append(f"Skill [{gid}] popup [{target_id}] has MISSING_NAMED_POPUP_ANCHOR")
                elif EFFECT_PARAM_RE.search(anchor) or RAW_HASH_PARAM_RE.search(anchor) or re.fullmatch(r'[\d\s.,/%+\-]+', anchor):
                    errors.append(f"Skill [{gid}] popup [{target_id}] uses numeric/parameter-only popup anchor [{anchor}]")
                if binding_key not in mechanic_by_id:
                    errors.append(f"Skill [{gid}] popup target [{target_id}] is absent from this card's mechanics")
                    continue
                binding = mechanic_by_id[binding_key]
                if binding.get("key") != target_id:
                    errors.append(f"Skill [{gid}] popup binding [{binding_key}] resolves to wrong buff [{binding.get('key')}] instead of [{target_id}]")
                    continue
                if target_id != buff_id and target_id not in descendants(buff_id):
                    errors.append(f"Skill [{gid}] popup target [{target_id}] is not a child of mechanic buff [{buff_id}]")
                    continue
                buff = buffs.get(target_id, {})
                expected_cn = clean_text(buff.get("buff_name_cn", ""))
                expected_vi = clean_text(buff.get("buff_name_vi", ""))
                if expected_cn and term.get("name_cn") != expected_cn:
                    errors.append(f"Skill [{gid}] popup [{target_id}] uses a name from another buff")
                if desc_vi and not expected_vi:
                    warnings.append(f"Skill [{gid}] buff [{target_id}] has no BUFF_STATUS VI name, so the coloured VI term has no popup target")
                if desc_vi and expected_vi and expected_vi not in desc_vi:
                    warnings.append(f"Skill [{gid}] popup [{target_id}] cannot be rendered by exact BUFF_STATUS VI name")

                canonical_vi_raw = buff.get("buff_desc_vi") or buff.get("desc_vi", "")
                canonical_vi = canonical_vi_raw if valid_vi(canonical_vi_raw) else ""
                binding_vi = binding.get("desc_vi", "")
                canonical_vi_missing = bool(binding.get("canonical_vi_missing"))
                if canonical_vi and not binding_vi:
                    errors.append(f"Skill [{gid}] popup [{target_id}] has canonical VI but resolved binding VI is empty")
                if canonical_vi and canonical_vi_missing:
                    errors.append(f"Skill [{gid}] popup [{target_id}] incorrectly marks canonical_vi_missing")
                selected_body = binding_vi or (binding.get("desc_cn", "") if canonical_vi_missing else "")
                if contains_unresolved_player_parameter(selected_body):
                    errors.append(f"Skill [{gid}] popup [{target_id}] player-facing body contains unresolved parameter")

            # A coloured source buff name with an exported mechanic must have an explicit
            # popup term.  Colour alone is never sufficient to create one.
            colored_names = [clean_text(x) for x in re.findall(r'<color=[^>]+>(.*?)</color>', record.get("desc_cn", ""), flags=re.I | re.S)]
            if clean_text(mechanic.get("name_cn", "")) in colored_names and not popup_terms:
                warnings.append(f"Skill [{gid}] coloured buff [{buff_id}] has no deterministic popup target")

    # Zhizhi must retain the exact raw SkillUP base -> enhanced relationship.
    raw_roleattr = Path("..") / "NeoArtifacts" / "MasterData" / "json" / "roleattrMap.json"
    if raw_roleattr.exists():
        with raw_roleattr.open("r", encoding="utf-8") as handle:
            roleattrs = json.load(handle)
        for raw in roleattrs.values():
            cid = str(raw.get("id", ""))
            if cid not in data.get("characters", {}):
                continue
            star = raw.get("star")
            attrs = raw.get("starUpAttr") or []
            values = attrs if isinstance(attrs, list) else [attrs]
            for value in values:
                if not str(value).startswith("SkillUP,"):
                    continue
                base = str(value).split(",", 1)[1]
                row = next((x for x in (data.get("characters", {}).get(cid, {}).get("zhizhi") or []) if x.get("star") == star), {})
                upgrade = row.get("skill_upgrade") or {}
                if upgrade.get("base_skill_id") != base or upgrade.get("enhanced_skill_id") != f"{base}ex":
                    errors.append(f"Zhizhi [{cid} star {star}] does not match raw SkillUP relation {base} -> {base}ex")
                    continue

                enhanced = upgrade.get("enhanced_skill") or {}
                ex_id = f"{base}ex"
                display_source = enhanced.get("display_source") or {}
                parameter_source = enhanced.get("parameter_source") or {}
                if (
                    display_source.get("skill_id") != ex_id
                    or display_source.get("name_record_id") != ex_id
                    or display_source.get("description_record_id") != ex_id
                ):
                    errors.append(
                        f"Zhizhi [{cid} star {star}] EX [{ex_id}] mixes display records: "
                        f"{display_source}"
                    )
                # Parameter provenance may point to a proven raw vector, but
                # must never be promoted into the display record.
                if parameter_source.get("skill_id") and parameter_source.get("skill_id") != ex_id:
                    errors.append(
                        f"Zhizhi [{cid} star {star}] EX [{ex_id}] uses parameter source "
                        f"[{parameter_source.get('skill_id')}] as display source"
                    )
                exact_loc = (generated.get("skills") or {}).get(ex_id, {})
                expected_name = exact_loc.get("skill_name_vi", "")
                if valid_vi(expected_name) and enhanced.get("name_vi") != expected_name:
                    errors.append(
                        f"Zhizhi [{cid} star {star}] EX [{ex_id}] ignores exact localized name "
                        f"[{expected_name}] for [{enhanced.get('name_vi', '')}]"
                    )


def validate_owner_term_audit(data, errors):
    """Audit the narrowly approved shared glossary and W0164 raw bindings."""
    generated_path = Path("localization") / "generated_localization.json"
    if not generated_path.exists():
        errors.append("OWNER_TERM_AUDIT cannot read generated glossary")
        return
    with generated_path.open("r", encoding="utf-8") as handle:
        glossary = (json.load(handle).get("glossary") or {})

    glossary_errors = 0
    for cn, vi in OWNER_SHARED_GLOSSARY_TERMS.items():
        entry = glossary.get(cn) or {}
        if (entry.get("term_vi"), entry.get("status")) != (vi, "OWNER_APPROVED"):
            glossary_errors += 1
            errors.append(f"OWNER_GLOSSARY [{cn}] must be {vi}/OWNER_APPROVED, found {entry}")
    for cn in OWNER_PRIVATE_BUFF_NAMES:
        if cn in glossary:
            glossary_errors += 1
            errors.append(f"OWNER_GLOSSARY_SCOPE private buff [{cn}] must not be in GLOSSARY")

    char = (data.get("characters") or {}).get("W0164") or {}
    levels_by_group = {
        skill.get("group_id"): skill.get("levels") or []
        for skill in char.get("skills") or []
    }
    audit = {
        "RAW_MARKER_WITHOUT_POPUP": 0,
        "VISIBLE_TERM_CANONICAL_NAME_MISMATCH": 0,
        "GENERIC_MULTI_VARIANT_TRIGGER": 0,
        "PARTIAL_SUBSTRING_TRIGGER": 0,
    }

    def mechanics(group_id):
        return [m for level in levels_by_group.get(group_id, [])
                for m in (level.get("mechanics") or [])]

    def exact_popup(group_id, buff_id, name_vi):
        for mechanic in mechanics(group_id):
            for term in mechanic.get("popup_terms") or []:
                if term.get("buff_id") == buff_id and term.get("name_vi") == name_vi:
                    return True
        return False

    # Each listed raw relationship has a deterministic, card-local popup.
    for group_id, buff_id, name_vi in (
        ("W016411", "Buff_AllDmgIncrease", "Súc Thế"),
        ("W016404", "Buff_Mov_Down", "Trệ Hoãn"),
        ("W016404", "Buff_AllDmgReduce", "Tiêu Sắt"),
        ("W016404", "Buff_HitRate_Down", "Tiệt Chiêu"),
    ):
        if not exact_popup(group_id, buff_id, name_vi):
            audit["RAW_MARKER_WITHOUT_POPUP"] += 1
            errors.append(f"W0164 [{group_id}] raw marker [{buff_id}] has no exact popup [{name_vi}]")

    for group_id, cn, vi in (("W016411", "待放", "Đãi Phóng"), ("W016402", "绽放", "Triện Phóng")):
        controllers = [m for m in mechanics(group_id)
                       if m.get("kind") == "MULTI_VARIANT_CONTROLLER" and m.get("name_cn") == cn]
        if not any(len(m.get("variant_children") or []) == 5 and exact_popup(group_id, m.get("key"), vi)
                   for m in controllers):
            audit["GENERIC_MULTI_VARIANT_TRIGGER"] += 1
            errors.append(f"W0164 [{group_id}] generic [{cn}] lacks its five-variant popup controller")

    # A field is prose/mechanic, not the generic 绽放 buff.  The only eligible
    # visible term on W016402 is the exact standalone `绽放` binding.
    for level in levels_by_group.get("W016402", []):
        if "Triện Phóng Lĩnh Vực" in str(level.get("desc_vi") or ""):
            if any((term.get("name_vi") == "Triện Phóng Lĩnh Vực")
                   for m in (level.get("mechanics") or []) for term in (m.get("popup_terms") or [])):
                audit["PARTIAL_SUBSTRING_TRIGGER"] += 1
                errors.append("W0164 field phrase Triện Phóng Lĩnh Vực was exported as a popup target")

    print("OWNER_TERM_AUDIT " + " ".join(f"{key}={value}" for key, value in audit.items())
          + f" GLOSSARY_ERRORS={glossary_errors}")


def validate_character_talent_eligibility(data, raw_characters, errors, warnings):
    """Use the raw gameplay-talent field, never IDs or assets, for roster eligibility."""
    if not raw_characters:
        errors.append("CHARACTER_TALENT_ELIGIBILITY cannot read raw characterTable")
        return
    fields = {field for record in raw_characters.values() if isinstance(record, dict) for field in record}
    # Current MasterData serializes this gameplay field as TalentRecommend.
    # Prefer a literal Talent field when a future raw schema provides it.
    talent_field = "Talent" if "Talent" in fields else "TalentRecommend" if "TalentRecommend" in fields else ""
    if not talent_field:
        errors.append("CHARACTER_TALENT_ELIGIBILITY has no Talent field in raw characterTable")
        return
    playable, npc_empty, inconsistent = [], [], []
    for cid, record in raw_characters.items():
        if talent_field not in record:
            inconsistent.append(cid)
        elif record.get(talent_field):
            playable.append(cid)
        else:
            npc_empty.append(cid)
    public = data.get("characters", {})
    for cid in npc_empty:
        if cid in public:
            warnings.append(f"[NPC_TALENT_EMPTY_IN_PUBLIC_ROSTER] [{cid}] has empty raw {talent_field}; review raw relations before any roster change")
    generated_path = Path("localization") / "generated_localization.json"
    generated = {}
    if generated_path.exists():
        with generated_path.open("r", encoding="utf-8") as handle:
            generated = json.load(handle).get("characters") or {}
    a0001 = raw_characters.get("A0001") or {}
    expected_cn, expected_vi = "山水人物镜", "Sơn Thủy Nhân Vật Kính"
    if a0001.get("namelanText") != expected_cn:
        errors.append(f"[A0001_RAW_SOURCE_MISMATCH] expected {expected_cn}, found {a0001.get('namelanText')!r}")
    for scope, value in (("generated", (generated.get("A0001") or {}).get("name_vi")), ("public", (public.get("A0001") or {}).get("name_vi"))):
        if value != expected_vi:
            errors.append(f"[A0001_OWNER_CANONICAL_MISMATCH] {scope} name_vi must be {expected_vi!r}, found {value!r}")
    generic_labels = {"Nhà Sưu Tầm", "Người Chơi", "NPC"}
    for cid in playable:
        localized = generated.get(cid) or {}
        name_vi = localized.get("name_vi")
        if name_vi in generic_labels and name_vi != (raw_characters[cid].get("namelanText") or ""):
            errors.append(f"[PLAYABLE_GENERIC_NAME_FALLBACK] [{cid}] has raw {talent_field} but generic name_vi {name_vi!r}")
    print(
        "CHARACTER_TALENT_ELIGIBILITY "
        f"FIELD={talent_field} PLAYABLE_OR_GAMEPLAY_CHARACTER={len(playable)} "
        f"NPC_TALENT_EMPTY={len(npc_empty)} OWNER_OVERRIDE=0 INCONSISTENT_TALENT_DATA={len(inconsistent)}"
    )

def validate():
    remote_asset_manifest = load_manifest(manifest_path(Path(__file__).resolve().parent.parent))
    print("=== STARTING DATA VALIDATION ===")
    data_path = os.path.join("public", "data.json")
    if not os.path.exists(data_path):
        print(f"CRITICAL ERROR: {data_path} does not exist!")
        sys.exit(1)
        
    with open(data_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    raw_character_path = Path("..") / "NeoArtifacts" / "MasterData" / "json" / "characterTable.json"
    raw_characters = {}
    if raw_character_path.exists():
        with raw_character_path.open("r", encoding="utf-8-sig") as handle:
            raw_characters = json.load(handle)

    errors = []
    warnings = []

    # Top-level keys
    required_keys = ["characters", "items", "expCurve"]
    for k in required_keys:
        if k not in data:
            errors.append(f"Missing top-level key: {k}")

    characters = data.get("characters", {})
    items = data.get("items", {})
    exp_curve = data.get("expCurve", {})

    print(f"Total Characters: {len(characters)}")
    print(f"Total Items: {len(items)}")

    # Valid jobs and rarities
    valid_jobs = {1, 2, 3, 4, 5}
    job_names = {1: 'Túc Vệ', 2: 'Khinh Nhuệ', 3: 'Viễn Kích', 4: 'Cấu Thuật', 5: 'Chiến Lược'}
    valid_rarities = {1, 2, 3, 4, 5} # 4=SSR, 3=SR, 2=R, 5=EXTRA
    valid_attacktypes = {1, 2} # raw engine field characterTable.attacktype
    valid_attack_style_types = {0, 1, 2} # 0=Chưa xác định, 1=Cận chiến, 2=Tầm xa
    attack_style_names = {0: 'Chưa xác định', 1: 'Cận chiến', 2: 'Tầm xa'}

    seen_char_ids = set()
    EXCLUDED_CHARACTER_IDS = {"W0021", "ES013"}

    for cid, char in characters.items():
        publish_flag = (raw_characters.get(cid) or {}).get("Switch")
        # Switch=0 is not sufficient by itself: legacy released rows use it.
        # A preload has the raw flag, no raw visual reference, and no locally
        # published visual reference, the same rule used by the builder.
        raw_visual_reference = any((raw_characters.get(cid) or {}).get(field) not in (None, "", 0, [])
                                   for field in ("mainAvatar", "trainingAvatar", "setCharacterAvatar", "beforeFullImage", "afterFullImage"))
        local_avatar = Path("public") / "assets" / "characters" / "avatars" / f"{cid}.png"
        drawing_available = any(
            skin.get("is_base") and str(skin.get("image", "")).startswith(("https://", "http://"))
            for skin in char.get("skins", [])
        )
        is_unreleased = publish_flag == 0 and not raw_visual_reference and not (local_avatar.exists() or drawing_available)
        if is_unreleased:
            warnings.append(
                f"[UNRELEASED_CHARACTER_IN_PUBLIC_ROSTER] Char [{cid}] has raw Switch=0; "
                "the current public artifact is stale and must be rebuilt before deployment"
            )
        if cid in EXCLUDED_CHARACTER_IDS or cid.startswith("SCJ"):
            errors.append(f"Non-playable character ID '{cid}' found in playable characters dataset!")

        # Check ID match
        if char.get("id") != cid:
            errors.append(f"Character key '{cid}' mismatch with char.id '{char.get('id')}'")

        if cid in seen_char_ids:
            errors.append(f"Duplicate character ID: {cid}")
        seen_char_ids.add(cid)

        # Check essential fields
        for field in ["name_vi", "job", "rare", "icon", "attacktype", "attack_style_type"]:
            if field not in char or char[field] is None:
                errors.append(f"Char [{cid}] ({char.get('name_vi', 'Unknown')}): Missing or null required field '{field}'")

        job = char.get("job")
        if job not in valid_jobs:
            errors.append(f"Char [{cid}]: Invalid job value '{job}'")

        rare = char.get("rare")
        if rare not in valid_rarities:
            errors.append(f"Char [{cid}]: Invalid rarity value '{rare}'")

        raw_char = raw_characters.get(cid) or {}

        # 1. Raw engine field attacktype check
        attacktype = char.get("attacktype")
        raw_at = raw_char.get("attacktype")
        if attacktype != raw_at:
            errors.append(f"Char [{cid}]: attacktype {attacktype} does not match raw characterTable.attacktype {raw_at}")

        # 2. Text-tag derived presentation field attack_style_type check
        attack_style_type = char.get("attack_style_type")
        if attack_style_type not in valid_attack_style_types:
            errors.append(f"Char [{cid}]: Invalid attack_style_type value '{attack_style_type}'")

        raw_tags = raw_char.get("CharacterTagLanText") or ""
        tokens = [t.strip() for t in raw_tags.replace("；", ";").replace(",", ";").split(";") if t.strip()]
        has_melee = "近战" in tokens
        has_ranged = "远程" in tokens
        expected_style_type = 1 if (has_melee and not has_ranged) else (2 if (has_ranged and not has_melee) else 0)

        if attack_style_type != expected_style_type:
            errors.append(f"Char [{cid}]: attack_style_type {attack_style_type} does not match authoritative raw tags {raw_tags!r} (expected {expected_style_type})")

        # CURRENT 133-roster regression invariant: only V0172 and W0178 (switch/form tags)
        # currently lack explicit 近战 / 远程 tokens; this is a current-catalog regression invariant,
        # not an immutable game-wide rule.
        if attack_style_type == 0 and cid not in ("V0172", "W0178"):
            errors.append(f"Char [{cid}]: Unexpected unresolved attack_style_type (0) with tags {raw_tags!r}")

        # Check Icon image existence
        icon_path = char.get("icon")
        if icon_path:
            norm_icon = icon_path.replace("assets/avatars/", "assets/characters/avatars/")
            full_icon_path = os.path.join("public", norm_icon.replace("/", os.sep))
            if not os.path.exists(full_icon_path):
                message = f"Char [{cid}]: Missing icon file 'public/{norm_icon}'"
                if is_unreleased:
                    warnings.append(f"[UNRELEASED_MISSING_ASSET] {message}; raw Switch=0")
                else:
                    errors.append(f"[RELEASED_MISSING_ASSET] {message}")

        # Cards and drawings are published remotely.  Data must retain the
        # exact configured base URL and each URL must resolve to a manifest key.
        cards = char.get("cards", [])
        for cname in cards:
            key = str(cname).replace(remote_asset_manifest["public_base_url"].rstrip("/") + "/", "", 1)
            entry = remote_asset_manifest["assets"].get(key)
            if (not str(cname).startswith(remote_asset_manifest["public_base_url"].rstrip("/") + "/")
                    or key != key.lower() or not isinstance(entry, dict) or entry.get("key") != key):
                message = f"Char [{cid}]: Card URL does not resolve through the publish manifest: {cname}"
                if is_unreleased:
                    warnings.append(f"[UNRELEASED_MISSING_ASSET] {message}; raw Switch=0")
                else:
                    errors.append(f"[RELEASED_MISSING_ASSET] {message}")

        for skin in char.get("skins", []):
            image = str(skin.get("image", ""))
            key = image.replace(remote_asset_manifest["public_base_url"].rstrip("/") + "/", "", 1)
            entry = remote_asset_manifest["assets"].get(key)
            if (not image.startswith(remote_asset_manifest["public_base_url"].rstrip("/") + "/")
                    or key != key.lower() or not isinstance(entry, dict) or entry.get("key") != key):
                errors.append(f"Char [{cid}]: Drawing URL does not resolve through the publish manifest: {image}")

        # Check talents
        talents = char.get("talents", [])
        talent_ids = set()
        for t in talents:
            tid = t.get("id")
            if not tid:
                errors.append(f"Char [{cid}]: Talent has no ID")
                continue
            if tid in talent_ids:
                errors.append(f"Char [{cid}]: Duplicate talent ID '{tid}'")
            talent_ids.add(tid)

            # Check talent icon
            ticon = t.get("icon")
            if ticon:
                full_ticon_path = os.path.join("public", ticon.replace("/", os.sep))
                if not os.path.exists(full_ticon_path):
                    errors.append(f"Char [{cid}] Talent [{tid}]: Missing icon file 'public/{ticon}'")

            # Check costs item references
            for c in t.get("cost", []):
                item_id = str(c.get("id"))
                if item_id != "3" and item_id not in items:
                    errors.append(f"Char [{cid}] Talent [{tid}]: Material item ID '{item_id}' not found in items dictionary")

            # Check prerequisites
            for req in t.get("req_talent", []):
                if req not in [x.get("id") for x in talents]:
                    errors.append(f"Char [{cid}] Talent [{tid}]: Prerequisite talent '{req}' does not exist in character's talents")

        # Scan actual level records. Raw/debug mechanic nodes may retain templates,
        # but any body reachable from a serialized popup term is player-facing.
        all_descs = []
        for sk in (char.get("skills") or []):
            gid = sk.get("group_id")
            for level in sk.get("levels", []) or []:
                level_no = level.get("level", 1)
                all_descs.append((f"Skill {gid} Lv.{level_no}", level.get("desc_cn", "")))
                all_descs.append((f"Skill {gid} Lv.{level_no} VI", level.get("desc_vi", "")))
        for zz in (char.get("zhizhi") or []):
            sk_up = zz.get("skill_upgrade")
            if sk_up and isinstance(sk_up, dict):
                enh = sk_up.get("enhanced_skill")
                if enh and isinstance(enh, dict):
                    all_descs.append((f"Zhizhi {enh.get('group_id')}", enh.get("desc_cn", "")))
                    all_descs.append((f"Zhizhi {enh.get('group_id')} VI", enh.get("desc_vi", "")))

        for ctx, text in all_descs:
            if not text: continue
            # Catch raw unreplaced placeholders
            ph_matches = EFFECT_PARAM_RE.findall(text) + RAW_HASH_PARAM_RE.findall(text)
            if ph_matches:
                errors.append(f"Char [{cid}] {ctx} contains unresolved placeholders: {ph_matches}")

            # Catch malformed percentage progression like 10/20/30% or 10 / 20 / 30%
            if re.search(r'\d+/\d+/\d+%', text) or re.search(r'\d+\s*/\s*\d+\s*/\s*\d+%', text):
                errors.append(f"Char [{cid}] {ctx} contains malformed percentage progression: {text}")

            # Catch repeated non-percentage unit suffixes like 1倍/1.2倍/1.3倍 or 1格/2格/3格
            if re.search(r'\d+(?:倍|格|层|次)/\d+(?:倍|格|层|次)', text):
                errors.append(f"Char [{cid}] {ctx} contains repeated suffix progression: {text}")

        # Audit S0174 (太阳神鸟) specifically
        if cid == "S0174":
            s0174_mechs = []
            for sk in (char.get("skills") or []):
                s0174_mechs.extend(sk.get("mechanics") or [])
            for zz in (char.get("zhizhi") or []):
                sk_up = zz.get("skill_upgrade")
                if sk_up and isinstance(sk_up, dict):
                    enh = sk_up.get("enhanced_skill")
                    if enh and isinstance(enh, dict):
                        s0174_mechs.extend(enh.get("mechanics", []))
            
            s0174_names = {m.get("name_cn") for m in s0174_mechs}
            expected_statuses = {"阳春-超群", "炎夏-超群", "暮秋-超群", "凛冬-超群", "恒时-超群"}
            missing = expected_statuses - s0174_names
            if missing:
                errors.append(f"S0174 missing expected statuses: {missing}")

            for m in s0174_mechs:
                name = m.get("name_cn")
                if name in expected_statuses:
                    desc = m.get("desc_cn", "")
                    if "/" not in desc:
                        errors.append(f"S0174 status [{name}] does not contain multi-level slash progression! Got: {desc}")

            # Audit S017403ex specifically for battle logic condition correction
            s017403ex_found = False
            for zz in (char.get("zhizhi") or []):
                sk_up = zz.get("skill_upgrade")
                if sk_up and isinstance(sk_up, dict):
                    enh = sk_up.get("enhanced_skill")
                    if enh and isinstance(enh, dict) and enh.get("group_id") == "S017403ex":
                        s017403ex_found = True
                        desc = enh.get("desc_cn", "")
                        clean_d = re.sub(r'<[^>]+>', '', desc)
                        if "不少于3层灿金" not in clean_d or "周围2格" not in clean_d or "累计至3层" not in clean_d or "额外行动1次" not in clean_d:
                            errors.append(f"S017403ex description validation failed! Got: {desc}")
                        if "不少于2层灿金" in clean_d:
                            errors.append(f"S017403ex still contains uncorrected stale text '不少于2层灿金'! Got: {desc}")
            if not s017403ex_found:
                errors.append("S017403ex not found in S0174 zhizhi skill upgrades!")


    # Check Items
    for iid, item in items.items():
        if item.get("id") and str(item.get("id")) != str(iid):
            errors.append(f"Item key '{iid}' mismatch with item.id '{item.get('id')}'")
        icon_path = item.get("icon")
        if icon_path:
            full_icon_path = os.path.join("public", icon_path.replace("/", os.sep))
            if not os.path.exists(full_icon_path):
                warnings.append(f"Item [{iid}] ({item.get('name_vi', 'Unknown')}): Missing icon file 'public/{icon_path}'")

    validate_localization_integrity(data, errors, warnings)
    validate_skill_icon_integrity(data, errors)
    validate_huanzhang_coverage(data, errors)
    validate_owner_term_audit(data, errors)
    validate_character_talent_eligibility(data, raw_characters, errors, warnings)

    # Multi-level records share descriptions; report each unique issue once.
    errors[:] = list(dict.fromkeys(errors))
    warnings[:] = list(dict.fromkeys(warnings))

    print(f"\nValidation complete.")
    print(f"Total Errors: {len(errors)}")
    print(f"Total Warnings: {len(warnings)}")

    if errors:
        print("\n--- ERRORS ---")
        for e in errors[:30]:
            print(f"[ERROR] {e}")
        if len(errors) > 30:
            print(f"... and {len(errors) - 30} more errors")

    if warnings:
        print("\n--- WARNINGS ---")
        for w in warnings[:30]:
            print(f"[WARN] {w}")

    if errors:
        sys.exit(1)
    else:
        print("[SUCCESS] DATA VALIDATION PASSED PERFECTLY!")
        sys.exit(0)

if __name__ == "__main__":
    validate()
