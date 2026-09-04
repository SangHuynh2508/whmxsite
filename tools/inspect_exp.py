import json
from pathlib import Path

master_dir = Path(r'd:\BaiTapCode\WHMX\NeoArtifacts\MasterData\json')
item_map = json.load(open(master_dir / 'itemMap.json', encoding='utf-8'))

# Inspect EXP items
for iid in ['1011', '1012', '1013', '1014', '1015']:
    if iid in item_map:
        item = item_map[iid]
        print(f"Item {iid}: {item.get('nameLanText')}")
        print(f"  useParam: {item.get('useParam')}")
        print(f"  useArgs: {item.get('useArgs')}")
        print(f"  cost/other: {[k for k, v in item.items() if 'coin' in k.lower() or 'cost' in k.lower()]}")

# Also check if there's a global config file
config_files = [
    'SystemConfig.json', 'systemConfig.json', 'Config.json', 'GlobalConfig.json', 
    'constant.json', 'Constant.json', 'gameConfig.json'
]
for f in config_files:
    p = master_dir / f
    if p.exists():
        print(f"\nFound config file: {f}")
        data = json.load(open(p, encoding='utf-8'))
        # Try to find 'exp' or 'coin' or 'level' in keys
        if isinstance(data, dict):
            for k, v in data.items():
                if isinstance(k, str) and ('exp' in k.lower() or 'coin' in k.lower() or 'cost' in k.lower()):
                    print(f"  {k}: {v}")
        elif isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    # Check for key/value patterns
                    key = item.get('key') or item.get('id') or str(item)
                    if isinstance(key, str) and ('exp' in key.lower() or 'coin' in key.lower() or 'cost' in key.lower()):
                        print(f"  {key}: {item}")
