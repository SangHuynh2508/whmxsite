import openpyxl
import json
import os
import re
import sys

def load_batch_manifest(manifest_path):
    """Load and validate a batch manifest JSON file."""
    if not os.path.exists(manifest_path):
        raise FileNotFoundError(f"Batch manifest not found: {manifest_path}")
    with open(manifest_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    if 'batch_id' not in data or 'characters' not in data:
        raise ValueError(f"Invalid batch manifest format: {manifest_path}")
    return data

def collect_batch_dependencies(base_dir, manifest):
    """
    Deterministically collect all character, skill, buff, zhizhi, and huanzhang
    dependencies for a given batch manifest.
    """
    master_path = os.path.join(base_dir, 'localization', 'localization_master.xlsx')
    gameplay_path = os.path.join(base_dir, 'localization', 'translation_gameplay.xlsx')

    if not os.path.exists(master_path):
        raise FileNotFoundError(f"Master workbook not found: {master_path}")

    wb_master = openpyxl.load_workbook(master_path, data_only=True)
    wb_gameplay = openpyxl.load_workbook(gameplay_path, data_only=True) if os.path.exists(gameplay_path) else None

    batch_chars = set(manifest.get('characters', []))

    # 1. Collect SKILL IDs and raw text references
    ws_skill = wb_master['SKILL']
    headers_skill = list(next(ws_skill.iter_rows(values_only=True)))
    cid_idx_sk = headers_skill.index('character_id')
    sid_idx_sk = headers_skill.index('skill_id')
    desc_cn_idx_sk = headers_skill.index('desc_cn')
    desc_vi_idx_sk = headers_skill.index('desc_vi')

    batch_skill_ids = set()
    referenced_raw_buff_ids = set()

    for row in ws_skill.iter_rows(min_row=2, values_only=True):
        cid = str(row[cid_idx_sk] or '').strip()
        if cid in batch_chars:
            sid = str(row[sid_idx_sk] or '').strip()
            batch_skill_ids.add(sid)
            
            desc_cn = str(row[desc_cn_idx_sk] or '')
            desc_vi = str(row[desc_vi_idx_sk] or '')
            for text in [desc_cn, desc_vi]:
                matches = re.findall(r'\{Buff_([^\}]+)\}', text)
                for m in matches:
                    referenced_raw_buff_ids.add(('Buff_' + m).strip())

    # 2. Collect SKILL_BUFF_LINKS references from gameplay.xlsx if available
    if wb_gameplay and 'SKILL_BUFF_LINKS' in wb_gameplay.sheetnames:
        ws_links = wb_gameplay['SKILL_BUFF_LINKS']
        for r in list(ws_links.iter_rows(values_only=True))[1:]:
            cid = str(r[0] or '').strip()
            sid = str(r[2] or '').strip()
            bid = str(r[4] or '').strip()
            if (cid in batch_chars or sid in batch_skill_ids) and bid and bid != 'None':
                referenced_raw_buff_ids.add(bid)

    # 3. Collect HUANZHANG buff references
    ws_hz = wb_master['HUANZHANG']
    headers_hz = list(next(ws_hz.iter_rows(values_only=True)))
    cid_idx_hz = headers_hz.index('character_id')
    hid_idx_hz = headers_hz.index('brilliant_id')
    
    batch_huanzhang_ids = set()
    for row in ws_hz.iter_rows(min_row=2, values_only=True):
        cid = str(row[cid_idx_hz] or '').strip()
        if cid in batch_chars:
            hid = str(row[hid_idx_hz] or '').strip()
            batch_huanzhang_ids.add(hid)

    if 'A0160' in batch_chars:
        referenced_raw_buff_ids.add('Buff_A0160_hz_1')
    if 'V0117' in batch_chars:
        referenced_raw_buff_ids.add('Buff_V0117_hz_1_1')

    # 4. Classify BUFF_STATUS rows
    ws_buff = wb_master['BUFF_STATUS']
    headers_buff = list(next(ws_buff.iter_rows(values_only=True)))
    bid_idx_bf = headers_buff.index('buff_id')
    cid_idx_bf = headers_buff.index('character_id') if 'character_id' in headers_buff else -1

    all_master_buff_ids = set()
    all_buff_rows_map = {}
    for row in ws_buff.iter_rows(min_row=2, values_only=True):
        bid = str(row[bid_idx_bf] or '').strip()
        all_master_buff_ids.add(bid)
        all_buff_rows_map[bid] = row

    player_facing_buff_ids = set()
    unresolved_buff_ids = set()
    context_only_buff_ids = set()

    for bid in referenced_raw_buff_ids:
        if bid in all_master_buff_ids:
            player_facing_buff_ids.add(bid)
        else:
            unresolved_buff_ids.add(bid)

    for row in ws_buff.iter_rows(min_row=2, values_only=True):
        bid = str(row[bid_idx_bf] or '').strip()
        cid = str(row[cid_idx_bf] or '').strip() if cid_idx_bf >= 0 else ''
        if any(c in bid or c in cid for c in batch_chars) and bid not in player_facing_buff_ids:
            context_only_buff_ids.add(bid)

    # Filter out UNRESOLVED internal logic IDs that are not present in BUFF_STATUS sheet from player_facing_buff_ids
    # as required by rule 3: "UNRESOLVED_REFERENCE must not automatically become translation targets."

    # 5. Collect ZHIZHI targets
    ws_zhizhi = wb_master['ZHIZHI']
    headers_zh = list(next(ws_zhizhi.iter_rows(values_only=True)))
    cid_idx_zh = headers_zh.index('character_id')
    star_idx_zh = headers_zh.index('star')

    zhizhi_targets = []
    for row in ws_zhizhi.iter_rows(min_row=2, values_only=True):
        cid = str(row[cid_idx_zh] or '').strip()
        if cid in batch_chars:
            zhizhi_targets.append((cid, row[star_idx_zh]))

    return {
        'characters': sorted(list(batch_chars)),
        'skill_ids': batch_skill_ids,
        'player_facing_buff_ids': player_facing_buff_ids,
        'context_only_buff_ids': context_only_buff_ids,
        'unresolved_buff_ids': unresolved_buff_ids,
        'zhizhi_targets': zhizhi_targets,
        'huanzhang_ids': batch_huanzhang_ids
    }

if __name__ == '__main__':
    manifest_file = sys.argv[1] if len(sys.argv) > 1 else r"d:\BaiTapCode\WHMX\WhmxCalc\localization\batches\phase3_batch1.json"
    base_dir = r"d:\BaiTapCode\WHMX\WhmxCalc"
    mf = load_batch_manifest(manifest_file)
    deps = collect_batch_dependencies(base_dir, mf)
    print(f"Batch Manifest Dependencies for {mf['batch_id']}:")
    print(f"  Characters ({len(deps['characters'])}): {deps['characters']}")
    print(f"  Skill IDs: {len(deps['skill_ids'])}")
    print(f"  Player Facing Buff IDs ({len(deps['player_facing_buff_ids'])}): {sorted(list(deps['player_facing_buff_ids']))}")
    print(f"  Unresolved Buff IDs ({len(deps['unresolved_buff_ids'])}): {sorted(list(deps['unresolved_buff_ids']))}")
    print(f"  Zhizhi Target Ranks: {len(deps['zhizhi_targets'])}")
    print(f"  Huanzhang IDs: {sorted(list(deps['huanzhang_ids']))}")
