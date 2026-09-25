import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Notice, SkeletonRows } from '../../layout/ui';
import { getSkin, patchSkin } from '../charactersApi.js';
import { useEditor } from '../useEditor';
import { OverridableField, PairHead } from '../components/OverridableField';
import { SaveBar } from '../components/SaveBar';
import { Avatar, skinAvatar } from '../components/Avatar';
import type { ModuleProps, Skin } from '../types';

const KEYS = ['skinNameVi', 'descriptionVi', 'obtainVi'];
const FIELDS: { key: 'skinNameVi' | 'descriptionVi' | 'obtainVi'; cn: 'skinNameCn' | 'descriptionCn' | 'obtainCn'; label: string; multiline?: boolean }[] = [
  { key: 'skinNameVi', cn: 'skinNameCn', label: 'Tên trang phục' },
  { key: 'descriptionVi', cn: 'descriptionCn', label: 'Mô tả', multiline: true },
  { key: 'obtainVi', cn: 'obtainCn', label: 'Cách nhận' },
];
export const SKIN_FIELD_LABELS: Record<string, string> = { name_vi: 'Tên trang phục', description_vi: 'Mô tả', obtain_vi: 'Cách nhận' };
type DirtyFlag = { __whmxAdminDirty?: boolean };

// Direction B: skin list (left / chip strip on phones) · the open skin's pairs · its image and relations.
export function SkinsModule({ data, reload }: ModuleProps) {
  const [openId, setOpenId] = useState(data.skins[0]?.skinId ?? null);
  const open = (skinId: string) => {
    if (skinId === openId) return;
    if ((window as DirtyFlag).__whmxAdminDirty && !confirm('Có thay đổi chưa lưu. Rời trang phục này?')) return;
    setOpenId(skinId);
  };

  if (!data.skins.length) return <p className="px-4 py-8 text-sm text-(--text-subtle) md:px-8">Không có trang phục liên kết.</p>;
  return (
    <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[260px_1fr]">
      <nav aria-label="Trang phục" className="flex gap-1 overflow-x-auto border-b border-(--border-color) px-2 py-1.5 [scrollbar-width:none] lg:block lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-0 lg:py-2.5">
        {data.skins.map((s) => (
          <button
            key={s.skinId}
            type="button"
            aria-current={s.skinId === openId ? 'true' : undefined}
            onClick={() => open(s.skinId)}
            className={cn(
              'flex shrink-0 items-center gap-2.5 text-left transition-colors duration-(--motion-fast) hover:bg-(--bg-surface-hover)',
              'border-b-2 border-transparent px-2.5 py-1.5 lg:w-full lg:border-b-0 lg:border-l-2 lg:px-4',
              s.skinId === openId && 'border-(--accent) bg-(--accent-light)',
            )}
          >
            <Avatar src={skinAvatar(s.skinId)} label={s.skinId} className="size-8 rounded-md max-lg:hidden" />
            <span className="min-w-0">
              <span className="block truncate text-[13px]">{s.skinNameVi.value || s.skinNameCn}</span>
              <span className="block truncate font-mono text-[11px] text-(--text-subtle) max-lg:hidden">{s.skinId}</span>
            </span>
          </button>
        ))}
      </nav>
      {openId && <SkinEditor key={openId} skinId={openId} summary={data.skins.find((s) => s.skinId === openId)} onSaved={reload} />}
    </div>
  );
}

// `summary` (from the character payload) carries resolved series/acquisition names; GET /skins returns raw state rows.
function SkinEditor({ skinId, summary, onSaved }: { skinId: string; summary?: Skin; onSaved: ModuleProps['reload'] }) {
  const [skin, setSkin] = useState<Skin | null>(null);
  const [error, setError] = useState(false);
  const reload = useCallback(async () => {
    const next: { skin: Skin } = await getSkin(skinId);
    setSkin(next.skin);
    return next.skin;
  }, [skinId]);
  const load = () => { setError(false); reload().catch(() => setError(true)); };
  useEffect(load, [reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(
    // The character record's skin list and history also change: refresh it after the skin saves.
    (changes: Record<string, string | null>) => patchSkin(skinId, { expectedRevision: skin?.revision, changes }).then(() => onSaved()),
    [skinId, skin?.revision, onSaved],
  );
  const editor = useEditor({ scope: 'skin', id: skinId, record: skin, keys: KEYS, save, reload });

  if (error) return <Notice className="m-4">Không tải được trang phục {skinId}. <Button variant="ghost" onClick={load}>Thử lại</Button></Notice>;
  if (!skin) return <SkeletonRows count={3} />;
  const series = summary?.relations?.series?.source;
  const acquisition = summary?.relations?.acquisition?.source;
  const image = skin.assets?.find((a) => a.override?.url || a.source?.url);
  return (
    <div className="flex min-h-0 flex-col">
      <div className="min-h-0 flex-1 xl:grid xl:grid-cols-[1fr_280px]">
        <section aria-label={`Trang phục ${skinId}`} className="max-lg:pb-16 lg:h-full lg:overflow-y-auto">
          <PairHead />
          {FIELDS.map((f) => (
            <OverridableField
              key={f.key}
              label={f.label}
              original={skin[f.cn]}
              sourceVi={skin[f.key].source}
              override={skin[f.key].override}
              value={editor.draft[f.key] ?? ''}
              dirty={f.key in editor.changes}
              multiline={f.multiline}
              onChange={(v) => editor.setField(f.key, v)}
              onRevert={() => editor.setField(f.key, '')}
            />
          ))}
        </section>
        <aside aria-label="Thông tin trang phục" className="overflow-y-auto border-l border-(--border-color) px-4 py-4 text-[13px] max-xl:border-l-0 max-xl:border-t">
          <img src={image?.override?.url || image?.source?.url || skinAvatar(skinId)} alt="" className="mb-3 aspect-square w-full max-w-60 rounded-md bg-(--bg-elevated) object-contain" />
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            <dt className="text-(--text-subtle)">Mã</dt><dd className="font-mono">{skin.skinId}</dd>
            <dt className="text-(--text-subtle)">Series</dt><dd>{series ? `${series.nameVi ?? ''} ${series.nameCn ? `· ${series.nameCn}` : ''}`.trim() || series.seriesId : '—'}</dd>
            <dt className="text-(--text-subtle)">Cách nhận</dt><dd>{acquisition ? acquisition.labelVi ?? acquisition.id : '—'}</dd>
            <dt className="text-(--text-subtle)">Ảnh</dt><dd>{skin.assets?.map((a) => a.assetRole).join(', ') || '—'}</dd>
          </dl>
          <p className="mt-2 text-xs text-(--text-subtle)">Series, cách nhận và ảnh chỉ xem.</p>
        </aside>
      </div>
      <SaveBar {...editor} />
    </div>
  );
}
