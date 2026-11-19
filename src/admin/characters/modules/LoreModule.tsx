import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Notice, Select, SkeletonRows } from '../../layout/ui';
import { getLore, patchLore } from '../loreApi.js';
import { lorePublisher, usePublishStatus } from '../lorePublish';
import { useEditor } from '../useEditor';
import { useIsOwner } from '../useIsOwner';
import { inScope, loreUnitGroups, teaUnitGroups, termProgress, voiceUnitGroups, type Scope, type TeaStructure } from '../lib/loreUnits.mts';
import { loadVoiceDoc } from '../../../features/characters/voice/voiceData.mts';
import type { VoiceDoc } from '../../../features/characters/voice/voiceView.mts';
import { TAG_LABELS } from '../../../features/characters/lore/loreView.mts';
import { termHref } from '../lib/route.mts';
import { topVisible } from '../lib/scrollSpy.mts';
import { BilingualText, type LoreStatus } from '../components/BilingualText';
import { PairHead } from '../components/OverridableField';
import { SaveBar } from '../components/SaveBar';
import { HistoryList, type HistoryEntry } from '../components/HistoryList';
import { invalidateLoreProgress } from '../CharacterList';
import type { ModuleProps } from '../types';

type Unit = { unitKey: string; sourceCn: string; vi: string | null; viOrigin: 'admin' | 'legacy_workbook' | null; state: 'ok' | 'source_changed'; previousCn: string | null };
type TermView = { code: string; nameCn: string; nameVi: string | null; official: boolean; done: boolean } | null;
type Lore = {
  characterId: string;
  revision: number;
  structure: { reports: { fileId: string; kind: string; unlock?: { type: number; elementId: string } }[]; timeline: string[]; tea?: TeaStructure };
  units: Unit[];
  organisation: TermView;
  relic: { type: TermView; era: TermView; museum: TermView; eraRange: TermView } | null;
  relicTags: { field: string; term: TermView }[];
  affinity: Record<string, TermView>;
  teaTerms?: Record<string, TermView>;
  archiveImages: { url: string }[];
  history: HistoryEntry[];
};

const statusOf = (u: Unit): LoreStatus => (u.state === 'source_changed' ? 'changed' : u.viOrigin === 'legacy_workbook' ? 'legacy' : u.vi ? 'done' : 'todo');
const DOT: Record<LoreStatus, string> = { done: 'bg-(--text-muted)', legacy: 'bg-(--accent)', changed: 'bg-(--rarity-ssr-text)', todo: 'border border-(--text-muted)' };
const smooth = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

// Units as editor fields: `value` is the shown text (legacy / CN-changed text is pre-filled), `official` says
// whether it is already published — "Dùng bản này" / "Giữ bản dịch" turns an unofficial one into a change.
// One record, three modules (spec 2026-10-03 §7, voice-translation §6): Lore edits the archive units, Phòng trà the
// `tea.*` units, Lồng tiếng the `voice.*` units.
const TEXT: Record<Scope, { name: string; pick: string; nav: string; info: string; terms: string | null; empty: string }> = {
  lore: { name: 'Lore', pick: 'Chọn đoạn lore', nav: 'Các đoạn lore', info: 'Hiện vật và thuật ngữ', terms: 'Hiện vật', empty: '' },
  tea: { name: 'Phòng trà', pick: 'Chọn đoạn phòng trà', nav: 'Các đoạn phòng trà', info: 'Trà và thuật ngữ', terms: 'Trà yêu thích', empty: 'Nhân vật này chưa có dữ liệu phòng trà.' },
  voice: { name: 'Lồng tiếng', pick: 'Chọn câu thoại', nav: 'Các câu thoại', info: 'Lịch sử gần đây', terms: null, empty: 'Nhân vật này chưa có thoại.' },
};
const toRecord = (lore: Lore, scope: Scope) =>
  Object.fromEntries(lore.units.filter((u) => inScope(u.unitKey, scope)).map((u) => [u.unitKey, { value: u.vi ?? '', source: null, official: u.viOrigin === 'admin' && u.state === 'ok' }]));

