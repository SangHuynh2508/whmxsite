import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, Copy, Lock, PanelLeftClose, PanelLeftOpen, RefreshCw, Upload, X } from 'lucide-react';
import { LIFECYCLES, VISIBILITIES, ASSET_ROLES, PROVENANCES, savePreviewMetadata, savePreviewState, finalizeUpload, uploadAsset } from './previewApi.js';
import { buildEvidence, evidenceExtra, evidenceNote, parseJsonObject } from './evidence.js';
import { cn } from '@/lib/utils';
import {
  Button, Field, LifecycleGlyph, Notice, Select, SectionTitle, inputClass, describeError, statusOf, formatDate,
  LIFECYCLE_VI, VISIBILITY_VI, PROVENANCE_VI, ROLE_VI,
} from '@/ui';

export type Asset = { url?: string; provenance?: string; verificationState?: string; mimeType?: string; width?: number; height?: number };
export type Preview = {
  entityId: string; publicKey?: string; revision: number; origin?: string;
  lifecycle: string; visibility: string;
  nameVi?: string; nameCn?: string; fullnameVi?: string; fullnameCn?: string; nicknameVi?: string; tagsVi?: string;
  claimedRawId?: string; claimedRawIdEvidence?: unknown; manualMetadata?: unknown; provenanceNotes?: string;
  createdAt?: string; updatedAt?: string; createdByUserId?: string; updatedByUserId?: string;
  assets?: Record<string, Asset | undefined>;
  pendingUploads?: { id: string; assetRole: string; requestedProvenance?: string }[];
  history?: { fieldName: string; editedAt: string; actorUserId?: string }[];
  reconciliation?: { status: string; officialCharacterId?: string; officialCharacterEntityId?: string; officialNameVi?: string; officialNameCn?: string; candidateEvidence?: unknown }[];
};

export const JSON_ERROR = 'Dữ liệu trong mục "Nâng cao" phải là JSON object hợp lệ, dạng {…}.';

/**
 * Form → create/patch payload; null when the owner's advanced JSON is invalid.
 * `base` is the record being edited (its evidence keys other than the note are
 * kept). Editors have no advanced fields, so `manualMetadata` isn't sent at all
 * and the server keeps its value.
 */
export function parseMetadataForm(form: HTMLFormElement, base?: Preview) {
  const { evidenceNote: note = '', evidenceExtra: extraJson, manualMetadata: metaJson, ...values } =
    Object.fromEntries(new FormData(form)) as Record<string, string>;
  const claimedRawIdEvidence = buildEvidence(base?.claimedRawIdEvidence, note, extraJson);
  const manualMetadata = metaJson === undefined ? undefined : parseJsonObject(metaJson);
  if (!claimedRawIdEvidence || manualMetadata === null) return null;
  return { ...values, claimedRawIdEvidence, ...(manualMetadata && { manualMetadata }) };
}

const TEXT_FIELDS: { name: keyof Preview; label: string; zh?: boolean; hint?: string }[] = [
  { name: 'nameVi', label: 'Tên Việt' }, { name: 'nameCn', label: 'Tên Trung', zh: true },
  { name: 'fullnameVi', label: 'Tên đầy đủ (Việt)' }, { name: 'fullnameCn', label: 'Tên đầy đủ (Trung)', zh: true },
  { name: 'nicknameVi', label: 'Biệt danh' }, { name: 'tagsVi', label: 'Thẻ' },
  { name: 'claimedRawId', label: 'Mã nhân vật trong game (nếu đã biết)', hint: 'VD: A0213. Để trống nếu chưa chắc.' },
];

const jsonClass = `${inputClass} py-2 font-mono text-[13px] leading-5`;

