import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Notice, SkeletonRows } from '../layout/ui';
import { getGameTexts, getLoreTerms, patchGameText, patchLoreTerm } from './loreApi.js';
import { lorePublisher, usePublishStatus } from './lorePublish';
import { useEditor } from './useEditor';
import { gameTermHref, recordHref, termHref } from './lib/route.mts';
import { PairRow, ViCell } from './components/Pair';
import { SaveBar } from './components/SaveBar';

type Term = {
  code: string; kind: string; nameCn: string; detailCn: string; nameVi: string | null; detailVi: string | null;
  viOrigin: 'admin' | null; state: 'ok' | 'source_changed'; revision: number; usedBy: string[];
};
type Vi = { expectedRevision: number; nameVi: string | null; detailVi: string | null };
// One translation page, two sources: lore terms (lore_terms) and game texts (game_texts: weapons, skills, 深造…).
type TermsConfig = {
  title: string; intro: string; kinds: [string, string][];
  load: () => Promise<Term[]>; save: (term: Term, vi: Vi) => Promise<unknown>; href: (code: string) => string;
};
const LORE: TermsConfig = {
  title: 'Thuật ngữ lore', intro: 'Sửa ở đây đổi cho mọi nhân vật dùng thuật ngữ.',
  kinds: [
    ['organisation', 'Tổ chức'], ['relic_type', 'Loại hiện vật'], ['era', 'Triều đại'],
    ['museum', 'Bảo tàng'], ['era_range', 'Giai đoạn'], ['affinity_level', 'Mức thiện cảm'],
    ['relic_tag', 'Mục phụ hiện vật'],
  ],
  load: getLoreTerms, save: (t, vi) => patchLoreTerm(t.code, vi), href: termHref,
};
// Game texts are keyed kind + code; the page uses "kind:code" as the term code.
type GameText = Omit<Term, 'code' | 'usedBy'> & { code: string };
const GAME: TermsConfig = {
  title: 'Thuật ngữ game', intro: 'Tên và mô tả trong game dùng cho tab Build (vũ khí, kỹ năng vũ khí, dòng thuộc tính, thâm tạo). Chưa dịch thì trang công khai hiện tiếng Trung.',
  kinds: [
    ['weapon', 'Vũ khí'], ['weapon_skill', 'Kỹ năng vũ khí'], ['weapon_affix', 'Dòng thuộc tính'],
    ['job_style', 'Hướng thâm tạo'], ['style_sector', 'Cột thâm tạo'], ['style_talent', 'Thiên phú thâm tạo'],
  ],
  load: async () => ((await getGameTexts()) as GameText[]).map((t) => ({ ...t, code: `${t.kind}:${t.code}`, usedBy: [] })),
  save: (t, vi) => patchGameText(t.kind, t.code.slice(t.kind.length + 1), vi),
  href: gameTermHref,
};
const KEYS = ['nameVi', 'detailVi'];
const official = (t: Term) => t.viOrigin === 'admin' && t.state === 'ok';
const toRecord = (t: Term) => ({
  nameVi: { value: t.nameVi ?? '', source: null, official: official(t) },
  detailVi: { value: t.detailVi ?? '', source: null, official: official(t) },
});

export const LoreTermsView = ({ code }: { code?: string }) => <TermsView code={code} config={LORE} />;
export const GameTermsView = ({ code }: { code?: string }) => <TermsView code={code} config={GAME} />;

