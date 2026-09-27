import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Notice, SkeletonRows } from '../layout/ui';
import { getGameTexts, getLoreTerms, patchGameText, patchLoreTerm } from './loreApi.js';
import { lorePublisher, usePublishStatus } from './lorePublish';
import { useEditor } from './useEditor';
import { recordHref } from './lib/route.mts';
import { DICTIONARY_TABS, dictionaryHref, isDone, mergeSameText, outOfStep, parseDictionaryRoute, progress, type DictionaryTab } from './lib/dictionary.mts';
import { PairRow, ViCell } from './components/Pair';
import { SaveBar } from './components/SaveBar';

type Term = {
  code: string; kind: string; nameCn: string; detailCn: string; nameVi: string | null; detailVi: string | null;
  viOrigin: 'admin' | null; state: 'ok' | 'source_changed'; revision: number; usedBy: string[]; skillCodes?: string[];
  twins?: Term[]; // rows merged by identical Chinese (sameText tabs); saved together
};
type Vi = { expectedRevision: number; nameVi: string | null; detailVi: string | null };
// One tab = one source (lore_terms or game_texts) and the kinds it lists; `children` = terms edited with a row
// (a weapon's skills, owner choice 2026-09-27).
type TabConfig = {
  intro: string; kinds: [string, string][];
  load: () => Promise<Term[]>; save: (term: Term, vi: Vi) => Promise<unknown>;
  children?: (term: Term, all: Term[]) => Term[];
  sameText?: boolean; // one row per identical Chinese text of a kind (mergeSameText)
};

// Game texts are keyed kind + code; the page uses "kind:code" as the term code.
const loadGame = async () => ((await getGameTexts()) as Omit<Term, 'usedBy'>[]).map((t) => ({ ...t, code: `${t.kind}:${t.code}`, usedBy: [] }));
const saveGame = (t: Term, vi: Vi) => patchGameText(t.kind, t.code.slice(t.kind.length + 1), vi);
const TABS: Record<DictionaryTab, TabConfig> = {
  weapons: {
    intro: 'Mỗi vũ khí: tên và kỹ năng của nó (tên + mô tả) sửa cùng một chỗ.',
    kinds: [['weapon', 'Vũ khí']], load: loadGame, save: saveGame,
    children: (t, all) => (t.skillCodes ?? []).flatMap((c) => all.find((x) => x.code === `weapon_skill:${c}`) ?? []),
  },
  affixes: { intro: 'Tên dòng thuộc tính vũ khí.', kinds: [['weapon_affix', 'Dòng thuộc tính']], load: loadGame, save: saveGame },
  deepen: {
    intro: 'Thâm tạo: hướng, cột và thiên phú theo điểm.',
    kinds: [['job_style', 'Hướng thâm tạo'], ['style_sector', 'Cột thâm tạo'], ['style_talent', 'Thiên phú thâm tạo']], load: loadGame, save: saveGame,
    sameText: true,
  },
  lore: {
    intro: 'Thuật ngữ lore: sửa ở đây đổi cho mọi nhân vật dùng thuật ngữ.',
    kinds: [
      ['organisation', 'Tổ chức'], ['relic_type', 'Loại hiện vật'], ['era', 'Triều đại'],
      ['museum', 'Bảo tàng'], ['era_range', 'Giai đoạn'], ['affinity_level', 'Mức thiện cảm'],
      ['relic_tag', 'Mục phụ hiện vật'],
    ],
    load: getLoreTerms, save: (t, vi) => patchLoreTerm(t.code, vi),
  },
};

const official = (t: Term) => t.viOrigin === 'admin' && t.state === 'ok';
const twinsOf = (t: Term) => t.twins ?? [t];
const behind = (t: Term) => (t.twins ? outOfStep({ ...t, twins: t.twins }) : []);
const field = (code: string, key: 'nameVi' | 'detailVi') => `${code}|${key}`;