export function LoreModule({ data, scope = 'lore' }: ModuleProps & { scope?: Scope }) {
  const id = data.character.characterId;
  const [lore, setLore] = useState<Lore | null>(null);
  const [error, setError] = useState(false);
  const reload = useCallback(async () => { const next: Lore = await getLore(id); setLore(next); return toRecord(next, scope); }, [id, scope]);
  useEffect(() => { reload().catch(() => setError(true)); }, [reload]);
  // Line order, labels and mp3 keys come from the tab's own file (public/voice/<ID>.json).
  const [voiceDoc, setVoiceDoc] = useState<VoiceDoc | null | undefined>(scope === 'voice' ? undefined : null);
  useEffect(() => { if (scope === 'voice') void loadVoiceDoc(id).then(setVoiceDoc); }, [id, scope]);

  const record = useMemo(() => (lore ? toRecord(lore, scope) : null), [lore, scope]);
  const keys = useMemo(() => lore?.units.filter((u) => inScope(u.unitKey, scope)).map((u) => u.unitKey) ?? [], [lore, scope]);
  const save = useCallback(
    (texts: Record<string, string | null>) => patchLore(id, { expectedRevision: lore?.revision, texts }).then(() => { invalidateLoreProgress(); lorePublisher.schedule(); }),
    [id, lore?.revision],
  );
  const peek = useCallback(() => getLore(id).then((l: Lore) => toRecord(l, scope)), [id, scope]);
  const editor = useEditor({ scope, id, record, keys, save, reload, peek });
  const publish = usePublishStatus();
  const isOwner = useIsOwner();

  const [pane, setPane] = useState<HTMLElement | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const [active, setActive] = useScrollSpy(pane, keys);
  useKeepVisible(navRef, active);

  if (error) return <Notice className="m-4">Không tải được lore của {id}.</Notice>;
  if (!lore || !record || voiceDoc === undefined) return <SkeletonRows />;

  const units = lore.units.filter((u) => inScope(u.unitKey, scope));
  const byKey = new Map(units.map((u) => [u.unitKey, u]));
  const skinName = (sid: string) => { const k = data.skins.find((x) => x.skinId === sid); return k?.skinNameVi.value || k?.skinNameCn || sid; };
  const groups = scope === 'tea' ? teaUnitGroups(lore.structure.tea, keys, lore.teaTerms ?? {})
    : scope === 'voice' ? voiceUnitGroups(voiceDoc ?? null, keys, skinName)
      : loreUnitGroups(lore.structure, keys, lore.affinity);
  const t = TEXT[scope];
  if (scope !== 'lore' && !groups.length) return <Notice className="m-4">{t.empty}</Notice>;
  const labels = Object.fromEntries(groups.flatMap((g) => g.items.map((i) => [i.unitKey, i.label])));
  const counts = units.reduce((c, u) => ({ ...c, [statusOf(u)]: c[statusOf(u)] + 1 }), { done: 0, legacy: 0, changed: 0, todo: 0 } as Record<LoreStatus, number>);
  const termRows: [string, TermView][] = scope === 'voice' ? [] : scope === 'tea'
    ? (lore.structure.tea?.teas ?? []).map((code, i): [string, TermView] => [`Trà ${i + 1}`, lore.teaTerms?.[code] ?? null])
    : [
    ['Loại', lore.relic?.type ?? null], ['Triều đại', lore.relic?.era ?? null], ['Bảo tàng', lore.relic?.museum ?? null], ['Giai đoạn', lore.relic?.eraRange ?? null],
    ...(lore.relicTags ?? []).map((t): [string, TermView] => [TAG_LABELS[t.field] ?? t.field, t.term]),
    ['Trực thuộc', lore.organisation],
  ];
  const terms = termProgress([...termRows.map(([, t]) => t), ...(scope === 'lore' ? Object.values(lore.affinity) : [])]);
  // The phone bar jumps without focusing: focusing the field would open the keyboard over the text being read.
  const jump = (unitKey: string, focus = true) => {
    document.getElementById(`pair-${unitKey}`)?.scrollIntoView({ behavior: smooth(), block: 'start' });
    if (focus) (document.getElementById(`vi-${unitKey}`) as HTMLTextAreaElement | null)?.focus({ preventScroll: true });
    setActive(unitKey);
  };
  const order = groups.flatMap((g) => g.items.map((i) => i.unitKey));
  const at = Math.max(0, order.indexOf(active ?? ''));
  const STATUS_NOTE: Record<LoreStatus, string> = { done: '', legacy: 'bản cũ', changed: 'đổi CN', todo: 'chưa dịch' };

  // Relic + shared terms + recent history: a column on wide screens, a collapsible block at the top of the editor below
  // 1280 px (owner 2026-09-28: on phones the column was hidden, so editors could not find where to translate the terms).
  const info = (
    <>
      {t.terms && <>
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[.12em] text-(--text-muted)">{t.terms}</h3>
      {scope === 'lore' && lore.archiveImages[0] && <img src={lore.archiveImages[0].url} alt="" loading="lazy" className="mb-3 aspect-square w-full max-w-64 rounded-md bg-(--bg-elevated) object-contain" />}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
        {termRows.map(([label, t]) => (
          <Fragment key={label}>
            <dt className="text-(--text-muted)">{label}</dt>
            <dd>{t ? <a href={termHref(t.code)} className="underline decoration-(--border-strong) underline-offset-4 hover:decoration-(--accent) max-md:inline-block max-md:py-3">{t.official && t.nameVi ? <>{t.nameVi}{!t.done && <span className="text-(--text-muted)"> (chưa dịch mô tả)</span>}</> : <><span lang="zh" className="admin-cn">{t.nameCn}</span> <span className="text-(--text-muted)">(chưa dịch)</span></>}</a> : '—'}</dd>
          </Fragment>
        ))}
      </dl>
      <p className="mt-2 text-xs text-(--text-muted)">Thuật ngữ dùng chung: bấm để sửa trong Từ điển, đổi cho mọi nhân vật.</p>
      </>}
      <h3 className={cn('mb-1 text-[11px] font-medium uppercase tracking-[.12em] text-(--text-muted)', t.terms && 'mt-5')}>Lịch sử gần đây</h3>
      <div className="-mx-4 [&_li]:px-4 [&_p]:px-4">
        <HistoryList entries={lore.history.filter((h) => h.eventType === 'human_edit').slice(0, 5)} labels={labels} />
      </div>
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none flex-wrap items-center gap-x-4 gap-y-1 border-b border-(--border-color) px-4 py-2 text-xs text-(--text-muted) lg:px-5">
        <span className="tabular-nums">{counts.done}/{units.length} đã lưu · {counts.legacy} bản cũ · {counts.changed} đổi CN · {counts.todo} chưa dịch{t.terms && <> · <span className={terms.done < terms.total ? 'text-(--accent)' : undefined}>thuật ngữ {terms.done}/{terms.total}</span></>}</span>
        <span role="status" className="ml-auto">{publish.state !== 'idle' && publish.message}</span>
        {isOwner && <Button variant="ghost" className="h-7 max-md:h-11" onClick={() => lorePublisher.now()} disabled={publish.state === 'publishing'}>Xuất bản ngay</Button>}
      </div>
      {/* Phones: one row under the record header — previous, a picker of every unit (grouped, status in words), next. */}
      <div className="sticky top-14 z-10 flex items-center gap-1 border-b border-(--border-color) bg-(--bg-main) px-1 py-1.5 md:hidden">
        <button type="button" aria-label="Đoạn trước" disabled={at === 0} onClick={() => jump(order[at - 1], false)}
          className="grid size-11 flex-none place-items-center text-(--text-muted) hover:text-(--text-main) disabled:opacity-40"><ChevronLeft size={20} aria-hidden /></button>
        <Select aria-label={t.pick} value={order[at]} onChange={(event) => jump(event.target.value, false)}
          className="min-w-0 flex-1 [&_select]:h-11">
          {groups.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.items.map((i) => {
                // The closed box shows the option's text ("… · chưa dịch"); the open list hides the " · " and puts the status on the right.
                const note = STATUS_NOTE[statusOf(byKey.get(i.unitKey)!)];
                return <option key={i.unitKey} value={i.unitKey}>
                  <span>{i.label}</span>{note && <><span className="admin-select-sep"> · </span><span className="admin-select-note">{note}</span></>}
                </option>;
              })}
            </optgroup>
          ))}
        </Select>
        <button type="button" aria-label="Đoạn sau" disabled={at === order.length - 1} onClick={() => jump(order[at + 1], false)}
          className="grid size-11 flex-none place-items-center text-(--text-muted) hover:text-(--text-main) disabled:opacity-40"><ChevronRight size={20} aria-hidden /></button>
      </div>
      <div className="min-h-0 flex-1 lg:grid lg:grid-cols-[260px_1fr] xl:grid-cols-[260px_1fr_280px]">
        <nav
          ref={navRef}
          aria-label={t.nav}
          className="relative z-10 bg-(--bg-main) [scrollbar-width:none] max-md:hidden max-lg:sticky max-lg:top-0 max-lg:flex max-lg:gap-1 max-lg:overflow-x-auto max-lg:border-b max-lg:border-(--border-color) max-lg:px-2 max-lg:py-1.5 lg:overflow-y-auto lg:border-r lg:border-(--border-color) lg:py-2.5"
        >
          {groups.map((g) => (
            <Fragment key={g.group}>
              <p className="px-4 pb-1.5 pt-3 text-[11px] uppercase tracking-[.12em] text-(--text-muted) max-lg:hidden">{g.group}</p>
              {g.items.map((i) => {
                const u = byKey.get(i.unitKey)!;
                return (
                  <button
                    key={i.unitKey}
                    type="button"
                    data-nav={i.unitKey}
                    aria-current={active === i.unitKey ? 'true' : undefined}
                    onClick={() => jump(i.unitKey)}
                    className={cn(
                      'flex shrink-0 items-start gap-2 border-transparent text-left transition-colors duration-(--motion-fast) hover:bg-(--bg-surface-hover)',
                      'max-lg:border-b-2 max-lg:px-2.5 max-lg:py-1.5 lg:w-full lg:border-l-2 lg:px-4 lg:py-1.5',
                      active === i.unitKey && 'border-(--accent) bg-(--accent-light)',
                    )}
                  >
                    <span aria-hidden className={cn('mt-1.5 size-[7px] shrink-0 rounded-full', DOT[statusOf(u)])} />
                    <span className="min-w-0">
                      <span className="block whitespace-nowrap text-[13px]">{i.label}</span>
                      <span lang="zh" className="admin-cn block max-w-[190px] truncate text-xs text-(--text-muted) max-lg:hidden">{u.sourceCn.slice(0, 24)}</span>
                    </span>
                  </button>
                );
              })}
            </Fragment>
          ))}
        </nav>

        <section
          ref={setPane}
          aria-label={t.name}
          onFocus={(event) => { const unit = (event.target as HTMLElement).closest<HTMLElement>('[data-unit]')?.dataset.unit; if (unit) setActive(unit); }}
          className="max-lg:pb-16 lg:h-full lg:overflow-y-auto"
        >
          <details className="border-b border-(--border-color) px-4 py-3 text-[13px] max-md:py-0 max-md:open:pb-3 md:px-8 xl:hidden">
            <summary className="cursor-pointer text-(--text-muted) max-md:py-3">{t.info}{t.terms && <> · <span className={terms.done < terms.total ? 'text-(--accent)' : undefined}>thuật ngữ {terms.done}/{terms.total}</span></>}</summary>
            <div className="mt-3">{info}</div>
          </details>
          <PairHead />
          {groups.map((g) => (
            <Fragment key={g.group}>
              <h3 className="border-t border-(--border-color) px-4 pb-1 pt-6 text-[13px] uppercase tracking-[.3em] text-(--accent) first-of-type:border-t-0 md:px-8">{g.group}</h3>
              {g.items.map((i) => {
                const u = byKey.get(i.unitKey)!;
                return (
                  <BilingualText
                    key={i.unitKey}
                    unitKey={i.unitKey}
                    label={i.label}
                    extra={i.extra}
                    audio={i.audio}
                    cn={u.sourceCn}
                    previousCn={u.previousCn}
                    value={editor.draft[i.unitKey] ?? ''}
                    status={statusOf(u)}
                    dirty={i.unitKey in editor.changes}
                    confirmed={editor.confirmed.includes(i.unitKey)}
                    onChange={(v) => editor.setField(i.unitKey, v)}
                    onConfirm={() => editor.confirm(i.unitKey)}
                  />
                );
              })}
            </Fragment>
          ))}
        </section>

        <aside aria-label={t.info} className="overflow-y-auto border-l border-(--border-color) px-4 py-4 text-[13px] max-xl:hidden">{info}</aside>
      </div>
      <SaveBar {...editor} labels={labels} />
    </div>
  );
}

