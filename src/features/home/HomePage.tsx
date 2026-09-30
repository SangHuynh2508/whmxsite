// Home (spec 2026-09-30 §5, docs/public-redesign/home/direction-approved.md): the season KV as a hero fading into the
// page, the banners that are open, the events running, what was just released.
import { StrictMode, useRef } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { BannerGrid, Cn, type SliceChar } from '../banners/BannerSlice.tsx';
import { remaining } from '../banners/bannerTime.mts';
import { artUrl, cachedBanners, currentBanners, currentEvents, formatRange, loadBannersCached, versionTitle, type BannersDoc } from '../banners/bannersData.mts';
import { useNow } from '../banners/useNow.ts';
import { useReveal } from '../characters/motion.ts';
import { newReleases, type ReleaseChar } from './newReleases.mts';
import { getGameData } from '../../data/loader.js';
import './styles/home.css';

type HomeChar = SliceChar & ReleaseChar;

export function HomePage({ doc }: { doc: BannersDoc | null }) {
  const characters = getGameData().characters as Record<string, HomeChar>;
  const now = useNow();
  const page = useRef<HTMLDivElement>(null);
  useReveal(page, '.home-block', 'home');
  const releases = newReleases(characters, Math.floor(now / 1000), doc?.version?.start ?? null);
  const hero = doc?.hero ?? null;
  const heroArt = doc && hero ? artUrl(doc, hero.art) : null;
  const banners = doc ? currentBanners(doc, now) : null;
  const events = doc ? currentEvents(doc, now) : [];
  const theme = events.find((e) => e.kind_cn === '主题活动');
  return (
    <div className="home-page" ref={page}>
      {(hero || doc?.version) && (
        <header className={`home-hero${heroArt ? '' : ' home-hero--plain'}`}>
          {heroArt && <img className="home-hero-art" src={heroArt} alt="" />}
          <div className="home-hero-text home-block">
            {doc?.version && <p className="home-hero-version">{formatRange(doc.version.start, doc.version.end)}</p>}
            <h1>{doc?.version ? versionTitle(doc.version.label) : 'Vật Hoa Di Tân'}</h1>
            {hero?.name_cn && <p className="home-hero-cn"><Cn text={hero.name_cn} /></p>}
            {theme && <p className="home-hero-theme">Sự kiện chủ đề <Cn text={theme.name_cn} /><span className="home-hero-left">còn <b>{remaining(now, theme.end)}</b></span></p>}
          </div>
        </header>
      )}
      <div className="home-body">
        <section className="home-block home-banners" aria-label="Banner đang mở">
          <h2 className="home-h2">Banner đang mở <a href="#/banners">Tất cả banner ›</a></h2>
          {banners
            ? <BannerGrid banners={banners} doc={doc!} now={now} characters={characters} />
            : <p className="bn-error">Chưa tải được dữ liệu banner</p>}
        </section>
        <div className="home-row">
          {events.length > 0 && (
            <section className="home-block home-events" aria-label="Sự kiện đang diễn ra">
              <h2 className="home-h2">Sự kiện đang diễn ra</h2>
              <ul>{events.map((e) => (
                <li key={e.id}>
                  <span className="home-event-kind"><Cn text={e.kind_cn} /></span>
                  <span className="home-event-name"><Cn text={e.name_cn} /></span>
                  <span className="home-event-left">Còn <b>{remaining(now, e.end)}</b></span>
                </li>
              ))}</ul>
            </section>
          )}
          {releases.length > 0 && (
            <section className="home-block home-releases" aria-label="Mới ra mắt">
              <h2 className="home-h2">Mới ra mắt</h2>
              <ul>{releases.map((r) => {
                const href = r.kind === 'skin' ? `#/skins/${r.id}` : `#/characters/${characters[r.charId].slug}`;
                return (
                  <li key={r.id}><a href={href}>
                    <span className="home-release-pic">
                      {r.image && <img src={r.image} alt="" loading="lazy" />}
                      {r.isNew && <span className="home-new">Mới</span>}
                    </span>
                    <span className="home-release-name">{r.name}</span>
                    <span className="home-release-kind">{r.kind === 'skin' ? 'Trang phục' : 'Khí Giả'}</span>
                  </a></li>
                );
              })}</ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ponytail: same island pattern as BuildTab; `generation` drops a late banners.json after the route changed.
let root: Root | null = null;
let generation = 0;

export function unmountHomePage() {
  generation += 1;
  root?.unmount();
  root = null;
}

function render(container: HTMLElement, doc: BannersDoc | null) {
  container.innerHTML = '';
  const mounted = createRoot(container);
  root = mounted;
  flushSync(() => mounted.render(<StrictMode><HomePage doc={doc} /></StrictMode>));
}

export function mountHomePage(container: HTMLElement): Promise<void> {
  unmountHomePage();
  const hit = cachedBanners();
  if (hit) { render(container, hit); return Promise.resolve(); } // synchronous: Back restores the scroll onto real content
  const mine = generation;
  return loadBannersCached().then((doc) => { if (mine === generation) render(container, doc); });
}
