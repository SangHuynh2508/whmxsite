// Shared helpers for the three Home directions (same logic as src/features/banners/bannerTime.mts).
const NOW = Date.now();
const TYPE_VI = { limited: 'Giới hạn', time: 'Có thời hạn', season: 'Theo mùa' };
const SHORTCUTS = [['Khí Giả', '#/characters'], ['Trang Phục', '#/gallery'], ['Vũ Khí', '#/weapons'], ['Banner', '#/banners'], ['Công cụ', '#calc']];

function remaining(endS) {
  const left = Math.floor((endS * 1000 - NOW) / 1000);
  if (left <= 0) return '';
  const d = Math.floor(left / 86400), h = Math.floor((left % 86400) / 3600), m = Math.floor((left % 3600) / 60);
  if (d > 0) return `${d} ngày ${h} giờ`;
  if (h > 0) return `${h} giờ ${m} phút`;
  return m > 0 ? `${m} phút` : '< 1 phút';
}
const fmt = (s) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(s * 1000);
const fmtShort = (s) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit' }).format(s * 1000);
const progress = (b) => Math.min(1, Math.max(0, (NOW / 1000 - b.start) / (b.end - b.start)));
const cn = (t) => `<span lang="zh" class="cn">${t}</span><span class="dot" aria-label="(chưa dịch)"></span>`;
// The game's pool background + the UP skin drawing on top = the banner as the game shows it.
const layered = (b, cls = '') => `<div class="art ${cls}">${b.art ? `<img class="art-bg" src="${b.art}" alt="">` : ''}${b.drawing ? `<img class="art-fig" src="${b.drawing}" alt="${b.skin_name || ''}">` : ''}${!b.art && !b.drawing ? `<div class="art-ups">${b.ups.map((u) => `<img src="${u.avatar}" alt="">`).join('')}</div>` : ''}</div>`;
const featured = HOME.current.filter((b) => b.ups.length && b.type !== 'season');
const compact = HOME.current.filter((b) => !(b.ups.length && b.type !== 'season'));
const years = (list) => [...new Set(list.map((b) => new Date(b.start * 1000).getFullYear()))];

function reveal(selector) {
  if (!window.gsap) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  gsap.fromTo(selector, reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: 'blur(2px)' },
    { opacity: 1, y: 0, filter: 'blur(0px)', duration: reduce ? 0.15 : 0.6, ease: 'expo.out', stagger: reduce ? 0 : 0.06 });
}
