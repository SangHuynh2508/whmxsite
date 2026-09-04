import json

char_table = json.load(open(r'd:\BaiTapCode\WHMX\NeoArtifacts\MasterData\json\characterTable.json', encoding='utf-8'))
jobs = {}
for cid, c in char_table.items():
    job = c.get('job')
    name_cn = c.get('nameLanText', '')
    if not name_cn:
        name_cn = c.get('name', '')
    if job not in jobs:
        jobs[job] = []
    if len(jobs[job]) < 5:
        jobs[job].append(name_cn)

output = []
for j, chars in sorted(jobs.items(), key=lambda x: str(x[0])):
    output.append(f'Job ID: {j} -> Examples: {", ".join(chars)}')

with open(r'd:\BaiTapCode\WHMX\WhmxCalc\tools\jobs_output.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))
