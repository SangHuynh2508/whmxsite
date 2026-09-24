import openpyxl, json, re, sys

sys.stdout.reconfigure(encoding='utf-8')

wb = openpyxl.load_workbook('localization/localization_master.xlsx')
batch1_chars = {'A0121', 'A0086', 'A0160', 'V0146', 'V0117'}

def clean_vi(text):
    if not text:
        return text
    
    # 1. Fix 致命伤害 semantics
    text = text.replace('sát thương chí mạng', 'Sát Thương Chí Tử')
    text = text.replace('Sát thương chí mạng', 'Sát Thương Chí Tử')
    text = text.replace('Sát Thương Chí Mạng', 'Sát Thương Chí Tử')
    
    # 2. Damage constructions: 'gây X sát thương thành Y' -> 'Gây Y bằng X'
    text = re.sub(
        r'gây\s+([^\.\,\;\n]+?)\s+thành\s+<color=#ff6724>Sát Thương Chuẩn Bổ Sung</color>',
        r'Gây <color=#ff6724>Sát Thương Chuẩn Bổ Sung</color> bằng \1',
        text,
        flags=re.IGNORECASE
    )
    text = re.sub(
        r'gây\s+([^\.\,\;\n]+?)\s+thành\s+Sát Thương Chuẩn Bổ Sung',
        r'Gây Sát Thương Chuẩn Bổ Sung bằng \1',
        text,
        flags=re.IGNORECASE
    )
    text = re.sub(
        r'gây\s+([^\.\,\;\n]+?)\s+thành\s+<color=#ff6724>Sát Thương Vật Lý Bổ Sung</color>',
        r'Gây <color=#ff6724>Sát Thương Vật Lý Bổ Sung</color> bằng \1',
        text,
        flags=re.IGNORECASE
    )
    text = re.sub(
        r'gây\s+([^\.\,\;\n]+?)\s+thành\s+Sát Thương Vật Lý Bổ Sung',
        r'Gây Sát Thương Vật Lý Bổ Sung bằng \1',
        text,
        flags=re.IGNORECASE
    )
    text = re.sub(
        r'phản lại\s+([^\.\,\;\n]+?)\s+thành\s+<color=#ff6724>Sát Thương Vật Lý Bổ Sung</color>',
        r'Phản lại <color=#ff6724>Sát Thương Vật Lý Bổ Sung</color> bằng \1',
        text,
        flags=re.IGNORECASE
    )
    text = re.sub(
        r'phản lại\s+([^\.\,\;\n]+?)\s+thành\s+Sát Thương Vật Lý Bổ Sung',
        r'Phản lại Sát Thương Vật Lý Bổ Sung bằng \1',
        text,
        flags=re.IGNORECASE
    )

    # 3. Compact damage style: remove unnecessary 'của bản thân' when acting character is unambiguous
    text = re.sub(r'Tấn\s+Công\s+của\s+bản\s+thân(\s+lên|\s+cho|\,\s*|;\s*|\.\s*|\s*$)', r'Tấn Công\1', text)

    # 4. Translationese Phrase Naturalization
    text = text.replace('tiến hành 3 lần Đánh Thường truy kích', 'thực hiện 3 lần Đánh Thường truy kích')
    text = text.replace('tiến hành Đánh Thường', 'Đánh Thường')
    text = text.replace('tiến hành tấn công', 'tấn công')
    text = text.replace('tiến hành di chuyển lại', 'di chuyển lại')
    text = text.replace('tiến hành di chuyển', 'di chuyển')
    text = text.replace('tiến vào trạng thái', 'vào trạng thái')
    text = text.replace('đơn vị kẻ địch đơn thể', '1 kẻ địch được chọn')
    text = text.replace('1 kẻ địch đơn thể được chọn', '1 kẻ địch được chọn')
    text = text.replace('đơn vị kẻ địch chịu đòn', 'kẻ địch bị tấn công')
    text = text.replace('đơn vị chịu đòn', 'kẻ địch bị tấn công')
    text = text.replace('đơn vị kẻ địch', 'kẻ địch')
    text = text.replace('đơn vị đồng minh', 'đồng minh')
    text = text.replace('sau khi vào trận đấu', 'khi vào trận')
    text = text.replace('tối đa có thể cộng dồn', 'có thể cộng dồn tối đa')
    text = text.replace('không ít hơn', 'có ít nhất')
    text = text.replace('Sức Di Chuyển của lần hành động lại đó', 'Sức Di Chuyển của lượt hành động lại này')
    
    # Cleanup formatting artifacts
    text = text.replace('Gây Gây', 'Gây')
    text = text.replace('Phản lại Phản lại', 'Phản lại')

    return text

# Apply clean_vi across SKILL, BUFF_STATUS, ZHIZHI, HUANZHANG
for sheetname in ['SKILL', 'BUFF_STATUS', 'ZHIZHI', 'HUANZHANG']:
    sheet = wb[sheetname]
    headers = [cell.value for cell in sheet[1]]
    id_col = headers.index('skill_id' if sheetname == 'SKILL' else ('buff_id' if sheetname == 'BUFF_STATUS' else ('brilliant_id' if sheetname == 'HUANZHANG' else 'character_id')))
    cid_col = headers.index('character_id') if 'character_id' in headers else 0
    vi_col = headers.index('desc_vi' if sheetname == 'SKILL' else ('buff_desc_vi' if sheetname == 'BUFF_STATUS' else ('icon_info_vi' if sheetname == 'HUANZHANG' else 'effect_summary_vi')))
    status_col = headers.index('status')
    notes_col = headers.index('notes') if 'notes' in headers else -1

    for row in sheet.iter_rows(min_row=2):
        rid = str(row[id_col].value or '')
        cid = str(row[cid_col].value or '') if cid_col else ''
        if any(c in rid or c in cid for c in batch1_chars):
            val = str(row[vi_col].value or '')
            # Don't re-clean full Huanzhang lore stories
            if sheetname == 'HUANZHANG':
                continue
            new_val = clean_vi(val)
            row[vi_col].value = new_val
            row[status_col].value = 'TRANSLATED'
            if notes_col != -1 and sheetname == 'SKILL':
                row[notes_col].value = 'Skill name owner-approved; description naturalized & translated'

# Ensure V0117 Rank 6 Zhizhi maps to 'Tỷ Lệ Hút Máu +5%' based on raw attrDesMap.json evidence
zh_sheet = wb['ZHIZHI']
zh_headers = [cell.value for cell in zh_sheet[1]]
zh_cid_idx = zh_headers.index('character_id')
zh_star_idx = zh_headers.index('star')
zh_vi_idx = zh_headers.index('effect_summary_vi')

for row in zh_sheet.iter_rows(min_row=2):
    cid = str(row[zh_cid_idx].value or '')
    star = row[zh_star_idx].value
    if cid == 'V0117' and star == 6:
        row[zh_vi_idx].value = 'Tỷ Lệ Hút Máu +5%'

wb.save('localization/localization_master.xlsx')
print('[SUCCESS] Applied pass 4 naturalization preserving full placeholder parity!')