// The unit whose row is at the top of the editor is the active one (the left list follows the scroll).
function useScrollSpy(pane: HTMLElement | null, keys: string[]) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!pane || !keys.length) return;
    const wide = matchMedia('(min-width: 1024px)').matches; // the pane scrolls on its own only on wide screens
    const edge = matchMedia('(max-width: 767.98px)').matches ? 112 : 48; // phones: record header + unit bar
    const visible = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      const line = (wide ? pane.getBoundingClientRect().top : 0) + edge;
      const unit = (topVisible(visible, entries, (el) => el.getBoundingClientRect().top, line) as HTMLElement | undefined)?.dataset.unit;
      if (unit) setActive(unit);
    }, { root: wide ? pane : null, rootMargin: `-${edge}px 0px -60% 0px` });
    pane.querySelectorAll('[data-unit]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [pane, keys]);
  return [active, setActive] as const;
}

// Keep the active item visible inside the unit list by scrolling only the list (scrollIntoView would
// cancel the page's smooth jump).
function useKeepVisible(navRef: React.RefObject<HTMLElement | null>, active: string | null) {
  useEffect(() => {
    const nav = navRef.current;
    const item = active ? nav?.querySelector<HTMLElement>(`[data-nav="${CSS.escape(active)}"]`) : null;
    if (!nav || !item) return;
    if (nav.scrollWidth > nav.clientWidth) nav.scrollLeft = item.offsetLeft - (nav.clientWidth - item.offsetWidth) / 2;
    else if (item.offsetTop < nav.scrollTop || item.offsetTop + item.offsetHeight > nav.scrollTop + nav.clientHeight) nav.scrollTop = item.offsetTop - nav.clientHeight / 3;
  }, [navRef, active]);
}
