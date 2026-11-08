// Static page files for search engines and link previews (spec 2026-11-09 seo-path-urls §4–5). Pure except
// loadTierLists, which reads the published game document over HTTPS.
import { loadGameDocument } from '../src/features/profile/api/loreOverlay.mts'; // the site's own loader (Node strips the types)

export const SITE_ORIGIN = 'https://whmxsite.vercel.app'; // one place to change for a custom domain
export const DEFAULT_IMAGE = `${SITE_ORIGIN}/og-image.jpg`;
const SITE = 'Vật Hoa Di Tân Wiki';
const DEFAULT_DESC = 'Tra cứu nhân vật, kỹ năng, build và cốt truyện Vật Hoa Di Tân bằng tiếng Việt.';

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const vi = (o, k) => (o?.[`${k}_vi`] || o?.[`${k}_cn`] || '').trim(); // VI, else the Chinese original
const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const strip = (s) => String(s ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const page = (path, heading, description, image = DEFAULT_IMAGE) =>
  ({ path, title: path === '/' ? SITE : `${heading} — ${SITE}`, heading, description: cut(description, 160), image, text: [description] });

export function buildPages({ data, music, tierLists }) {
  const pages = [
    page('/', SITE, DEFAULT_DESC),
    page('/characters', 'Danh sách Khí Giả', 'Toàn bộ Khí Giả Vật Hoa Di Tân: độ hiếm, hệ, vai trò, kỹ năng và build.'),
    page('/gallery', 'Trang phục', 'Toàn bộ trang phục Khí Giả Vật Hoa Di Tân.'),
    page('/tier-list', 'Tier list', 'Bảng xếp hạng Khí Giả Vật Hoa Di Tân.'),
    page('/music', 'Nhạc', 'Nhạc nền Vật Hoa Di Tân theo sự kiện, cốt truyện và khu vực.'),
    page('/banners', 'Banner', 'Banner hiện tại và lịch sử banner Vật Hoa Di Tân.'),
    page('/info', 'Thông tin', 'Banner, nhạc và dữ liệu Vật Hoa Di Tân.'),
  ];
  for (const c of Object.values(data.characters)) {
    const name = vi(c, 'name');
    const image = c.cards?.[0] || DEFAULT_IMAGE;
    const skills = (c.skills ?? []).map((g) => vi(g.levels?.[0], 'name')).filter(Boolean);
    const base = `/characters/${c.slug}`;
    const tags = c.tags_vi ? `, ${c.tags_vi.replaceAll(';', ',')}` : '';
    pages.push(page(base, `${name} (${c.name_cn})`, `${name} (${c.name_cn}) — Khí Giả ${c.rare}★${tags}. Kỹ năng: ${skills.join(', ')}.`, image));
    pages.push(page(`${base}/build`, `Build ${name}`, `Vũ khí, dòng thuộc tính, thâm tạo, chuỗi kỹ năng và đội hình gợi ý cho ${name}.`, image));
    const intro = strip(c.profile?.eval_intro_vi || c.profile?.eval_intro);
    pages.push(page(`${base}/lore`, `Hồ sơ ${name}`, intro || `Hồ sơ lưu trữ, báo cáo và di vật của ${name}.`, image));
    for (const s of c.skins ?? []) {
      if (s.is_base) continue;
      const card = c.cards?.find((u) => u.endsWith(`/${s.skinID.toLowerCase()}.webp`)) || image;
      pages.push(page(`/skins/${s.skinID}`, `${vi(s, 'name')} — ${name}`, `Trang phục ${vi(s, 'name')} của ${name}. ${vi(s, 'obtain')}`.trim(), card));
    }
  }
  for (const l of tierLists ?? []) {
    if (l.status !== 'published') continue;
    pages.push(page(`/tier-list/${l.slug}`, `Tier list ${l.doc.title}`, `Tier list "${l.doc.title}" của ${l.doc.author}.`));
  }
  for (const t of music?.tracks ?? []) {
    const name = vi(t, 'name') || t.id;
    pages.push(page(`/music/${encodeURIComponent(t.id)}`, name, `Nghe "${name}" — nhạc Vật Hoa Di Tân.`));
  }
  return pages;
}

const setMeta = (html, attr, key, value) =>
  html.replace(new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`), (_, a, b) => `${a}${escapeHtml(value)}${b}`);

export function renderPage(template, p) {
  const url = `${SITE_ORIGIN}${p.path}`;
  let html = template.replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(p.title)}</title>`);
  html = setMeta(html, 'name', 'description', p.description);
  html = setMeta(html, 'property', 'og:title', p.title);
  html = setMeta(html, 'property', 'og:description', p.description);
  html = setMeta(html, 'property', 'og:url', url);
  html = setMeta(html, 'property', 'og:image', p.image);
  if (p.image !== DEFAULT_IMAGE) html = html.replace(/\s*<meta property="og:image:(width|height)" content="\d+" \/>/g, '');
  html = html.replace('</head>', () => `<link rel="canonical" href="${escapeHtml(url)}" />\n</head>`);
  const body = `<h1>${escapeHtml(p.heading)}</h1>${p.text.map((t) => `<p>${escapeHtml(t)}</p>`).join('')}`;
  return html.replace(/(<div id="prerender"[^>]*>)(<\/div>)/, (_, a, b) => `${a}${body}${b}`);
}

export const sitemap = (pages) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `<url><loc>${escapeHtml(`${SITE_ORIGIN}${p.path}`)}</loc></url>`).join('\n')}
</urlset>
`;

export const robots = () => `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;

// Node's fetch may reject the browser-only `cache` option the site's loader passes; drop it.
const nodeFetch = (url, opts = {}) => fetch(url, { ...opts, cache: undefined });

export async function loadTierLists(lorePointerUrl, fetchImpl = nodeFetch) {
  const doc = await loadGameDocument(lorePointerUrl, fetchImpl, 15000);
  if (!doc) console.warn('prerender: game document unavailable, tier list pages skipped');
  return doc?.tierLists ?? [];
}
