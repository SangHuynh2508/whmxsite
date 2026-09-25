import { useId } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  original: string | null | undefined; // read-only CN (left page)
  sourceVi: string | null | undefined; // workbook VI the field falls back to
  override: string | null | undefined; // active admin override, null when none
  value: string;
  dirty: boolean;
  onChange: (value: string) => void;
  onRevert: () => void;
  multiline?: boolean;
};

// Auto-grow where CSS `field-sizing` is missing (Firefox): size the textarea to its content.
const fit = (el: HTMLTextAreaElement | null) => {
  if (!el || CSS.supports('field-sizing', 'content')) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

// Sticky column captions above a list of pairs (desktop only; phones stack the pair).
export function PairHead() {
  return (
    <div className="sticky top-0 z-[2] grid grid-cols-2 gap-12 border-b border-(--border-color) bg-(--bg-main) px-8 py-2.5 text-[11px] uppercase tracking-[.3em] text-(--text-subtle) max-md:hidden">
      <span>Nguyên bản</span>
      <span>Tiếng Việt</span>
    </div>
  );
}

// One bilingual pair (direction: B layout, C field): CN left, borderless VI right with a hairline
// that turns gold on focus or when dirty — the hairline is the focus indicator.
export function OverridableField({ label, original, sourceVi, override, value, dirty, onChange, onRevert, multiline }: Props) {
  const id = useId();
  const empty = value.trim() === '';
  return (
    <div className="grid grid-cols-1 gap-x-12 gap-y-3 border-t border-(--border-color) py-5 pl-7 pr-4 first:border-t-0 md:grid-cols-2 md:px-8 md:py-6">
      <label htmlFor={id} className="text-xs font-medium tracking-wide text-(--text-muted) md:col-span-2">{label}</label>
      <p id={`${id}-cn`} className="admin-cn min-w-0 whitespace-pre-line text-[15px] leading-8 text-(--text-muted)">{original || '—'}</p>
      <div
        className={cn(
          'relative min-w-0',
          'before:absolute before:-left-3 before:top-1.5 before:bottom-1.5 before:w-px before:bg-(--border-color) before:transition-colors md:before:-left-6',
          'focus-within:before:bg-(--accent)',
          dirty && 'before:bg-(--accent)',
        )}
      >
        <textarea
          id={id}
          ref={fit}
          rows={1}
          value={value}
          aria-describedby={`${id}-cn ${id}-note`}
          placeholder={sourceVi ? `Để trống = dùng bản gốc: ${sourceVi}` : 'Viết bản tiếng Việt…'}
          onChange={(event) => { onChange(event.target.value); fit(event.target); }}
          className={cn(
            'block w-full resize-none border-0 bg-transparent p-0 text-base font-light leading-[1.9] text-(--text-main) outline-none [field-sizing:content]',
            'placeholder:italic placeholder:text-(--text-subtle) focus-visible:outline-none',
            multiline ? 'min-h-16' : 'min-h-8',
          )}
        />
        <div id={`${id}-note`} className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--text-subtle)">
          {override != null && !empty && (
            <>
              <span className="text-(--accent)">Đang dùng bản sửa</span>
              {sourceVi && <span className="min-w-0 truncate">Gốc: {sourceVi}</span>}
              <button type="button" onClick={onRevert} className="transition-colors hover:text-(--text-main)">Trả về gốc</button>
            </>
          )}
          {empty && !sourceVi && <span>Chưa dịch</span>}
          <span className="ml-auto tabular-nums">{value.length} ký tự</span>
        </div>
      </div>
    </div>
  );
}
