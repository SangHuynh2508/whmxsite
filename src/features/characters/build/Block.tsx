import type { ReactNode } from 'react';
import type { BlockId, Span } from './sheetLayout.mts';

// One module of the build sheet. `action` = where a later public "Sửa" button goes (spec 2026-09-28 R4).
// `bs-b-<id>` lets the phone layout reorder blocks (Thâm tạo right after Vũ khí, spec C1).
export function Block({ id, title, span, action, children }: { id: BlockId; title: string; span: Span; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={`bs-mod bs-s${span} bs-b-${id}`}>
      <header className="bs-mod-head"><h3>{title}</h3>{action}</header>
      {children}
    </section>
  );
}
