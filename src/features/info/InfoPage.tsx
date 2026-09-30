// Thông tin (#/info, owner 2026-09-30, direction B "Gian trưng bày" — docs/public-redesign/info/direction-approved.md):
// one large art panel per lookup feature; the rail keeps only the hot pages, the rest live here.
import { StrictMode, useRef } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { type SliceChar } from '../banners/BannerSlice.tsx';
import { artUrl, cachedBanners, currentBanners, loadBannersCached, skinImage, type BannersDoc } from '../banners/bannersData.mts';
import { useReveal } from '../characters/motion.ts';
import { getGameData } from '../../data/loader.js';
import './styles/info.css';

// 绮木覆花 weapon series (item icons already in public/assets/items) in the game's 5-star frame
const WEAPON_ICONS = [31541, 31542, 31543, 31544, 31545];

function BannerArt({ doc }: { doc: BannersDoc | null }) {
  if (!doc) return null;
  const characters = getGameData().characters as Record<string, SliceChar>;
  const b = currentBanners(doc, Date.now()).find((x) => x.art && skinImage(x, characters));
  if (!b) return null;
  return (
    <>
      <img className="info-art-bg" src={artUrl(doc, b.art)!} alt="" />
      <img className="info-art-fig" src={skinImage(b, characters)!} alt="" />
      {b.title && <img className="info-art-logo" src={artUrl(doc, b.title)!} alt="" />}
    </>
  );
}

function WeaponArt() {
  return (
    <span className="info-weapons">
      {WEAPON_ICONS.map((id) => <span key={id}><img src={`/assets/items/itemicon_${id}.png`} alt="" loading="lazy" /></span>)}
    </span>
  );
}

export function InfoPage({ doc }: { doc: BannersDoc | null }) {
  const page = useRef<HTMLDivElement>(null);
  useReveal(page, '.info-tile', 'info');
  const tiles = [
    { href: '#/banners', name: 'Banner', desc: 'Banner đang mở, đếm ngược và toàn bộ banner đã qua.', art: <BannerArt doc={doc} /> },
    { href: '#/weapons', name: 'Vũ Khí', desc: 'Vũ khí, kỹ năng và dòng thuộc tính.', soon: 'Đang phát triển', art: <WeaponArt /> },
  ];
  return (
    <div className="info-page" ref={page}>
      <h1 className="info-title">Thông tin</h1>
      <div className="info-grid">
        {tiles.map((t) => (
          <a key={t.href} className="info-tile" href={t.href}>
            <span className="info-art">{t.art}</span>
            <span className="info-text">
              <span className="info-name">{t.name}{t.soon && <span className="info-soon">{t.soon}</span>}</span>
              <span className="info-desc">{t.desc}</span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

// ponytail: same island pattern as the Home and Banner pages (banners.json only feeds the Banner tile's art).
let root: Root | null = null;
let generation = 0;

export function unmountInfoPage() {
  generation += 1;
  root?.unmount();
  root = null;
}

function render(container: HTMLElement, doc: BannersDoc | null) {
  container.innerHTML = '';
  const mounted = createRoot(container);
  root = mounted;
  flushSync(() => mounted.render(<StrictMode><InfoPage doc={doc} /></StrictMode>));
}

export function mountInfoPage(container: HTMLElement): Promise<void> {
  unmountInfoPage();
  const hit = cachedBanners();
  if (hit) { render(container, hit); return Promise.resolve(); }
  const mine = generation;
  return loadBannersCached().then((doc) => { if (mine === generation) render(container, doc); });
}
