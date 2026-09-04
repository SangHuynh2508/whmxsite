import json
from pathlib import Path

data_path = Path(r'd:\BaiTapCode\WHMX\NeoArtifacts\MasterData\json\characterTalentMap.json')
talents = json.load(open(data_path, encoding='utf-8'))

def inspect_char(char_prefix):
    print(f"\n--- Topology for {char_prefix} ---")
    nodes = {}
    for tid, t in talents.items():
        if tid.startswith(char_prefix):
            nodes[tid] = t

    print(f"Total nodes: {len(nodes)}")
    
    roots = []
    branches = 0
    merges = 0
    max_reqs = 0
    
    # Check dependencies
    req_map = {} # node -> list of requirements
    for tid, t in nodes.items():
        reqs = t.get('requireTalent', [])
        req_map[tid] = reqs
        if not reqs:
            roots.append(tid)
        if len(reqs) > max_reqs:
            max_reqs = len(reqs)
        if len(reqs) > 1:
            merges += 1
            
    # Check branching (how many nodes require this node)
    used_by = {}
    for tid, reqs in req_map.items():
        for r in reqs:
            used_by[r] = used_by.get(r, 0) + 1
            
    for r, count in used_by.items():
        if count > 1:
            branches += 1
            
    print(f"Roots: {len(roots)}")
    print(f"Nodes with >1 requirements (merges): {merges}, max reqs: {max_reqs}")
    print(f"Nodes required by >1 nodes (branches): {branches}")

inspect_char("W0182")
inspect_char("W0041")
inspect_char("A0001")
