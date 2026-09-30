# Thông tin hub (#/info) — approved direction (2026-09-30)

Owner (during the Home/Banner critique): "trong thanh sidebar ko cần ghi home, chỉ cần tích hợp nó vào tên/logo … còn về
banner thì đặt nó ở trong thông tin cùng với vũ khí … như s1n … mấy cái nào thật sự hot mới đặt ở ngoài"; then
"thông tin là 1 giao diện nền đen, khi vào sẽ có các component tượng trưng cho các tính năng khác (dùng ảnh từ game do m
chọn/đề xuất) ấn vào đó nữa mới vào chức năng (giống info s1n)". Reference: s1n.gg/info.

Shown (huashu gate, built serially, real assets; screenshots `_claude_scratch/info/`, not committed):
- A · Mục lục (`design-demos/direction-a-index.html`) — s1n-like grid of compact tiles, dim thumbnail left.
- B · Gian trưng bày (`design-demos/direction-b-gallery.html`) — large art panels, banner-slice language.
- C · Ngăn lưu trữ (`design-demos/direction-c-drawer.html`) — ledger rows with gold Nº serials, art strip right.

**Picked: B** (owner: "B · Gian trưng bày").

Implemented (`src/features/info/InfoPage.tsx`, `styles/info.css`, route `#/info` in `staticRoutes.mts`/`router.js`,
`#info-view` in `index.html`):
- Serif 32 px "Thông tin" (26 px phones); 2 panels per row (1 below 768 px), aspect 16 / 8, 6 px, the art scales 1.03 on
  hover/focus (none under reduced motion); bottom dark fade (art-shade tokens) under a white serif 28 px name + 14 px line.
- Banner panel: the first open banner with art (PoolBg + UP skin drawing + title logo) from `banners.json`.
- Vũ Khí panel: five 绮木覆花 weapon icons (31541–31545) in the game's `itemRare5` frame; "Đang phát triển" chip (the
  weapons page is still a placeholder).
- Navigation (`AppNav.tsx`): rail = logo 物 (Home, title "Trang chủ · Vật Hoa Di Tân") · Khí Giả · Trang Phục ·
  Thông tin (active on info, banners, weapons) · Công cụ. Phone menu: a brand row "物 Vật Hoa Di Tân" (→ Home) above the
  same links, since phones have no rail logo.
- Checks: 1440/390 no horizontal scroll, 0 console errors; impeccable detect clean inside `.info-*` (the only finding,
  skipped-heading h1 → h3 "CHỌN NHÂN VẬT", is the hidden calculator picker).
