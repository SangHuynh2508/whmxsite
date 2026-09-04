import json
import os

with open('public/data.json', encoding='utf-8') as f:
    data = json.load(f)

items = data['items']

# Pick a rarity 4 character (SSR)
char = next(c for c in data['characters'].values() if c['rare'] == 4)

output = []
output.append(f"Nhân vật (Độ hiếm SSR - Siêu Việt): {char['name_vi']}")
output.append(f"Nghề nghiệp: {char['job']}")
output.append("=========================")

# Max Level EXP
exp_needed = max(data['expCurve'].values())
output.append(f"1. Tổng EXP cần để đạt cấp tối đa (Level 110): {exp_needed}")

talent_coin = 0
talent_items = {}

# 1. Talent cost
for t in char['talents']:
    for c in t.get('cost', []):
        iid = c['id']
        cnt = c['count']
        if iid == '3':
            talent_coin += cnt
        else:
            talent_items[iid] = talent_items.get(iid, 0) + cnt

# 2. Rank up cost (Đột phá giới hạn cấp)
rank_rule = str(char['rankUpRule'])
rules = data['rankUpRules'].get(rank_rule, [])
rank_coin = 0
for r in rules:
    rank_coin += r.get('coin', 0)
    iid = r.get('itemId')
    cnt = r.get('count', 0)
    if iid and cnt > 0:
        talent_items[iid] = talent_items.get(iid, 0) + cnt

output.append("2. Tổng Tiền Đông Cốc cần thiết:")
output.append(f"   - Nâng cấp Thiên Phú: {talent_coin:,}")
output.append(f"   - Đột Phá Giới Hạn: {rank_coin:,}")
output.append(f"   - TỔNG CỘNG: {talent_coin + rank_coin:,}")
output.append("3. Tổng Nguyên Liệu cần thiết:")
for iid, count in sorted(talent_items.items(), key=lambda x: -x[1]):
    iname = items.get(iid, {}).get('name_vi', f'Unknown {iid}')
    output.append(f"   - {iname}: {count:,}")

with open('tools/cost_output.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))
