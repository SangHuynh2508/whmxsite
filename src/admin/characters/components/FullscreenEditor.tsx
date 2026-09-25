import { useEffect, useRef } from 'react';

export function FullscreenEditor({ label, original, value, onChange, onClose }: { label: string; original: string; value: string; onChange: (v: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} onClose={onClose} aria-label={`${label} — phóng to`} className="m-0 h-dvh max-h-none w-screen max-w-none bg-(--bg-main) p-0 text-(--text-main) backdrop:bg-(--bg-main)">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-(--border-color) px-4 py-2.5 text-sm md:px-8">
          <span className="font-medium">{label}</span>
          <button type="button" onClick={() => ref.current?.close()} className="text-(--text-muted) hover:text-(--text-main)">Đóng (Esc)</button>
        </div>
        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-4 py-6 md:grid-cols-2 md:gap-12 md:px-8">
          <p lang="zh" className="admin-cn whitespace-pre-line text-[15px] leading-8 text-(--text-muted)">{original}</p>
          <textarea autoFocus value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} — tiếng Việt`} className="min-h-[60vh] w-full resize-none border-0 bg-transparent p-0 text-base font-light leading-[1.9] outline-none focus-visible:outline-none" />
        </div>
        <div className="border-t border-(--border-color) px-4 py-2 text-right text-xs text-(--text-subtle) md:px-8">{value.length} ký tự</div>
      </div>
    </dialog>
  );
}
