# WHMX — QUY ƯỚC ID VÀ QUAN HỆ RAW TRONG MASTERDATA

> **Entry point:** [`WHMX_CURRENT_STATE_FINAL_2026-09-26.md`](WHMX_CURRENT_STATE_FINAL_2026-09-26.md) (status, infrastructure, rules, backlog). Related: [`WHMX_COMPLETE_TECHNICAL_HANDOFF_2026-09-20_v2.md`](WHMX_COMPLETE_TECHNICAL_HANDOFF_2026-09-20_v2.md). Older handoffs, `WHMX_NEXT_STEPS.md` and finished plans were removed on 2026-09-26 — links to them below resolve in git history only.

**Checkpoint:** 2026-09-20  
**Vai trò:** Tài liệu bắt buộc cho agent xử lý WHMX / WhmxCalc / NeoArtifacts khi đọc character ID, skill, buff, EX, Trí Tri, Hoán Chương, skin/Series, tag source và asset-bundle identity.

> **Nguyên tắc tối cao:** Hình dạng ID chỉ là dấu hiệu hỗ trợ, **không phải nguồn chân lý**. Kết luận cuối cùng phải dựa trên **exact raw relationship**, exact source field và provenance giữa các bảng/sheet/runtime index.

---

## 1. ID nhân vật

ID nhân vật thường có dạng:

```text
A0160
W0164
S0174
D0183
V0146
```

Chữ cái đầu là một phần namespace ID của game. Project chưa có authority cho phép gán một ý nghĩa gameplay toàn cục cho A/W/S/D/V.

Không được tự suy:

- nghề;
- hệ;
- rarity;
- phe;
- loại nhân vật;
- player/NPC status.

Bốn chữ số tiếp theo nhận diện family trong ID convention. Một ID skill/buff có chứa character family là dấu hiệu hữu ích, nhưng ownership vẫn phải được raw reference xác nhận.

---

## 2. Sáu public base-skill slots

Public base-skill grid đã xác minh dùng đúng sáu slot:

```text
01 = Thường kích
11 = Kỹ năng nghề
02 = Tuyệt kỹ
03 = Nội tại 1
04 = Nội tại 2
05 = Nội tại 3
```

Thứ tự public:

```text
01 -> 11 -> 02 -> 03 -> 04 -> 05
```

Ví dụ với A0160:

```text
A016001
A016011
A016002
A016003
A016004
A016005
```

Mapping này đã được xác minh cho public base grid. Không áp dụng mù quáng cho mọi record cùng hình dạng ở mọi bảng.

---

## 3. Slot suffix khác với raw `Type`

Suffix trong ID và trường raw `Type` là hai hệ khác nhau.

Mapping Type đã xác minh:

```text
Type 1  = 常击 = Đánh Thường
Type 2  = 职业 = Kỹ Năng Nghề
Type 3  = 绝技 = Tuyệt Kỹ
Type 4  = 被动 = Nội Tại
Type 5  = 被动 = Nội Tại
Type 6  = 被动 = Nội Tại
Type 11 = 被动 = Nội Tại
```

Không được nhầm:

```text
suffix 01 != Type 1
suffix 11 != Type 11
suffix 06 != Type 6
```

`Type 6` chỉ là classification của raw row, không chứng minh `{character}06` là public nội tại thứ tư.

---

## 4. Đuôi `06`

`06` không thuộc sáu public base slots.

Không có rule toàn cục cho phép kết luận:

```text
06 = Hoán Chương
06 = Nội tại 4
06 = EX
```

Gặp `{character_id}06*` thì mặc định:

```text
NON_BASE_OR_UNKNOWN
```

cho tới khi raw graph chứng minh vai trò thật.

Không:

- thêm 06 vào public six-skill grid;
- suy ownership Hoán Chương từ 06;
- tự tạo badge/type label;
- xóa record 06 khỏi raw evidence chỉ vì không public.

Phải lần exact inbound/outbound reference qua các bảng liên quan.

---

## 5. Hậu tố `ex`

`ex` thường xuất hiện trong enhanced skill/display record, nhưng không tự động đồng nghĩa với Trí Tri player-facing.

