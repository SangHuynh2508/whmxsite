// Banner page (#/banners, spec 2026-09-30 §5): the current batch, then every older banner by year with filters.
// Filters live in the hash (#/banners?char=…&type=…&year=…) so Back from a character page and shared links keep them.
import { useMemo, useRef, useState } from 'react';
import { BannerGrid, type SliceChar } from './BannerSlice.tsx';
import { TYPE_VI, archive, currentBanners, filtersHash, readFilters, type ArchiveFilters, type BannersDoc } from './bannersData.mts';
import { useNow } from './useNow.ts';
import { useReveal } from '../characters/motion.ts';
import { getGameData } from '../../data/loader.js';
import { bannerIsland } from './island.tsx';
import './styles/banners.css';

const NO_FILTERS: ArchiveFilters = { character: '', type: '', year: 0 };
const openYears = new Set<number>(); // years the reader unfolded, kept for Back within the session

export function BannersPage({ doc }: { doc: BannersDoc | null }) {
  const characters = getGameData().characters as Record<string, SliceChar>;
  const [filters, setFilters] = useState<ArchiveFilters>(() => readFilters(window.location.hash));
  const now = useNow();
  const page = useRef<HTMLDivElement>(null);
  const filtered = Boolean(filters.character || filters.type || filters.year);
  const current = useMemo(() => (doc ? currentBanners(doc, now) : null), [doc, now]);
  // unfiltered, the archive leaves out the batch shown on top; filtered, it searches everything (the critique found
  // "no match" while the matching banner sat right above)
  const groups = useMemo(() => {
    if (!doc) return [];
    const skip = new Set(filtered ? [] : current?.map((b) => b.id));
    return archive(doc, { ...filters, year: filters.year || undefined })
      .map((g) => ({ ...g, banners: g.banners.filter((b) => !skip.has(b.id)) }))
      .filter((g) => g.banners.length);
  }, [doc, filters, filtered, current]);
  const count = groups.reduce((n, g) => n + g.banners.length, 0);
  const years = useMemo(() => (doc ? archive(doc, {}).map((g) => g.year) : []), [doc]);
  const types = useMemo(() => [...new Set(doc?.banners.map((b) => b.type) ?? [])], [doc]);
  const upIds = useMemo(() => [...new Set(doc?.banners.flatMap((b) => b.up) ?? [])].filter((id) => characters[id])
    .sort((a, b) => (characters[a].name_vi || characters[a].name_cn).localeCompare(characters[b].name_vi || characters[b].name_cn, 'vi')),
  [doc, characters]);
  const setFilter = (patch: Partial<ArchiveFilters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    history.replaceState(null, '', filtersHash(next)); // no hashchange: the page stays mounted
  };
  const key = `${filters.character}|${filters.type}|${filters.year}`;
  useReveal(page, '.bn-block', 'page');
  useReveal(page, '.bn-year', key, 0, true);
  if (!doc || !current) return <div className="bn-page"><h1 className="bn-title">Banner</h1><p className="bn-error">Chưa tải được dữ liệu banner</p></div>;
  return (
    <div className="bn-page" ref={page}>
      <h1 className="bn-title bn-block">Banner</h1>
      <section className="bn-block" aria-labelledby="bn-open">
        <h2 id="bn-open" className="bn-h2">Đang mở</h2>
        <BannerGrid banners={current} doc={doc} now={now} characters={characters} />
      </section>
      <section className="bn-archive bn-block" aria-labelledby="bn-past">
        <h2 id="bn-past" className="bn-h2">Tất cả banner <span className="bn-count">{count} banner</span></h2>
        <div className="bn-filters">
          <label>Khí Giả<select value={filters.character} onChange={(e) => setFilter({ character: e.target.value })}>
            <option value="">Tất cả</option>
            {upIds.map((id) => <option key={id} value={id}>{characters[id].name_vi || characters[id].name_cn}</option>)}
          </select></label>
          <label>Loại<select value={filters.type} onChange={(e) => setFilter({ type: e.target.value })}>
            <option value="">Tất cả</option>
            {types.map((t) => <option key={t} value={t}>{TYPE_VI[t] ?? t}</option>)}
          </select></label>
          <label>Năm<select value={filters.year} onChange={(e) => setFilter({ year: Number(e.target.value) })}>
            <option value={0}>Tất cả</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select></label>
          {filtered && <button type="button" className="bn-clear" onClick={() => setFilter(NO_FILTERS)}>Xoá bộ lọc</button>}
        </div>
        {/* the labels with the game's own channel names, so "Giới hạn" and "Có thời hạn" can be told apart */}
        <p className="bn-legend">{types.map((t) => {
          const kind = doc.banners.find((b) => b.type === t)?.kind_cn;
          return <span key={t}>{TYPE_VI[t] ?? t}{kind && <> (<span lang="zh">{kind}</span>)</>}</span>;
        })}</p>
        {groups.length === 0 && (
          <p className="bn-empty">Không có banner nào khớp bộ lọc. <button type="button" className="bn-clear" onClick={() => setFilter(NO_FILTERS)}>Xoá bộ lọc</button></p>
        )}
        {groups.map((g, i) => (
          // the newest year is open; older years fold (a filter opens every matching year)
          <details className="bn-year" key={`${g.year}|${key}`} open={filtered || i === 0 || openYears.has(g.year)}
            onToggle={(e) => { if (e.currentTarget.open) openYears.add(g.year); else openYears.delete(g.year); }}>
            <summary><h3>{g.year}</h3><span className="bn-count">{g.banners.length} banner</span></summary>
            <BannerGrid banners={g.banners} doc={doc} now={now} characters={characters} isArchive />
          </details>
        ))}
      </section>
    </div>
  );
}

export const { mount: mountBannersPage, unmount: unmountBannersPage } = bannerIsland(BannersPage);
