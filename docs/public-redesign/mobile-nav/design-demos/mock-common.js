// Shared bits for the three mobile-nav directions (serve the repo root: python -m http.server 8765,
// open /docs/public-redesign/mobile-nav/design-demos/direction-*.html). Real data: search-data.js (data.json subset).
const ICON = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  users: '<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>',
  shirt: '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>',
  sword: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/>',
  calc: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M8 6h8M16 14v4M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"/>',
  flag: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
};
const icon = (name, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

const NAV = [
  { label: 'Khí Giả', cn: '器者', icon: 'users', active: true },
  { label: 'Trang Phục', cn: '衣装', icon: 'shirt' },
  { label: 'Vũ Khí', cn: '武器', icon: 'sword' },
  { label: 'Công cụ', cn: '计算', icon: 'calc' },
];

// "thuong chu" finds "Thương Chu"; CN matches by substring
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
function searchAll(q, limit = 8) {
  const f = fold(q.trim());
  if (!f) return [];
  const { chars, skins } = window.WHMX_SEARCH;
  const hit = (x) => fold(x.vi).includes(f) || x.cn.includes(q.trim());
  const c = chars.filter(hit).map((x) => ({ kind: 'Khí Giả', title: x.vi || x.cn, sub: x.cn, avatar: x.id }));
  const s = skins.filter(hit).map((x) => ({ kind: 'Trang phục', title: x.vi || x.cn, sub: x.char, avatar: x.charId }));
  return [...c, ...s].slice(0, limit);
}
const avatar = (id) => `/public/assets/characters/avatars/${id}.png`;

// The page behind the menu: a real character header, so the overlay is judged on top of real content.
function fakePage() {
  return `
  <div class="fp">
    <div class="fp-head"><img src="${avatar('W0176')}" alt=""><div><h1>Thương Chu Đồng Nhân</h1><p>商周铜人</p>
    <div class="fp-tags"><span style="color:#8DB8F2">Viễn Chiến</span><span style="color:#7FD39B">Hỗ Trợ</span><span style="color:#F29BB8">Trị Liệu</span></div></div></div>
    <div class="fp-tabs"><b>Tổng Quan</b><span>Thông Tin</span><span>Thiên Phú</span><span>Build</span></div>
    <div class="fp-lines">${'<i></i>'.repeat(9)}</div>
  </div>`;
}
const FAKE_PAGE_CSS = `
.fp{padding:28px 20px;color:#E3E5E8;font:14px/1.6 Inter,system-ui,sans-serif}
.fp-head{display:flex;gap:14px;align-items:flex-start}.fp-head img{width:60px;height:60px;border:1px solid #3D434A;background:#1C2024;object-fit:cover}
.fp h1{margin:0;font:700 20px/1.3 'Noto Serif',serif}.fp p{margin:2px 0 6px;color:#9097A0;font-size:13px}
.fp-tags{display:flex;gap:6px;flex-wrap:wrap}.fp-tags span{padding:1px 10px;border:1px solid currentColor;border-radius:999px;font-size:12px;font-weight:600}
.fp-tabs{display:flex;gap:4px;margin:22px 0 18px;font-size:13px;color:#9097A0;overflow:hidden}.fp-tabs *{padding:6px 12px;border:1px solid #2B2F34;border-radius:6px;white-space:nowrap}.fp-tabs b{color:#E3E5E8;border-bottom:2px solid #D4B763}
.fp-lines{display:grid;gap:10px}.fp-lines i{height:10px;border-radius:4px;background:#1C2024}.fp-lines i:nth-child(3n){width:70%}`;