Ví dụ đã xác minh:

```text
A016004   = base display
A016004ex = exact enhanced display
```

Quan hệ Trí Tri đúng phải đi qua raw progression:

```text
roleattrMap / rank-star progression
-> SkillUP
-> base skill
-> exact EX display record
```

Không suy từ regex `ex` đơn thuần.

### display_source

Tên và description của một EX phải cùng thuộc exact display identity.

Sai:

```text
base title + EX description
```

Đúng:

```text
EX title + EX description from exact EX display_source
```

### parameter_source

Numeric vector có thể đến từ relation/source khác với display record nếu raw edge chứng minh.

Do đó:

```text
display_source != parameter_source
```

là hợp lệ khi có provenance rõ.

Các ID như:

```text
V005502ex
W018203ex
S017403ex
S017403ex1
S017403ex2
S017403ex3
```

cho thấy vị trí `ex`/level không đồng nhất giữa bảng. Không dùng parser chuỗi để thay exact relationship.

---

## 6. Hậu tố `npc`

Ví dụ:

```text
A016005npc
```

Đây là dấu hiệu mạnh cho internal/NPC/battle variant.

Rule:

- không đưa vào public six-skill grid;
- không đưa vào translation queue thông thường nếu không player-facing;
- không xóa khỏi raw MasterData;
- giữ nếu dependency graph/controller/battle logic cần.

---

## 7. Level suffix / variant suffix

Ví dụ:

```text
A000101_1
A000101_2
A000101_3
A000101_4
A000101_5

A000104_1
A000104_2
A000104_3
```

Các pattern 5-level normal attack và 3-level passive đã được quan sát, nhưng không phải authority để group mọi skill.

Chỉ group khi đã xác minh:

- cùng base identity;
- cùng exact relation;
- cùng source template;
- cùng marker/placeholder grammar;
- cùng provenance tương thích.

Tách group nếu khác:

- display identity;
- source template;
- placeholder grammar;
- branch condition;
- parameter source;
- marker set.

Suffix `_3` không có nghĩa tự động là `EffectPara3`.

---

## 8. Placeholder index không phải skill level

Các grammar cần bảo toàn:

```text
[EffectParam,n]
[EffectPara,n]
[BuffParam,n]
[Effect1Para,n]
[Effect2Para,n]
[Effect3Para,n]
[Effect4Para,n]
[Effect5Para,n]
[Condition1Para,n]
[Condition2Para,n]
[Condition3Para,n]
[Condition4Para,n]
[Condition5Para,n]
#1 ... #9
```

Ví dụ A016205 `_1.._3` có thể dùng cùng template `[Effect1Para,1]` nhưng resolve thành các vector level khác nhau qua exact parameter source.

Không được:

- đổi placeholder chỉ vì row suffix khác;
- suy parameter vector từ tên key;
- coi source text giống nhau là numeric output giống nhau.

---

## 9. Trí Tri / Zhizhi

Zhizhi phải theo raw progression/SkillUP, không theo ID suffix.

Badge dựa trên base slot đã xác minh:

```text
01 -> [CƯỜNG HÓA ĐÁNH THƯỜNG]
11 -> [CƯỜNG HÓA KỸ NĂNG NGHỀ]
02 -> [CƯỜNG HÓA TUYỆT KỸ]
03 -> [CƯỜNG HÓA NỘI TẠI 1]
04 -> [CƯỜNG HÓA NỘI TẠI 2]
05 -> [CƯỜNG HÓA NỘI TẠI 3]
```

Không:

- tạo Zhizhi chỉ vì thấy `ex`;
- suy badge từ `Type`;
- gộp base + EX thành một display identity;
- lấy description base cho EX.

Frontend có thể nest alternate form nhưng identity/provenance vẫn riêng.

---

## 10. Hoán Chương

Các lớp dữ liệu phải giữ riêng:

```text
BrilliantMap      = metadata/lore Hoán Chương
BrilliantUpMap    = progression/upgrade relation
SKILL             = gameplay skill/effect
BUFF_STATUS/buffMap = gameplay referenced status/buff
talentBankMap     = talent/property relation
```

