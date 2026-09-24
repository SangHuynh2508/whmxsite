import openpyxl
import os
import shutil
from datetime import datetime

# 1. Create timestamped backup of localization/localization_master.xlsx
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
backup_dir = "localization/backups"
os.makedirs(backup_dir, exist_ok=True)
master_path = "localization/localization_master.xlsx"
backup_path = os.path.join(backup_dir, f"localization_master_backup_{timestamp}.xlsx")

shutil.copy2(master_path, backup_path)
print(f"[OK] Created timestamped backup: {backup_path}")

# 2. Restoration dataset
RESTORATION_DATA = {
    'A0160061': {
        'sheet': 'SKILL',
        'skill_name_cn': '音乐盒',
        'skill_name_vi': 'Hộp Nhạc',
        'desc_cn': '对选定的敌方单体造成自身攻击力100%的物理伤害，并使目标获得1层<color=#ff6724>泛音</color>；若自身处于<color=#ff6724>余音</color>状态，则额外造成自身攻击力50%的物理伤害。',
        'desc_vi': 'Gây Sát Thương Vật Lý bằng 100% Tấn Công của bản thân lên 1 kẻ địch được chọn, khiến mục tiêu nhận 1 tầng <color=#ff6724>Phiếm Âm</color>; nếu bản thân đang trong trạng thái <color=#ff6724>Dư Âm</color>, gây thêm Sát Thương Vật Lý bằng 50% Tấn Công của bản thân.',
        'confidence': 'HIGH',
        'status': 'HUMAN_REVIEWED',
        'notes': 'Restored historical Batch 1 human-reviewed value (phase3_batch1_human_review.json)'
    },
    'V0146061': {
        'sheet': 'SKILL',
        'skill_name_cn': '牛牛洒水车',
        'skill_name_vi': 'Xe Phun Nước Bò Bò',
        'desc_cn': '对选定的敌方单体及其周围1格的敌方全体造成自身攻击力50%的物理伤害，并对受击目标施加1层<color=#ff6724>水渍</color>。',
        'desc_vi': 'Gây Sát Thương Vật Lý bằng 50% Tấn Công của bản thân lên 1 kẻ địch được chọn và toàn bộ kẻ địch trong phạm vi 1 ô xung quanh, đồng thời thi triển 1 tầng <color=#ff6724>Vết Nước</color> lên mục tiêu bị trúng đòn.',
        'confidence': 'HIGH',
        'status': 'OWNER_CORRECTED',
        'notes': 'Restored historical owner-corrected value (apply_batch1_naturalization_final.py & phase3_batch1_human_review.json)'
    },
    'V0117061': {
        'sheet': 'SKILL',
        'skill_name_cn': '好结局游戏卡带',
        'skill_name_vi': 'Băng Trò Chơi Kết Cục Tốt',
        'desc_cn': '对选定的敌方单体造成自身攻击力100%的物理伤害。使用后自身获得1层<color=#ff6724>欧气</color>。',
        'desc_vi': 'Gây Sát Thương Vật Lý bằng 100% Tấn Công của bản thân lên 1 kẻ địch được chọn. Sau khi sử dụng bản thân nhận 1 tầng <color=#ff6724>Vận May</color>.',
        'confidence': 'HIGH',
        'status': 'OWNER_APPROVED',
        'notes': 'Restored historical owner-approved value (phase3_batch1_human_review.json)'
    },
    'A016004ex': {
        'sheet': 'SKILL',
        'skill_name_cn': '万籁沉寂',
        'skill_name_vi': 'Vạn Âm Lặng Tắt',
        'desc_cn': '受到常击后，若自身拥有<color=#ff6724>散音</color>，则有<color=#158bdb>100%</color>概率无视本次伤害。',
        'desc_vi': 'Khi chịu Đánh Thường, nếu bản thân có <color=#ff6724>Tản Âm</color>, có <color=#158bdb>100%</color> xác suất bỏ qua sát thương lần này.',
        'confidence': 'HIGH',
        'status': 'OWNER_CORRECTED',
        'notes': 'Restored historical owner-corrected value (apply_batch1_naturalization_final.py L142)'
    },
    'A012103ex': {
        'sheet': 'SKILL',
        'skill_name_cn': '弦落箭鸣',
        'skill_name_vi': 'Dây Đàn Lắng Tiếng Tên',
        'desc_cn': '使用绝技后，自身获得1次<color=#ff6724>再行动</color>，且本次再行动移动力增加2格。',
        'desc_vi': 'Sau khi sử dụng Tuyệt Kỹ, bản thân nhận 1 lần <color=#ff6724>Tái Hành Động</color>, đồng thời Tái Hành Động lần này tăng 2 ô Sức Di Chuyển.',
        'confidence': 'HIGH',
        'status': 'OWNER_CORRECTED',
        'notes': 'Restored historical owner-corrected value (apply_batch1_naturalization_final.py)'
    },
    'A008603ex': {
        'sheet': 'SKILL',
        'skill_name_cn': '金蝉脱壳',
        'skill_name_vi': 'Kim Thiền Thoát Xác',
        'desc_cn': '受到常击时，若攻击者生命值低于50%，则使自身获得<color=#ff6724>隐身</color>状态，持续1轮次。',
        'desc_vi': 'Khi chịu Đánh Thường, nếu tấn công khiến bản thân nhận sát thương chí mạng, hóa giải lần sát thương này và khiến bản thân nhận <color=#ff6724>Ẩn Thân</color>, kéo dài 1 lượt.',
        'confidence': 'HIGH',
        'status': 'HUMAN_REVIEWED',
        'notes': 'Restored historical human-reviewed value (phase3_batch1_human_review.md L64, L140)'
    },
    'V014605ex': {
        'sheet': 'SKILL',
        'skill_name_cn': '骁勇',
        'skill_name_vi': 'Dũng Cảm Cương Cường',
        'desc_cn': '每轮次开始时，自身获得1层<color=#ff6724>骁勇</color>状态；造成单体伤害后，使自身生命值恢复造成伤害的15%。',
        'desc_vi': 'Mỗi lượt bắt đầu, bản thân nhận 1 tầng Dũng Cảm. Khi tấn công đơn thể gây sát thương, khiến bản thân hồi phục HP bằng 15% sát thương đã gây ra.',
        'confidence': 'HIGH',
        'status': 'OWNER_CORRECTED',
        'notes': 'Restored historical owner-corrected value (apply_batch1_naturalization_final.py)'
    },
    'V011704ex': {
        'sheet': 'SKILL',
        'skill_name_cn': '百福呈祥',
        'skill_name_vi': 'Trăm Phúc Báo Điềm Lành',
        'desc_cn': '累计受到敌方单位的常击或绝技伤害达3次后，使自身获得<color=#ff6724>福祥</color>状态。',
        'desc_vi': 'Tích lũy chịu từ đơn vị địch 3 lần sát thương Đánh Thường hoặc Tuyệt Kỹ, khiến bản thân nhận trạng thái <color=#ff6724>Phúc Tường</color>. Khi bắt đầu lượt của bản thân, nhận 1 tầng Phúc Tường.',
        'confidence': 'HIGH',
        'status': 'OWNER_CORRECTED',
        'notes': 'Restored historical owner-corrected value (apply_batch1_naturalization_pass3.py)'
    },
    'Buff_A0160_10ex': {
        'sheet': 'BUFF_STATUS',
        'buff_name_cn': '<color=#ff6724>散音</color>',
        'buff_name_vi': '<color=#ff6724>Tản Âm</color>',
        'buff_desc_cn': '无法获得散音效果；受到太凤明敏的绝技伤害时，额外增加20%伤害。',
        'buff_desc_vi': 'Không thể nhận hiệu ứng Tản Âm. Khi chịu sát thương Tuyệt Kỹ của Thái Phụng Minh Mẫn, gây thêm sát thương.',
        'confidence': 'HIGH',
        'status': 'OWNER_APPROVED',
        'notes': 'Restored historical owner-approved value (execute_recovery_pipeline.py)'
    },
    'Buff_CannotMove': {
        'sheet': 'BUFF_STATUS',
        'buff_name_cn': '<color=#ff6724>禁足</color>',
        'buff_name_vi': '<color=#ff6724>Cấm Túc</color>',
        'buff_desc_cn': '无法移动。',
        'buff_desc_vi': 'Không thể di chuyển.',
        'confidence': 'HIGH',
        'status': 'OWNER_APPROVED',
        'notes': 'Restored historical owner-approved value (execute_recovery_pipeline.py & phase3_batch1_human_review.md L489)'
    },
    'Buff_Snipe_Lan': {
        'sheet': 'BUFF_STATUS',
        'buff_name_cn': '<color=#ff6724>瞄准</color>',
        'buff_name_vi': '<color=#ff6724>Nhắm Bắn</color>',
        'buff_desc_cn': '使用后自身获得1次不可移动的再行动。',
        'buff_desc_vi': 'Sau khi sử dụng bản thân nhận 1 lần hành động không thể di chuyển.',
        'confidence': 'HIGH',
        'status': 'OWNER_APPROVED',
        'notes': 'Restored historical owner-approved value (execute_recovery_pipeline.py & phase3_batch1_human_review.md L124)'
    },
    'Buff_V0117_2_1': {
        'sheet': 'BUFF_STATUS',
        'buff_name_cn': '<color=#ff6724>业障</color>',
        'buff_name_vi': '<color=#ff6724>Nghiệp Chướng</color>',
        'buff_desc_cn': '暴击率降低10%',
        'buff_desc_vi': 'Tỷ Lệ Bạo Kích giảm <color=#158bdb>10%</color>, kéo dài <color=#158bdb>2</color> lượt.',
        'confidence': 'HIGH',
        'status': 'OWNER_APPROVED',
        'notes': 'Restored historical owner-approved value (execute_recovery_pipeline.py & phase3_batch1_human_review.md L731)'
    }
}

