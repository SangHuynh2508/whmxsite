// Shared by the three Thư viện ảnh directions: labels (→ src/i18n/strings.mts vi), filtering and query state
// (→ galleryData.mts), image paths, icons (lucide), swipe. Images are read from the WHMX_Tool export next to this
// repo (D:\BaiTapCode\WHMX\WHMX_Tool\Xuat\Gallery_r3173, web sizes in _web/<kind>/<id>/{t,v}.webp made for the demo);
// on the site they come from R2 as gallery/<kind>/<id>/{t.webp,v.webp,o.png}. Serve D:\BaiTapCode\WHMX.
(function () {
  const BASE = '../../../../../WHMX_Tool/Xuat/Gallery_r3173/';
  const items = window.GALLERY.items;
  const KINDS = [['story', 'CG truyện'], ['loading', 'Màn hình chờ'], ['home', 'Hình nền sảnh'], ['kv', 'KV phiên bản'], ['postcard', 'Bưu thiếp']];
  const KIND = Object.fromEntries(KINDS);
  const GROUPS = [['v3', 'Bản 3.x'], ['v2', 'Bản 2.x'], ['old', 'Trước 2.5'], ['main', 'Chính tuyến'], ['other', 'Khác']];
  const GROUP = Object.fromEntries(GROUPS);
  const L = { title: 'Thư viện ảnh', lede: 'Ảnh nền và CG của game, xếp theo nơi game dùng tới. Bấm một ảnh để xem to và tải bản gốc.',
    search: 'Tìm theo tên, địa danh, truyện', empty: 'Không có ảnh nào phù hợp.', clear: 'Xóa tìm kiếm', download: 'Tải PNG gốc',
    close: 'Đóng', prev: 'Ảnh trước', next: 'Ảnh sau', all: 'Tất cả', untranslated: 'chưa dịch',
    elsewhere: 'Ảnh trang phục và banner có trang riêng:', skins: 'Trang phục', banners: 'Banner' };

  const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Untranslated text: Chinese + the ash dot; the last glyph and the dot never wrap apart (DESIGN.md Original Name Rule).
  const cn = (v) => { const c = Array.from(v); return `<span class="cn">${esc(c.slice(0, -1).join(''))}<span class="nw">${esc(c.slice(-1).join(''))}<span class="dot" aria-hidden="true"></span></span></span><span class="sr">(chưa dịch)</span>`; };
  const pick = (vi, zh) => (vi ? esc(vi) : zh ? cn(zh) : '');
  const vlabel = (v) => v.replace('上', ' Thượng').replace('下', ' Hạ');
  const isVer = (it) => it.group === 'v3' || it.group === 'v2';
  const subHtml = (it) => (isVer(it) ? 'Bản ' + esc(vlabel(it.sub_cn)) : pick(it.sub_vi, it.sub_cn));
  const subText = (it) => (isVer(it) ? 'Bản ' + vlabel(it.sub_cn) : it.sub_vi || it.sub_cn);
  // A name for every image: its own name → postcard place → the story it opens in → the KV code.
  function title(it) {
    if (it.name_cn) return pick(it.name_vi, it.name_cn);
    if (it.place_cn) return pick(it.place_vi, it.place_cn);
    if (it.kind === 'story') return isVer(it) && it.story_cn ? pick(it.story_vi, it.story_cn) : subHtml(it);
    return it.kind === 'kv' ? 'KV ' + esc(it.id) : esc(it.id);
  }
  const titleText = (it) => it.name_vi || it.name_cn || it.place_vi || it.place_cn || (it.kind === 'story' ? (isVer(it) && it.story_cn ? it.story_vi || it.story_cn : subText(it)) : it.kind === 'kv' ? 'KV ' + it.id : it.id);
  const note = (it) => pick(it.note_vi, it.note_cn).replace(/\n/g, '<br>');
  const rel = (it) => it.file.replace(/^gallery\//, '');
  const thumb = (it) => `${BASE}_web/${rel(it)}/t.webp`;
  const view = (it) => `${BASE}_web/${rel(it)}/v.webp`;
  const orig = (it) => `${BASE}${rel(it)}.png`;

  const verKey = (v) => { const m = /^(\d)\.(\d)(上|下)?$/.exec(v); return m ? (+m[1] * 10 + +m[2]) * 2 + (m[3] === '下' ? 1 : 0) : -1; };
  const ofKind = (k) => items.filter((it) => it.kind === k);
  // Rows of the story tab: subs of one group, newest version first; chapters / events / stories keep the data order.
  function subs(group) {
    const s = [...new Set(items.filter((it) => it.kind === 'story' && it.group === group).map((it) => it.sub_cn))];
    return group === 'v3' || group === 'v2' ? s.sort((a, b) => verKey(b) - verKey(a)) : s;
  }
  const subLabel = (group, sub) => { const it = items.find((x) => x.group === group && x.sub_cn === sub); return it ? subHtml(it) : esc(sub); };
  const count = (pred) => items.filter(pred).length;
  const fold = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
  const hay = (it) => fold([it.id, it.name_cn, it.name_vi, it.place_cn, it.place_vi, it.note_cn, it.note_vi, it.sub_cn, it.sub_vi, it.story_cn, it.story_vi, isVer(it) ? vlabel(it.sub_cn) : ''].join(' '));
  function filter(st) {
    const q = fold(st.q || '');
    const order = st.kind === 'story' && st.g ? subs(st.g) : null; // story: newest version / chapter order, as shown
    const out = items.filter((it) => it.kind === st.kind
      && (it.kind !== 'story' || ((!st.g || it.group === st.g) && (!st.v || it.sub_cn === st.v)))
      && (!q || hay(it).includes(q)));
    return order ? out.sort((x, y) => order.indexOf(x.sub_cn) - order.indexOf(y.sub_cn)) : out;
  }
  // Query: ?kind=story&g=v3&v=3.4上&q=…&id=… ; anything unknown falls back to the default (no blank page).
  function readQuery(defaults) {
    const p = new URLSearchParams(location.search);
    const st = { ...defaults, q: p.get('q') || '' };
    if (KIND[p.get('kind')]) st.kind = p.get('kind');
    if (st.kind === 'story') {
      if (GROUP[p.get('g')]) { st.g = p.get('g'); st.v = ''; }
      if (st.g && subs(st.g).includes(p.get('v'))) st.v = p.get('v');
    } else { st.g = ''; st.v = ''; }
    const id = p.get('id');
    st.id = items.some((it) => it.kind === st.kind && it.id === id) ? id : '';
    return st;
  }
  function writeQuery(st) {
    const p = new URLSearchParams();
    p.set('kind', st.kind);
    if (st.kind === 'story' && st.g) p.set('g', st.g);
    if (st.kind === 'story' && st.v) p.set('v', st.v);
    if (st.q) p.set('q', st.q);
    if (st.id) p.set('id', st.id);
    history.replaceState(null, '', '?' + p.toString());
  }

  const P = {
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    down: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  };
  const icon = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
  // Horizontal swipe (phones) → prev / next; vertical scrolling is left alone.
  function swipe(el, onPrev, onNext) {
    let x0 = null, y0 = 0;
    el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx > 0 ? onPrev : onNext)();
    });
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.G = { items, KINDS, KIND, GROUPS, GROUP, L, esc, cn, pick, vlabel, title, titleText, note, subHtml, subText, subs, subLabel,
    thumb, view, orig, ofKind, count, filter, readQuery, writeQuery, icon, swipe, reduced, verKey };
})();
