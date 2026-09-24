import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Plus, RefreshCw, Search, X } from 'lucide-react';
import { LIFECYCLES, VISIBILITIES, listPreviews, getPreview, createPreview } from './previewApi.js';
import { cn } from '@/lib/utils';
import { Button, LifecycleGlyph, Notice, Select, SkeletonRows, ViewHeader, inputClass, describeError, LIFECYCLE_VI, VISIBILITY_VI } from '@/ui';
import PreviewDetail, { MetadataFields, JSON_ERROR, parseMetadataForm, type Preview } from './PreviewDetail';

type Detail = { status: 'loading' | 'error' | 'ready'; preview?: Preview; reloadFailed?: boolean };
const DISCARD_PROMPT = 'Hồ sơ đang mở có thay đổi chưa lưu. Bỏ các thay đổi đó?';

export default function PreviewView({ isOwner }: { isOwner: boolean }) {
  const [q, setQ] = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [visibility, setVisibility] = useState('');
  const [items, setItems] = useState<Preview[] | null>(null);
  const [listError, setListError] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [reloading, setReloading] = useState(false);
  const [focus, setFocus] = useState(false);
  const dirtyRef = useRef(false);
  const listSeq = useRef(0);
  const detailSeq = useRef(0);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const loadList = useCallback(async () => {
    const seq = ++listSeq.current;
    setListLoading(true);
    try {
      const data: Preview[] = await listPreviews({ q: q.trim(), lifecycle, visibility });
      if (seq !== listSeq.current) return;
      setItems(data);
      setListError(false);
    } catch {
      if (seq === listSeq.current) setListError(true);
    } finally {
      if (seq === listSeq.current) setListLoading(false);
    }
  }, [q, lifecycle, visibility]);

  // Debounced for typing; selects go through the same path (250 ms is imperceptible there).
  useEffect(() => {
    const timer = setTimeout(() => void loadList(), 250);
    return () => clearTimeout(timer);
  }, [loadList]);

  const loadDetail = useCallback(async (id: string, quiet = false) => {
    const seq = ++detailSeq.current;
    if (quiet) setReloading(true);
    else setDetail({ status: 'loading' });
    try {
      const preview: Preview = await getPreview(id);
      if (seq === detailSeq.current) setDetail({ status: 'ready', preview });
    } catch {
      // A failed quiet reload keeps the open record (and any draft in it) on screen.
      if (seq === detailSeq.current) setDetail((current) => (quiet && current?.preview ? { ...current, reloadFailed: true } : { status: 'error' }));
    } finally {
      if (seq === detailSeq.current) setReloading(false);
    }
  }, []);

  function select(id: string | null) {
    if (id === selectedId) return;
    if (dirtyRef.current && !window.confirm(DISCARD_PROMPT)) return;
    dirtyRef.current = false;
    setSelectedId(id);
    if (id) void loadDetail(id);
    else setDetail(null);
  }

  async function reloadOpen() {
    if (!selectedId) return;
    await loadDetail(selectedId, true);
    void loadList();
  }

  const filtered = Boolean(q.trim() || lifecycle || visibility);
  const groupKeys = [...new Set<string>([...LIFECYCLES, ...(items || []).map((item) => item.lifecycle)])];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader title="Preview" meta={items && !listError ? `${items.length} bản ghi${filtered ? ' khớp bộ lọc' : ''}` : undefined}>
        <Button variant="ghost" aria-label="Tải lại danh sách" title="Tải lại danh sách" onClick={() => void loadList()} className="px-2">
          <RefreshCw size={15} aria-hidden className={listLoading && items ? 'animate-spin' : ''} />
        </Button>
        <Button variant="secondary" onClick={() => dialogRef.current?.showModal()}>
          <Plus size={15} aria-hidden /> Preview mới
        </Button>
      </ViewHeader>

      <div className="flex min-h-0 flex-1">
        {/* List pane — stays put while a record is open (split view). */}
        <section aria-label="Danh sách Preview" className={cn('w-full flex-col border-(--border-color) bg-(--bg-surface) lg:w-[360px] lg:shrink-0 lg:border-r', selectedId ? 'flex max-lg:hidden' : 'flex', focus && selectedId && 'lg:hidden')}>
          <div className="grid shrink-0 gap-2 border-b border-(--border-color) p-3">
            <label className="relative block">
              <span className="sr-only">Tìm theo tên hoặc mã nhân vật</span>
              <Search size={15} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-(--text-muted)" />
              <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Tìm tên / mã nhân vật" className={cn(inputClass, 'h-9 pl-8')} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Select aria-label="Lọc theo vòng đời" value={lifecycle} onChange={(event) => setLifecycle(event.target.value)}>
                <option value="">Mọi vòng đời</option>
                {LIFECYCLES.map((item) => <option key={item} value={item}>{LIFECYCLE_VI[item]} · {item}</option>)}
              </Select>
              <Select aria-label="Lọc theo hiển thị" value={visibility} onChange={(event) => setVisibility(event.target.value)}>
                <option value="">Mọi hiển thị</option>
                {VISIBILITIES.map((item) => <option key={item} value={item}>{VISIBILITY_VI[item]} · {item}</option>)}
              </Select>
            </div>
          </div>

          <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {listError ? (
              <div className="grid justify-items-start gap-3 p-4">
                <Notice>Không thể tải Preview Characters.</Notice>
                <Button onClick={() => void loadList()}>Thử lại</Button>
              </div>
            ) : !items ? (
              <SkeletonRows />
            ) : !items.length ? (
              <div className="grid justify-items-start gap-3 px-4 py-8">
                <p className="text-sm text-(--text-main)">{filtered ? 'Không có bản ghi nào khớp bộ lọc.' : 'Chưa có Preview Character nào.'}</p>
                {filtered ? (
                  <Button onClick={() => { setQ(''); setLifecycle(''); setVisibility(''); }}>Xoá bộ lọc</Button>
                ) : (
                  <Button onClick={() => dialogRef.current?.showModal()}><Plus size={15} aria-hidden /> Tạo bản nháp đầu tiên</Button>
                )}
              </div>
            ) : (
              groupKeys.map((key) => {
                const rows = items.filter((item) => item.lifecycle === key);
                if (!rows.length) return null;
                return (
                  <div key={key} role="group" aria-label={LIFECYCLE_VI[key] ?? key}>
                    <div className="sticky top-0 z-[1] flex h-9 items-center gap-2 border-b border-(--border-color) bg-(--bg-main) px-4 text-[13px] font-semibold text-(--text-main)">
                      <LifecycleGlyph lifecycle={key} />
                      {LIFECYCLE_VI[key] ?? key}
                      <span className="admin-num font-normal text-(--text-muted)">{rows.length}</span>
                    </div>
                    <ul>
                      {rows.map((item) => <Row key={item.entityId} item={item} selected={item.entityId === selectedId} onSelect={() => select(item.entityId)} />)}
                    </ul>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Record pane */}
        <section aria-label="Hồ sơ Preview" className={cn('min-w-0 flex-1 bg-(--bg-surface) lg:overflow-y-auto', selectedId ? 'block' : 'block max-lg:hidden')}>
          {!detail ? (
            <EmptyRecord onCreate={() => dialogRef.current?.showModal()} />
          ) : detail.status === 'loading' ? (
            <SkeletonRows count={8} className="p-8" />
          ) : detail.status === 'error' || !detail.preview ? (
            <div className="grid justify-items-start gap-3 p-8">
              <Notice>Không thể tải Preview Character.</Notice>
              <span className="flex gap-2">
                <Button onClick={() => selectedId && void loadDetail(selectedId)}>Thử lại</Button>
                <Button variant="ghost" onClick={() => select(null)}>Đóng</Button>
              </span>
            </div>
          ) : (
            <>
              {detail.reloadFailed && <Notice className="m-4">Không tải lại được bản ghi; đang hiển thị bản cũ. Dữ liệu bạn nhập vẫn còn.</Notice>}
              <PreviewDetail
                key={detail.preview.entityId}
                preview={detail.preview}
                isOwner={isOwner}
                reloading={reloading}
                onReload={reloadOpen}
                onClose={() => select(null)}
                onDirtyChange={(dirty) => { dirtyRef.current = dirty; }}
                focus={focus}
                onToggleFocus={() => setFocus((value) => !value)}
              />
            </>
          )}
        </section>
      </div>

      <CreateDialog dialogRef={dialogRef} isOwner={isOwner} onCreated={async (id) => { await loadList(); select(id); }} />
    </div>
  );
}

function Row({ item, selected, onSelect }: { item: Preview; selected: boolean; onSelect: () => void }) {
  const image = item.assets?.avatar?.url || item.assets?.card?.url;
  return (
    <li className="border-b border-(--border-color) last:border-b-0">
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'grid w-full grid-cols-[16px_32px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--accent)',
          selected ? 'bg-(--bg-surface-hover)' : 'hover:bg-(--bg-surface-hover)',
        )}
      >
        <LifecycleGlyph lifecycle={item.lifecycle} />
        <span className="grid size-8 place-items-center overflow-hidden rounded-md bg-(--bg-main)">
          {image ? <img src={image} alt="" className="size-full object-cover" /> : <span lang="zh" aria-hidden className="admin-cn text-sm text-(--text-muted)">物</span>}
        </span>
        <span className="min-w-0">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-sm font-medium text-(--text-main)">{item.nameVi || item.nameCn || 'Chưa đặt tên'}</span>
            {item.nameVi && item.nameCn && <span lang="zh" className="admin-cn truncate text-[13px] text-(--text-muted)">{item.nameCn}</span>}
          </span>
          <span className="admin-num mt-0.5 block truncate text-xs text-(--text-muted)">
            {item.claimedRawId || 'Chưa rõ mã nhân vật'}
          </span>
        </span>
        <span className="grid justify-items-end gap-0.5 text-xs text-(--text-muted)">
          <span>{VISIBILITY_VI[item.visibility] ?? item.visibility}</span>
          <span className="admin-num">rev {item.revision}</span>
        </span>
      </button>
    </li>
  );
}

function EmptyRecord({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="grid h-full place-content-center justify-items-center gap-6 p-10 text-center">
      <p className="admin-serif text-2xl font-semibold text-(--text-main)">Chưa mở hồ sơ nào</p>
      <ol aria-label="Các bước giám định" className="flex flex-wrap justify-center gap-x-3 gap-y-2 text-[13px] text-(--text-muted)">
        {LIFECYCLES.map((item, index) => (
          <li key={item} className="flex items-center gap-2">
            <LifecycleGlyph lifecycle={item} />
            {LIFECYCLE_VI[item]}
            {index < LIFECYCLES.length - 1 && <span aria-hidden className="pl-1 text-(--border-strong)">—</span>}
          </li>
        ))}
      </ol>
      <p className="max-w-[48ch] text-sm leading-6 text-(--text-muted)">
        Đây là hồ sơ của nhân vật chưa ra mắt. Chọn một bản ghi ở danh sách bên trái, hoặc mở bản nháp mới. Mỗi Preview Character đi qua bốn bước trên; dữ liệu Preview tách khỏi các hàng Character có nguồn và không được xuất công khai.
      </p>
      <Button variant="primary" onClick={onCreate}><Plus size={15} aria-hidden /> Preview mới</Button>
    </div>
  );
}

function CreateDialog({ dialogRef, isOwner, onCreated }: { dialogRef: React.RefObject<HTMLDialogElement | null>; isOwner: boolean; onCreated: (id: string) => Promise<void> }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = event.currentTarget;
    const values = parseMetadataForm(form);
    if (!values) { setError(JSON_ERROR); return; }
    setBusy(true);
    try {
      const result = await createPreview(values);
      form.reset();
      dialogRef.current?.close();
      await onCreated(result.entityId);
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="admin-create-title"
      className="m-auto max-h-[calc(100vh-48px)] w-[min(760px,calc(100vw-32px))] overflow-y-auto rounded-lg border border-(--border-strong) bg-(--bg-elevated) p-0 text-(--text-main) shadow-[0_24px_64px_var(--shadow-pop)]"
    >
      <form onSubmit={submit}>
        <header className="flex items-start justify-between gap-4 border-b border-(--border-color) px-6 pb-4 pt-6">
          <div>
            <h2 id="admin-create-title" className="admin-serif text-2xl font-semibold">Preview mới</h2>
            <p className="mt-1 text-sm text-(--text-muted)">
              Bản nháp luôn bắt đầu ở <span className="text-(--text-main)">Ẩn · Chờ giám định</span>. Chỉ owner đưa nó sang bước tiếp theo.
            </p>
          </div>
          <Button variant="ghost" aria-label="Đóng" onClick={() => dialogRef.current?.close()} className="px-2"><X size={16} aria-hidden /></Button>
        </header>
        <div className="px-6 py-5"><MetadataFields isOwner={isOwner} /></div>
        {error && <Notice className="mx-6 mb-4">{error}</Notice>}
        <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-(--border-color) bg-(--bg-elevated) px-6 py-3">
          <Button variant="ghost" onClick={() => dialogRef.current?.close()}>Huỷ</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo bản nháp'}</Button>
        </footer>
      </form>
    </dialog>
  );
}
