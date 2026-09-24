import sys, os, json, re

sys.stdout.reconfigure(encoding='utf-8')

# Read recovery sources
path_apply_batch1 = 'C:/Users/Legion/.gemini/antigravity-ide/brain/8ce6273a-cafe-4c12-80b2-f6d10ae0f369/scratch/apply_batch1_localization.py'
path_owner_changes = 'C:/Users/Legion/.gemini/antigravity-ide/brain/8ce6273a-cafe-4c12-80b2-f6d10ae0f369/scratch/apply_all_owner_changes.py'
path_naturalization_final = 'tools/apply_batch1_naturalization_final.py'

batch1_cids = ['A0121', 'A0086', 'A0160', 'V0146', 'V0117']

print('=== VERIFYING RECOVERY INTEGRITY ACROSS SURVIVING SOURCES ===')

# Load scratch/apply_batch1_localization.py
with open(path_apply_batch1, 'r', encoding='utf-8') as f:
    code_b1 = f.read()

# Load scratch/apply_all_owner_changes.py
with open(path_owner_changes, 'r', encoding='utf-8') as f:
    code_owner = f.read()

# Load tools/apply_batch1_naturalization_final.py
with open(path_naturalization_final, 'r', encoding='utf-8') as f:
    code_nat = f.read()

# Check skill names coverage
skill_names = [
    'Phao Xạ', 'Phong Địch Thanh Dã', 'Huyền Lạc Tiễn Minh', 'Chiến Hữu Tề Tâm', 'Tốc Nạp', 'Vọng Sơn',
    'Dương Chi Mỹ Ngọc', 'Hạ Thiền Huyên Minh', 'Kim Thiền Thoát Xác', 'Động Tĩnh Tương Nghi', 'Ngọc Diệp Chiết Quang', 'Ngọa Ngọc',
    'Gảy Đàn', 'Phụng Minh Kỳ Sơn', 'Khúc Chấn Lương Trần', 'Vạn Lại Trầm Tịch', 'Ti Đồng Khánh Thanh', 'Lạc Hà',
    'Sam Trác', 'Phù Ẩm Trường Ca', 'Vạn Vật Hữu Linh', 'Tế Dĩ Loại Thương', 'Kiêu Dũng', 'Tồi Phong Trảm Kỳ',
    'Lẫm Nhiên Khí Độ', 'Nhân Quả Vãng Phục', 'Bồ Đề Vô Ngân', 'Bách Lộc Trình Tường', 'Phúc Đức Quả Báo', 'Lộc Hành Phổ Độ'
]

missing_names = [n for n in skill_names if n not in code_owner and n not in code_nat and n not in code_b1]
print(f'Skill Names Coverage: {len(skill_names) - len(missing_names)}/{len(skill_names)} present (Missing: {missing_names})')

# Check Huanzhang Stories
hz_stories = ['v01464_story', 'v01174_story', 'a01604_story']
missing_hz = [h for h in hz_stories if h not in code_nat and h not in code_owner]
print(f'Huanzhang Lore Coverage: {len(hz_stories) - len(missing_hz)}/{len(hz_stories)} present (Missing: {missing_hz})')

# Check Zhizhi HurtHealRate resolution
print(f'Zhizhi HurtHealRate resolution: {"Tỷ Lệ Hút Máu +5%" in code_nat or "Tỷ Lệ Hút Máu +5%" in code_owner}')

# Check Naturalization rules
nat_terms = ['Sát Thương Chí Tử', 'Dễ Vỡ', 'Ẩn Nấp', 'Trì Trệ', 'Thiêu Đốt', 'Hàn Thiên', 'Cấm Túc', 'Gây <color=#ff6724>Sát Thương Chuẩn Bổ Sung</color>']
missing_nat = [t for t in nat_terms if t not in code_nat and t not in code_owner and t not in code_b1]
print(f'Naturalization Rules Coverage: {len(nat_terms) - len(missing_nat)}/{len(nat_terms)} present (Missing: {missing_nat})')

print('\nCONCLUSION PREVIEW:')
if not missing_names and not missing_hz and not missing_nat:
    print('A. FULL RECOVERY POSSIBLE — all lost Batch 1 translations survive somewhere in local Python scripts and scratch artifacts!')
else:
    print('B. PARTIAL RECOVERY POSSIBLE')
