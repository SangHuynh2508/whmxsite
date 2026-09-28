import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button, Field, Notice, SectionTitle, Select, SkeletonRows, describeError, inputClass, statusOf } from '../../layout/ui';
import { loadGameData } from '../../../data/loader.js';
import { createBuild, deleteBuild, getBuilds, saveBuild } from '../buildApi.js';
import { lorePublisher, usePublishStatus } from '../lorePublish';
import { MAX_COLUMN, MAX_DEEPENS, MAX_TOTAL, MAX_WEAPONS, addDeepen, addWeapon, buildErrors, emptyBuild, move, sameDoc, setPoint, totalPoints, type BuildDoc } from '../lib/buildDoc.mts';
import type { ModuleProps } from '../types';

// Shapes of GET /api/admin/builds/characters/:id (server/builds/build-editor.mjs).
type Name = { cn: string; vi: string | null };
type Editor = {
  character: { id: string; job: number | null; styleIds: string[]; recommendedStyleId: string | null };
  builds: { id: string; revision: number; doc: BuildDoc }[];
  catalogue: {
    weapons: { id: string; rare: number; icon: string | null; name: Name; skills: { id: string; name: Name; detail: Name }[] }[];
    affixes: { id: string; percent: boolean; name: Name }[];
    styles: { id: string; name: Name; sectors: { id: string; name: Name; talents: { id: string; text: Name }[][] }[] }[];
  };
};
// Skills and character names come from the site's own data.json (same source the public tab uses).
type Site = { skills: { id: string; name: string }[]; characters: { id: string; name: string }[] };
type DirtyFlag = { __whmxAdminDirty?: boolean };

const nm = (n: Name | undefined) => n?.vi || n?.cn || '';
const withDefaults = (doc: Partial<BuildDoc>): BuildDoc => ({ ...emptyBuild(null), ...doc });

async function loadSite(characterId: string): Promise<Site> {
  const data = await loadGameData();
  const all = Object.values(data.characters) as { id: string; name_vi?: string; name_cn?: string; skills?: { group_id: string; levels?: { name_vi?: string; name_cn?: string }[] }[] }[];
  return {
    skills: (data.characters[characterId]?.skills ?? []).map((s: { group_id: string; levels?: { name_vi?: string; name_cn?: string }[] }) => ({ id: s.group_id, name: s.levels?.[0]?.name_vi || s.levels?.[0]?.name_cn || s.group_id })),
    characters: all.map((c) => ({ id: c.id, name: c.name_vi || c.name_cn || c.id })).sort((a, b) => a.name.localeCompare(b.name, 'vi')),
  };
}

