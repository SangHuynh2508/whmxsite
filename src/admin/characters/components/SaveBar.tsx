import { Button } from '../../layout/ui';
import type { EditorStatus } from '../lib/editorState.mts';

type Props = { dirtyCount: number; status: EditorStatus; message: string; onSave: () => void; onDiscard: () => void; onReload: () => void };

// Bottom strip of the record on desktop, fixed to the screen bottom on phones.
export function SaveBar({ dirtyCount, status, message, onSave, onDiscard, onReload }: Props) {
  if (dirtyCount === 0 && status === 'idle') return null;
  const saving = status === 'saving';
  return (
    <div className="fixed inset-x-0 bottom-(--admin-dock) z-20 flex flex-none items-center gap-3 border-t border-(--border-color) bg-(--bg-surface) px-4 py-2.5 text-[13px] md:static md:px-5">
      {dirtyCount > 0 && <span className="text-(--accent)">{dirtyCount} thay đổi chưa lưu</span>}
      <span role="status" className="min-w-0 flex-1 truncate text-(--text-subtle)">{message}</span>
      {status === 'conflict' && <Button onClick={onReload}>Tải bản mới</Button>}
      {dirtyCount > 0 && (
        <>
          <kbd className="rounded border border-(--border-strong) px-1 font-mono text-[11px] text-(--text-muted) max-md:hidden">Ctrl S</kbd>
          <Button variant="ghost" onClick={onDiscard} disabled={saving}>Bỏ thay đổi</Button>
          <Button variant="primary" onClick={onSave} disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</Button>
        </>
      )}
    </div>
  );
}
