# 物华弥新 Character Upgrade Calculator --- UI Design Specification

## 1. Mục tiêu

Thiết kế lại **Character Upgrade Calculator** theo hướng **game
companion tool / database**, không phải generic SaaS/admin dashboard.

Phase hiện tại: - Chọn nhân vật. - Tính Level từ trạng thái hiện tại đến
mục tiêu. - Tính Thiên Phú (Talent) từ trạng thái hiện tại đến mục
tiêu. - Tổng hợp Đông Cốc Tệ, EXP và vật liệu. - Dùng asset thật đã
extract từ game. - Giữ kiến trúc để mở rộng Character Database, Build,
Guide và calculator khác.

> **Data determines the structure; artwork provides the color; UI
> provides clarity.**

## 2. Design Direction

### Nên

-   Sạch, gọn, information-dense.
-   Cảm giác game companion / editorial / museum-like.
-   Flat surfaces, nền trung tính, border mảnh.
-   Corner radius nhỏ/vừa.
-   Typography hierarchy rõ.
-   Character/item/talent artwork là nguồn màu chính.
-   Hover/focus/transition chỉ dùng khi có chức năng.

### Không nên

-   Glassmorphism.
-   Decorative gradients.
-   Glow/neon.
-   Oversized rounded cards.
-   Shadow mạnh khắp nơi.
-   Animation trang trí.
-   Button gradient lớn.
-   Card lồng card.
-   Emoji thay icon game.
-   Hero section chiếm nhiều viewport.

## 3. Desktop Layout

``` text
┌─────────────────────────────────────────────────────────────────────────────┐
│ VẬT HOA DI TÂN                          Calculator   Characters   Data      │
├───────────────────┬─────────────────────────────────────────────────────────┤
│ Character Sidebar │ Character Header                                        │
│ Search / Filter   │ Level Progression                                       │
│ Character List    │ Talent Progression / Graph                              │
│                   │ Required Resources                                      │
└───────────────────┴─────────────────────────────────────────────────────────┘
```

Giữ sidebar hiện tại nếu hợp lý. Main content đặt `max-width` để không
bị loãng trên màn hình lớn.

## 4. Character Sidebar

-   Search tên Việt và Trung.
-   Filter rarity.
-   Avatar thật.
-   Tên Việt primary; tên Trung secondary/tooltip.
-   Rarity là metadata nhỏ.
-   Selected state rõ nhưng không glow/gradient.
-   Không biến mỗi character thành một card lớn.

## 5. Character Header

Compact, dùng `CharacterAvatar_runtime` hoặc `CharacterCards_runtime`.

``` text
[ CARD ]  Thố Hình Đào Huân
[      ]  兔形陶埙
[      ]  SSR · Viễn Kích · ...
```

Ảnh khoảng 96--120 px desktop. Không cần hero/banner lớn.

## 6. Level Progression

``` text
LEVEL
[ 1 ] ─────────────────────────────→ [ 120 ]
```

-   Current \>= 1.
-   Target không thấp hơn Current.
-   Max level ưu tiên lấy từ verified data.
-   Có thể dùng numeric input + slider nếu không giảm độ chính xác.
-   Thay đổi input phải recalculate ngay.
-   Không cần nút Calculate lớn.

# 7. Talent Progression --- Priority Feature

## 7.1 Không chỉ dùng numeric input

Không nên chỉ có:

``` text
Current Node [0] → Target Node [31]
```

Talent có dependency, loại node, icon và prerequisite. UI phải thể hiện
progression thật.

## 7.2 Mapping icon đã xác minh

``` text
characterTalentMap
    ↓ talentBankId
talentBankMap[id]
    ↓ icon
TalentIcons_runtime/{icon}.png
```

Ví dụ:

``` text
characterTalentMap["A000103"].talentBankId → T1312
talentBankMap["T1312"].icon → kh_AttkAdd
TalentIcons_runtime/kh_AttkAdd.png
```

Không đoán icon theo tên talent.

## 7.3 Graph topology

Build dependency từ:

``` text
characterTalentMap.requireTalent
```

**Không giả định talent luôn tuyến tính 1 → 31.**

Trước implementation, inspect nhiều character để xác định: - số root; -
branch; - merge; - vai trò thật của `index`; - dependency có nhất quán
giữa roster hay không.

Nếu data có branch thì UI phải render branch. Nếu thật sự linear thì
dùng progression track.

