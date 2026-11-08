// After `vite build`: one index.html per public page + sitemap.xml + robots.txt in dist/ (spec 2026-11-09 §4).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadEnv } from 'vite';
import { buildPages, loadTierLists, renderPage, robots, sitemap } from './prerender-lib.mjs';

const env = { ...loadEnv(process.env.MODE || 'production', process.cwd(), 'VITE_'), ...process.env };
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const template = readFileSync('dist/index.html', 'utf8');
const pages = buildPages({
  data: read('public/data.json'),
  music: read('public/music.json'),
  tierLists: await loadTierLists(env.VITE_LORE_POINTER_URL),
});
for (const p of pages) {
  if (p.path === '/') continue; // dist/index.html itself gets the home meta below
  const file = join('dist', decodeURIComponent(p.path), 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, renderPage(template, p));
}
writeFileSync('dist/index.html', renderPage(template, pages.find((p) => p.path === '/')));
writeFileSync('dist/sitemap.xml', sitemap(pages));
writeFileSync('dist/robots.txt', robots());
console.log(`prerender: ${pages.length} pages`);
