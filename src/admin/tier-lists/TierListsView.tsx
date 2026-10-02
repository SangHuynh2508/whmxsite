// Admin → Tier List: every list (title, slug, status, order) + "Tạo mới"; #/admin/tier-lists/<slug> opens the editor.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { cn } from '@/lib/utils';
import { Button, Field, Notice, Select, SkeletonRows, describeError, inputClass } from '../layout/ui';
import { lorePublisher } from '../characters/lorePublish';
import { createTierList, deleteTierList, listTierLists, saveTierList } from './tierListApi.js';
import { TierListEditor } from './TierListEditor';

type Row = { id: string; slug: string; status: 'draft' | 'published' | 'archived'; position: number; title: string; updatedAt: string; revision: number };
const STATUS_VI = { draft: 'Nháp', published: 'Công khai', archived: 'Lưu trữ (Cũ)' };
const slugFromHash = () => location.hash.match(/^#\/admin\/tier-lists\/([^/?]+)/)?.[1] ?? '';

export default function TierListsView({ isOwner }: { isOwner: boolean }) {
  const [slug, setSlug] = useState(slugFromHash);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [problem, setProblem] = useState('');
  const [form, setForm] = useState({ slug: '', title: '' });
  useEffect(() => { const on = () => setSlug(slugFromHash()); addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, []);
  const load = useCallback(async () => {
    try { setRows(((await listTierLists()) as { lists: Row[] }).lists); } catch (failure) { setProblem(describeError(failure)); }
  }, []);
  useEffect(() => { if (!slug) void load(); }, [slug, load]);
  if (slug) return <TierListEditor slug={slug} />;

  const run = async (work: () => Promise<unknown>) => {
    setProblem('');
    try { await work(); lorePublisher.schedule(); await load(); } catch (failure) { setProblem(describeError(failure)); }
  };
  const create = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => { await createTierList(form.slug.trim(), form.title.trim()); location.hash = `#/admin/tier-lists/${form.slug.trim()}`; });
  };
  if (!rows) return problem ? <Notice className="m-4">{problem}</Notice> : <SkeletonRows />;
  return (
    <div className="grid max-w-[900px] gap-6 overflow-y-auto px-4 py-6 lg:px-6">
      {problem && <Notice>{problem}</Notice>}
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-(--text-muted)"><tr><th className="py-2">Tiêu đề</th><th>Slug</th><th>Trạng thái</th><th>Thứ tự</th><th /></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="border-t border-(--border-color)">
              <td className="py-2"><a className="text-(--text-main) hover:underline" href={`#/admin/tier-lists/${r.slug}`}>{r.title}</a></td>
              <td className="font-mono text-xs text-(--text-muted)">{r.slug}</td>
              <td>
                <Select value={r.status} aria-label={`Trạng thái của ${r.title}`} onChange={(e) => run(() => saveTierList(r.slug, r.revision, { status: e.target.value }))}>
                  {Object.entries(STATUS_VI).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </td>
              <td className="whitespace-nowrap">
                <Button variant="ghost" aria-label="Lên" disabled={i === 0} onClick={() => run(() => saveTierList(r.slug, r.revision, { position: Math.max(0, rows[i - 1].position - 1) }))}>↑</Button>
                <Button variant="ghost" aria-label="Xuống" disabled={i === rows.length - 1} onClick={() => run(() => saveTierList(r.slug, r.revision, { position: rows[i + 1].position + 1 }))}>↓</Button>
              </td>
              <td className="text-right">{isOwner && <Button variant="ghost" onClick={() => confirm(`Xoá tier list "${r.title}"? Lịch sử vẫn giữ bản cuối.`) && run(() => deleteTierList(r.slug, r.revision))}>Xoá</Button>}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={5} className="py-6 text-(--text-muted)">Chưa có tier list nào.</td></tr>}
        </tbody>
      </table>
      <form onSubmit={create} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Tiêu đề"><input className={cn(inputClass, 'h-9')} required maxLength={80} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Slug · a-z, 0-9, dấu gạch · không đổi được"><input className={cn(inputClass, 'h-9')} required maxLength={40} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="tong-hop" title="a-z, 0-9 và dấu gạch, vd. tong-hop" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></Field>
        <Button variant="primary" type="submit">Tạo mới</Button>
      </form>
    </div>
  );
}
