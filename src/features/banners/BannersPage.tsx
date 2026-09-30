// Banner page (#/banners, spec 2026-09-30 §5): the current batch, then every older banner by year with filters.
import { StrictMode, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { BannerGrid, type SliceChar } from './BannerSlice.tsx';
import { TYPE_VI, archive, currentBanners, loadBanners, type BannersDoc } from './bannersData.mts';
import { useNow } from './useNow.ts';
import { useReveal } from '../characters/motion.ts';
import { getGameData } from '../../data/loader.js';
import './styles/banners.css';

export function BannersPage({ doc }: { doc: BannersDoc | null }) {
  const characters = getGameData().characters as Record<string, SliceChar>;
  const [character, setCharacter] = useState('');
  const [type, setType] = useState('');
  const [year, setYear] = useState(0);
  const now = useNow();
  const page = useRef<HTMLDivElement>(null);
  const current = useMemo(() => (doc ? currentBanners(doc, now) : null), [doc, now]);
  const currentIds = useMemo(() => new Set(current?.map((b) => b.id)), [current]);
  const groups = useMemo(() => (doc ? archive(doc, { character, type, year: year || undefined }) : [])
    .map((g) => ({ ...g, banners: g.banners.filter((b) => !currentIds.has(b.id)) }))
    .filter((g) => g.banners.length), [doc, character, type, year, currentIds]);
  const years = useMemo(() => (doc ? archive(doc, {}).map((g) => g.year) : []), [doc]);
  const types = useMemo(() => [...new Set(doc?.banners.map((b) => b.type) ?? [])], [doc]);
  const upIds = useMemo(() => [...new Set(doc?.banners.flatMap((b) => b.up) ?? [])].filter((id) => characters[id]), [doc, characters]);
  useReveal(page, '.bn-block', 'page');
  useReveal(page, '.bn-year', `${character}|${type}|${year}`, 0, true);
  if (!doc || !current) return <div className="bn-page"><h1 className="bn-title">Banner</h1><p className="bn-error">Chưa tải được dữ liệu banner</p></div>;
  return (
    <div className="bn-page" ref={page}>
      <h1 className="bn-title bn-block">Banner</h1>
      <section className="bn-block" aria-label="Banner đang mở">
        <BannerGrid banners={current} doc={doc} now={now} characters={characters} />
      </section>
      <section className="bn-archive bn-block" aria-label="Banner đã qua">
        <div className="bn-filters">
          <label>Khí Giả<select value={character} onChange={(e) => setCharacter(e.target.value)}>
            <option value="">Tất cả</option>
            {upIds.map((id) => <option key={id} value={id}>{characters[id].name_vi || characters[id].name_cn}</option>)}
          </select></label>
          <label>Loại<select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Tất cả</option>
            {types.map((t) => <option key={t} value={t}>{TYPE_VI[t] ?? t}</option>)}
          </select></label>
          <label>Năm<select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            <option value={0}>Tất cả</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select></label>
        </div>
        {groups.length === 0 && <p className="bn-empty">Không có banner nào khớp bộ lọc.</p>}
        {groups.map((g) => (
          <div className="bn-year" key={g.year}>
            <h2>{g.year}</h2>
            <BannerGrid banners={g.banners} doc={doc} now={now} characters={characters} isArchive />
          </div>
        ))}
      </section>
    </div>
  );
}

// ponytail: same island pattern as BuildTab; `generation` drops a late banners.json after the route changed.
let root: Root | null = null;
let generation = 0;

export function unmountBannersPage() {
  generation += 1;
  root?.unmount();
  root = null;
}

export function mountBannersPage(container: HTMLElement): Promise<void> {
  unmountBannersPage();
  const mine = generation;
  return loadBanners().then((doc) => {
    if (mine !== generation) return;
    container.innerHTML = '';
    const mounted = createRoot(container);
    root = mounted;
    flushSync(() => mounted.render(<StrictMode><BannersPage doc={doc} /></StrictMode>));
  });
}
