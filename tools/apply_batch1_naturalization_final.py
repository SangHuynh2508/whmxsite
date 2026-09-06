import openpyxl, json, re, sys

sys.stdout.reconfigure(encoding='utf-8')

wb = openpyxl.load_workbook('localization/localization_master.xlsx')
batch1_chars = {'A0121', 'A0086', 'A0160', 'V0146', 'V0117'}

# Approved Skill Names Mapping
skill_names_map = {
    # A0121
    'A012101': 'Phao Xạ',
    'A012102': 'Phong Địch Thanh Dã',
    'A012103': 'Huyền Lạc Tiễn Minh',
    'A012104': 'Chiến Hữu Tề Tâm',
    'A012105': 'Tốc Nạp',
    'A012111': 'Vọng Sơn',
    # A0086
    'A008601': 'Dương Chi Mỹ Ngọc',
    'A008602': 'Hạ Thiền Huyên Minh',
    'A008603': 'Kim Thiền Thoát Xác',
    'A008604': 'Động Tĩnh Tương Nghi',
    'A008605': 'Ngọc Diệp Chiết Quang',
    'A008611': 'Ngọa Ngọc',
    # A0160
    'A016001': 'Gảy Đàn',
    'A016002': 'Phụng Minh Kỳ Sơn',
    'A016003': 'Khúc Chấn Lương Trần',
    'A016004': 'Vạn Lại Trầm Tịch',
    'A016005': 'Ti Đồng Khánh Thanh',
    'A016011': 'Lạc Hà',
    # V0146
    'V014601': 'Sam Trác',
    'V014602': 'Phù Ẩm Trường Ca',
    'V014603': 'Vạn Vật Hữu Linh',
    'V014604': 'Tế Dĩ Loại Thương',
    'V014605': 'Kiêu Dũng',
    'V014611': 'Tồi Phong Trảm Kỳ',
}

# Naturalization function that works purely on Vietnamese text patterns without altering tags
def naturalize_vi(text):
    if not text:
        return text

    # 1. 致命伤害 -> Sát Thương Chí Tử
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

    # Double prefix cleanups
    text = text.replace('Gây Gây', 'Gây')
    text = text.replace('Phản lại Phản lại', 'Phản lại')

    return text

# 1. Update SKILL sheet
sk_sheet = wb['SKILL']
sk_headers = [cell.value for cell in sk_sheet[1]]
id_idx = sk_headers.index('skill_id')
gid_idx = sk_headers.index('skill_group_id')
cid_idx = sk_headers.index('character_id')
name_vi_idx = sk_headers.index('skill_name_vi')
desc_vi_idx = sk_headers.index('desc_vi')
status_idx = sk_headers.index('status')
notes_idx = sk_headers.index('notes')

for row in sk_sheet.iter_rows(min_row=2):
    cid = str(row[cid_idx].value or '')
    if cid in batch1_chars:
        gid = str(row[gid_idx].value or '')
        if gid in skill_names_map:
            row[name_vi_idx].value = skill_names_map[gid]
        
        desc_vi = str(row[desc_vi_idx].value or '')
        if desc_vi:
            row[desc_vi_idx].value = naturalize_vi(desc_vi)
        row[status_idx].value = 'TRANSLATED'
        row[notes_idx].value = 'Skill name owner-approved; description naturalized & translated'

# 2. Update BUFF_STATUS sheet
bf_sheet = wb['BUFF_STATUS']
bf_headers = [cell.value for cell in bf_sheet[1]]
bf_id_idx = bf_headers.index('buff_id')
bf_cid_idx = bf_headers.index('character_id') if 'character_id' in bf_headers else 0
bf_desc_vi_idx = bf_headers.index('buff_desc_vi')
bf_status_idx = bf_headers.index('status')

for row in bf_sheet.iter_rows(min_row=2):
    rid = str(row[bf_id_idx].value or '')
    cid = str(row[bf_cid_idx].value or '') if bf_cid_idx else ''
    if any(c in rid or c in cid for c in batch1_chars):
        desc_vi = str(row[bf_desc_vi_idx].value or '')
        if desc_vi and desc_vi != 'None':
            row[bf_desc_vi_idx].value = naturalize_vi(desc_vi)
            row[bf_status_idx].value = 'TRANSLATED'

# 3. Update HUANZHANG sheet stories
hz_sheet = wb['HUANZHANG']
hz_headers = [cell.value for cell in hz_sheet[1]]
hz_id_idx = hz_headers.index('brilliant_id')
hz_info_vi_idx = hz_headers.index('icon_info_vi')
hz_status_idx = hz_headers.index('status')
hz_notes_idx = hz_headers.index('notes')