## 7.4 Node states

Mỗi node cần: - `completed`: đã có ở Current. - `upgrade`: nằm trong
đường nâng. - `target`: node mục tiêu. - `neutral`: chưa chọn. -
`locked/unavailable`: chưa đủ dependency/điều kiện.

Không phụ thuộc chỉ vào màu. Có thể dùng border, opacity, check nhỏ,
target ring, lock indicator.

## 7.5 Chọn Current / Target

Ưu tiên click trực tiếp graph.

``` text
Mode: [ Target ] [ Current ]
```

Mặc định click node = Target. Chuyển sang Current rồi click node = trạng
thái hiện tại.

Nếu test UX thấy gây nhầm, có thể thêm control compact, nhưng graph vẫn
là biểu diễn chính.

## 7.6 Talent tooltip / popover

Hover/click node mở:

``` text
┌──────────────────────────────────┐
│ [icon] Sinh Mệnh · Cường Hóa     │
│        生命·强化                  │
│                                  │
│ HP cơ bản +10%                   │
│ Yêu cầu: Lv.10                   │
│ [item] ×5   [item] ×5            │
│ Đông Cốc Tệ ×2,000              │
└──────────────────────────────────┘
```

Lấy từ data khi có: - tên Việt; - `namelanText`; -
`talentBankMap.DescriptionLanText`; - `descriptionRemLanText`; -
`requireLevel`; - `requireStar`; - `requireCoin`; - `requireItems`; -
dependency; - icon.

Không sáng tác mô tả nếu source không có.

## 8. Talent Assets

Đã có:

``` text
Assets/TalentIcons_runtime/
```

Ví dụ: `kh_AttkAdd`, `kh_HpAdd`, `kh_PasSkillA02`, `kh_PasSkillB01`,
`kh_Level15`, `kh_Level30`, `kh_Level50`, `kh_Level70`, `kh_Level90`,
`kh_Level100`, `kh_Level110`, `kh_UpRare3/4/5`.

`talentBankMap` còn có `pitch` và `shadow`. Có thể nghiên cứu sau để tái
tạo frame node gần game hơn. **Phase hiện tại chỉ cần icon chính.**

## 9. Required Resources

Không dùng card lớn cho từng item. Desktop dùng compact grid 3--4 cột
hoặc compact list.

``` text
[icon]  Thẻ Chứng Nhận Kính Dự V             ×55
[icon]  Lập Hồ Sơ                            ×50
[icon]  Thẻ Chứng Nhận Kính Dự II            ×30
```

Quantity phải nổi bật hơn tên item. Icon đủ để nhận diện nhưng không lấn
át số lượng.

Có thể group Currency / EXP / upgrade / talent materials **chỉ khi
classification được chứng minh từ data**.

## 10. Summary Metrics

``` text
REQUIRED RESOURCES

2,870,400              4,692,799
Đông Cốc Tệ            Kinh nghiệm
```

Không cần gradient card.

Nếu sau này có EXP book conversion: - vẫn giữ raw EXP; - conversion là
secondary; - không đưa vào Phase 1 nếu conversion chưa verified.

## 11. Real Assets

Không dùng placeholder khi đã có asset:

``` text
Assets/CharacterAvatar_runtime/
Assets/CharacterCards_runtime/
Assets/ItemIcons/
Assets/SkillIcons_runtime/
Assets/TalentIcons_runtime/
```

Mapping deterministic: - Character ID → avatar/card. - Item ID →
`itemicon_<itemId>.png`. - Talent →
`talentBankId → talentBankMap.icon → <icon>.png`.

Nếu thiếu asset: fallback trung tính + log missing asset; không crash và
không tự chọn asset gần giống.

## 12. Immediate Recalculation

Recalculate ngay khi: - đổi character; - Current/Target Level; -
Current/Target Talent.

Không yêu cầu nút Calculate lớn.

## 13. Responsive

### Desktop

-   Sidebar sticky/fixed hợp lý.
-   Talent graph có không gian.
-   Resource grid 3--4 cột.

### Tablet

-   Sidebar thu hẹp.
-   Grid 2--3 cột.
-   Graph horizontal scroll nếu cần.

### Mobile

``` text
Character selector
↓
Character header
↓
Level
↓
Talent
↓
Resources
```

Sidebar chuyển drawer/modal/select panel. Graph hỗ trợ scroll/pan.
Tooltip mở bằng tap. Resource dùng list 1 cột hoặc grid 2 cột nếu đủ
chỗ.

