export type DiffRow = { key: string; base: string; theirs: string; yours: string };

// After a 409: what is saved on the server now next to what the user is typing, per changed field.
export function ConflictDiff({ rows, labels, onClose }: { rows: DiffRow[]; labels: Record<string, string>; onClose: () => void }) {
  return (
    <section aria-label="Khác biệt" className="max-h-[50vh] overflow-y-auto border-t border-(--border-color) bg-(--bg-elevated) px-4 py-3 text-[13px] md:px-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-medium">Khác biệt với bản vừa được lưu</h3>
        <button type="button" onClick={onClose} className="text-(--text-muted) hover:text-(--text-main)">Đóng</button>
      </div>
      {rows.length === 0 && <p className="text-(--text-subtle)">Người kia sửa các trường khác; tải bản mới sẽ giữ phần bạn gõ.</p>}
      {rows.map((r) => (
        <div key={r.key} className="grid gap-1 border-t border-(--border-color) py-2 first:border-t-0 md:grid-cols-[160px_1fr_1fr] md:gap-4">
          <span className="text-(--text-muted)">{labels[r.key] ?? r.key}{r.theirs !== r.base && <span className="ml-2 text-(--rarity-ssr-text)">cả hai cùng sửa</span>}</span>
          <p className="whitespace-pre-line break-words"><span className="block text-xs text-(--text-subtle)">Đang lưu trên máy chủ</span>{r.theirs || '∅'}</p>
          <p className="whitespace-pre-line break-words"><span className="block text-xs text-(--text-subtle)">Bạn đang gõ</span>{r.yours || '∅'}</p>
        </div>
      ))}
    </section>
  );
}
