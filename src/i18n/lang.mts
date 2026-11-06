// Public-site language (owner 2026-11-06, docs/superpowers/specs/2026-11-06-language-switch-design.md).
// VI falls back to CN per field (untranslated); CN shows CN (VI only if CN is empty).
export type Lang = 'vi' | 'cn';
export type Unit = { text: string; untranslated: boolean };
const KEY = 'whmx.lang';
const valid = (v: unknown): v is Lang => v === 'vi' || v === 'cn';

export function resolveLang(search: string, stored: string | null): Lang {
  const q = new URLSearchParams(search).get('lang');
  if (valid(q)) return q;
  return valid(stored) ? stored : 'vi';
}

export function langUrl(href: string, l: Lang): string {
  const u = new URL(href);
  u.searchParams.set('lang', l);
  return u.toString();
}

function stored(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

let current: Lang | null = null;
export function getLang(): Lang {
  if (current) return current;
  if (typeof window === 'undefined') return 'vi';
  current = resolveLang(location.search, stored());
  document.documentElement.lang = current === 'cn' ? 'zh' : 'vi';
  return current;
}

export function setLang(l: Lang): void {
  if (l === getLang()) return;
  current = l;
  try { localStorage.setItem(KEY, l); } catch { /* private mode: the URL still carries it */ }
  history.replaceState(history.state, '', langUrl(location.href, l));
  document.documentElement.lang = l === 'cn' ? 'zh' : 'vi';
  window.dispatchEvent(new CustomEvent('whmx:lang', { detail: l }));
}

export function pickText(vi?: string | null, cn?: string | null, l: Lang = getLang()): Unit {
  if (l === 'cn') return { text: cn || vi || '', untranslated: false };
  return vi ? { text: vi, untranslated: false } : { text: cn || '', untranslated: !!cn };
}

export const pick = (o: Record<string, any> | null | undefined, field: string, l?: Lang): Unit =>
  pickText(o?.[`${field}_vi`], o?.[`${field}_cn`], l);
export const txt = (o: Record<string, any> | null | undefined, field: string, l?: Lang): string => pick(o, field, l).text;
