import { useState } from 'react';
import { cn } from '@/lib/utils';

// Public avatar by ID (characters: A0001.png, skins: a0001001.png); initials when the file is missing.
export function Avatar({ src, label, className }: { src: string; label: string; className?: string }) {
  const [missing, setMissing] = useState(false);
  const box = cn('shrink-0 bg-(--bg-elevated) object-cover', className);
  if (missing) return <span aria-hidden className={cn(box, 'grid place-items-center text-xs text-(--text-subtle)')}>{label.slice(-2)}</span>;
  return <img src={src} alt="" loading="lazy" onError={() => setMissing(true)} className={box} />;
}

export const characterAvatar = (id: string) => `/assets/characters/avatars/${id}.png`;
export const skinAvatar = (id: string) => `/assets/characters/avatars/${id.toLowerCase()}.png`;
