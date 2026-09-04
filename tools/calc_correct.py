import json

level_up = json.load(open(r'd:\BaiTapCode\WHMX\NeoArtifacts\MasterData\json\characterLevelUp.json', encoding='utf-8'))
# level_up is like {"1": 0, "2": 100, ...}
# Is there a coin cost for leveling? Usually in these games, 1 EXP = x coins. Or maybe it's in another config.
# If not, let's just print max exp.

data = json.load(open(r'd:\BaiTapCode\WHMX\WhmxCalc\public\data.json', encoding='utf-8'))
items = data['items']

# Find Lý Tiểu Hài
char = next(c for c in data['characters'].values() if c['id'] == 'W0182')

output = []
output.append(f"Name: {char['name_vi']} ({char['id']})")
output.append("=== MAX TALENTS ===")
t_coin = 0
t_items = {}
for t in char['talents']:
    for c in t.get('cost', []):
        iid = c['id']
        cnt = c['count']
        if iid == '3':
            t_coin += cnt
        else:
            t_items[iid] = t_items.get(iid, 0) + cnt
            
output.append(f"Coin for talents: {t_coin}")
for iid, cnt in t_items.items():
    output.append(f" - {items.get(iid, {}).get('name_vi', iid)}: {cnt}")

output.append("\n=== RANK UP (Constellation?) ===")
rank_rule = str(char['rankUpRule'])
r_coin = 0
r_items = {}
for r in data['rankUpRules'].get(rank_rule, []):
    r_coin += r.get('coin', 0)
    iid = r.get('itemId')
    cnt = r.get('count', 0)
    if iid and cnt:
         r_items[iid] = r_items.get(iid, 0) + cnt

output.append(f"Coin for rank up: {r_coin}")
for iid, cnt in r_items.items():
    output.append(f" - {items.get(iid, {}).get('name_vi', iid)}: {cnt}")

with open(r'd:\BaiTapCode\WHMX\WhmxCalc\tools\calc_test.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))
