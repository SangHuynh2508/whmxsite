import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const fit = (el: HTMLTextAreaElement | null) => {
  if (!el || CSS.supports('field-sizing', 'content')) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

// A bilingual row: caption across, CN left (serif, read-only), VI right.
export function PairRow({ id, label, extra, original, children }: { id: string; label: string; extra?: ReactNode; original: ReactNode; children: ReactNode }) {
  return (
    <div id={`pair-${id}`} data-unit={id} className="grid scroll-mt-12 grid-cols-1 gap-x-12 gap-y-3 border-t border-(--border-color) py-5 pl-7 pr-4 first:border-t-0 max-lg:scroll-mt-14 md:grid-cols-2 md:px-8 md:py-6">
      <div className="flex flex-wrap items-baseline gap-x-3.5 text-xs md:col-span-2">
        <label htmlFor={`vi-${id}`} className="font-medium tracking-wide text-(--text-muted)">{label}</label>
        {extra && <span className="text-(--text-subtle)">{extra}</span>}
      </div>
      <div id={`cn-${id}`} lang="zh" className="admin-cn min-w-0 whitespace-pre-line text-[15px] leading-8 text-(--text-muted)">{original || '—'}</div>
      {children}
    </div>
  );
}

// Borderless VI textarea; the hairline on its left is the focus/dirty indicator (gold on focus or when dirty).
export function ViCell({ id, value, dirty, placeholder, multiline, onChange, notes }: { id: string; value: string; dirty: boolean; placeholder: string; multiline?: boolean; onChange: (v: string) => void; notes: ReactNode }) {
  return (
    <div className={cn('relative min-w-0 before:absolute before:-left-3 before:top-1.5 before:bottom-1.5 before:w-px before:bg-(--border-color) before:transition-colors md:before:-left-6 focus-within:before:bg-(--accent)', dirty && 'before:bg-(--accent)')}>
      <textarea
        id={`vi-${id}`} ref={fit} rows={1} value={value} placeholder={placeholder}
        aria-describedby={`cn-${id} note-${id}`}
        onChange={(event) => { onChange(event.target.value); fit(event.target); }}
        className={cn('block w-full resize-none border-0 bg-transparent p-0 text-base font-light leading-[1.9] text-(--text-main) outline-none [field-sizing:content] placeholder:italic placeholder:text-(--text-subtle) focus-visible:outline-none', multiline ? 'min-h-16' : 'min-h-8')}
      />
      <div id={`note-${id}`} className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--text-subtle)">{notes}</div>
    </div>
  );
}