## 14. Accessibility

-   Không chỉ dùng màu để biểu thị node state.
-   Keyboard focus rõ.
-   Talent node có accessible label.
-   Image có alt.
-   Input có label.
-   Tooltip dùng được bằng keyboard/tap.
-   Contrast đủ đọc.

## 15. Data Integrity

Nếu field/enum chưa chứng minh: `UNKNOWN / UNVERIFIED` hoặc không hiển
thị.

Không suy semantics từ numeric enum.

Không hard-code progression nếu có thể lấy từ MasterData: - max level; -
talent dependency; - resource cost; - talent icon; - rarity; - metadata.

Giữ Chinese source name trong normalized data.

## 16. Suggested Code Structure

Dù dùng Vite + Vanilla JS/CSS, chia responsibility:

``` text
src/
  main.js
  data/
    loader.js
    character.js
    talent.js
    calculator.js
  ui/
    sidebar.js
    characterHeader.js
    levelProgress.js
    talentGraph.js
    talentPopover.js
    resourceSummary.js
  style/
    base.css
    layout.css
    sidebar.css
    talent.css
    resources.css
```

Không dồn data normalization + calculation + rendering vào một `main.js`
khổng lồ.

## 17. Talent Verification Before Layout

Trước khi chốt graph: 1. Chọn nhiều character đại diện. 2. Đọc toàn bộ
talent records. 3. Build dependency từ `requireTalent`. 4. Kiểm tra
root, branch, merge, `index`. 5. Chỉ sau đó chọn layout.

Không lấy một character hoặc screenshot làm chuẩn cho toàn roster.

## 18. Visual Acceptance

Implementation đạt yêu cầu khi: - Không giống generic SaaS/admin
dashboard. - Không glassmorphism / decorative gradient / glow. - Không
hàng loạt card bo tròn lớn. - Artwork game là nguồn màu chính. - Talent
progression hiểu được bằng mắt. - Current → Target rõ mà không phụ thuộc
form. - Resource quantity dễ quét. - Không có khoảng trắng lớn vô ích. -
Desktop dùng viewport hiệu quả. - Typography Việt/Trung rõ hierarchy.

## 19. Functional Checklist

### Character

-   [ ] Search Việt.
-   [ ] Search Trung.
-   [ ] Rarity filter.
-   [ ] Real avatar/card.
-   [ ] Selected state.

### Level

-   [ ] Current/Target.
-   [ ] Validation.
-   [ ] Immediate recalculation.
-   [ ] EXP đúng.
-   [ ] Currency đúng theo verified rule.

### Talent

-   [ ] Build từ `characterTalentMap`.
-   [ ] Resolve `talentBankId`.
-   [ ] Resolve `talentBankMap.icon`.
-   [ ] Real talent icon.
-   [ ] Dependency từ `requireTalent`.
-   [ ] Không giả định linear.
-   [ ] Completed / upgrade / target / locked / neutral states.
-   [ ] Tooltip/popover.
-   [ ] Cost per node.
-   [ ] Tổng cost đúng.

### Resources

-   [ ] Real item icons.
-   [ ] Quantity nổi bật.
-   [ ] Compact layout.
-   [ ] Currency + EXP summary.
-   [ ] Missing asset fallback.

### Responsive

-   [ ] Desktop.
-   [ ] Tablet.
-   [ ] Mobile.
-   [ ] Talent graph usable bằng touch.

## 20. Priority

### P0 --- Correctness

1.  Data loading.
2.  Character selection.
3.  Level calculation.
4.  Talent dependency.
5.  Current → Target talent calculation.
6.  Resource consolidation.

### P1 --- Core UI

1.  Character header.
2.  Talent graph.
3.  Real talent icons.
4.  Talent tooltip.
5.  Compact resources.
6.  Immediate recalculation.

### P2 --- Polish

1.  Responsive refinement.
2.  Accessibility.
3.  Subtle functional transitions.
4.  Optional `pitch` / `shadow` layers.
5.  Additional character metadata.

------------------------------------------------------------------------

## Final Principle

> **Data determines the structure; artwork provides the color; UI
> provides clarity.**

Mỗi visual element phải giúp người dùng chọn progression, hiểu
dependency hoặc đọc resource nhanh hơn. Không thêm hiệu ứng chỉ để trông
"hiện đại".
