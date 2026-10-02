// Tier List page (#/tier-list[/<slug>[/tab]], spec 2026-10-02 §7, direction D3). Island pattern as BuildTab/banners:
// one root, `generation` drops a late game document after the route changed.
import { StrictMode, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { getGameData, loadedGameDocument } from '../../data/loader.js';
import { useReveal } from '../characters/motion.ts';
import { CharacterTile } from '../characters/components/CharacterTile.tsx';
import { Legend, TierFilter } from './TierFilter.tsx';
import { JOB_NAMES, RARITY_LABELS } from '../../ui/utils/gameLabels.mts';
import { chipCount, countMatches, emptyFilter, filterTiers, fmtDate, paragraphs, pickList, presentRarities, tileProps, visibleTabs, type Filter, type PublishedList, type SiteChar } from './tierView.mts';
import { tierListHref, type Tab } from './tierRoute.mts';
import './styles/tierList.css';

gsap.registerPlugin(Flip);
const TAB_LABEL: Record<Tab, string> = { characters: 'Nhân vật', teams: 'Đội hình', info: 'Thông tin' };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function TierListView({ list, characters, tab: initial, onTab }: { list: PublishedList; characters: Record<string, SiteChar>; tab: Tab; onTab?: (tab: Tab) => void }) {
  const { doc } = list;
  const tabs = visibleTabs(doc);
  const [tab, setTab] = useState<Tab>(tabs.includes(initial) ? initial : 'characters');
  const [filter, setFilter] = useState<Filter>(emptyFilter);
  const panel = useRef<HTMLDivElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const flip = useRef<Flip.FlipState | null>(null);
  useReveal(panel, '.tl-group, .tl-team, .tl-info > *', tab);

  const tiers = doc.solo.tiers;
  const groups = useMemo(() => filterTiers(tiers, characters, filter), [tiers, characters, filter]);
  const total = countMatches(tiers, characters, emptyFilter());
  const shown = countMatches(tiers, characters, filter);
  const rarities = useMemo(() => presentRarities(tiers, characters), [tiers, characters]);

  // filter changes: tiles that stay slide to their new place (GSAP Flip); new ones fade in
  const change = (next: Filter) => {
    if (board.current && !reduced()) flip.current = Flip.getState(board.current.querySelectorAll('.ctile'));
    setFilter(next);
  };
  useLayoutEffect(() => {
    if (!flip.current) return;
    Flip.from(flip.current, { targets: board.current?.querySelectorAll('.ctile'), duration: 0.45, ease: 'expo.out', onEnter: (els) => gsap.fromTo(els, { opacity: 0 }, { opacity: 1, duration: 0.3 }) });
    flip.current = null;
  }, [filter]);
  const toggle = (kind: 'jobs' | 'rarities', value: number) => {
    const s = new Set(filter[kind]);
    if (s.has(value)) s.delete(value); else s.add(value);
    change({ ...filter, [kind]: s });
  };
  const clear = () => change(emptyFilter());
  const choose = (next: Tab, focus = false) => {
    setTab(next);
    onTab?.(next);
    if (focus) requestAnimationFrame(() => document.getElementById(`tl-tab-${next}`)?.focus());
  };
  const names = [...[...filter.jobs].sort().map((j) => JOB_NAMES[j]), ...[...filter.rarities].sort((a, b) => b - a).map((r) => RARITY_LABELS[r])];
  const filtering = names.length > 0 || filter.q.trim() !== '';
  const firstTier = tiers[0];

  return (
    <div className="tl-page">
      <header className="tl-mast">
        <h1>{doc.title}</h1>
        <p className="tl-by">
          {doc.author && <>Tham khảo tier list của {doc.sourceUrl ? <a href={doc.sourceUrl} target="_blank" rel="noreferrer">{doc.author}</a> : <b>{doc.author}</b>} · </>}
          Cập nhật {fmtDate(list.updatedAt)}{list.status === 'archived' && ' · Cũ'}
        </p>
        {tabs.length > 1 && (
          <div className="tl-tabs" role="tablist" aria-label="Nội dung tier list">
            {tabs.map((t, i) => (
              <button key={t} id={`tl-tab-${t}`} type="button" role="tab" aria-selected={t === tab} aria-controls="tl-panel" tabIndex={t === tab ? 0 : -1}
                onClick={() => choose(t)}
                onKeyDown={(e) => { const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (d) choose(tabs[(i + d + tabs.length) % tabs.length], true); }}>
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>
        )}
      </header>
      {tab === 'characters' && (
        <div className="tl-bar">
          <label className="tl-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" placeholder="Tìm Khí Giả" aria-label="Tìm Khí Giả theo tên" autoComplete="off" value={filter.q} onChange={(e) => change({ ...filter, q: e.target.value })} />
          </label>
          <TierFilter filter={filter} rarities={rarities} left={shown} count={(k, v) => chipCount(tiers, characters, filter, k, v)} toggle={toggle} clear={clear} />
          <p className={filtering ? 'tl-result' : 'tl-result idle'} aria-live="polite">
            {filtering
              ? <><b>{shown}</b>/{total} Khí Giả{names.length > 0 && ` · ${names.join(', ')}`}{filter.q.trim() && ` · “${filter.q.trim()}”`}<button type="button" onClick={clear}>Xoá lọc</button></>
              : `${total} Khí Giả`}
          </p>
        </div>
      )}
      <div id="tl-panel" role="tabpanel" aria-labelledby={tabs.length > 1 ? `tl-tab-${tab}` : undefined} ref={panel}>
        {tab === 'characters' && (
          <>
            {doc.solo.note && <p className="tl-note">{doc.solo.note}</p>}
            <Legend />
            <div ref={board}>
              {groups.length ? groups.map((g, gi) => (
                <section key={gi} className="tl-group">
                  {g.description && <p className="tl-desc">{g.description}</p>}
                  {g.rows.map(({ tier, entries }) => (
                    <div key={tier.label} className="tl-row">
                      <div className={tier === firstTier ? 'tl-lab top' : 'tl-lab'}><h2>{tier.label}</h2><small>{entries.length} Khí Giả</small></div>
                      <div className="tl-tiles">
                        {entries.map((e) => { const key = `${e.characterId}|${e.zhizhi ?? ''}|${e.hc ? 1 : ''}`; return <CharacterTile key={key} flipId={key} {...tileProps(e, characters[e.characterId])} />; })}
                      </div>
                    </div>
                  ))}
                </section>
              )) : <p className="tl-empty">Không có Khí Giả nào khớp. <button type="button" onClick={clear}>Xoá lọc</button></p>}
            </div>
          </>
        )}
        {tab === 'teams' && (
          <>
            {doc.teams.note && <p className="tl-note">{doc.teams.note}</p>}
            {doc.teams.groups.map((g, i) => (
              <article key={i} className="tl-team">
                <h2>{g.name}</h2>
                {g.note && <p>{g.note}</p>}
                <div className="tl-tiles">{g.members.filter((m) => characters[m.characterId]).map((m) => <CharacterTile key={m.characterId} {...tileProps(m, characters[m.characterId])} />)}</div>
              </article>
            ))}
          </>
        )}
        {tab === 'info' && (
          <div className="tl-info">
            {paragraphs(doc.info).map((b, i) => (b.kind === 'ul'
              ? <ul key={i}>{b.items.map((t, j) => <li key={j}>{t}</li>)}</ul>
              : <p key={i}>{b.lines.map((l, j) => <span key={j}>{j > 0 && <br />}{l}</span>)}</p>))}
          </div>
        )}
      </div>
    </div>
  );
}

function Page({ lists, slug, tab }: { lists: PublishedList[] | undefined; slug: string; tab: Tab }) {
  const characters = getGameData().characters as Record<string, SiteChar>;
  const pick = pickList(lists, slug);
  if (pick.kind === 'list') {
    return <TierListView list={pick.list} characters={characters} tab={tab}
      onTab={(t) => history.replaceState(null, '', tierListHref(pick.list.slug, t))} />;
  }
  if (pick.kind === 'index') {
    return (
      <div className="tl-page">
        <header className="tl-mast"><h1>Tier List</h1></header>
        <ul className="tl-index">
          {pick.lists.map((l) => (
            <li key={l.slug}><a href={tierListHref(l.slug)}><b>{l.doc.title}</b><small>{l.doc.author && `${l.doc.author} · `}Cập nhật {fmtDate(l.updatedAt)}{l.status === 'archived' && ' · Cũ'}</small></a></li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="tl-page">
      <header className="tl-mast"><h1>Tier List</h1></header>
      <p className="tl-empty">{pick.kind === 'missing' ? <>Không tìm thấy tier list này. <a href={tierListHref()}>Xem các tier list</a></> : 'Chưa có tier list.'}</p>
    </div>
  );
}

let root: Root | null = null;
let generation = 0;

export function unmountTierListPage() {
  generation += 1;
  root?.unmount();
  root = null;
}

export function mountTierListPage(container: HTMLElement, route: { slug: string; tab: Tab }): Promise<void> {
  unmountTierListPage();
  const mine = generation;
  return loadedGameDocument().then((game) => {
    if (mine !== generation) return;
    container.innerHTML = '';
    const mounted = createRoot(container);
    root = mounted;
    flushSync(() => mounted.render(<StrictMode><Page lists={game?.tierLists} slug={route.slug} tab={route.tab} /></StrictMode>));
  });
}
