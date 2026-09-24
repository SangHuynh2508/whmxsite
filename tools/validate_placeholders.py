import openpyxl
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

def validate_placeholders():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    master_path = os.path.join(base_dir, 'localization', 'localization_master.xlsx')

    if not os.path.exists(master_path):
        print(f"CRITICAL ERROR: {master_path} does not exist!")
        sys.exit(1)

    print("=== STARTING PLACEHOLDER & RICH-TEXT PARITY VALIDATION ===")
    wb = openpyxl.load_workbook(master_path, data_only=True)

    errors = []
    total_audited_populated_fields = 0

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        rows = list(ws.iter_rows(values_only=True))
        if not rows or len(rows) <= 1:
            continue

        header = [str(c).strip() if c is not None else '' for c in rows[0]]
        
        # Identify CN source columns and corresponding VI translation columns
        col_pairs = []
        for idx, h in enumerate(header):
            hl = h.lower()
            if 'cn' in hl or 'zh' in hl:
                # search for corresponding vi column
                vi_col_name = hl.replace('cn', 'vi').replace('zh', 'vi')
                for vi_idx, vi_h in enumerate(header):
                    if vi_h.lower() == vi_col_name and vi_h.lower() not in ['status', 'notes', 'provenance_vi']:
                        col_pairs.append((idx, h, vi_idx, vi_h))
                        break

        for row_idx, r in enumerate(rows[1:], start=2):
            key_id = str(r[0]) if r[0] is not None else f"Row_{row_idx}"

            for cn_idx, cn_h, vi_idx, vi_h in col_pairs:
                cn_val = str(r[cn_idx]).strip() if cn_idx < len(r) and r[cn_idx] is not None else ''
                vi_val = str(r[vi_idx]).strip() if vi_idx < len(r) and r[vi_idx] is not None else ''

                # Skip empty / PENDING translations safely
                if not vi_val or vi_val == 'NONE':
                    continue

                total_audited_populated_fields += 1

                # 1. Validate Placeholders (e.g. [Effect1Para,1], [Effect1Param1])
                cn_placeholders = sorted(re.findall(r'\[Effect[^\]]+\]', cn_val))
                vi_placeholders = sorted(re.findall(r'\[Effect[^\]]+\]', vi_val))

                if cn_placeholders != vi_placeholders:
                    errors.append({
                        'sheet': sheet_name,
                        'record_id': key_id,
                        'field': vi_h,
                        'cn_token': cn_placeholders,
                        'vi_token': vi_placeholders,
                        'reason': f"Placeholder mismatch: CN has {cn_placeholders}, VI has {vi_placeholders}"
                    })

                # 2. Validate Rich-Text Color & Formatting Tags (e.g. <color=#158bdb>, </color>, <br>)
                cn_tags = sorted(re.findall(r'</?color[^>]*>', cn_val))
                vi_tags = sorted(re.findall(r'</?color[^>]*>', vi_val))

                if cn_tags != vi_tags:
                    errors.append({
                        'sheet': sheet_name,
                        'record_id': key_id,
                        'field': vi_h,
                        'cn_token': cn_tags,
                        'vi_token': vi_tags,
                        'reason': f"Rich-text tag mismatch: CN has {cn_tags}, VI has {vi_tags}"
                    })

    print(f"Total Populated Fields Audited: {total_audited_populated_fields}")
    print(f"Total Placeholder / Rich-Text Errors Found: {len(errors)}")

    if errors:
        print("\n--- ERROR DETAILS ---")
        for err in errors:
            print(f"[ERROR] Sheet: {err['sheet']}, Record: {err['record_id']}, Field: {err['field']}")
            print(f"  CN Tokens: {err['cn_token']}")
            print(f"  VI Tokens: {err['vi_token']}")
            print(f"  Reason: {err['reason']}\n")
        sys.exit(1)
    else:
        print("[SUCCESS] ALL POPULATED PLACEHOLDERS & RICH-TEXT TAGS MATCHED 100% PERFECTLY!")
        sys.exit(0)

if __name__ == '__main__':
    validate_placeholders()