/** The record fields, shared by the edit form and the create dialog. Owners also get the raw-JSON "Nâng cao" drawer. */
export function MetadataFields({ preview, isOwner }: { preview?: Preview; isOwner: boolean }) {
  const json = (value: unknown) => (preview ? JSON.stringify(value || {}, null, 2) : '');
  return (
    <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
      {TEXT_FIELDS.map(({ name, label, zh, hint }) => (
        <Field key={name} label={label} hint={hint}>
          <input name={name} maxLength={10000} defaultValue={String(preview?.[name] ?? '')} lang={zh ? 'zh' : undefined} className={zh ? `${inputClass} admin-cn h-9` : `${inputClass} h-9`} />
        </Field>
      ))}
      <Field label="Căn cứ" hint="Vì sao nghĩ là mã này: link, ảnh, nguồn…" className="md:col-span-2">
        <textarea name="evidenceNote" rows={3} maxLength={10000} defaultValue={evidenceNote(preview?.claimedRawIdEvidence)} className={`${inputClass} py-2 leading-6`} />
      </Field>
      <Field label="Nguồn thông tin" hint="Thông báo chính thức, datamine, leak…" className="md:col-span-2">
        <textarea name="provenanceNotes" rows={3} defaultValue={preview?.provenanceNotes ?? ''} className={`${inputClass} py-2 leading-6`} />
      </Field>
      {isOwner && (
        <details className="md:col-span-2">
          <summary className="cursor-pointer text-[13px] font-medium text-(--text-muted) hover:text-(--text-main)">Nâng cao (chỉ owner)</summary>
          <div className="mt-3 grid gap-4">
            <Field label="Căn cứ — dữ liệu khác (JSON)" hint='Các khoá khác ngoài "Căn cứ" ở trên. Để nguyên nếu không chắc.'>
              <textarea name="evidenceExtra" rows={4} spellCheck={false} defaultValue={json(evidenceExtra(preview?.claimedRawIdEvidence))} placeholder="{}" className={jsonClass} />
            </Field>
            <Field label="Metadata thủ công (JSON)" hint="Chỉ lưu trữ, hiện chưa có chỗ nào đọc dữ liệu này.">
              <textarea name="manualMetadata" rows={4} spellCheck={false} defaultValue={json(preview?.manualMetadata)} placeholder="{}" className={jsonClass} />
            </Field>
          </div>
        </details>
      )}
    </div>
  );
}

type DetailProps = {
  preview: Preview;
  isOwner: boolean;
  reloading: boolean;
  onReload: () => Promise<void>;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
  /** Focus mode: the list pane is collapsed so the record takes the full width (≥1024px). */
  focus: boolean;
  onToggleFocus: () => void;
};

