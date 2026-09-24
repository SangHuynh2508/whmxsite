import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Dependency-free take on magicui's MagicCard, border glow only: the pointer
// position lives in the --mx/--my custom properties, written straight to the
// element so moving the mouse never re-renders React. Parking them at
// -gradientSize hides the glow when the pointer leaves.
export function MagicCard({ children, className, gradientSize = 200 }: { children?: ReactNode; className?: string; gradientSize?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const off = `${-gradientSize}px`;

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty('--my', `${event.clientY - rect.top}px`);
  };
  const reset = () => {
    ref.current?.style.setProperty('--mx', off);
    ref.current?.style.setProperty('--my', off);
  };

  return (
    <div
      ref={ref}
      onPointerMove={move}
      onPointerLeave={reset}
      className={cn('relative isolate overflow-hidden rounded-[inherit] border border-transparent', className)}
      style={{
        '--mx': off,
        '--my': off,
        background: `linear-gradient(var(--bg-surface) 0 0) padding-box, radial-gradient(${gradientSize}px circle at var(--mx) var(--my), var(--rarity-sr-text), var(--accent) 55%, var(--border-color) 100%) border-box`,
      } as CSSProperties}
    >
      {children}
    </div>
  );
}