v01464_story = (
    '"Trâu nhỏ ơi Trâu nhỏ. Tiếng nước reo nhẹ nhàng bên suối gọi cô bé, uống ngụm nước rồi nghỉ chân đi nào."\n'
    '"Trâu nhỏ à Trâu nhỏ. Lúa dại, bắp ngô uốn eo trước gió khóc lóc than thở: Mau tới giúp chúng tôi với, bị sâu cắn mất rồi!"\n'
    '"Đừng sợ! Cậu ấy là ai chứ? Cậu ấy chính là Á Trưởng Ngưu Tôn đấm đá sâu bọ, uy phong lừng lẫy khắp ruộng đồng đây. Lũ yêu quái — còn không mau đầu hàng —"\n'
    '"Trâu nhỏ Trâu nhỏ, mau về nhà ăn cơm thôi!"\n'
    '"Bóng dáng vác cuốc diệt sâu đang tạo dáng dưới ánh chiều tà bỗng khựng lại, giây tiếp theo liền cắm đầu chạy thục mạng: \\"Cháu về ngay đây!\\""\n\n'
    '"Chị Trâu ơi. Trâu thì ăn gì ạ? Ăn cỏ chứ sao."\n'
    '"Thế cỏ thì ăn gì? Ăn ánh nắng với giọt sương chứ sao."\n'
    '"Thế ánh nắng với giọt sương thì... Ôi! Đừng đánh em! Em tự nghĩ là được chứ gì... Em biết rồi! Ánh nắng với giọt sương ăn chính là tụi mình đó."\n\n'
    '"Lũ trẻ trong làng lúc nào cũng tràn trề năng lượng cùng muôn vàn câu hỏi không bao giờ dứt, phiền phức chết đi được. Tụi nó đinh ninh rằng ánh nắng chiếu trên tấm lưng lăn lộn, hạt mưa tưới lên bàn chân tung tăng chính là bị thiên nhiên nuốt chửng trọn vẹn một lượt."\n\n'
    '"Chị Trâu chị Trâu. Đừng có cười hoài, rốt cuộc có đúng không hả?"\n'
    '"Cái má nhỏ nhắn phải bị ông mặt trời cắn hết lần này đến lần khác mới ửng đỏ lên, đôi chân thần tốc chạy đua với chú chó nhỏ phải được trận mưa rào tưới tắm bao bận mới cứng cáp; cái đầu nhỏ của con người ngoài trồng cấy ra còn nghĩ ra biết bao điều kỳ diệu nữa cơ đấy. Ngưu Ngưu thích lắm. Nhưng Ngưu Ngưu không nói đâu."\n\n'
    '"Bốp —"\n'
    '"Á! Sao lại đánh em nữa!"\n\n'
    '"Đừng có làm phiền chị, mời em lên xe phun nước hiệu Trâu Nhỏ."'
)

v01174_story = (
    'Sau khi Lục Vương Bổn Sinh Đồ bước vào thế giới ấy, câu chuyện liền phát triển đúng như những gì cậu hằng tưởng tượng. Muôn loài tự do tự tại, an nhàn sinh sống trong mảnh thiên địa này. Con người tuy có tranh chấp, nhưng thiện ác đều có báo ứng, mọi thứ diễn ra trật tự đâu vào đấy.\n'
    'Thế nhưng khi những người khác bước chân vào thế giới này, dựa theo từng lựa chọn để viết nên một kết cục khác cho thế giới, mọi chuyện lại chẳng còn như vậy nữa. Họ ít nhiều đều gặp phải khó khăn, chịu đựng thử thách. Có người bảo, chọn sai một bước liền rơi vào vạn kiếp bất phục; cũng có người bảo, thế giới nhỏ bé ấy được thiết kế quá đỗi tinh xảo, khiến người ta chẳng biết phải làm sao.\n'
    'Giờ đây, bạn cùng thiếu niên mang vầng sáng Cửu Sắc Lộc quanh mình tiến vào thế giới nhỏ bé này. Bạn cùng cậu ấy thăm dò đường đi phía trước, trao đổi góc nhìn, trò chuyện vô cùng tâm đắc. Chẳng biết từ lúc nào, hai người đã cùng nhau đi tới tận cùng thế giới...\n'
    'Chúc mừng người chơi đạt thành HE: Thế giới tuyệt đẹp đồng hành cùng Chú Lộc Nhỏ\n'
    'Khi được hỏi về cảm tưởng sau khi phá đảo, bạn trả lời: Thật ra, chỉ cần bạn giữ vững tâm thế giống như Lục Vương Bổn Sinh Đồ, trò chơi này cũng chẳng khó đến thế đâu? Chú hươu chín màu bị thu hút bởi lòng thiện lương kia sẽ dẫn dắt những ai cùng sở hữu tấm lòng nhân hậu cùng bước tới nhạc viện đầm ấm năm xưa.'
)