export default function PreviewDetail({ preview, isOwner, reloading, onReload, onClose, onDirtyChange, focus, onToggleFocus }: DetailProps) {
  const [metaDirty, setMetaDirtyState] = useState(false);
  const setMetaDirty = (dirty: boolean) => { setMetaDirtyState(dirty); onDirtyChange(dirty); };
  // The metadata form is keyed by the revision its draft started from. While
  // the draft is dirty that key is frozen, so a reload (e.g. after an owner
  // state change) never wipes typed text; the save then sends the draft's
  // base revision and the server answers 409 instead of overwriting.
  const [formRevision, setFormRevision] = useState(preview.revision);
  useEffect(() => { if (!metaDirty) setFormRevision(preview.revision); }, [preview.revision, metaDirty]);
  useEffect(() => () => onDirtyChange(false), []); // on unmount only
  useEffect(() => {
    if (!metaDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [metaDirty]);

  const name = preview.nameVi || preview.nameCn || 'Chưa đặt tên';

  return (
    <article className="min-h-full bg-(--bg-surface)">
      <div className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-(--border-color) bg-(--bg-surface) px-4 lg:px-8">
        <Button variant="ghost" onClick={onClose} className="-ml-2 lg:hidden"><ArrowLeft size={16} aria-hidden /> Danh sách</Button>
        <Button
          variant="ghost"
          aria-pressed={focus}
          aria-label={focus ? 'Hiện danh sách' : 'Thu gọn danh sách'}
          title={focus ? 'Hiện danh sách' : 'Thu gọn danh sách'}
          onClick={onToggleFocus}
          className="-ml-2 px-2 max-lg:hidden"
        >
          {focus ? <PanelLeftOpen size={16} aria-hidden /> : <PanelLeftClose size={16} aria-hidden />}
        </Button>
        <p className="min-w-0 truncate text-sm text-(--text-muted) max-lg:hidden">
          Preview <span aria-hidden>/</span> <span className="text-(--text-main)">{name}</span>
        </p>
        <span className="admin-num ml-auto text-xs text-(--text-muted)">rev {preview.revision}</span>
        <Button variant="ghost" aria-label="Tải lại bản ghi" title="Tải lại bản ghi" onClick={() => void onReload()} className="px-2">
          <RefreshCw size={15} aria-hidden className={reloading ? 'animate-spin' : ''} />
        </Button>
        <Button variant="ghost" aria-label="Đóng hồ sơ" title="Đóng hồ sơ" onClick={onClose} className="px-2 max-lg:hidden">
          <X size={16} aria-hidden />
        </Button>
      </div>

      <div className="admin-record gap-x-12 px-4 pb-16 pt-8 lg:px-8 xl:px-10">
        <header className="admin-area-title pb-8">
          <h2 className="admin-serif text-[36px] font-semibold leading-[1.15] text-(--text-main) [text-wrap:balance]">{name}</h2>
          {preview.nameVi && preview.nameCn && <p lang="zh" className="admin-cn mt-2 text-lg text-(--text-muted)">{preview.nameCn}</p>}
          {(preview.fullnameVi || preview.fullnameCn) && (
            <p className="mt-1 text-sm text-(--text-muted)">
              {preview.fullnameVi} {preview.fullnameCn && <span lang="zh" className="admin-cn">{preview.fullnameCn}</span>}
            </p>
          )}
        </header>

        <aside className="admin-area-props mb-12 rounded-lg border border-(--border-color) p-4 2xl:mb-0 2xl:rounded-none 2xl:border-0 2xl:border-l 2xl:py-0 2xl:pl-6 2xl:pr-0">
          <Properties preview={preview} isOwner={isOwner} />
          <StateControl key={preview.revision} preview={preview} isOwner={isOwner} onReload={onReload} />
        </aside>

        <div className="admin-area-body grid min-w-0 content-start gap-14">
          <MetadataForm
            key={`${preview.entityId}:${formRevision}`}
            preview={{ ...preview, revision: formRevision }}
            isOwner={isOwner}
            dirty={metaDirty}
            setDirty={setMetaDirty}
            onSaved={onReload}
            onDiscardAndReload={() => { setMetaDirty(false); void onReload(); }}
          />
          <Assets preview={preview} isOwner={isOwner} onReload={onReload} />
          <Reconciliation preview={preview} />
          <History preview={preview} isOwner={isOwner} />
        </div>
      </div>
    </article>
  );
}

/* ---------- Properties panel ---------- */

function Raw({ children }: { children: ReactNode }) {
  return <span className="text-xs text-(--text-muted)">{children}</span>;
}

function CopyValue({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label="Sao chép UUID"
      title={done ? 'Đã sao chép' : 'Sao chép'}
      onClick={() => navigator.clipboard?.writeText(value).then(() => setDone(true), () => setDone(false))}
      className="ml-1 inline-flex align-middle text-(--text-muted) hover:text-(--text-main)"
    >
      <Copy size={13} aria-hidden />
    </button>
  );
}

function PropertyList({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-1">
      {rows.map(([label, value]) => (
        <div key={label} className="grid min-w-0 content-start gap-0.5 2xl:grid-cols-[88px_1fr] 2xl:gap-3">
          <dt className="pt-px text-xs text-(--text-muted)">{label}</dt>
          <dd className="min-w-0 break-words text-sm text-(--text-main)">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Properties({ preview, isOwner }: { preview: Preview; isOwner: boolean }) {
  return (
    <>
      <PropertyList
        rows={[
          ['Vòng đời', <span className="inline-flex items-center gap-2"><LifecycleGlyph lifecycle={preview.lifecycle} />{LIFECYCLE_VI[preview.lifecycle] ?? preview.lifecycle} <Raw>{preview.lifecycle}</Raw></span>],
          ['Hiển thị', <>{VISIBILITY_VI[preview.visibility] ?? preview.visibility} <Raw>{preview.visibility}</Raw></>],
          ['Phiên bản', <span className="admin-num">rev {preview.revision}</span>],
          ['Tạo', formatDate(preview.createdAt)],
          ['Cập nhật', formatDate(preview.updatedAt)],
        ]}
      />
      {isOwner && (
        <details className="mt-4 border-t border-(--border-color) pt-3">
          <summary className="cursor-pointer text-xs font-medium text-(--text-muted) hover:text-(--text-main)">Thông tin kỹ thuật</summary>
          <div className="mt-3">
            <PropertyList
              rows={[
                ['Nguồn gốc', <Raw>{preview.origin || '—'}</Raw>],
                ['Mã công khai', <span className="admin-num">{preview.publicKey || '—'}</span>],
                ['UUID', <span className="admin-num break-all text-xs">{preview.entityId}<CopyValue value={preview.entityId} /></span>],
                ['Tạo bởi', <span className="admin-num break-all text-xs">{preview.createdByUserId || '—'}</span>],
                ['Sửa bởi', <span className="admin-num break-all text-xs">{preview.updatedByUserId || '—'}</span>],
              ]}
            />
          </div>
        </details>
      )}
    </>
  );
}

/* ---------- Owner-only lifecycle / visibility ---------- */

function StateControl({ preview, isOwner, onReload }: { preview: Preview; isOwner: boolean; onReload: () => Promise<void> }) {
  const id = useId();
  const [lifecycle, setLifecycle] = useState(preview.lifecycle);
  const [visibility, setVisibility] = useState(preview.visibility);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const changed = lifecycle !== preview.lifecycle || visibility !== preview.visibility;

  async function save() {
    setError(''); setConflict(false); setBusy(true);
    try {
      await savePreviewState(preview, lifecycle, visibility);
      await onReload();
    } catch (failure) {
      if (statusOf(failure) === 409) setConflict(true);
      else setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-t`} className="mt-6 border-t border-(--border-color) pt-5">
      <h3 id={`${id}-t`} className="text-sm font-semibold text-(--text-main)">Quy trình giám định</h3>
      <fieldset disabled={!isOwner || busy} className="mt-3 border-0 p-0">
        <legend className="sr-only">Vòng đời</legend>
        <ol className="relative grid gap-0.5 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-px before:bg-(--border-strong)">
          {LIFECYCLES.map((item) => (
            <li key={item}>
              <label
                className={cn(
                  'relative flex items-center gap-3 rounded-md px-2 py-1.5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-(--accent)',
                  isOwner ? 'cursor-pointer hover:bg-(--bg-surface-hover)' : 'cursor-not-allowed',
                  lifecycle === item ? 'font-semibold text-(--text-main)' : 'text-(--text-muted)',
                )}
              >
                <input type="radio" name={`${id}-lifecycle`} value={item} checked={lifecycle === item} onChange={() => setLifecycle(item)} className="sr-only" />
                <span className="rounded-full bg-(--bg-surface) p-0.5"><LifecycleGlyph lifecycle={item} /></span>
                <span>{LIFECYCLE_VI[item]}</span>
                <span className="ml-auto text-xs font-normal text-(--text-muted)">{item === preview.lifecycle ? 'hiện tại' : item}</span>
              </label>
            </li>
          ))}
        </ol>
        <div role="radiogroup" aria-label="Hiển thị" className="mt-4 grid grid-cols-3 gap-0.5 rounded-md border border-(--border-color) p-0.5">
          {VISIBILITIES.map((item) => (
            <label
              key={item}
              className={cn(
                'rounded-[5px] px-2 py-1 text-center text-[13px] has-[:checked]:bg-(--bg-surface-hover) has-[:checked]:font-semibold has-[:checked]:text-(--text-main) has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-(--accent)',
                isOwner ? 'cursor-pointer text-(--text-muted) hover:text-(--text-main)' : 'cursor-not-allowed text-(--text-muted)',
              )}
            >
              <input type="radio" name={`${id}-visibility`} value={item} checked={visibility === item} onChange={() => setVisibility(item)} className="sr-only" />
              {VISIBILITY_VI[item]}
            </label>
          ))}
        </div>
      </fieldset>

      {!isOwner ? (
        <p className="mt-3 flex gap-2 text-xs leading-5 text-(--text-muted)">
          <Lock size={13} aria-hidden className="mt-0.5 shrink-0" />
          Chỉ owner được đổi vòng đời và hiển thị. Máy chủ vẫn kiểm tra quyền và phiên bản.
        </p>
      ) : (
        <div className="mt-4 flex items-center justify-end gap-2">
          {changed && <Button variant="ghost" disabled={busy} onClick={() => { setLifecycle(preview.lifecycle); setVisibility(preview.visibility); }}>Hoàn tác</Button>}
          <Button variant={changed ? 'primary' : 'secondary'} disabled={!changed || busy} onClick={() => void save()}>
            {busy ? 'Đang lưu…' : 'Lưu trạng thái'}
          </Button>
        </div>
      )}
      {conflict && (
        <Notice className="mt-3">
          Bản ghi đã đổi ở nơi khác (VERSION_CONFLICT). Chưa có gì bị ghi đè — hãy tải lại rồi chọn lại.
          <Button variant="secondary" className="mt-2 w-full" onClick={() => void onReload()}>Tải lại bản ghi</Button>
        </Notice>
      )}
      {error && <Notice className="mt-3">{error}</Notice>}
    </section>
  );
}

/* ---------- Metadata form with a draft that survives 409 ---------- */

function MetadataForm({ preview, isOwner, dirty, setDirty, onSaved, onDiscardAndReload }: {
  preview: Preview; isOwner: boolean; dirty: boolean; setDirty: (dirty: boolean) => void; onSaved: () => Promise<void>; onDiscardAndReload: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [copied, setCopied] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const patch = parseMetadataForm(event.currentTarget, preview);
    if (!patch) { setError(JSON_ERROR); return; }
    setSaving(true);
    try {
      await savePreviewMetadata(preview, patch);
      setConflict(false);
      setDirty(false);
      await onSaved();
    } catch (failure) {
      if (statusOf(failure) === 409) setConflict(true);
      else setError(describeError(failure));
    } finally {
      setSaving(false);
    }
  }

  function copyDraft() {
    if (!formRef.current) return;
    const draft = JSON.stringify(Object.fromEntries(new FormData(formRef.current)), null, 2);
    navigator.clipboard?.writeText(draft).then(
      () => setCopied('Đã sao chép bản nháp vào clipboard.'),
      () => setCopied('Không sao chép được — hãy chọn và sao chép thủ công từ form.'),
    );
  }

  return (
    <section aria-labelledby="admin-meta-title">
      <SectionTitle aside={dirty && <span className="text-xs font-medium text-(--admin-gold-ink)">Có thay đổi chưa lưu</span>}>
        <span id="admin-meta-title">Hồ sơ</span>
      </SectionTitle>

      {conflict && (
        <Notice className="mb-5 grid gap-2">
          <strong className="font-semibold">Bản ghi đã thay đổi ở nơi khác (VERSION_CONFLICT).</strong>
          <span className="text-(--text-main)">Bản nháp của bạn vẫn nguyên trong form bên dưới, chưa có gì bị ghi đè. Sao chép bản nháp, tải bản mới nhất, rồi áp dụng lại thủ công.</span>
          <span className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={copyDraft}><Copy size={14} aria-hidden /> Sao chép bản nháp</Button>
            <Button variant="ghost" onClick={onDiscardAndReload}>Tải bản mới nhất (bỏ bản nháp)</Button>
          </span>
          {copied && <span role="status" className="text-xs text-(--text-muted)">{copied}</span>}
        </Notice>
      )}

      <form ref={formRef} onSubmit={submit} onInput={() => { if (!dirty) setDirty(true); }} onReset={() => { setDirty(false); setError(''); }}>
        <MetadataFields preview={preview} isOwner={isOwner} />
        {error && <Notice className="mt-4">{error}</Notice>}
        <div className="sticky bottom-0 mt-5 flex items-center justify-end gap-2 border-t border-(--border-color) bg-(--bg-surface) py-3">
          {dirty && <Button type="reset" variant="ghost" disabled={saving}>Hoàn tác</Button>}
          <Button type="submit" variant={dirty ? 'primary' : 'secondary'} disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu hồ sơ'}</Button>
        </div>
      </form>
    </section>
  );
}

/* ---------- Managed assets ---------- */

const UPLOAD_STATUS_VI: Record<string, string> = {
  'Requesting upload intent…': 'Đang xin phiếu tải lên…',
  'Uploading…': 'Đang tải tệp lên…',
  'Uploaded to quarantine. Owner finalization required.': 'Đã tải lên, đang chờ owner duyệt.',
  'Verifying and activating…': 'Đang xác minh và kích hoạt…',
};
const VERIFICATION_VI: Record<string, string> = { pending: 'Đang chờ duyệt', verified: 'Đã duyệt', quarantined: 'Đang cách ly', retired: 'Đã gỡ' };

function Assets({ preview, isOwner, onReload }: { preview: Preview; isOwner: boolean; onReload: () => Promise<void> }) {
  return (
    <section aria-labelledby="admin-assets-title">
      <SectionTitle><span id="admin-assets-title">Tư liệu hình ảnh</span></SectionTitle>
      <p className="-mt-1 mb-5 max-w-[68ch] text-sm text-(--text-muted)">
        Editor tải được ảnh xem trước (chưa chính thức) khi bản ghi còn ẩn và chờ giám định. Chọn loại ảnh khác và duyệt ảnh là việc của owner.
      </p>
      <div className="grid gap-6 sm:grid-cols-3">
        {ASSET_ROLES.map((role) => <AssetSlot key={role} role={role} preview={preview} isOwner={isOwner} onReload={onReload} />)}
      </div>
    </section>
  );
}

function AssetSlot({ role, preview, isOwner, onReload }: { role: string; preview: Preview; isOwner: boolean; onReload: () => Promise<void> }) {
  const asset = preview.assets?.[role];
  const pending = (preview.pendingUploads || []).filter((item) => item.assetRole === role);
  const [provenance, setProvenance] = useState('manual_preview');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function upload(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      // previewApi's default `onStatus = () => {}` is inferred as zero-arg; it is called with one string.
      const onStatus = ((text: string) => setStatus(UPLOAD_STATUS_VI[text] ?? text)) as () => void;
      const { finalized } = await uploadAsset(preview, role, file, provenance, isOwner, onStatus);
      if (finalized) { setStatus('Đã kích hoạt ảnh.'); await onReload(); }
    } catch (failure) {
      setStatus(describeError(failure));
    } finally {
      input.value = '';
      setBusy(false);
    }
  }

  async function finalize(intentId: string) {
    setBusy(true);
    setStatus('Đang duyệt…');
    try {
      await finalizeUpload(intentId);
      await onReload();
      setStatus('');
    } catch (failure) {
      setStatus(describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="grid content-start gap-3">
      <h4 className="text-sm font-semibold text-(--text-main)">{ROLE_VI[role] ?? role}</h4>
      <figure className="relative aspect-[4/5] overflow-hidden rounded-md border border-(--border-color) bg-(--bg-main)">
        {asset?.url ? (
          <img src={asset.url} alt={`${ROLE_VI[role] ?? role} — ${preview.nameVi || preview.nameCn || ''}`} className="h-full w-full object-contain" />
        ) : (
          <div className="grid h-full place-content-center justify-items-center gap-1">
            <span lang="zh" aria-hidden className="admin-cn text-4xl text-(--border-strong)">物</span>
            <span className="text-xs text-(--text-muted)">Chưa có ảnh</span>
          </div>
        )}
        {asset?.provenance === 'manual_placeholder' && (
          <figcaption className="absolute inset-x-0 bottom-0 border-t border-(--border-gold-subtle) bg-(--admin-warn-bg) px-2 py-1 text-xs font-medium text-(--admin-warn)">
            Ảnh tạm — không phải ảnh chính thức
          </figcaption>
        )}
      </figure>
      <dl className="grid gap-1 text-xs text-(--text-muted)">
        {asset ? (
          <>
            <div className="flex justify-between gap-2"><dt>Loại ảnh</dt><dd className="text-right text-(--text-main)">{PROVENANCE_VI[asset.provenance ?? ''] ?? asset.provenance ?? '—'}</dd></div>
            <div className="flex justify-between gap-2"><dt>Trạng thái</dt><dd className="text-right text-(--text-main)">{VERIFICATION_VI[asset.verificationState ?? ''] ?? asset.verificationState ?? '—'}</dd></div>
            <div className="flex justify-between gap-2"><dt>Tệp</dt><dd className="admin-num text-right">{asset.mimeType || '?'} · {asset.width || '?'}×{asset.height || '?'}</dd></div>
          </>
        ) : (
          <div>Chưa có ảnh đã duyệt.</div>
        )}
      </dl>
      <Field label="Loại ảnh khi tải lên" hint={!isOwner && 'Chỉ owner chọn; editor luôn tải ảnh xem trước.'}>
        <Select value={provenance} onChange={(event) => setProvenance(event.target.value)} disabled={!isOwner || busy} title={isOwner ? undefined : 'Chỉ owner'}>
          {PROVENANCES.map((item) => <option key={item} value={item}>{PROVENANCE_VI[item] ?? item}</option>)}
        </Select>
      </Field>
      <label
        className={cn(
          'inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-(--border-strong) bg-(--bg-surface) px-3 text-sm font-medium text-(--text-main)',
          'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--accent)',
          busy ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:bg-(--bg-surface-hover)',
        )}
      >
        <Upload size={14} aria-hidden /> Tải ảnh ứng viên
        <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => void upload(event.currentTarget)} className="sr-only" />
      </label>
      {pending.map((item) => (
        <Button key={item.id} disabled={!isOwner || busy} onClick={() => void finalize(item.id)} title={isOwner ? undefined : 'Chỉ owner duyệt'}>
          Duyệt ảnh đang chờ ({PROVENANCE_VI[item.requestedProvenance ?? ''] ?? item.requestedProvenance ?? '—'})
        </Button>
      ))}
      {pending.length > 0 && !isOwner && <p className="text-xs text-(--text-muted)">Ảnh đang chờ owner duyệt.</p>}
      <p role="status" aria-live="polite" className="min-h-4 text-xs text-(--text-muted)">{status}</p>
    </article>
  );
}

/* ---------- Reconciliation + history (the activity feed sits last, as in an issue tracker) ---------- */

function Reconciliation({ preview }: { preview: Preview }) {
  const items = preview.reconciliation || [];
  if (!items.length) return null;
  return (
    <section aria-labelledby="admin-recon-title">
      <SectionTitle><span id="admin-recon-title">Đối chiếu với nhân vật chính thức</span></SectionTitle>
      <ul className="grid gap-3">
        {items.map((item, index) => (
          <li key={index} className="grid gap-1 rounded-md border border-(--border-color) px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-(--text-main)">{item.status}</span>
              <Raw>Chính thức: {item.officialCharacterId || item.officialCharacterEntityId}</Raw>
            </div>
            {(item.officialNameVi || item.officialNameCn) && <p className="text-sm text-(--text-main)">{item.officialNameVi || item.officialNameCn}</p>}
            <pre className="whitespace-pre-wrap break-all font-mono text-xs text-(--text-muted)">Bằng chứng: {JSON.stringify(item.candidateEvidence || {})}</pre>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Audit event names written by server/preview-characters/ (raw name shown when unknown).
const HISTORY_VI: Record<string, string> = {
  'preview_character.create': 'Tạo bản ghi',
  'preview_character.metadata': 'Sửa hồ sơ',
  'preview_character.claimed_identity_evidence': 'Sửa mã nhân vật / căn cứ',
  'preview_character.publication_state': 'Đổi vòng đời / hiển thị',
  'asset_upload_intent.issue': 'Tải ảnh lên',
  'entity_asset_mapping.active_asset': 'Duyệt ảnh',
  'preview_reconciliation.proposed': 'Đề xuất đối chiếu',
  'preview_reconciliation.confirmed': 'Xác nhận đối chiếu',
  'preview_reconciliation.confirmed_target': 'Xác nhận đối chiếu',
};

function History({ preview, isOwner }: { preview: Preview; isOwner: boolean }) {
  const items = preview.history || [];
  return (
    <section aria-labelledby="admin-history-title">
      <SectionTitle><span id="admin-history-title">Lịch sử</span></SectionTitle>
      {items.length ? (
        <ol className="relative grid gap-3 before:absolute before:bottom-2 before:left-[3px] before:top-2 before:w-px before:bg-(--border-color)">
          {items.map((item, index) => (
            <li key={index} className="relative grid grid-cols-[7px_1fr_auto] items-baseline gap-3 text-sm">
              <span aria-hidden className="size-[7px] -translate-y-px rounded-full bg-(--border-strong)" />
              <span className="min-w-0 break-words text-(--text-main)">
                {HISTORY_VI[item.fieldName] ?? item.fieldName}
                {isOwner && <span className="admin-num block break-all text-xs text-(--text-muted)">{item.actorUserId || 'hệ thống'}</span>}
              </span>
              <time dateTime={item.editedAt} className="admin-num text-xs text-(--text-muted)">{formatDate(item.editedAt)}</time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-(--text-muted)">Chưa có lịch sử.</p>
      )}
    </section>
  );
}
