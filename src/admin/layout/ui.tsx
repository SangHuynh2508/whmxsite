import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ---------- Vietnamese labels for raw enum data (raw value stays visible next to them) ---------- */

export const LIFECYCLE_VI: Record<string, string> = {
  unverified: 'Chờ giám định',
  unreleased: 'Chưa ra mắt',
  released: 'Đã ra mắt',
  retired: 'Đã rút',
};
export const VISIBILITY_VI: Record<string, string> = { hidden: 'Ẩn', preview: 'Xem trước', public: 'Công khai' };
export const PROVENANCE_VI: Record<string, string> = {
  source_extracted: 'Ảnh trích từ game',
  manual_preview: 'Ảnh xem trước (chưa chính thức)',
  manual_official: 'Ảnh chính thức',
  manual_placeholder: 'Ảnh tạm',
};
export const ROLE_VI: Record<string, string> = { avatar: 'Ảnh đại diện', card: 'Ảnh thẻ', drawing: 'Tranh lập họa' };

const ERROR_VI: Record<string, string> = {
  FORBIDDEN: 'Máy chủ từ chối quyền thực hiện.',
  OBJECT_NOT_FOUND: 'Tệp chưa được tải lên.',
  UPLOAD_FAILED: 'Tải tệp lên thất bại.',
  REQUEST_FAILED: 'Yêu cầu thất bại.',
  VERSION_CONFLICT: 'Bản ghi đã thay đổi ở nơi khác.',
};
export function describeError(failure: unknown) {
  const code = failure instanceof Error ? failure.message : String(failure);
  return ERROR_VI[code] ? `${ERROR_VI[code]} (${code})` : `Lỗi: ${code}`;
}
export const statusOf = (failure: unknown) => (failure as { status?: number } | null)?.status;

export function formatDate(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

/* ---------- Lifecycle glyph: the accession path drawn as one progressing mark ---------- */

export function LifecycleGlyph({ lifecycle, className }: { lifecycle: string; className?: string }) {
  const common = { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': true, className: cn('shrink-0', className) } as const;
  if (lifecycle === 'released') {
    return (
      <svg {...common} className={cn(common.className, 'text-(--admin-gold-ink)')}>
        <circle cx="8" cy="8" r="7" fill="currentColor" />
        <path d="M4.8 8.2l2.1 2.1 4.3-4.6" fill="none" stroke="var(--admin-on-gold)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (lifecycle === 'unreleased') {
    return (
      <svg {...common} className={cn(common.className, 'text-(--text-main)')}>
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4a4 4 0 0 1 0 8z" fill="currentColor" />
      </svg>
    );
  }
  if (lifecycle === 'retired') {
    return (
      <svg {...common} className={cn(common.className, 'text-(--text-muted)')}>
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3.8 12.2l8.4-8.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common} className={cn(common.className, 'text-(--text-muted)')}>
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.4 2.1" />
    </svg>
  );
}

/* ---------- Primitives ---------- */

type Variant = 'primary' | 'secondary' | 'ghost';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-(--accent) text-(--admin-on-gold) font-semibold hover:brightness-105',
  secondary: 'border border-(--border-strong) bg-(--bg-surface) text-(--text-main) hover:bg-(--bg-surface-hover)',
  ghost: 'text-(--text-muted) hover:text-(--text-main) hover:bg-(--bg-surface-hover)',
};
export function Button({ variant = 'secondary', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium',
        'transition-[color,background-color,border-color,transform] duration-(--motion-fast) ease-(--ease-standard) active:scale-[.97] disabled:active:scale-100 motion-reduce:active:scale-100',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) disabled:cursor-not-allowed disabled:opacity-45',
        VARIANT[variant],
        className,
      )}
    />
  );
}

export const inputClass =
  'w-full rounded-md border border-(--input-border) bg-(--input-bg) px-3 text-sm text-(--input-text) placeholder:text-(--input-placeholder) ' +
  'hover:bg-(--input-bg-hover) focus:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--border-gold-subtle) disabled:cursor-not-allowed disabled:opacity-55';

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={cn('relative block', className)}>
      <select {...props} className={cn(inputClass, 'h-9 appearance-none pr-8')}>
        {children}
      </select>
      <ChevronDown size={14} aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-(--text-muted)" />
    </span>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('grid content-start gap-1.5', className)}>
      <span className="text-[13px] font-medium text-(--text-muted)">{label}</span>
      {children}
      {hint && <span className="text-xs text-(--text-muted)">{hint}</span>}
    </label>
  );
}

export function Notice({ tone = 'danger', children, className }: { tone?: 'danger' | 'warn'; children: ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-md border px-3 py-2 text-sm',
        tone === 'danger' ? 'border-(--admin-danger-line) bg-(--admin-danger-bg) text-(--admin-danger)' : 'border-(--border-gold-subtle) bg-(--admin-warn-bg) text-(--admin-warn)',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SkeletonRows({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div aria-busy="true" aria-label="Đang tải" className={cn('grid gap-2 p-3', className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-11 animate-pulse rounded-md bg-(--bg-surface-hover)" />
      ))}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-(--border-color) pb-2">
      <h3 className="admin-serif text-lg font-semibold text-(--text-main)">{children}</h3>
      {aside}
    </div>
  );
}

export function ViewHeader({ title, meta, children }: { title: string; meta?: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-(--border-color) bg-(--bg-surface) px-4 lg:px-6">
      <h1 className="text-sm font-semibold text-(--text-main)">{title}</h1>
      {meta && <span className="min-w-0 truncate text-[13px] text-(--text-muted)">{meta}</span>}
      <div className="ml-auto flex items-center gap-1.5">{children}</div>
    </header>
  );
}
