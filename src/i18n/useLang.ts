import { useSyncExternalStore } from 'react';
import { getLang } from './lang.mts';
const sub = (cb: () => void) => { window.addEventListener('whmx:lang', cb); return () => window.removeEventListener('whmx:lang', cb); };
export const useLang = () => useSyncExternalStore(sub, getLang, () => 'vi' as const);
