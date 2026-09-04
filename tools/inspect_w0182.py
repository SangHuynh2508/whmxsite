import json

talents = json.load(open(r'd:\BaiTapCode\WHMX\NeoArtifacts\MasterData\json\characterTalentMap.json', encoding='utf-8'))
bank = json.load(open(r'd:\BaiTapCode\WHMX\NeoArtifacts\MasterData\json\talentBankMap.json', encoding='utf-8'))

out = []
for tid, t in talents.items():
    if tid.startswith("W0182"):
        name = t.get("nameLanText", t.get("name", ""))
        req = t.get("requireTalent", [])
        bank_id = t.get("talentBankId", "")
        icon = bank.get(bank_id, {}).get("icon", "")
        out.append(f"[{tid}] {name} (req: {req}) - icon: {icon}")
        
with open(r'd:\BaiTapCode\WHMX\WhmxCalc\tools\inspect_w0182.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
