// Banner/event time helpers (spec 2026-09-30 §3.4). Times in the data are unix seconds; "now" is Date.now() ms.
import { s } from '../../i18n/strings.mts';

export type BannerStatus = 'upcoming' | 'active' | 'ended';

export function status(nowMs: number, startS: number, endS: number): BannerStatus {
  if (nowMs < startS * 1000) return 'upcoming';
  return nowMs < endS * 1000 ? 'active' : 'ended';
}

export function remaining(nowMs: number, endS: number): string {
  const left = Math.floor((endS * 1000 - nowMs) / 1000);
  if (left <= 0) return '';
  const d = Math.floor(left / 86400), h = Math.floor((left % 86400) / 3600), m = Math.floor((left % 3600) / 60);
  const f = (k: 'tmDH' | 'tmHM' | 'tmM') => s(k).replace('{d}', () => String(d)).replace('{h}', () => String(h)).replace('{m}', () => String(m));
  if (d > 0) return f('tmDH');
  if (h > 0) return f('tmHM');
  return m > 0 ? f('tmM') : s('tmLt');
}

export function formatDate(s: number, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(s * 1000);
}
