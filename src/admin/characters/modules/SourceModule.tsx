import type { ModuleProps } from '../types';

const show = (value: unknown) => (value == null || value === '' ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value));

function Rows({ title, rows }: { title: string; rows: [string, unknown][] }) {
  return (
    <section className="px-4 py-5 md:px-8">
      <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[.12em] text-(--text-subtle)">{title}</h3>
      <dl className="grid grid-cols-[minmax(0,200px)_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="truncate text-(--text-subtle)">{label}</dt>
            <dd className="min-w-0 break-words font-mono text-[13px] text-(--text-main)">{show(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// Read-only: what the importer recorded for this character.
export function SourceModule({ data }: ModuleProps) {
  const c = data.character;
  const p = c.protected ?? {};
  return (
    <div className="min-h-0 flex-1 divide-y divide-(--border-color) lg:overflow-y-auto">
      <Rows
        title="Nguồn"
        rows={[
          ['Mã nhân vật', c.characterId],
          ['Bản nguồn (snapshot)', p.sourceSnapshotId],
          ['Bản workbook (snapshot)', p.workbookSnapshotId],
          ['Độ hiếm (raw)', p.rawRare],
          ['Nghề (raw)', p.rawJob],
          ['Kiểu tấn công (raw)', p.rawAttackType],
          ['Ngày mở (raw)', p.rawUnlockDate],
        ]}
      />
      <Rows title="Dữ liệu gốc từ game" rows={Object.entries(p.rawIdentity ?? {})} />
    </div>
  );
}
