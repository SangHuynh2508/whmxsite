import { Archive, ScanEye, Users, type LucideIcon } from 'lucide-react';

export type Section = 'characters' | 'preview' | 'accounts';
export type NavEntry = { id: Section; href: string; label: string; icon: LucideIcon; foot?: boolean; ownerOnly?: boolean };

// One entry per admin area, shared by the Admin sidebar and the mobile dock.
// A new domain (Buff, Skill…) is one line here plus its view in AdminApp's body.
export const NAV: NavEntry[] = [
  { id: 'characters', href: '#/admin/characters', label: 'Khí Giả', icon: Archive },
  { id: 'preview', href: '#/admin', label: 'Preview', icon: ScanEye },
  { id: 'accounts', href: '#/admin/accounts', label: 'Tài khoản', icon: Users, foot: true, ownerOnly: true },
];

export const ADMIN_HASH = '#/admin';
// #/login is the signed-out face of the admin shell (see lib/authRoute.mts).
export const isAdminRoute = () => location.hash === '#/login' || location.hash === ADMIN_HASH || location.hash.startsWith(`${ADMIN_HASH}/`);
// '#/admin' (Preview) is the fallback for any admin hash no other entry claims.
export const currentSection = (): Section =>
  NAV.find(({ href }) => href !== ADMIN_HASH && (location.hash === href || location.hash.startsWith(`${href}/`)))?.id ?? 'preview';
