// Admin Tier List editor (spec 2026-10-02 §8, direction D3). Drag from the pool or a tile onto a tier/team (native
// HTML5 DnD); keyboard path: focus a tile, Enter selects it, then the toolbar moves it / sets Z / HC / duplicates /
// removes; a pool tile + "Thêm vào" adds to the chosen tier. "Xem trước" renders the real public TierListView.
import { useCallback, useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button, Field, Notice, SectionTitle, Select, SkeletonRows, describeError, inputClass, statusOf } from '../layout/ui';
import { loadGameData } from '../../data/loader.js';
import { lorePublisher, usePublishStatus } from '../characters/lorePublish';
import { CharacterTile } from '../../features/characters/components/CharacterTile.tsx';
import { TierListView } from '../../features/tier-list/TierListPage.tsx';
import { tileProps, type Entry, type SiteChar, type TierListDoc } from '../../features/tier-list/tierView.mts';
import { fold } from '../../lib/fold.mts';
import { JOB_NAMES, RARITY_LABELS } from '../../ui/utils/gameLabels.mts';
import { getTierList, saveTierList } from './tierListApi.js';
import { addTeam, addTier, canInsert, duplicateEntry, entriesOf, insertEntry, moveEntry, moveTeam, moveTier, removeEntry, removeTeam, removeTier, sameDoc, tierListErrors, updateEntry, updateTeam, updateTier, type Place } from './lib/tierEdit.mts';

type Row = { id: string; slug: string; status: 'draft' | 'published' | 'archived'; position: number; doc: TierListDoc; revision: number; updatedAt: string };
type Chars = Record<string, SiteChar & { has_huanzhang?: boolean }>;
type Drag = { from: 'pool'; characterId: string } | { from: 'place'; place: Place };
type View = 'characters' | 'teams' | 'info' | 'preview';
const VIEWS: [View, string][] = [['characters', 'Nhân vật'], ['teams', 'Đội hình'], ['info', 'Thông tin'], ['preview', 'Xem trước']];
const DRAG = 'application/x-whmx-tier';

