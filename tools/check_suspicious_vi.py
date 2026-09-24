import openpyxl
import json
import os
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

from batch_manifest_helper import load_batch_manifest, collect_batch_dependencies

SUSPICIOUS_PHRASES = [
    'tiến hành',
    'đơn vị chịu đòn',
    'kẻ địch chịu đòn',
    'đơn thể',
    'thành Sát Thương',
    'không ít hơn',
]

def check_suspicious_vi(manifest_path, base_dir=None, wb_master=None):
    if base_dir is None:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
    if manifest_path.endswith('.xlsx'):
        batch_id = os.path.basename(manifest_path)
        if wb_master is None:
            master_path = manifest_path if os.path.isabs(manifest_path) else os.path.join(base_dir, manifest_path)
            wb = openpyxl.load_workbook(master_path, data_only=True)
        else:
            wb = wb_master

        # When checking master workbook directly, inspect the most recent batch review source
        skill_sheet = wb['SKILL']
        skill_headers = list(next(skill_sheet.iter_rows(values_only=True)))
        src_col = skill_headers.index('translation_review_source') if 'translation_review_source' in skill_headers else None
        
        target_source = None
        if src_col is not None:
            # Find the most recently added or prevalent recent packet
            sources = [r[src_col] for r in skill_sheet.iter_rows(min_row=2, values_only=True) if r[src_col]]
            if sources:
                target_source = sources[-1]

        batch_chars = None
        player_buffs = None
        huanzhang_ids = None
    else:
        manifest = load_batch_manifest(manifest_path)
        deps = collect_batch_dependencies(base_dir, manifest)
        batch_id = manifest.get('batch_id', 'BATCH')
        batch_chars = set(deps['characters'])
        player_buffs = set(deps['player_facing_buff_ids'])
        huanzhang_ids = set(deps['huanzhang_ids'])
        target_source = None
        if wb_master is None:
            master_path = os.path.join(base_dir, 'localization', 'localization_master.xlsx')
            wb = openpyxl.load_workbook(master_path, data_only=True)
        else:
            wb = wb_master
    
    warnings = []

    for sheetname in ['SKILL', 'BUFF_STATUS', 'ZHIZHI', 'HUANZHANG']:
        if sheetname not in wb.sheetnames:
            continue
        sheet = wb[sheetname]
        headers = list(next(sheet.iter_rows(values_only=True)))
        
        cn_col = headers.index('desc_cn' if sheetname == 'SKILL' else ('buff_desc_cn' if sheetname == 'BUFF_STATUS' else ('icon_info_cn' if sheetname == 'HUANZHANG' else 'effect_summary_cn')))
        vi_col = headers.index('desc_vi' if sheetname == 'SKILL' else ('buff_desc_vi' if sheetname == 'BUFF_STATUS' else ('icon_info_vi' if sheetname == 'HUANZHANG' else 'effect_summary_vi')))
        cid_col = headers.index('character_id') if 'character_id' in headers else 0
        src_col = headers.index('translation_review_source') if 'translation_review_source' in headers else (headers.index('desc_translation_source') if 'desc_translation_source' in headers else None)

        for row in sheet.iter_rows(min_row=2, values_only=True):
            cid = str(row[cid_col] or '').strip()
            rid = str(row[0] or '').strip()
            row_src = str(row[src_col] or '').strip() if src_col is not None else ''
            
            is_target = False
            if target_source:
                if row_src == target_source:
                    is_target = True
            elif batch_chars is not None:
                if sheetname == 'SKILL' and cid in batch_chars:
                    is_target = True
                elif sheetname == 'BUFF_STATUS' and rid in player_buffs:
                    is_target = True
                elif sheetname == 'ZHIZHI' and cid in batch_chars:
                    is_target = True
                elif sheetname == 'HUANZHANG' and rid in huanzhang_ids:
                    is_target = True
            else:
                is_target = True

            if is_target:
                cn_txt = str(row[cn_col] or '')
                vi_txt = str(row[vi_col] or '')
                
                if vi_txt and vi_txt != 'None':
                    for pattern in SUSPICIOUS_PHRASES:
                        if pattern in vi_txt:
                            warnings.append({
                                'sheet': sheetname,
                                'record_id': rid,
                                'character_id': cid,
                                'pattern': pattern,
                                'cn_txt': cn_txt,
                                'vi_txt': vi_txt
                            })

                    # Casing/punctuation artifact check (ignore literary ellipsis '...')
                    clean_vi = vi_txt.replace('...', '').replace('…', '')
                    if re.search(r'[\.\,\;]{2,}', clean_vi):
                        warnings.append({
                            'sheet': sheetname,
                            'record_id': rid,
                            'character_id': cid,
                            'pattern': 'duplicated punctuation',
                            'cn_txt': cn_txt,
                            'vi_txt': vi_txt
                        })

    print(f"=== SUSPICIOUS VI QUALITY SCAN ({batch_id}) ===")
    if warnings:
        print(f"[WARNING] Found {len(warnings)} potential translationese / quality warning(s):")
        seen = set()
        for w in warnings:
            key = (w['sheet'], w['record_id'], w['pattern'])
            if key not in seen:
                seen.add(key)
                print(f"  [QUALITY_WARNING] Sheet: {w['sheet']} | Record: {w['record_id']} | Char: {w['character_id']}")
                print(f"    Matched Pattern: '{w['pattern']}'")
                print(f"    CN Source: {w['cn_txt'][:80]}")
                print(f"    VI Text: {w['vi_txt'][:80]}")
        return warnings
    else:
        print("[SUCCESS] 0 suspicious phrase or quality warnings found!")
        return []

if __name__ == '__main__':
    manifest_file = sys.argv[1] if len(sys.argv) > 1 else r"d:\BaiTapCode\WHMX\WhmxCalc\localization\batches\phase3_batch1.json"
    check_suspicious_vi(manifest_file)