# 3. Perform workbook mutation using openpyxl
wb = openpyxl.load_workbook(master_path)

mutated_count = 0

for target_id, data in RESTORATION_DATA.items():
    sheet_name = data['sheet']
    ws = wb[sheet_name]
    
    # Get column mapping from header
    header = [cell.value for cell in ws[1]]
    col_map = {str(name).strip().lower(): idx + 1 for idx, name in enumerate(header) if name}
    
    # Find matching row
    id_col = col_map.get('skill_id') or col_map.get('buff_id') or col_map.get('id') or col_map.get('key')
    
    target_row = None
    for r in range(2, ws.max_row + 1):
        cell_val = ws.cell(row=r, column=id_col).value
        if cell_val and str(cell_val).strip() == target_id:
            target_row = r
            break
            
    if target_row:
        if sheet_name == 'SKILL':
            ws.cell(row=target_row, column=col_map['skill_name_cn'], value=data['skill_name_cn'])
            ws.cell(row=target_row, column=col_map['skill_name_vi'], value=data['skill_name_vi'])
            ws.cell(row=target_row, column=col_map['desc_cn'], value=data['desc_cn'])
            ws.cell(row=target_row, column=col_map['desc_vi'], value=data['desc_vi'])
            ws.cell(row=target_row, column=col_map['confidence'], value=data['confidence'])
            ws.cell(row=target_row, column=col_map['status'], value=data['status'])
            ws.cell(row=target_row, column=col_map['notes'], value=data['notes'])
        elif sheet_name == 'BUFF_STATUS':
            ws.cell(row=target_row, column=col_map['buff_name_cn'], value=data['buff_name_cn'])
            ws.cell(row=target_row, column=col_map['buff_name_vi'], value=data['buff_name_vi'])
            ws.cell(row=target_row, column=col_map['buff_desc_cn'], value=data['buff_desc_cn'])
            ws.cell(row=target_row, column=col_map['buff_desc_vi'], value=data['buff_desc_vi'])
            ws.cell(row=target_row, column=col_map['confidence'], value=data['confidence'])
            ws.cell(row=target_row, column=col_map['status'], value=data['status'])
            ws.cell(row=target_row, column=col_map['notes'], value=data['notes'])
        
        mutated_count += 1
        print(f"[OK] Restored {target_id} in {sheet_name} (Row {target_row}) -> Status: {data['status']}")
    else:
        print(f"[ERROR] Target {target_id} not found in sheet {sheet_name}")

wb.save(master_path)
print(f"\n[SUCCESS] Updated {mutated_count}/12 targets in {master_path}")
