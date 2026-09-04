import json

talent_map = json.load(open(r'd:\BaiTapCode\WHMX\NeoArtifacts\MasterData\json\characterTalentMap.json', encoding='utf-8'))

# Find any node with maxLevel > 1 or requireCoin/requireItems as list of lists
multi_level_nodes = []
list_of_lists_nodes = []

for k, node in talent_map.items():
    if node.get('maxLevel') and int(node.get('maxLevel')) > 1:
        multi_level_nodes.append(node)
    
    rc = node.get('requireCoin')
    if isinstance(rc, list) and len(rc) > 0 and isinstance(rc[0], list):
        list_of_lists_nodes.append(node)
        
    ri = node.get('requireItems')
    if isinstance(ri, list) and len(ri) > 0 and isinstance(ri[0], list):
        list_of_lists_nodes.append(node)

with open(r'd:\BaiTapCode\WHMX\WhmxCalc\tools\talent_output.txt', 'w', encoding='utf-8') as f:
    f.write(f"Multi-level nodes: {len(multi_level_nodes)}\n")
    if multi_level_nodes:
        n = multi_level_nodes[0]
        f.write(f"Example: {n.get('name')}, maxLevel: {n.get('maxLevel')}\n")
        f.write(f"requireCoin: {n.get('requireCoin')}\n")
        f.write(f"requireItems: {n.get('requireItems')}\n")
    
    f.write(f"\nList of lists nodes: {len(list_of_lists_nodes)}\n")
    if list_of_lists_nodes:
        n = list_of_lists_nodes[0]
        f.write(f"Example: {n.get('name')}\n")
        f.write(f"requireCoin: {n.get('requireCoin')}\n")
        f.write(f"requireItems: {n.get('requireItems')}\n")