// Build module: the character's builds as tabs; everything is picked from game data, only labels/notes are typed.
export function BuildModule({ data }: ModuleProps) {
  const id = data.character.characterId;
  const [editor, setEditor] = useState<Editor | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [active, setActive] = useState(0); // index into editor.builds; builds.length = a new, unsaved build
  const [draft, setDraft] = useState<BuildDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ReactNode>(null);
  const [loadError, setLoadError] = useState(false);
  const publish = usePublishStatus();

  const open = useCallback((next: Editor, index: number) => {
    setEditor(next);
    setActive(index);
    const build = next.builds[index];
    setDraft(build ? withDefaults(build.doc) : emptyBuild(next.character.recommendedStyleId));
  }, []);
  const load = useCallback(async (index = 0) => {
    setLoadError(false);
    try {
      const [next, nextSite] = await Promise.all([getBuilds(id) as Promise<Editor>, loadSite(id)]);
      setSite(nextSite);
      open(next, Math.min(index, next.builds.length));
    } catch { setLoadError(true); }
  }, [id, open]);
  useEffect(() => { void load(); }, [load]);

  const current = editor?.builds[active];
  const baseline = useMemo(() => (editor ? (current ? withDefaults(current.doc) : emptyBuild(editor.character.recommendedStyleId)) : null), [editor, current]);
  const dirty = Boolean(draft && baseline && !sameDoc(draft, baseline));

  // Same leave-page guard as the other modules (AdminApp's capture listener reads the flag).
  useEffect(() => {
    (window as DirtyFlag).__whmxAdminDirty = dirty;
    const onUnload = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    addEventListener('beforeunload', onUnload);
    return () => { removeEventListener('beforeunload', onUnload); (window as DirtyFlag).__whmxAdminDirty = false; };
  }, [dirty]);

  if (loadError) return <Notice className="m-4">Không tải được build của {id}. <Button variant="ghost" onClick={() => load(active)}>Thử lại</Button></Notice>;
  if (!editor || !site || !draft) return <SkeletonRows />;

  const choose = (index: number) => {
    if (index === active) return;
    if (dirty && !confirm('Có thay đổi chưa lưu. Bỏ và mở build khác?')) return;
    setProblem(null);
    open(editor, index);
  };
  const upd = (patch: Partial<BuildDoc>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const save = async () => {
    setBusy(true);
    setProblem(null);
    const doc = { ...draft, tips: draft.tips.map((t) => t.trim()).filter(Boolean) };
    try {
      if (current) await saveBuild(current.id, current.revision, doc);
      else await createBuild(id, doc);
      lorePublisher.schedule();
      await load(active);
    } catch (failure) {
      const details = (failure as { payload?: { error?: { details?: { path: string; code: string }[] } } }).payload?.error?.details;
      if (details) setProblem(<ul className="list-disc pl-5">{buildErrors(details).map((line) => <li key={line}>{line}</li>)}</ul>);
      else if (statusOf(failure) === 409) setProblem(<>Build này vừa được lưu ở nơi khác. <Button variant="ghost" onClick={() => load(active)}>Tải bản mới</Button> (thay đổi của bạn sẽ mất)</>);
      else setProblem(describeError(failure));
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!current || !confirm(`Xoá build "${current.doc.name || `Build ${active + 1}`}"? Lịch sử vẫn giữ bản cuối.`)) return;
    setBusy(true);
    try { await deleteBuild(current.id, current.revision); lorePublisher.schedule(); await load(0); }
    catch (failure) { setProblem(describeError(failure)); }
    finally { setBusy(false); }
  };

  const { catalogue } = editor;
  const weaponOf = (weaponId: string) => catalogue.weapons.find((w) => w.id === weaponId);
  const styleOf = (styleId: string | undefined) => catalogue.styles.find((s) => s.id === styleId);
  const skillName = (skillId: string) => site.skills.find((s) => s.id === skillId)?.name ?? skillId;
  const characterName = (characterId: string) => site.characters.find((c) => c.id === characterId)?.name ?? characterId;
  const tabs = [...editor.builds.map((b, i) => b.doc.name || `Build ${i + 1}`), ...(active === editor.builds.length ? ['Build mới'] : [])];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-(--border-color) bg-(--bg-main) px-4 py-2 lg:px-6">
        <nav aria-label="Các build" className="flex flex-wrap gap-1">
          {tabs.map((label, i) => (
            <button key={i} type="button" aria-current={i === active ? 'true' : undefined} onClick={() => choose(i)}
              className={cn('rounded-md px-3 py-1.5 text-[13px]', i === active ? 'bg-(--bg-elevated) text-(--text-main)' : 'text-(--text-muted) hover:text-(--text-main)')}>
              {label}
            </button>
          ))}
          {active !== editor.builds.length && <Button variant="ghost" onClick={() => choose(editor.builds.length)}>+ Thêm build</Button>}
        </nav>
        <span className="ml-auto text-xs text-(--text-subtle)" role="status">{publish.state !== 'idle' ? publish.message : dirty ? 'Chưa lưu' : ''}</span>
        {current && <Button variant="ghost" disabled={busy} onClick={remove}>Xoá build</Button>}
        <Button variant="primary" disabled={busy || !dirty} onClick={save}>{busy ? 'Đang lưu…' : current ? 'Lưu' : 'Tạo build'}</Button>
      </div>
      {problem && <Notice className="mx-4 mt-3 lg:mx-6">{problem}</Notice>}

      <div className="grid max-w-[1100px] gap-10 px-4 py-6 lg:px-6">
        <section>
          <SectionTitle>Thông tin</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <Field label="Tên build (tab)"><input className={cn(inputClass, 'h-9')} value={draft.name} maxLength={60} onChange={(e) => upd({ name: e.target.value })} placeholder="Chuẩn, Boss…" /></Field>
            <Field label="Đánh giá"><input className={cn(inputClass, 'h-9')} value={draft.rating} maxLength={20} onChange={(e) => upd({ rating: e.target.value })} placeholder="S, 9/10…" /></Field>
          </div>
          <Field label="Tóm tắt" className="mt-3"><textarea className={cn(inputClass, 'min-h-20 py-2')} value={draft.summary} maxLength={2000} onChange={(e) => upd({ summary: e.target.value })} /></Field>
        </section>

        <section>
          <SectionTitle aside={<span className="text-xs text-(--text-subtle)">{draft.weapons.length}/{MAX_WEAPONS}</span>}>Vũ khí</SectionTitle>
          {draft.weapons.map((w, i) => {
            const weapon = weaponOf(w.weaponId);
            const set = (patch: Partial<typeof w>) => upd({ weapons: draft.weapons.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className="mb-3 grid gap-2 border-b border-(--border-color) pb-3 sm:grid-cols-[2fr_1fr_auto]">
                <span className="flex items-center gap-2">
                  {weapon?.icon && <img src={`/assets/items/${weapon.icon}.png`} alt="" className="size-9 flex-none object-contain" />}
                  <Select aria-label={`Vũ khí ${i + 1}`} value={w.weaponId} onChange={(e) => set({ weaponId: e.target.value })}>
                    {!weapon && <option value={w.weaponId}>{w.weaponId} (không có trong danh sách)</option>}
                    {catalogue.weapons.map((x) => <option key={x.id} value={x.id}>★{x.rare} · {nm(x.name)}</option>)}
                  </Select>
                </span>
                <input aria-label={`Nhãn vũ khí ${i + 1}`} className={cn(inputClass, 'h-9')} value={w.label} maxLength={60} placeholder="Chịu đòn, Hồi năng…" onChange={(e) => set({ label: e.target.value })} />
                <span className="flex gap-1">
                  <Button variant="ghost" aria-label="Lên" onClick={() => upd({ weapons: move(draft.weapons, i, -1) })}>↑</Button>
                  <Button variant="ghost" aria-label="Xuống" onClick={() => upd({ weapons: move(draft.weapons, i, 1) })}>↓</Button>
                  <Button variant="ghost" aria-label="Bỏ" onClick={() => upd({ weapons: draft.weapons.filter((_, j) => j !== i) })}>✕</Button>
                </span>
                {weapon?.skills.map((s) => <p key={s.id} className="text-xs text-(--text-muted) sm:col-span-3"><b className="font-medium text-(--text-main)">{nm(s.name)}</b> — {nm(s.detail)}</p>)}
              </div>
            );
          })}
          <Adder label="Thêm vũ khí…" disabled={draft.weapons.length >= MAX_WEAPONS} options={catalogue.weapons.map((x) => [x.id, `★${x.rare} · ${nm(x.name)}`])} onAdd={(weaponId) => setDraft(addWeapon(draft, weaponId))} />
          {!catalogue.weapons.length && <p className="text-sm text-(--text-subtle)">Chưa có dữ liệu vũ khí (chạy importer kho game).</p>}
        </section>

        <section>
          <SectionTitle>Dòng thuộc tính</SectionTitle>
          <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.affixes.noReroll} onChange={(e) => upd({ affixes: { ...draft.affixes, noReroll: e.target.checked } })} /> Không cần tẩy luyện vũ khí</label>
          {draft.affixes.groups.map((g, i) => {
            const set = (patch: Partial<typeof g>) => upd({ affixes: { ...draft.affixes, groups: draft.affixes.groups.map((x, j) => (j === i ? { ...x, ...patch } : x)) } });
            return (
              <div key={i} className="mb-3 grid gap-2 border-b border-(--border-color) pb-3">
                <span className="flex gap-2">
                  <input aria-label={`Nhãn nhóm ${i + 1}`} className={cn(inputClass, 'h-9')} value={g.label} maxLength={60} placeholder="Ưu tiên, Thay thế…" onChange={(e) => set({ label: e.target.value })} />
                  <Button variant="ghost" onClick={() => upd({ affixes: { ...draft.affixes, groups: draft.affixes.groups.filter((_, j) => j !== i) } })}>Bỏ nhóm</Button>
                </span>
                <Chips items={g.affixIds.map((a) => [a, nm(catalogue.affixes.find((x) => x.id === a)?.name) || a])} onRemove={(k) => set({ affixIds: g.affixIds.filter((_, j) => j !== k) })} onMove={(k, d) => set({ affixIds: move(g.affixIds, k, d) })} />
                <Adder label="Thêm dòng…" options={catalogue.affixes.map((x) => [x.id, `${nm(x.name)}${x.percent ? ' %' : ''}`])} onAdd={(a) => set({ affixIds: [...g.affixIds, a] })} />
              </div>
            );
          })}
          <Button onClick={() => upd({ affixes: { ...draft.affixes, groups: [...draft.affixes.groups, { label: '', affixIds: [] }] } })}>+ Thêm nhóm</Button>
        </section>

        <section>
          <SectionTitle>Thâm tạo</SectionTitle>
          {draft.deepens.map((d, n) => {
            const set = (patch: Partial<typeof d>) => upd({ deepens: draft.deepens.map((x, j) => (j === n ? { ...x, ...patch } : x)) });
            return (
              <div key={n} className="mb-3 grid gap-3 border-b border-(--border-color) pb-3">
                <span className="flex flex-wrap items-center gap-2">
                  <input aria-label={`Nhãn thâm tạo ${n + 1}`} className={cn(inputClass, 'h-9 max-w-48')} value={d.label} maxLength={60} placeholder="Chuẩn, Lục Trí…" onChange={(e) => set({ label: e.target.value })} />
                  <Select aria-label={`Hướng thâm tạo ${n + 1}`} className="max-w-sm" value={d.styleId} onChange={(e) => set({ styleId: e.target.value })}>
                    {catalogue.styles.map((s) => <option key={s.id} value={s.id}>{nm(s.name)}{s.id === editor.character.recommendedStyleId ? ' (game gợi ý)' : ''}</option>)}
                  </Select>
                  <span className={cn('text-xs', totalPoints(d) === MAX_TOTAL ? 'text-(--accent)' : 'text-(--text-subtle)')}>{totalPoints(d)}/{MAX_TOTAL} điểm</span>
                  <Button variant="ghost" onClick={() => upd({ deepens: draft.deepens.filter((_, j) => j !== n) })}>Bỏ</Button>
                </span>
                <div className="grid gap-3 sm:grid-cols-4">
                  {(styleOf(d.styleId)?.sectors ?? []).map((sector, i) => (
                    <Field key={sector.id} label={nm(sector.name)}
                      hint={<span className="grid gap-0.5">{sector.talents.map((point, p) => <span key={p} className={p < (d.points[i] ?? 0) ? 'text-(--text-main)' : undefined}>{p + 1}. {point.map((t) => nm(t.text)).join(' / ')}</span>)}</span>}>
                      <input type="number" min={0} max={MAX_COLUMN} aria-label={`Thâm tạo ${n + 1} · ${nm(sector.name)}`} className={cn(inputClass, 'h-9')} value={d.points[i] ?? 0} onChange={(e) => setDraft(setPoint(draft, n, i, Number(e.target.value)))} />
                    </Field>
                  ))}
                </div>
              </div>
            );
          })}
          <Button disabled={draft.deepens.length >= MAX_DEEPENS || !catalogue.styles.length}
            onClick={() => setDraft(addDeepen(draft, editor.character.recommendedStyleId ?? catalogue.styles[0].id))}>+ Thêm thâm tạo</Button>
        </section>

        <section>
          <SectionTitle>Xoay vòng kỹ năng</SectionTitle>
          {draft.rotations.map((r, i) => {
            const set = (patch: Partial<typeof r>) => upd({ rotations: draft.rotations.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            const setStep = (k: number, note: string) => set({ steps: r.steps.map((s, j) => (j === k ? { ...s, note } : s)) });
            return (
              <div key={i} className="mb-3 grid gap-2 border-b border-(--border-color) pb-3">
                <span className="flex gap-2">
                  <input aria-label={`Nhãn xoay vòng ${i + 1}`} className={cn(inputClass, 'h-9')} value={r.label} maxLength={60} placeholder="Lượt đầu, Tam Trí…" onChange={(e) => set({ label: e.target.value })} />
                  <Button variant="ghost" onClick={() => upd({ rotations: draft.rotations.filter((_, j) => j !== i) })}>Bỏ</Button>
                </span>
                <textarea aria-label={`Ghi chú xoay vòng ${i + 1}`} className={cn(inputClass, 'min-h-16 py-2')} value={r.note} maxLength={500} placeholder="Ghi chú cho cả vòng (tuỳ chọn): điều kiện, lượt đầu…" onChange={(e) => set({ note: e.target.value })} />
                <Chips items={r.steps.map((s) => [s.skillId, skillName(s.skillId)])} onRemove={(k) => set({ steps: r.steps.filter((_, j) => j !== k) })} onMove={(k, d) => set({ steps: move(r.steps, k, d) })} />
                {r.steps.map((s, k) => (
                  <label key={k} className="flex items-center gap-2 text-xs text-(--text-muted)">
                    <span className="w-44 truncate">{k + 1}. {skillName(s.skillId)}</span>
                    <input aria-label={`Ghi chú bước ${k + 1} của xoay vòng ${i + 1}`} className={cn(inputClass, 'h-8')} value={s.note} maxLength={60} placeholder="Ghi chú bước (tuỳ chọn), vd: dùng lên Thố Động" onChange={(e) => setStep(k, e.target.value)} />
                  </label>
                ))}
                <Adder label="Thêm kỹ năng…" options={site.skills.map((s) => [s.id, s.name])} onAdd={(s) => set({ steps: [...r.steps, { skillId: s, note: '' }] })} />
              </div>
            );
          })}
          <Button onClick={() => upd({ rotations: [...draft.rotations, { label: '', note: '', steps: [] }] })}>+ Thêm xoay vòng</Button>
          <Field label="Mẹo (mỗi dòng một mẹo)" className="mt-4"><textarea className={cn(inputClass, 'min-h-24 py-2')} value={draft.tips.join('\n')} onChange={(e) => upd({ tips: e.target.value.split('\n') })} /></Field>
        </section>

        <section>
          <SectionTitle>Đội hình</SectionTitle>
          {draft.teams.map((t, i) => {
            const set = (patch: Partial<typeof t>) => upd({ teams: draft.teams.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className="mb-3 grid gap-2 border-b border-(--border-color) pb-3">
                <span className="flex gap-2">
                  <input aria-label={`Tên đội ${i + 1}`} className={cn(inputClass, 'h-9')} value={t.label} maxLength={60} placeholder="Đội chính…" onChange={(e) => set({ label: e.target.value })} />
                  <Button variant="ghost" onClick={() => upd({ teams: draft.teams.filter((_, j) => j !== i) })}>Bỏ đội</Button>
                </span>
                <Chips items={t.characterIds.map((c) => [c, characterName(c)])} onRemove={(k) => set({ characterIds: t.characterIds.filter((_, j) => j !== k) })} onMove={(k, d) => set({ characterIds: move(t.characterIds, k, d) })} />
                <Adder label="Thêm nhân vật…" options={site.characters.map((c) => [c.id, c.name])} onAdd={(c) => set({ characterIds: [...t.characterIds, c] })} />
                <input aria-label={`Ghi chú đội ${i + 1}`} className={cn(inputClass, 'h-9')} value={t.note} maxLength={500} placeholder="Ghi chú" onChange={(e) => set({ note: e.target.value })} />
              </div>
            );
          })}
          <Button onClick={() => upd({ teams: [...draft.teams, { label: '', characterIds: [], note: '' }] })}>+ Thêm đội hình</Button>
          <Field label="Khác" className="mt-4"><input className={cn(inputClass, 'h-9')} value={draft.teamOther} maxLength={500} onChange={(e) => upd({ teamOther: e.target.value })} /></Field>
        </section>
      </div>
    </div>
  );
}

// A select that adds the picked option and resets to its placeholder.
function Adder({ label, options, onAdd, disabled }: { label: string; options: [string, string][]; onAdd: (value: string) => void; disabled?: boolean }) {
  return (
    <Select aria-label={label} className="max-w-sm" value="" disabled={disabled} onChange={(e) => { if (e.target.value) onAdd(e.target.value); }}>
      <option value="">{label}</option>
      {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
    </Select>
  );
}

// Ordered picks: ← → reorder, ✕ removes.
function Chips({ items, onRemove, onMove }: { items: [string, string][]; onRemove: (index: number) => void; onMove: (index: number, delta: number) => void }) {
  if (!items.length) return null;
  return (
    <ol className="flex flex-wrap gap-1.5">
      {items.map(([key, text], i) => (
        <li key={`${key}-${i}`} className="flex items-center gap-1 rounded-md border border-(--border-color) bg-(--bg-surface) px-2 py-1 text-[13px]">
          <button type="button" aria-label="Lùi" className="text-(--text-subtle) hover:text-(--text-main)" onClick={() => onMove(i, -1)}>‹</button>
          {text}
          <button type="button" aria-label="Tiến" className="text-(--text-subtle) hover:text-(--text-main)" onClick={() => onMove(i, 1)}>›</button>
          <button type="button" aria-label={`Bỏ ${text}`} className="ml-1 text-(--text-subtle) hover:text-(--text-main)" onClick={() => onRemove(i)}>✕</button>
        </li>
      ))}
    </ol>
  );
}
