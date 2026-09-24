import sys, os, json, re, time

sys.stdout.reconfigure(encoding='utf-8')

scratch_files = [
    'tools/apply_batch1_naturalization_final.py',
    'tools/apply_batch1_naturalization_pass4.py',
    'tools/apply_batch1_naturalization_pass3.py',
    'tools/apply_batch1_naturalization_pass2.py',
    'tools/apply_batch1_final_cleanup.py',
    'C:/Users/Legion/.gemini/antigravity-ide/brain/8ce6273a-cafe-4c12-80b2-f6d10ae0f369/scratch/fix_all_skills_exact.py',
    'C:/Users/Legion/.gemini/antigravity-ide/brain/8ce6273a-cafe-4c12-80b2-f6d10ae0f369/scratch/apply_batch1_localization.py',
    'C:/Users/Legion/.gemini/antigravity-ide/brain/8ce6273a-cafe-4c12-80b2-f6d10ae0f369/scratch/build_audit_artifacts.py',
    'C:/Users/Legion/.gemini/antigravity-ide/brain/8ce6273a-cafe-4c12-80b2-f6d10ae0f369/scratch/apply_all_owner_changes.py'
]

batch1_cids = ['A0121', 'A0086', 'A0160', 'V0146', 'V0117']

print('=== CHECKING PYTHON SCRIPT RECOVERY SOURCES ===')
for fp in scratch_files:
    if os.path.exists(fp):
        mtime = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(os.path.getmtime(fp)))
        with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        # Count skill keys
        skill_keys = re.findall(r"['\"]([A-Z0-9]{6}_\d+)['\"]", content)
        buff_keys = re.findall(r"['\"](Buff_[A-Z0-9_]+)['\"]", content)
        
        print(f"File: {fp}")
        print(f"  mtime: {mtime} | size: {os.path.getsize(fp)} bytes")
        print(f"  Skill record keys found: {len(set(skill_keys))}")
        print(f"  Buff record keys found: {len(set(buff_keys))}")
        print(f"  Contains full V01464 story: {'v01464_story' in content or 'Trâu nhỏ' in content}")
        print(f"  Contains full V01174 story: {'v01174_story' in content or 'Lộc Vương Bổn Sinh Đồ' in content}")
        print(f"  Contains naturalized A01604 story: {'a01604_story' in content or 'ông lão' in content}")
        print()