Các relation từng xác minh:

```text
characterTalentMap.talentBankId -> talentBankMap
talentBankMap.requireTalent      -> talentBankMap
BrilliantMap.PropertyUp          -> talentBankMap
BrilliantMap.Buff                -> buffMap
BrilliantMap <-> BrilliantUpMap
```

Không được dùng một layer thay cho layer khác.

Đặc biệt:

```text
{character_id}06* != proof of Hoán Chương ownership
```

---

## 11. Buff ID không có parser semantics toàn cục

Ví dụ:

```text
Buff_Snipe_Lan
Buff_MD16201_LAN
Buff_A0160_hz_1
Buff_Gangrene
Buff_W016411_6
Buff_W0164_1Lan
Buff_W0164_1BLan
Buff_A0001_2
Buff_A0001_2_1
Buff_S0174_2_2
Buff_S0174_3_3_1ex
```

`Buff_` chỉ cho biết họ record. Nó không chứng minh player-facing.

Một buff row có thể là:

- player-facing buff/debuff/status;
- terminal leaf;
- named controller;
- unnamed controller;
- selector/wrapper/helper;
- battle-only effect;
- NPC/internal row;
- condition/job/season branch;
- dependency không hiện trực tiếp.

Không đưa mọi BUFF_STATUS row vào UI/translation queue.

---

## 12. `LAN`, `Lan`, `BLan`

Chưa có semantics toàn cục.

Không được kết luận:

```text
LAN = upgrade
LAN = EX
LAN = player-facing
LAN/non-LAN = same effect
BLan = level B
```

W0164 đã chứng minh `Lan` và `BLan` có branch/context riêng.

Semantics phải lấy từ:

```text
parent/child path
branch condition
controller/leaf identity
exact parameter source
```

---

## 13. Cùng tên khác ID vẫn là identity riêng

Hai buff có cùng display CN vẫn có thể khác:

- parameter;
- duration;
- stacks;
- target;
- trigger;
- condition;
- job/season variant;
- controller/leaf role;
- battle timing.

Localization có thể reuse cùng tên VI nếu exact display CN và owner terminology cho phép, nhưng:

```text
ID vẫn tách
row vẫn tách
body/effect không copy mù
```

---

## 14. Khác tên/ID nhưng chung graph/controller

Một skill có thể hiển thị generic controller term nhưng raw graph branch sang nhiều named leaves.

Binding key không được chỉ là `Buff_ID`.

Phải giữ đủ context:

```text
parent/child path
edge order
branch condition
local parameter vector
inherited parameter vector
controller identity
leaf identity
card-local context
```

Đây là lý do flat popup binding cũ từng sai.

---

## 15. Player-facing vs internal-only

Không coi mọi row có CN là player-facing; cũng không coi row không CN là rác.

Phân loại bằng evidence:

- skill player-facing có tham chiếu không;
- có title/body display không;
- controller hay terminal leaf;
- branch condition;
- runtime/UI có popup/term không;
- chỉ battle logic hay không.

Nếu chưa đủ evidence, dùng trạng thái kiểu:

```text
UNRESOLVED
BLOCKED_CONTEXT
RAW_NAMED_CONTROLLER
INTERNAL_ONLY_CANDIDATE
```

Không tự xóa hoặc tự public.

---

## 16. `display_source` và `parameter_source`

Mọi record player-facing, đặc biệt EX/popup, phải tách hai provenance:

```text
display_source
= exact title + exact description identity

parameter_source
= exact numeric vector source
```

Không tạo hybrid display object.

---

## 17. Character skin IDs / base appearance

Character skin IDs thường nối character family với suffix ba chữ số, ví dụ:

```text
A0090001
A0090002
A0090004
S0174003
```

Current accepted convention:

```text
001 = base/original appearance (Tạo Hình)
002 = upgraded/base portrait appearance (Chân Dung)
003+ = skin candidates
```

Nhưng public eligibility vẫn phải theo raw skin record semantics (`skin_type`, relation, roster), không chỉ suffix.

Current actual-skin roster:

```text
145 actual skins
all skin_type = 3
```

