// Banner/event time helpers (spec 2026-09-30 §3.4). Times in the data are unix seconds; "now" is Date.now() ms.
export type BannerStatus = 'upcoming' | 'active' | 'ended';

export function status(nowMs: number, startS: number, endS: number): BannerStatus {
  if (nowMs < startS * 1000) return 'upcoming';
  return nowMs < endS * 1000 ? 'active' : 'ended';
}

export function remaining(nowMs: number, endS: number): string {
  const left = Math.floor((endS * 1000 - nowMs) / 1000);
  if (left <= 0) return '';
  const d = Math.floor(left / 86400), h = Math.floor((left % 86400) / 3600), m = Math.floor((left % 3600) / 60);
  if (d > 0) return `${d} ngày ${h} giờ`;
  if (h > 0) return `${h} giờ ${m} phút`;
  return m > 0 ? `${m} phút` : '< 1 phút';
}

export function formatDate(s: number, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(s * 1000);
}