// Shared terms: one translation used everywhere the term appears.
function TermsView({ code, config }: { code?: string; config: TermsConfig }) {
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(code ?? null);
  const publish = usePublishStatus();

  const load = useCallback(async () => { const all = await config.load(); setTerms(all); return all; }, [config]);
  useEffect(() => { load().catch(() => setError(true)); }, [load]);
  useEffect(() => { if (code) setOpen(code); }, [code]);
  useEffect(() => {
    if (terms && open) document.getElementById(`term-${open}`)?.scrollIntoView({ block: 'start' });
  }, [terms, open]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (terms ?? []).filter((t) => !q || [t.code, t.nameCn, t.nameVi].some((v) => v?.toLowerCase().includes(q)));
  }, [terms, query]);

  const toggle = (next: string) => {
    if (next === open) return;
    if ((window as { __whmxAdminDirty?: boolean }).__whmxAdminDirty && !confirm('Có thay đổi chưa lưu. Rời thuật ngữ này?')) return;
    history.replaceState(null, '', config.href(next));
    setOpen(next);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1100px] px-4 pb-24 pt-8 md:px-10 md:pt-14">
        <a href="#/admin/characters" className="text-[13px] text-(--text-muted) hover:text-(--text-main)">← Danh sách</a>
        <p className="mt-6 text-[13px] uppercase tracking-[.3em] text-(--text-subtle)">Khí Giả</p>
        <h2 className="admin-cn mb-2 mt-4 text-3xl leading-tight md:text-[40px]">{config.title}</h2>
        <p className="mb-8 text-sm text-(--text-muted)">{config.intro} {publish.state !== 'idle' && <span role="status" className="text-(--text-subtle)">{publish.message}</span>}</p>
        <div className="mb-3 border-b border-(--border-strong) pb-3 transition-colors focus-within:border-(--accent)">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm mã, tên Trung hoặc Việt" aria-label="Tìm thuật ngữ"
            className="w-full border-0 bg-transparent text-lg text-(--text-main) outline-none placeholder:text-(--text-subtle) focus-visible:outline-none" />
        </div>
        {error && <Notice className="my-4">Không tải được thuật ngữ. <Button variant="ghost" onClick={() => { setError(false); load().catch(() => setError(true)); }}>Thử lại</Button></Notice>}
        {!terms && !error && <SkeletonRows count={8} />}
        {terms && config.kinds.map(([kind, heading]) => {
          const group = shown.filter((t) => t.kind === kind);
          if (!group.length) return null;
          return (
            <section key={kind} aria-label={heading} className="mt-10">
              <h3 className="mb-1 text-[13px] uppercase tracking-[.3em] text-(--accent)">{heading}</h3>
              {group.map((t) => (
                <div key={t.code} id={`term-${t.code}`} className="scroll-mt-4 border-b border-(--border-color)">
                  <button type="button" aria-expanded={open === t.code} onClick={() => toggle(t.code)}
                    className={cn('grid w-full grid-cols-[1fr_auto] items-baseline gap-3 py-3 text-left transition-colors hover:bg-[linear-gradient(90deg,transparent,var(--bg-surface),transparent)]', open === t.code && 'text-(--accent)')}>
                    <span className="min-w-0">
                      <span lang="zh" className="admin-cn text-[17px]">{t.nameCn}</span>
                      <span className="ml-3 text-sm text-(--text-muted)">{t.nameVi ?? <span className="italic text-(--text-subtle)">chưa dịch</span>}</span>
                      {t.state === 'source_changed' && <span className="ml-3 text-xs text-(--rarity-ssr-text)">Tiếng Trung đã đổi</span>}
                    </span>
                    <span className="font-mono text-xs text-(--text-subtle)">{t.code}</span>
                  </button>
                  {t.usedBy.length > 0 && (
                    <details className="pb-2 text-xs text-(--text-subtle)">
                      <summary className="cursor-pointer">đang dùng bởi {t.usedBy.length} nhân vật</summary>
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">{t.usedBy.map((id) => <a key={id} href={recordHref(id, 'lore')} className="font-mono hover:text-(--text-main)">{id}</a>)}</p>
                    </details>
                  )}
                  {open === t.code && <TermEditor key={t.code} term={t} reload={load} config={config} />}
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TermEditor({ term, reload, config }: { term: Term; reload: () => Promise<Term[]>; config: TermsConfig }) {
  const record = useMemo(() => toRecord(term), [term]);
  const save = useCallback(
    (c: Record<string, string | null>) => config.save(term, {
      expectedRevision: term.revision,
      nameVi: 'nameVi' in c ? c.nameVi : term.nameVi,
      detailVi: 'detailVi' in c ? c.detailVi : term.detailVi,
    }).then(() => lorePublisher.schedule()),
    [term, config],
  );
  const find = useCallback(async () => { const t = (await reload()).find((x) => x.code === term.code); return t ? toRecord(t) : null; }, [reload, term.code]);
  const peek = useCallback(async () => { const t = (await config.load()).find((x) => x.code === term.code); return t ? toRecord(t) : null; }, [term.code, config]);
  const editor = useEditor({ scope: 'term', id: term.code, record, keys: KEYS, save, reload: find, peek });
  const pending = !official(term) && Boolean(term.nameVi || term.detailVi);
  const notes = (key: string) => (
    <>
      {pending && term.state === 'source_changed' && key === 'nameVi' && !editor.confirmed.length && (
        <button type="button" onClick={() => KEYS.forEach(editor.confirm)} className="hover:text-(--text-main)">Giữ bản dịch</button>
      )}
      <span className="ml-auto tabular-nums">{(editor.draft[key] ?? '').length} ký tự</span>
    </>
  );
  return (
    <div className="-mx-4 mb-3 bg-(--bg-surface) md:-mx-8">
      <PairRow id={`${term.code}-name`} label="Tên" original={term.nameCn}>
        <ViCell id={`${term.code}-name`} value={editor.draft.nameVi ?? ''} dirty={'nameVi' in editor.changes} placeholder="Tên tiếng Việt…" onChange={(v) => editor.setField('nameVi', v)} notes={notes('nameVi')} />
      </PairRow>
      {term.detailCn && (
        <PairRow id={`${term.code}-detail`} label="Mô tả" original={term.detailCn}>
          <ViCell id={`${term.code}-detail`} value={editor.draft.detailVi ?? ''} dirty={'detailVi' in editor.changes} multiline placeholder="Mô tả tiếng Việt…" onChange={(v) => editor.setField('detailVi', v)} notes={notes('detailVi')} />
        </PairRow>
      )}
      <SaveBar {...editor} labels={{ nameVi: 'Tên', detailVi: 'Mô tả' }} />
    </div>
  );
}
