import { useEffect, useMemo, useState } from 'react';
import { Button, Notice, SkeletonRows } from '../layout/ui';
import { listCharacters } from './charactersApi.js';
import { recordHref } from './lib/route.mts';
import { Avatar, characterAvatar } from './components/Avatar';
import { RARE_LABEL, type Character } from './types';

// Loaded once per page; a save drops it so names shown here stay current.
let cache: Promise<Character[]> | null = null;
export const invalidateCharacterList = () => { cache = null; };

// Direction C: a register index — kicker, big count, borderless search, two text columns.
export function CharacterList() {
  const [items, setItems] = useState<Character[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');

  const load = () => {
    setError(false);
    cache ??= listCharacters();
    cache.then(setItems, () => { cache = null; setError(true); });
  };
  useEffect(load, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!items || !q) return items;
    return items.filter((c) => [c.characterId, c.nameCn, c.nameVi.value, c.fullnameVi.value].some((v) => v?.toLowerCase().includes(q)));
  }, [items, query]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1100px] px-4 pb-24 pt-8 md:px-10 md:pt-14">
        <p className="text-[13px] uppercase tracking-[.3em] text-(--text-subtle)">Khí Giả</p>
        <h2 className="admin-cn mb-9 mt-4 text-3xl leading-tight md:text-[40px]">
          {items ? `${items.length} hồ sơ` : 'Hồ sơ'}
          <small className="mt-2.5 block font-sans text-sm text-(--text-muted)">Bấm một tên để mở hồ sơ.</small>
        </h2>
        <div className="mb-3 flex items-baseline gap-7 border-b border-(--border-strong) pb-3 transition-colors focus-within:border-(--accent)">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm tên hoặc mã"
            aria-label="Tìm nhân vật"
            className="min-w-0 flex-1 border-0 bg-transparent text-lg text-(--text-main) outline-none placeholder:text-(--text-subtle) focus-visible:outline-none"
          />
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
                  className="grid grid-cols-[44px_1fr] items-center gap-3.5 border-b border-(--border-color) py-3.5 transition-colors hover:bg-[linear-gradient(90deg,transparent,var(--bg-surface),transparent)] focus-visible:outline-1 focus-visible:outline-(--accent)"
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
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