export function TierListEditor({ slug }: { slug: string }) {
  const [row, setRow] = useState<Row | null>(null);
  const [draft, setDraft] = useState<TierListDoc | null>(null);
  const [chars, setChars] = useState<Chars | null>(null);
  const [view, setView] = useState<View>('characters');
  const [sel, setSel] = useState<Place | null>(null);
  const [target, setTarget] = useState(0); // tier that "Thêm vào" adds to
  const [pool, setPool] = useState({ q: '', job: 0, rare: 0 });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ReactNode>(null);
  const publish = usePublishStatus();

  const load = useCallback(async () => {
    setProblem(null);
    try {
      const [r, data] = await Promise.all([getTierList(slug) as Promise<Row>, loadGameData()]);
      setRow(r); setDraft(r.doc); setChars(data.characters as Chars); setSel(null);
    } catch (failure) { setProblem(describeError(failure)); }
  }, [slug]);
  useEffect(() => { void load(); }, [load]);
  const dirty = Boolean(row && draft && !sameDoc(row.doc, draft));

  useEffect(() => { // leave guard (AdminApp reads the flag) + Ctrl+S
    (window as { __whmxAdminDirty?: boolean }).__whmxAdminDirty = dirty;
    const unload = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (dirty) void save(); } };
    addEventListener('beforeunload', unload); addEventListener('keydown', key);
    return () => { removeEventListener('beforeunload', unload); removeEventListener('keydown', key); (window as { __whmxAdminDirty?: boolean }).__whmxAdminDirty = false; };
  });

  const poolList = useMemo(() => Object.values(chars ?? {})
    .filter((c) => (!pool.job || c.job === pool.job) && (!pool.rare || c.rare === pool.rare) && (!pool.q || fold(c.name_vi || c.name_cn).includes(fold(pool.q.trim())) || c.name_cn.includes(pool.q.trim())))
    .sort((a, b) => b.rare - a.rare || (a.name_vi || a.name_cn).localeCompare(b.name_vi || b.name_cn, 'vi')), [chars, pool]);

  if (!row || !draft || !chars) return problem ? <Notice className="m-4">{problem}</Notice> : <SkeletonRows />;
  const set = (next: TierListDoc) => setDraft(next);

  async function save() {
    if (!row || !draft) return;
    setBusy(true); setProblem(null);
    try {
      const saved = (await saveTierList(row.slug, row.revision, { doc: draft })) as Row;
      setRow(saved); setDraft(saved.doc);
      lorePublisher.schedule();
    } catch (failure) {
      const details = (failure as { payload?: { error?: { details?: { path: string; code: string }[] } } }).payload?.error?.details;
      if (details) setProblem(<ul className="list-disc pl-5">{tierListErrors(details).map((l) => <li key={l}>{l}</li>)}</ul>);
      else if (statusOf(failure) === 409) setProblem(<>Tier list vừa được lưu ở nơi khác. <Button variant="ghost" onClick={load}>Tải bản mới</Button> (thay đổi của bạn sẽ mất)</>);
      else setProblem(describeError(failure));
    } finally { setBusy(false); }
  }

  const drop = (to: Place) => (e: DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const data = JSON.parse(e.dataTransfer.getData(DRAG) || 'null') as Drag | null;
    if (!data) return;
    if (data.from === 'pool') set(insertEntry(draft, to, { characterId: data.characterId }));
    else set(moveEntry(draft, data.place, to));
    setSel(null);
  };
  const dragStart = (data: Drag) => (e: DragEvent) => { e.dataTransfer.setData(DRAG, JSON.stringify(data)); e.dataTransfer.effectAllowed = 'move'; };
  const over = (e: DragEvent) => { if (e.dataTransfer.types.includes(DRAG)) e.preventDefault(); };

  const tile = (entry: Entry, place: Place) => {
    const c = chars[entry.characterId];
    const selected = sel && sel.area === place.area && sel.list === place.list && sel.index === place.index;
    return (
      <button key={`${place.index}-${entry.characterId}`} type="button" draggable onDragStart={dragStart({ from: 'place', place })} onDragOver={over} onDrop={drop(place)}
        onClick={() => setSel(selected ? null : place)} aria-pressed={Boolean(selected)}
        className={cn('rounded-md p-0.5', selected && 'outline-2 outline-(--accent)')}>
        {c ? <CharacterTile {...tileProps(entry, c)} href={undefined} /> : <span className="block w-24 text-xs text-(--text-muted)">{entry.characterId} (không còn)</span>}
      </button>
    );
  };
  const zone = (area: Place['area'], list: number, entries: Entry[]) => (
    <div onDragOver={over} onDrop={drop({ area, list, index: entries.length })}
      className={cn('flex min-h-[112px] flex-wrap content-start gap-2 rounded-md border border-dashed border-(--border-color) p-2', area === 'team' && !canInsert(draft, area, list) && 'border-solid')}>
      {entries.map((e, i) => tile(e, { area, list, index: i }))}
      {!entries.length && <span className="self-center text-xs text-(--text-muted)">Kéo Khí Giả vào đây</span>}
    </div>
  );

  const selected = sel ? entriesOf(draft, sel.area, sel.list)[sel.index] : null;
  const toolbar = sel && selected && (
    <div className="sticky top-[49px] z-10 flex flex-wrap items-center gap-2 border-b border-(--border-color) bg-(--bg-main) px-4 py-2 text-sm lg:px-6">
      <b>{chars[selected.characterId]?.name_vi || chars[selected.characterId]?.name_cn || selected.characterId}</b>
      {sel.area === 'tier' && (
        <Select aria-label="Chuyển tới tier" value={sel.list} onChange={(e) => { const list = Number(e.target.value); set(moveEntry(draft, sel, { area: 'tier', list, index: draft.solo.tiers[list].entries.length })); setSel(null); }}>
          {draft.solo.tiers.map((t, i) => <option key={i} value={i}>Tier {t.label}</option>)}
        </Select>
      )}
      <Button variant="ghost" aria-label="Sang trái" disabled={sel.index === 0} onClick={() => { set(moveEntry(draft, sel, { ...sel, index: sel.index - 1 })); setSel({ ...sel, index: sel.index - 1 }); }}>←</Button>
      <Button variant="ghost" aria-label="Sang phải" disabled={sel.index >= entriesOf(draft, sel.area, sel.list).length - 1} onClick={() => { set(moveEntry(draft, sel, { ...sel, index: sel.index + 2 })); setSel({ ...sel, index: sel.index + 1 }); }}>→</Button>
      <Select aria-label="Trí Tri" value={selected.zhizhi ?? 0} onChange={(e) => set(updateEntry(draft, sel, { zhizhi: Number(e.target.value) || null }))}>
        <option value={0}>Không Z</option>{[1, 2, 3, 4, 5, 6].map((z) => <option key={z} value={z}>Z{z}</option>)}
      </Select>
      <label className="flex items-center gap-1"><input type="checkbox" disabled={!chars[selected.characterId]?.has_huanzhang} checked={Boolean(selected.hc)} onChange={(e) => set(updateEntry(draft, sel, { hc: e.target.checked }))} /> HC</label>
      {sel.area === 'tier' && <Button variant="ghost" onClick={() => set(duplicateEntry(draft, sel))}>Nhân bản</Button>}
      <Button variant="ghost" onClick={() => { set(removeEntry(draft, sel)); setSel(null); }}>Xoá khỏi danh sách</Button>
      <Button variant="ghost" className="ml-auto" onClick={() => setSel(null)}>Bỏ chọn</Button>
    </div>
  );

  const poolPanel = (
    <aside className="grid content-start gap-2 xl:sticky xl:top-[60px]">
      <SectionTitle>Khí Giả</SectionTitle>
      <input className={inputClass} placeholder="Tìm tên" value={pool.q} onChange={(e) => setPool({ ...pool, q: e.target.value })} aria-label="Tìm Khí Giả" />
      <div className="flex gap-2">
        <Select aria-label="Nghề" value={pool.job} onChange={(e) => setPool({ ...pool, job: Number(e.target.value) })}><option value={0}>Mọi nghề</option>{Object.entries(JOB_NAMES).map(([n, l]) => <option key={n} value={n}>{l}</option>)}</Select>
        <Select aria-label="Độ hiếm" value={pool.rare} onChange={(e) => setPool({ ...pool, rare: Number(e.target.value) })}><option value={0}>Mọi độ hiếm</option>{[4, 3, 2].map((r) => <option key={r} value={r}>{RARITY_LABELS[r]}</option>)}</Select>
      </div>
      {view === 'characters' && (
        <label className="text-xs text-(--text-muted)">Bấm một Khí Giả để thêm vào{' '}
          <Select aria-label="Tier nhận" value={target} onChange={(e) => setTarget(Number(e.target.value))}>{draft.solo.tiers.map((t, i) => <option key={i} value={i}>Tier {t.label}</option>)}</Select>
        </label>
      )}
      <div className="flex max-h-[60vh] flex-wrap gap-2 overflow-y-auto">
        {poolList.map((c) => (
          <button key={c.id} type="button" draggable onDragStart={dragStart({ from: 'pool', characterId: c.id })}
            onClick={() => {
              if (view === 'characters') { set(insertEntry(draft, { area: 'tier', list: target, index: draft.solo.tiers[target].entries.length }, { characterId: c.id })); return; }
              const i = draft.teams.groups.findIndex((g) => g.members.length < 6); // Đội hình: the first team with room
              if (i >= 0) set(insertEntry(draft, { area: 'team', list: i, index: draft.teams.groups[i].members.length }, { characterId: c.id }));
            }}>
            <CharacterTile {...tileProps({ characterId: c.id }, c)} href={undefined} />
          </button>
        ))}
      </div>
    </aside>
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-(--border-color) bg-(--bg-main) px-4 py-2 lg:px-6">
        <a href="#/admin/tier-lists" className="text-sm text-(--text-muted) hover:text-(--text-main)">← Tier List</a>
        <nav aria-label="Phần" className="flex gap-1">
          {VIEWS.map(([v, l]) => <button key={v} type="button" aria-current={v === view ? 'true' : undefined} onClick={() => { setView(v); setSel(null); }}
            className={cn('rounded-md px-3 py-1.5 text-[13px]', v === view ? 'bg-(--bg-elevated) text-(--text-main)' : 'text-(--text-muted) hover:text-(--text-main)')}>{l}</button>)}
        </nav>
        <span className="ml-auto text-xs text-(--text-muted)" role="status">{publish.state !== 'idle' ? publish.message : dirty ? 'Chưa lưu' : ''}</span>
        <Button variant="primary" disabled={busy || !dirty} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu'}</Button>
      </div>
      {toolbar}
      {problem && <Notice className="mx-4 mt-3 lg:mx-6">{problem}</Notice>}

      {view === 'preview' ? (
        <TierListView list={{ slug: row.slug, status: row.status === 'archived' ? 'archived' : 'published', updatedAt: row.updatedAt, doc: draft }} characters={chars} tab="characters" />
      ) : (
        <div className="grid gap-8 px-4 py-6 lg:px-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid content-start gap-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Tiêu đề"><input className={inputClass} maxLength={80} value={draft.title} onChange={(e) => set({ ...draft, title: e.target.value })} /></Field>
              <Field label="Tác giả (ghi công)"><input className={inputClass} maxLength={80} value={draft.author} onChange={(e) => set({ ...draft, author: e.target.value })} /></Field>
              <Field label="Link nguồn"><input className={inputClass} maxLength={300} value={draft.sourceUrl} onChange={(e) => set({ ...draft, sourceUrl: e.target.value })} /></Field>
            </div>
            {view === 'characters' && (
              <>
                <Field label="Ghi chú đầu tab Nhân vật"><textarea className={inputClass} rows={2} maxLength={1000} value={draft.solo.note} onChange={(e) => set({ ...draft, solo: { ...draft.solo, note: e.target.value } })} /></Field>
                {draft.solo.tiers.map((t, i) => (
                  <section key={i} className="grid gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <input className={cn(inputClass, 'w-20 font-serif text-lg')} maxLength={6} aria-label={`Nhãn tier ${i + 1}`} value={t.label} onChange={(e) => set(updateTier(draft, i, { label: e.target.value }))} />
                      {!t.joinAbove && <input className={cn(inputClass, 'min-w-[240px] flex-1')} maxLength={200} placeholder="Mô tả (tuỳ chọn)" aria-label={`Mô tả tier ${t.label}`} value={t.description} onChange={(e) => set(updateTier(draft, i, { description: e.target.value }))} />}
                      {i > 0 && <label className="flex items-center gap-1 text-xs text-(--text-muted)"><input type="checkbox" checked={t.joinAbove} onChange={(e) => set(updateTier(draft, i, { joinAbove: e.target.checked }))} /> Dùng chung mô tả với tier trên</label>}
                      <span className="ml-auto flex gap-1">
                        <Button variant="ghost" aria-label="Tier lên" disabled={i === 0} onClick={() => set(moveTier(draft, i, -1))}>↑</Button>
                        <Button variant="ghost" aria-label="Tier xuống" disabled={i === draft.solo.tiers.length - 1} onClick={() => set(moveTier(draft, i, 1))}>↓</Button>
                        <Button variant="ghost" disabled={draft.solo.tiers.length <= 1} onClick={() => (!t.entries.length || confirm(`Xoá tier ${t.label} và ${t.entries.length} ô của nó?`)) && set(removeTier(draft, i))}>Xoá tier</Button>
                      </span>
                    </div>
                    {zone('tier', i, t.entries)}
                  </section>
                ))}
                <Button variant="secondary" disabled={draft.solo.tiers.length >= 15} onClick={() => set(addTier(draft))}>+ Thêm tier</Button>
              </>
            )}
            {view === 'teams' && (
              <>
                <Field label="Ghi chú đầu tab Đội hình"><textarea className={inputClass} rows={2} maxLength={1000} value={draft.teams.note} onChange={(e) => set({ ...draft, teams: { ...draft.teams, note: e.target.value } })} /></Field>
                {draft.teams.groups.map((g, i) => (
                  <section key={i} className="grid gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <input className={cn(inputClass, 'min-w-[200px] flex-1')} maxLength={60} placeholder="Tên đội" aria-label={`Tên đội ${i + 1}`} value={g.name} onChange={(e) => set(updateTeam(draft, i, { name: e.target.value }))} />
                      <span className="text-xs text-(--text-muted)">{g.members.length}/6</span>
                      <Button variant="ghost" aria-label="Đội lên" disabled={i === 0} onClick={() => set(moveTeam(draft, i, -1))}>↑</Button>
                      <Button variant="ghost" aria-label="Đội xuống" disabled={i === draft.teams.groups.length - 1} onClick={() => set(moveTeam(draft, i, 1))}>↓</Button>
                      <Button variant="ghost" onClick={() => set(removeTeam(draft, i))}>Xoá đội</Button>
                    </div>
                    <input className={inputClass} maxLength={300} placeholder="Ghi chú (tuỳ chọn)" aria-label={`Ghi chú đội ${i + 1}`} value={g.note} onChange={(e) => set(updateTeam(draft, i, { note: e.target.value }))} />
                    {zone('team', i, g.members)}
                  </section>
                ))}
                <Button variant="secondary" disabled={draft.teams.groups.length >= 30} onClick={() => set(addTeam(draft))}>+ Thêm đội</Button>
              </>
            )}
            {view === 'info' && (
              <Field label="Thông tin" hint="Dòng trống = đoạn mới · dòng bắt đầu bằng “- ” = gạch đầu dòng · tab ẩn khi để trống">
                <textarea className={inputClass} rows={14} maxLength={5000} value={draft.info} onChange={(e) => set({ ...draft, info: e.target.value })} />
              </Field>
            )}
          </div>
          {view !== 'info' && poolPanel}
        </div>
      )}
    </div>
  );
}
