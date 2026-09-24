import os, sys, json, openpyxl, glob, time

sys.stdout.reconfigure(encoding='utf-8')

batch1_cids = ['A0121', 'A0086', 'A0160', 'V0146', 'V0117']

def inspect_file(filepath):
    if not os.path.exists(filepath):
        return None
    size = os.path.getsize(filepath)
    mtime = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(os.path.getmtime(filepath)))
    
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        
    cids_found = [c for c in batch1_cids if c in content]
    has_pop = any(term in content for term in ['Gây Sát Thương', 'Sau khi', 'Khi ở trạng thái', 'Trâu nhỏ', 'Lần này, mọi câu chuyện', 'Cây đàn này do', 'Dương Chi Mỹ Ngọc', 'Phao Xạ'])
    
    return {
        'path': filepath,
        'size': size,
        'mtime': mtime,
        'cids': cids_found,
        'populated': has_pop,
        'content': content
    }

files_to_check = [
    'localization/generated_localization.json',
    'public/data.json',
    'localization/batch_review/batch1_human_review.json',
    'localization/batch_review/batch1_human_review.md',
    'localization/batch_context/A0121_context.json',
    'localization/batch_context/A0086_context.json',
    'localization/batch_context/A0160_context.json',
    'localization/batch_context/V0146_context.json',
    'localization/batch_context/V0117_context.json',
    'tools/apply_batch1_final_cleanup.py',
    'tools/apply_batch1_naturalization_pass2.py',
    'tools/apply_batch1_naturalization_pass3.py',
    'tools/apply_batch1_naturalization_pass4.py',
    'tools/apply_batch1_naturalization_final.py',
    'tools/self_check_review.py'
]

scratch_dir = r'C:\Users\Legion\.gemini\antigravity-ide\brain\8ce6273a-cafe-4c12-80b2-f6d10ae0f369\scratch'
if os.path.exists(scratch_dir):
    for f in os.listdir(scratch_dir):
        files_to_check.append(os.path.join(scratch_dir, f))

print('=== RECOVERY SOURCES AUDIT ===')
for fp in files_to_check:
    res = inspect_file(fp)
    if res and res['cids']:
        p = res['path']
        print(f"File: {p}")
        print(f"  mtime: {res['mtime']} | size: {res['size']} bytes | populated: {res['populated']}")
        print(f"  cids: {res['cids']}")

