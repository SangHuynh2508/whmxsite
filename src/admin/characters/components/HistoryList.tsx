import { formatDate } from '../../layout/ui';

export type HistoryEntry = { id: string; entityId: string; fieldName: string; eventType: string; oldValue: unknown; newValue: unknown; actorUserId: string | null; editedAt: string };

export const EVENT_VI: Record<string, string> = {
  source_baseline: 'Dữ liệu gốc',
  source_import: 'Nhập từ nguồn',
  admin_override: 'Sửa trong Admin',
  override_cleared: 'Trả về gốc',
  human_edit: 'Sửa tay',
};
// Import rows carry source-hash snapshots (objects); only text edits get an old → new line.
const isText = (value: unknown) => value == null || typeof value !== 'object';
const show = (value: unknown) => (value == null || value === '' ? '∅' : typeof value === 'string' ? value : JSON.stringify(value));

export function HistoryList({ entries, labels }: { entries: HistoryEntry[]; labels: Record<string, string> }) {
  if (!entries.length) return <p className="px-4 py-6 text-sm text-(--text-subtle) md:px-8">Chưa có thay đổi nào.</p>;
  const sorted = [...entries].sort((a, b) => String(b.editedAt).localeCompare(String(a.editedAt)));
  return (
    <ol className="divide-y divide-(--border-color)">
      {sorted.map((entry) => (
        <li key={entry.id} className="grid gap-1 px-4 py-3 text-sm md:px-8">
          <div className="flex flex-wrap items-baseline gap-x-3 text-xs text-(--text-subtle)">
            <span className="font-medium text-(--text-muted)">{labels[entry.fieldName] || entry.fieldName}</span>
            <span>{EVENT_VI[entry.eventType] || entry.eventType}</span>
            <span className="ml-auto tabular-nums">{formatDate(entry.editedAt)}</span>
          </div>
          {isText(entry.oldValue) && isText(entry.newValue) && <div className="min-w-0 break-words text-(--text-main)">
            <span className="text-(--text-subtle) line-through">{show(entry.oldValue)}</span>
            <span className="mx-2 text-(--text-subtle)">→</span>
            {show(entry.newValue)}
          </div>}
        </li>
      ))}
    </ol>
  );
}
