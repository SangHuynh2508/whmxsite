import json

bank = json.load(open(r'd:\BaiTapCode\WHMX\NeoArtifacts\MasterData\json\talentBankMap.json', encoding='utf-8'))
out = []
for k, v in list(bank.items())[:5]:
    out.append(f"{k}: icon={v.get('icon')}, name={v.get('namelanText')}")
    
with open(r'd:\BaiTapCode\WHMX\WhmxCalc\tools\inspect_bank_out.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
