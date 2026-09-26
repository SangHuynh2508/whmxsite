# Hồ Sơ Lưu Trữ tab — approved direction (2026-09-26)

**Approved: `design-demos/direction-b4-ticket.html` with heading preset `book`.**

## How we got here (huashu three-direction gate + taste pass)

| Round | Shown | Owner's answer |
|---|---|---|
| 1 | A document (`direction-a-document.html`), B museum (`direction-b-museum.html`), C dossier (`direction-c-dossier.html`) — real A0024 data | "1, 2 dễ đọc hơn nhưng vẫn thấy hơi dài … thử dùng taste skill chỉnh lại 1 lần"; untranslated text → **notice at the top of the tab** (option b) |
| 2 | A2 sections (`direction-a2-document-sections.html`), B2 compact museum (`direction-b2-museum-compact.html`) | "chọn B2"; **term popups now**; voice lines later on a separate route |
| 3 | B3 = B2 + decoration presets stamp / ticket / bronze (`direction-b3-museum-decor.html`) | "chọn phiếu bảo tàng" but: merge the 3 fact boxes into one frame; Bản thể / Mã too close and faint; the gold bar before headings "hơi AI"; look for decoration in the skills |
| 4 | B4 ticket (`direction-b4-ticket.html`), heading presets panel / book | "chọn kẻ sách" + the ticket notches showed the straight border through them → fixed (two-layer notch), "sửa đc cái này thì chốt" |

Screenshots of each round were sent in chat (kept outside the repo: `D:\BaiTapCode\WHMX\_claude_scratch\lore-shots\`).

## What the approved design is

- Layout B2: left column (sticky on desktop) = archive image with two gold corner brackets + **one museum ticket**; right column = heading, "chưa dịch" notice, intro clamped to 5 lines + "Đọc tiếp", "Hiện vật" with a Nguồn gốc | Dòng thời gian switch sharing one panel, "Báo cáo đánh giá" as report tabs.
- Ticket: relic full name → Loại / Niên đại / Nơi lưu giữ (dashed perforations, each opens a popup with the term description) → tear line with two notches (fill layer clipped 2px past the centre + outline layer clipped at the centre) → stub: Trực thuộc (popup) | Bản thể → serial row "Mã hồ sơ" in monospace gold.
- Headings: serif title + thin full-width rule (preset `book`). No coloured side bars.
- Texture: faint SVG grain on the ticket, image plate and popups. Motion: one load animation (plate + ticket rise 6px), off under reduced motion; the text-reveal effect only on the tab heading (`LORE_TAB_REVEAL`).
- Untranslated: one notice at the top + a small dot and screen-reader "(chưa dịch)" per unit.
- Colours: dark tokens from `src/styles/tokens.css` only.
