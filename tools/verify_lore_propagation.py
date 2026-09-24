import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

# 1. Load generated_localization.json
with open('localization/generated_localization.json', 'r', encoding='utf-8') as f:
    gen_loc = json.load(f)

skin_loc = gen_loc.get('skins', {})
print(f"Total entries in generated_localization.json (skins): {len(skin_loc)}")
assert len(skin_loc) == 145, f"Expected 145 skins in generated_localization.json, got {len(skin_loc)}"

gen_loc_with_desc = sum(1 for v in skin_loc.values() if v.get('desc_vi'))
print(f"Entries with desc_vi in generated_localization.json: {gen_loc_with_desc} / 145")
assert gen_loc_with_desc == 145, f"Expected 145 with desc_vi, got {gen_loc_with_desc}"

# 2. Load data.json
with open('public/data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

data_skins = {}
high_skins_lore = {}

for cid, char in data['characters'].items():
    for s in char.get('skins', []):
        sid = s.get('skinID')
        data_skins[sid] = {
            'skinId': sid,
            'nameVi': s.get('name_vi'),
            'charNameVi': char.get('name_vi'),
            'storyVi': s.get('story_vi', ''),
            'storyCn': s.get('story_cn', ''),
            'obtainVi': s.get('obtain_vi', ''),
            'isHighSkin': s.get('is_high_skin', False),
            'seriesId': s.get('series_id'),
        }
        if s.get('is_high_skin'):
            high_skins_lore[sid] = s.get('story_vi', '')

print(f"Total skins in data.json: {len(data_skins)}")
skins_with_lore = [s for s in data_skins.values() if s['storyVi']]
print(f"Skins with non-empty story_vi in data.json: {len(skins_with_lore)} / {len(data_skins)}")
assert len(skins_with_lore) == 145, f"Expected 145 skins with story_vi, got {len(skins_with_lore)}"

print(f"\nHigh Skin Lore Coverage: {len(high_skins_lore)} / 10 High Skins")
assert len(high_skins_lore) == 10, f"Expected 10 high skins, got {len(high_skins_lore)}"
for sid, lore in sorted(high_skins_lore.items()):
    s = data_skins[sid]
    name_vi = s['nameVi']
    char_vi = s['charNameVi']
    assert lore, f"High skin {sid} missing lore!"
    assert lore != s['obtainVi'], f"High skin {sid} lore is copy of obtain!"
    print(f"  [OK] {sid} ({name_vi} - {char_vi}): {lore[:65]}...")

# Check Representative Samples
samples = [
    ('A0001003', 'Normal skin'),
    ('A0090004', 'Series 220 High Skin'),
    ('V0141005', 'Previously copied desc_vi==obtain_vi'),
    ('S0174003', 'S0174003 (Series 0/null)'),
]

print("\n--- Representative Samples in public/data.json ---")
for sid, desc in samples:
    s = data_skins.get(sid)
    assert s, f"Sample {sid} not found!"
    print(f"[{desc}] ID: {sid} | {s['nameVi']} ({s['charNameVi']}) | Series: {s['seriesId']}")
    print(f"  story_vi:  {s['storyVi']}")
    print(f"  obtain_vi: {s['obtainVi']}")
    assert s['storyVi'] != s['obtainVi'], f"Error: story_vi equals obtain_vi for {sid}"

print("\n[SUCCESS] LORE PROPAGATION FULLY VERIFIED IN public/data.json AND generated_localization.json!")