// Shared translations, one tab per part of the game (Vũ khí, Dòng thuộc tính, Thâm tạo, Lore).
export function DictionaryView() {
  const [route, setRoute] = useState(() => parseDictionaryRoute(location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parseDictionaryRoute(location.hash));
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1100px] px-4 pb-24 pt-6 md:px-10 md:pt-10">
        <nav aria-label="Phần" className="mb-2 flex flex-wrap gap-x-7 gap-y-2 border-b border-(--border-color)">
          {DICTIONARY_TABS.map(([id, label]) => (
            <a key={id} href={dictionaryHref(id)} aria-current={route.tab === id ? 'page' : undefined}
              className={cn('-mb-px border-b-2 pb-2 text-sm transition-colors', route.tab === id ? 'border-(--accent) text-(--text-main)' : 'border-transparent text-(--text-subtle) hover:text-(--text-main)')}>{label}</a>
          ))}
        </nav>
        <TermsTab key={route.tab} tab={route.tab} code={route.code} />
      </div>
    </div>
  );
}

function TermsTab({ tab, code }: { tab: DictionaryTab; code?: string }) {
  const config = TABS[tab];
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [todoOnly, setTodoOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(code ?? null);
  const publish = usePublishStatus();

  const load = useCallback(async () => { const all = await config.load(); setTerms(all); return all; }, [config]);
  useEffect(() => { load().catch(() => setError(true)); }, [load]);
  useEffect(() => { if (code) setOpen(code); }, [code]);

  const kinds = useMemo(() => new Set(config.kinds.map(([k]) => k)), [config]);
  const listed = useMemo(() => {
    const rows = (terms ?? []).filter((t) => kinds.has(t.kind));
    return config.sameText ? mergeSameText(rows) : rows;
  }, [terms, kinds, config]);
  const childrenOf = useCallback((t: Term) => (config.children ? config.children(t, terms ?? []) : []), [config, terms]);
  // The editor's record must keep its identity across re-renders (search, publish status): a new array makes
  // useEditor treat it as a freshly loaded record — typing reset to the saved value, "bản nháp" prompt.
  const groups = useMemo(() => new Map(listed.map((t) => [t.code, [t, ...childrenOf(t)]])), [listed, childrenOf]);
  // A link to a weapon skill (old game-terms links, history) opens the weapon that has it.
  const openRow = useMemo(() => {
    if (!open || listed.some((t) => t.code === open)) return open;
    return listed.find((t) => [...twinsOf(t), ...childrenOf(t)].some((c) => c.code === open))?.code ?? open;
  }, [open, listed, childrenOf]);
  useEffect(() => {
    if (terms && openRow) document.getElementById(`term-${openRow}`)?.scrollIntoView({ block: 'start' });
  }, [terms, openRow]);

  const count = useMemo(() => progress(listed.flatMap((t) => [...twinsOf(t), ...childrenOf(t)])), [listed, childrenOf]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listed.filter((t) => {
      const group = [...twinsOf(t), ...childrenOf(t)];
      return (!q || group.some((x) => [x.code, x.nameCn, x.nameVi].some((v) => v?.toLowerCase().includes(q))))
        && (!todoOnly || group.some((x) => !isDone(x)));
    });
  }, [listed, childrenOf, query, todoOnly]);

  const toggle = (next: string) => {
    if (next === openRow) return;
    if ((window as { __whmxAdminDirty?: boolean }).__whmxAdminDirty && !confirm('Có thay đổi chưa lưu. Rời mục này?')) return;
    history.replaceState(null, '', dictionaryHref(tab, next));
    setOpen(next);
  };

  return (
    <>
      <p className="mb-6 mt-4 text-sm text-(--text-muted)">
        {config.intro} Chưa dịch thì trang công khai hiện tiếng Trung.{' '}
        {terms && <span className={cn('tabular-nums', count.done < count.total && 'text-(--accent)')}>Đã dịch {count.done}/{count.total}.</span>}{' '}
        {publish.state !== 'idle' && <span role="status" className="text-(--text-subtle)">{publish.message}</span>}
      </p>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-(--border-strong) pb-3 transition-colors focus-within:border-(--accent)">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm mã, tên Trung hoặc Việt" aria-label="Tìm trong từ điển"
          className="min-w-0 flex-1 border-0 bg-transparent text-lg text-(--text-main) outline-none placeholder:text-(--text-subtle) focus-visible:outline-none" />
        <label className="flex items-center gap-2 text-[13px] text-(--text-subtle)"><input type="checkbox" checked={todoOnly} onChange={(e) => setTodoOnly(e.target.checked)} /> Chỉ hiện chưa dịch</label>
      </div>
      {error && <Notice className="my-4">Không tải được từ điển. <Button variant="ghost" onClick={() => { setError(false); load().catch(() => setError(true)); }}>Thử lại</Button></Notice>}
      {!terms && !error && <SkeletonRows count={8} />}
      {terms && config.kinds.map(([kind, heading]) => {
        const group = shown.filter((t) => t.kind === kind);
        if (!group.length) return null;
        return (
          <section key={kind} aria-label={heading} className="mt-10">
            <h3 className="mb-1 text-[13px] uppercase tracking-[.3em] text-(--accent)">{heading}</h3>
            {group.map((t) => {
              const children = childrenOf(t);
              const childTodo = children.filter((c) => !isDone(c)).length;
              return (
                <div key={t.code} id={`term-${t.code}`} className="scroll-mt-4 border-b border-(--border-color)">
                  <button type="button" aria-expanded={openRow === t.code} onClick={() => toggle(t.code)}
                    className={cn('grid w-full grid-cols-[1fr_auto] items-baseline gap-3 py-3 text-left transition-colors hover:bg-[linear-gradient(90deg,transparent,var(--bg-surface),transparent)]', openRow === t.code && 'text-(--accent)')}>
                    <span className="min-w-0">
                      <span lang="zh" className="admin-cn text-[17px]">{t.nameCn}</span>
                      <span className="ml-3 text-sm text-(--text-muted)">{t.nameVi ?? <span className="italic text-(--text-subtle)">chưa dịch</span>}</span>
                      {t.nameVi && t.detailCn && !t.detailVi && <span className="ml-3 text-xs italic text-(--text-subtle)">chưa dịch mô tả</span>}
                      {childTodo > 0 && <span className="ml-3 text-xs italic text-(--text-subtle)">{childTodo}/{children.length} kỹ năng chưa dịch</span>}
                      {twinsOf(t).length > 1 && <span className="ml-3 text-xs text-(--text-subtle)">{twinsOf(t).length} mục{behind(t).length > 0 && `, ${behind(t).length} chưa theo bản dịch này`}</span>}
                      {[...twinsOf(t), ...children].some((x) => x.state === 'source_changed') && <span className="ml-3 text-xs text-(--rarity-ssr-text)">Tiếng Trung đã đổi</span>}
                    </span>
                    <span className="font-mono text-xs text-(--text-subtle)">{t.code}</span>
                  </button>
                  {t.usedBy.length > 0 && (
                    <details className="pb-2 text-xs text-(--text-subtle)">
                      <summary className="cursor-pointer">đang dùng bởi {t.usedBy.length} nhân vật</summary>
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">{t.usedBy.map((id) => <a key={id} href={recordHref(id, 'lore')} className="font-mono hover:text-(--text-main)">{id}</a>)}</p>
                    </details>
                  )}
                  {openRow === t.code && <GroupEditor key={t.code} terms={groups.get(t.code)!} reload={load} config={config} />}
                </div>
              );
            })}
          </section>
        );
      })}
    </>
  );
}

