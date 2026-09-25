import { useCallback } from 'react';
import { patchCharacter } from '../charactersApi.js';
import { useEditor } from '../useEditor';
import { OverridableField, PairHead } from '../components/OverridableField';
import { SaveBar } from '../components/SaveBar';
import { HistoryList } from '../components/HistoryList';
import { Avatar, characterAvatar } from '../components/Avatar';
import { invalidateCharacterList } from '../CharacterList';
import type { Character, ModuleProps } from '../types';

const KEYS = ['nameVi', 'fullnameVi', 'nicknameVi', 'tagsVi'];
const FIELDS: { key: keyof Character & string; label: string; cn: (c: Character) => string | null }[] = [
  { key: 'nameVi', label: 'Tên tiếng Việt', cn: (c) => c.nameCn },
  { key: 'fullnameVi', label: 'Tên đầy đủ tiếng Việt', cn: (c) => c.fullnameCn },
  { key: 'nicknameVi', label: 'Biệt danh tiếng Việt', cn: () => null },
  { key: 'tagsVi', label: 'Thẻ tiếng Việt', cn: (c) => c.tagsCn },
];
export const CHARACTER_FIELD_LABELS: Record<string, string> = { name_vi: 'Tên', fullname_vi: 'Tên đầy đủ', nickname_vi: 'Biệt danh', tags_vi: 'Thẻ', source_baseline: 'Dữ liệu nguồn' };

export function OverviewModule({ data, reload }: ModuleProps) {
  const c = data.character;
  const save = useCallback(
    (changes: Record<string, string | null>) => patchCharacter(c.characterId, { expectedRevision: c.revision, changes }).then(invalidateCharacterList),
    [c.characterId, c.revision],
  );
  const editor = useEditor({ scope: 'character', id: c.characterId, record: c, keys: KEYS, save, reload });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 xl:grid xl:grid-cols-[1fr_280px]">
        <section aria-label="Tổng quan" className="max-lg:pb-16 lg:h-full lg:overflow-y-auto">
          <PairHead />
          {FIELDS.map((f) => {
            const state = c[f.key] as Character['nameVi'];
            return (
              <OverridableField
                key={f.key}
                label={f.label}
                original={f.cn(c)}
                sourceVi={state.source}
                override={state.override}
                value={editor.draft[f.key] ?? ''}
                dirty={f.key in editor.changes}
                onChange={(v) => editor.setField(f.key, v)}
                onRevert={() => editor.setField(f.key, '')}
              />
            );
          })}
        </section>
        <aside aria-label="Thông tin hồ sơ" className="overflow-y-auto border-l border-(--border-color) px-4 py-4 text-[13px] max-xl:hidden">
          <Avatar src={characterAvatar(c.characterId)} label={c.characterId} className="mb-4 size-28 rounded-full" />
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            <dt className="text-(--text-subtle)">Mã</dt><dd className="font-mono">{c.characterId}</dd>
            <dt className="text-(--text-subtle)">Phiên bản</dt><dd className="font-mono">{c.revision}</dd>
          </dl>
          <h3 className="mb-1 mt-5 text-[11px] font-medium uppercase tracking-[.12em] text-(--text-subtle)">Lịch sử gần đây</h3>
          <div className="-mx-4 [&_li]:px-4 [&_p]:px-4">
            <HistoryList entries={data.history.filter((h) => h.entityId === c.entityId && !h.eventType.startsWith('source_')).slice(0, 5)} labels={CHARACTER_FIELD_LABELS} />
          </div>
        </aside>
      </div>
      <SaveBar {...editor} />
    </div>
  );
}
