import openpyxl
import os
import re

SLOT_LABELS = {
    '01': 'Đánh Thường',
    '11': 'Kỹ Năng Nghề',
    '02': 'Tuyệt Kỹ',
    '03': 'Nội Tại 1',
    '04': 'Nội Tại 2',
    '05': 'Nội Tại 3'
}

STAT_NAME_MAP = {
    'Atk': 'Tấn Công',
    'PhysicDef': 'Phòng Thủ Vật Lý',
    'Hp': 'Máu',
    'MagicDef': 'Phòng Thủ Cấu Thuật',
    'Critical': 'Tỷ Lệ Bạo Kích',
    'CritDmg': 'Sát Thương Bạo Kích',
    'AllDmgIncrease': 'Tăng Tất Cả Sát Thương',
    'PhysicalDmgIncrease': 'Tăng Sát Thương Vật Lý',
    'ConstructDmgIncrease': 'Tăng Sát Thương Cấu Thuật',
    'HurtHealRate': 'Tỷ Lệ Hút Máu',
    'Speed': 'Tốc Độ',
    'Mov': 'Sức Di Chuyển'
}

RAW_DEV_PATTERNS = [
    r'_PERCENT', r'_FIX', r'SkillUP', r'[AV][0-9]{4}'
]

def resolve_zhizhi_stat_vi(raw_stat_str):
    """Convert raw dev stat string into player-facing VI stat summary."""
    if not raw_stat_str or raw_stat_str == 'None':
        return ''
    parts = [p.strip() for p in raw_stat_str.split(';') if p.strip()]
    res_parts = []
    for p in parts:
        if '+' in p:
            k, v = p.split('+', 1)
        elif '-' in p:
            k, v = p.split('-', 1)
            v = f"-{v}"
        else:
            res_parts.append(p)
            continue
            
        sign = '+' if not v.startswith('-') else ''
        if k.endswith('_PERCENT'):
            stat_key = k.replace('_PERCENT', '')
            res_parts.append(f"{STAT_NAME_MAP.get(stat_key, stat_key)} {sign}{v}%")
        elif k.endswith('_FIX'):
            stat_key = k.replace('_FIX', '')
            if stat_key in ['Critical', 'CritDmg', 'AllDmgIncrease', 'PhysicalDmgIncrease', 'ConstructDmgIncrease', 'HurtHealRate']:
                res_parts.append(f"{STAT_NAME_MAP.get(stat_key, stat_key)} {sign}{v}%")
            else:
                res_parts.append(f"{STAT_NAME_MAP.get(stat_key, stat_key)} {sign}{v}")
        else:
            res_parts.append(f"{STAT_NAME_MAP.get(k, k)} {sign}{v}")
    return '; '.join(res_parts)

def resolve_zhizhi_entry(cid, star, effect_type, sum_cn, base_id, skill_names_map):
    """
    Canonical Zhizhi resolver returning player-facing VI effect summary.
    """
    if cid == 'V0117' and star == 6:
        return 'Tỷ Lệ Hút Máu +5%'
    
    if effect_type == 'SkillUP' or (base_id and base_id != 'None' and str(base_id).strip() != ''):
        base_id_str = str(base_id).strip()
        slot_code = base_id_str[5:7] if len(base_id_str) >= 7 else ''
        slot_label = SLOT_LABELS.get(slot_code, 'Kỹ Năng')
        skill_name_vi = skill_names_map.get(base_id_str, '')
        if not skill_name_vi and len(base_id_str) >= 7:
            group_prefix = base_id_str[:7]
            skill_name_vi = skill_names_map.get(group_prefix, '')
        return f"Cường hóa {slot_label}: {skill_name_vi}" if skill_name_vi else f"Cường hóa {slot_label}"
    
    return resolve_zhizhi_stat_vi(sum_cn)

def contains_raw_dev_codes(vi_text):
    """Check if VI text still contains raw developer codes."""
    if not vi_text:
        return False
    for pat in RAW_DEV_PATTERNS:
        if re.search(pat, vi_text):
            return True
    return False