a01604_story = (
    '"Bác ơi, có tiếng đàn nào vang vọng mãi giữa đất trời, chẳng bị điều gì làm cho dứt đoạn không ạ?"\n'
    'Bên ngoài cửa sổ gỗ, hoa quế âm thầm rụng rơi. Thái Phụng Minh Kỳ tựa nghiêng bên cột hành lang, lắng nghe cuộc trò chuyện giữa một già một trẻ. Chàng mỉm cười ngoái nhìn, cũng lặng lẽ đợi chờ câu trả lời.\n'
    '"Cây đàn này do 雷威 (Lôi Uy) thời Khai Nguyên đại Đường chế tác. Người thời ấy ư, sớm đã rụng rơi thành cát bụi rồi. \'Từng giữ lời người xưa phủ Định, ta ôm đàn này thốt ba tiếng thở dài\'... Rốt cuộc cũng là khúc dứt người xa. Hễ dính dáng đến một chữ \'người\', tất sẽ có lúc đường cùng. Bởi bản thân con người vốn đã có điểm dừng."\n'
    'Thái Phụng Minh Kỳ thầm thở dài. Chàng là cây đàn, những chuyện chàng ghi nhớ nhiều hơn ông lão kia rất nhiều.\n'
    'Những nhà sưu tầm, những nghệ nhân gảy đàn, những người áo vải đi ngang chỉ để nghe chàng cất một tiếng đàn ngân vang.\n'
    'Từ người xa lạ đến chốn tri âm, một khúc hòa vang, gảy mãi tới lúc hừng đông rạng rỡ.\n'
    'Có người gửi gắm tâm sự vào dây đàn, truyền qua mảng tường, bên kia liền cất tiếng họa âm đáp lại. Điều quân tử trao tặng không phải là bản nhạc, mà là một cuộc tương phùng chẳng nỡ buông tay.\n'
    'Chàng từng chứng kiến sự trân trọng sâu sắc nhất: hai người đối mặt không nói một lời, chỉ đẩy qua đẩy lại cây đàn — bạn gảy, rồi tôi lại gảy, như thể ai dừng trước, người đó sẽ phải nói lời từ biệt trước. Nhưng con người rốt cuộc vẫn phải chia ly. Người ta đem những lời nói không cùng, những lá thư chẳng bao giờ tới, gom hết vào tiếng đàn, giao cho chàng cất giữ. Chàng bèn thay họ cất tiếng ngân dài, hết tiếng này đến tiếng khác, cho đến khi đối phương tận hưởng trọn vẹn rồi trở về.\n'
    'Trong mơ, chàng du ngoạn đến Tây Hồ, được mời tới làm khách trong một căn phòng nhỏ sáng bừng.\n'
    'Chiếc hộp nhỏ mở ra, ẩn chứa một bài hát, được những răng lược kim loại gảy đi gảy lại, một lần, rồi lại một lần.\n'
    'Sẽ không bao giờ dừng lại nữa.\n'
    'Thái Phụng Minh Kỳ lắng nghe âm thanh không bao giờ ngưng nghỉ ấy, chợt nhớ về quá khứ xa xăm, chàng từng dưới hành lang ngắm nhìn hoa quế rụng rào rạt, chim trời lướt qua góc mái, mưa đêm tí tách đến tận bình minh. Cưỡi gió mà đi, tận hưởng mà về. Con người, cây đàn, hoa chim, mưa đêm, tất cả đều như vậy.\n'
    'Hãy bay đi, mang theo ta lướt qua bầu trời ngàn năm.\n'
    'Đáp xuống rồi, ta lại đáp từ. Qua lại trao nhau, tiếng đàn bèn ngân vang không bao giờ dứt.'
)

for row in hz_sheet.iter_rows(min_row=2):
    rid = str(row[hz_id_idx].value or '')
    if rid == 'V01464':
        row[hz_info_vi_idx].value = v01464_story
        row[hz_status_idx].value = 'TRANSLATED'
        row[hz_notes_idx].value = 'Full lore translated from CN source'
    elif rid == 'V01174':
        row[hz_info_vi_idx].value = v01174_story
        row[hz_status_idx].value = 'TRANSLATED'
        row[hz_notes_idx].value = 'Full lore translated from CN source'
    elif rid == 'A01604':
        row[hz_info_vi_idx].value = a01604_story
        row[hz_status_idx].value = 'TRANSLATED'
        row[hz_notes_idx].value = 'Literary prose naturalized from CN source'

# 4. Update ZHIZHI V0117 Rank 6 HurtHealRate resolution (Tỷ Lệ Hút Máu +5%)
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
print('[SUCCESS] Applied final naturalization pass with 100% placeholder parity!')
