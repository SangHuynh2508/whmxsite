import { useEffect, useMemo, useState } from 'react';
import { Button, Notice, SkeletonRows } from '../layout/ui';
import { listCharacters } from './charactersApi.js';
import { getLoreProgress } from './loreApi.js';
import { TERMS_HREF, recordHref } from './lib/route.mts';
import { filterCharacters, type LoreFilter } from './lib/listFilter.mts';
import { Avatar, characterAvatar } from './components/Avatar';
import { RARE_LABEL, type Character } from './types';

// Loaded once per page; a save drops it so names shown here stay current.
let cache: Promise<Character[]> | null = null;
export const invalidateCharacterList = () => { cache = null; };
type Progress = Record<string, { total: number; done: number; legacy: number; changed: number }>;
let progressCache: Promise<Progress> | null = null;
export const invalidateLoreProgress = () => { progressCache = null; };
const FILTERS: [LoreFilter, string][] = [['all', 'Tất cả'], ['unfinished', 'Chưa xong'], ['legacy', 'Có bản cũ'], ['changed', 'Tiếng Trung đã đổi']];

// Direction C: a register index — kicker, big count, borderless search, two text columns.
export function CharacterList() {
  const [items, setItems] = useState<Character[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LoreFilter>('all');
  const [progress, setProgress] = useState<Progress>({});

  const load = () => {
    setError(false);
    cache ??= listCharacters();
    cache.then(setItems, () => { cache = null; setError(true); });
    progressCache ??= getLoreProgress();
    progressCache.then(setProgress, () => { progressCache = null; }); // progress is extra; the list works without it
  };
  useEffect(load, []);

  const shown = useMemo(() => items && filterCharacters(items, progress, { query, filter }), [items, progress, query, filter]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1100px] px-4 pb-24 pt-8 md:px-10 md:pt-14">
        <p className="text-[13px] uppercase tracking-[.3em] text-(--text-subtle)">Khí Giả</p>
        <h2 className="admin-cn mb-9 mt-4 text-3xl leading-tight md:text-[40px]">
          {items ? `${items.length} hồ sơ` : 'Hồ sơ'}
          <small className="mt-2.5 block font-sans text-sm text-(--text-muted)">Bấm một tên để mở hồ sơ.</small>
        </h2>
        <div className="mb-3 flex flex-wrap items-baseline gap-x-7 gap-y-2 border-b border-(--border-strong) pb-3 transition-colors focus-within:border-(--accent)">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm tên hoặc mã"
            aria-label="Tìm nhân vật"
            className="min-w-0 flex-1 border-0 bg-transparent text-lg text-(--text-main) outline-none placeholder:text-(--text-subtle) focus-visible:outline-none"
          />
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className={filter === id ? 'text-[13px] text-(--text-main)' : 'text-[13px] text-(--text-subtle) transition-colors hover:text-(--text-main)'}>{label}</button>
          ))}
          <a href={TERMS_HREF} className="text-[13px] text-(--text-subtle) transition-colors hover:text-(--text-main)">Thuật ngữ lore →</a>
        </div>
        {error && <Notice className="my-4">Không tải được danh sách. <Button variant="ghost" onClick={load}>Thử lại</Button></Notice>}
        {!items && !error && <SkeletonRows count={8} />}
        {shown && shown.length === 0 && <p className="py-8 text-sm text-(--text-subtle)">Không có nhân vật khớp.</p>}
        {shown && shown.length > 0 && (
          <ul className="gap-16 md:columns-2">
            {shown.map((c) => (
              <li key={c.characterId} className="break-inside-avoid">
                <a
                  href={recordHref(c.characterId)}
                  className="grid grid-cols-[44px_1fr_auto] items-center gap-3.5 border-b border-(--border-color) py-3.5 transition-colors hover:bg-[linear-gradient(90deg,transparent,var(--bg-surface),transparent)] focus-visible:outline-1 focus-visible:outline-(--accent)"
                >
                  <Avatar src={characterAvatar(c.characterId)} label={c.characterId} className="size-11 rounded-full" />
                  <span className="min-w-0">
                    <span className="admin-cn block truncate text-[17px] leading-snug">
                      {c.nameVi.value || c.nameCn}
                      {c.nameVi.value && <small lang="zh" className="ml-2 text-[13px] text-(--text-subtle)">{c.nameCn}</small>}
                    </span>
                    <span className="block text-xs tracking-[.08em] text-(--text-subtle)">
                      {c.characterId}{c.protected?.rawRare != null && ` · ${RARE_LABEL[c.protected.rawRare] ?? `R${c.protected.rawRare}`}`}
                    </span>
                  </span>
                  <LoreFraction p={progress[c.characterId]} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function LoreFraction({ p }: { p?: Progress[string] }) {
  if (!p) return null;
  return (
    <span className="text-right text-[13px] tabular-nums text-(--text-muted)" aria-label={`Lore ${p.done} trên ${p.total} đoạn đã lưu`}>
      {p.done} / {p.total}
      {p.legacy > 0 && <small className="block text-[11px] text-(--accent)">{p.legacy} bản cũ</small>}
      {p.changed > 0 && <small className="block text-[11px] text-(--rarity-ssr-text)">{p.changed} đổi CN</small>}
    </span>
  );
}