Do not infer Series, High Skin, acquisition or release state from skin suffix.

---

## 18. `skinLOGO`, Series và High Skin

Current actual-skin Series model uses exact raw/source relationship, not image/name similarity.

Important:

```text
S0174003
skinLOGO = 0
-> intentionally no Series
```

Do not fabricate a Series.

Current actual-skin Series set uses IDs 202–220.

Special:

```text
205 -> Phi Di
```

`102 -> 精研 -> Tinh Nghiên` belongs to type-2/breakthrough appearance context and is not one of the 19 actual-skin Series filters.

High Skin must use semantic evidence:

```text
is_high_skin
```

Never infer:

```text
series_id == 220 -> High Skin
```

---

## 19. Character tag source fields

D2.4.1 proved the exact Character tag source relation:

```text
workbook CHARACTER.tags_cn
== raw characterTable.CharacterTagLanText
```

Current proof:

```text
133/133 exact match
0 mismatch
```

Distinction:

```text
CharacterTagLan
= field/reference identity

CharacterTagLanText
= raw Chinese display value
```

Do not substitute one for the other.

`tagsCn` exposed to Admin is read-only source data; `tagsVi` is the editable/localized side.

---

## 20. AssetBundle/runtime identity fields

In runtime asset indexes:

```text
MD5Name
= exact storage/lookup bundle filename

FileMD5
= expected content checksum
```

They are not interchangeable.

Example concept:

```text
logical AB
-> MD5Name for bundle file lookup
-> FileMD5 for verification
-> container/path for object extraction
```

Do not compare `MD5Name` as if it were the file-content checksum.

R2 public object keys are normalized lowercase. Windows case-insensitivity must not be treated as proof that mixed-case paths are safe on R2/Linux/Vercel.

---

## 21. Absolute non-inference rules

Never infer any of the following without exact evidence:

- A/D/S/V/W means class/faction/rarity/system.
- 06 always means Hoán Chương.
- 06 always means Passive 4.
- `ex` always means player-facing Trí Tri.
- `npc` can be deleted from raw data.
- LAN/Lan/BLan has one universal meaning.
- same display name means same effect/parameters.
- same-looking skill family means same level count.
- suffix `_3` means parameter slot 3.
- placeholder index equals skill level.
- all BUFF_STATUS rows are public.
- all named buffs belong in GLOSSARY.
- character ID substring proves direct ownership.
- Type and slot suffix are one numbering system.
- skin suffix proves Series/High Skin/acquisition.
- `skinLOGO == 220` proves High Skin.
- generated JSON/DB snapshot outranks raw/workbook authority by existence alone.
- text similarity may replace exact raw relationship.

---

## 22. Procedure for an unknown ID / relation

When encountering an unfamiliar record:

1. Identify the exact source table/sheet/snapshot.
2. Record exact ID and relevant raw fields.
3. Find inbound references.
4. Find outbound references.
5. Establish character/skin/skill/buff family only where raw relation supports it.
6. Identify `display_source`.
7. Identify `parameter_source`.
8. Resolve level/variant from raw relationship, not regex.
9. Classify player-facing/controller/leaf/helper/NPC/unresolved.
10. Compare source CN, marker, placeholder and rich-text grammar.
11. Preserve provenance/path/branch context.
12. Only then decide grouping, translation, popup binding or public eligibility.
13. If evidence is insufficient, keep the record and mark UNKNOWN/UNRESOLVED.

---

## 23. Current authority hierarchy

```text
NeoArtifacts / immutable raw MasterData/runtime evidence
= raw CN + gameplay semantics + exact ID relationships + asset provenance

WhmxCalc/localization/localization_master.xlsx
= current persistent Vietnamese localization authority

Neon PostgreSQL
= hosted normalized/Admin working layer with explicit overrides/revisions/audit
  (does not automatically outrank raw/workbook authority)

localization/generated_localization.json
= generated output

WhmxCalc/public/data.json
= generated public snapshot
```

If workbook/DB/generated data conflicts with raw evidence, report provenance conflict before mutation. Do not rewrite raw evidence to make a hypothesis look consistent.
