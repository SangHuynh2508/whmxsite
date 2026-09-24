import sys, os

sys.stdout.reconfigure(encoding='utf-8')

phrases = [
    'tiến hành',
    'đơn vị chịu đòn',
    'kẻ địch chịu đòn',
    'đơn thể',
    'thành Sát Thương',
    'không ít hơn',
    'tối đa có thể',
    'Tấn Công của bản thân'
]

with open('localization/batch_review/batch1_human_review.md', 'r', encoding='utf-8') as f:
    content = f.read()

print('=== SELF-CHECK SEARCH RESULTS IN BATCH 1 REVIEW MD ===')
found_any = False
for p in phrases:
    count = content.count(p)
    print(f'Phrase "{p}": {count} occurrences')
    if count > 0:
        found_any = True
        for line in content.splitlines():
            if p in line:
                print(f'  Match: {line[:140]}')

if not found_any:
    print('\n[PERFECT] ZERO SUSPICIOUS TRANSLATIONESE PHRASES REMAIN IN BATCH 1 REVIEW MD!')