// One editor for a row and its children (one Lưu, one Ctrl+S, one unsaved-changes flag); each changed term is
// saved with its own revision.
function GroupEditor({ terms, reload, config }: { terms: Term[]; reload: () => Promise<Term[]>; config: TabConfig }) {
  const toRecord = useCallback((list: Term[]) => Object.fromEntries(list.flatMap((t) => [
    [field(t.code, 'nameVi'), { value: t.nameVi ?? '', source: null, official: official(t) }],
    [field(t.code, 'detailVi'), { value: t.detailVi ?? '', source: null, official: official(t) }],
  ])), []);
  const record = useMemo(() => toRecord(terms), [terms, toRecord]);
  const keys = useMemo(() => Object.keys(record), [record]);
  const pick = useCallback((all: Term[]) => {
    const found = terms.map((t) => all.find((x) => x.code === t.code));
    return found.every(Boolean) ? toRecord(found as Term[]) : null;
  }, [terms, toRecord]);
  const save = useCallback(async (c: Record<string, string | null>) => {
    for (const t of terms) {
      const name = field(t.code, 'nameVi'); const detail = field(t.code, 'detailVi');
      if (!(name in c) && !(detail in c)) continue;
      const vi = { nameVi: name in c ? c[name] : t.nameVi, detailVi: detail in c ? c[detail] : t.detailVi };
      for (const x of twinsOf(t)) {
        if (official(x) && x.nameVi === vi.nameVi && x.detailVi === vi.detailVi) continue; // already this translation
        await config.save(x, { expectedRevision: x.revision, ...vi });
      }
    }
    lorePublisher.schedule();
  }, [terms, config]);
  const find = useCallback(async () => pick(await reload()), [pick, reload]);
  const peek = useCallback(async () => pick(await config.load()), [pick, config]);
  const editor = useEditor({ scope: 'term', id: terms[0].code, record, keys, save, reload: find, peek });
  const lagging = behind(terms[0]);
  const [applying, setApplying] = useState<string | null>(null);
  const applyAll = async () => {
    setApplying('Đang áp dụng…');
    try {
      for (const x of lagging) await config.save(x, { expectedRevision: x.revision, nameVi: terms[0].nameVi, detailVi: terms[0].detailVi });
      lorePublisher.schedule();
      setApplying(null);
    } catch { setApplying('Áp dụng chưa xong. Tải lại trang rồi thử lại.'); }
    await reload().catch(() => undefined);
  };
  const labels = Object.fromEntries(terms.flatMap((t, i) => {
    const who = i === 0 ? '' : `Kỹ năng ${t.nameVi || t.nameCn}: `;
    return [[field(t.code, 'nameVi'), `${who}Tên`], [field(t.code, 'detailVi'), `${who}Mô tả`]];
  }));
  const notes = (t: Term, key: string) => (
    <>
      {!official(t) && Boolean(t.nameVi || t.detailVi) && t.state === 'source_changed' && key === field(t.code, 'nameVi') && !editor.confirmed.includes(key) && (
        <button type="button" onClick={() => { editor.confirm(field(t.code, 'nameVi')); editor.confirm(field(t.code, 'detailVi')); }} className="hover:text-(--text-main)">Giữ bản dịch</button>
      )}
      <span className="ml-auto tabular-nums">{(editor.draft[key] ?? '').length} ký tự</span>
    </>
  );
  return (
    <div className="-mx-4 mb-3 bg-(--bg-surface) md:-mx-8">
      {twinsOf(terms[0]).length > 1 && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-3 text-xs text-(--text-subtle) md:px-8">
          <span>Dùng chung cho {twinsOf(terms[0]).length} mục cùng chữ Trung: <span className="font-mono">{twinsOf(terms[0]).map((x) => x.code.split(':')[1]).join(', ')}</span>.</span>
          {lagging.length > 0 && official(terms[0]) && (
            <Button variant="ghost" disabled={Boolean(editor.dirtyCount) || applying === 'Đang áp dụng…'} onClick={() => void applyAll()}>Áp dụng bản dịch này cho {lagging.length} mục còn lại</Button>
          )}
          {applying && <span role="status">{applying}</span>}
        </p>
      )}
      {terms.map((t, i) => (
        <div key={t.code} className={cn(i > 0 && 'border-t border-(--border-color)')}>
          {i > 0 && <p className="px-4 pt-3 text-[11px] uppercase tracking-[.2em] text-(--text-subtle) md:px-8">Kỹ năng {i}</p>}
          <PairRow id={`${t.code}-name`} label="Tên" original={t.nameCn}>
            <ViCell id={`${t.code}-name`} value={editor.draft[field(t.code, 'nameVi')] ?? ''} dirty={field(t.code, 'nameVi') in editor.changes} placeholder="Tên tiếng Việt…" onChange={(v) => editor.setField(field(t.code, 'nameVi'), v)} notes={notes(t, field(t.code, 'nameVi'))} />
          </PairRow>
          {t.detailCn && (
            <PairRow id={`${t.code}-detail`} label="Mô tả" original={t.detailCn}>
              <ViCell id={`${t.code}-detail`} value={editor.draft[field(t.code, 'detailVi')] ?? ''} dirty={field(t.code, 'detailVi') in editor.changes} multiline placeholder="Mô tả tiếng Việt…" onChange={(v) => editor.setField(field(t.code, 'detailVi'), v)} notes={notes(t, field(t.code, 'detailVi'))} />
            </PairRow>
          )}
        </div>
      ))}
      <SaveBar {...editor} labels={labels} />
    </div>
  );
}
