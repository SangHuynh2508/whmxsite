import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Lock, LogOut } from 'lucide-react';
import { getSession, refreshSession, signOut } from '../../app/auth/session.js';
import { cn } from '@/lib/utils';
import { MagicCard } from '@/components/magicui/magic-card';
import { Button, Field, Notice, ViewHeader, inputClass } from '@/ui';
import PreviewView from '../preview/PreviewView';
import AccountsView from '../users/AccountsView';
import CharactersView from '../characters/CharactersView';
import { NAV, currentSection, isAdminRoute, type NavEntry, type Section } from './nav';
import { LOGIN_HASH, authRedirect } from './lib/authRoute.mts';

/*
 * React Admin shell (direction B, picked 2026-09-23 — see
 * docs/admin-redesign/direction-approved.md). Structure borrowed from Linear:
 * dim sidebar, view header, split list/detail, record page with a properties
 * panel. Colours are WHMX tokens only (src/admin/styles/adminShell.css).
 */

type Session = { authenticated: boolean; user?: { name: string; role: string } };

export default function AdminApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [section, setSection] = useState<Section>(currentSection);
  const [isAdmin, setIsAdmin] = useState(isAdminRoute());
  const [hash, setHash] = useState(location.hash);
  const [showPassword, setShowPassword] = useState(false);
  // The admin page a signed-out visitor asked for, reopened after they sign in.
  const nextAfterLogin = useRef('');
  // Preview and Khí Giả mount on first visit and then stay mounted (hidden) so an unsaved draft survives a trip to another area.
  const [previewMounted, setPreviewMounted] = useState(false);
  if (section === 'preview' && !previewMounted) setPreviewMounted(true);
  const [charactersMounted, setCharactersMounted] = useState(false);
  if (section === 'characters' && !charactersMounted) setCharactersMounted(true);

  useEffect(() => {
    document.body.classList.toggle('admin-route-active', isAdmin);
  }, [isAdmin]);

  useEffect(() => {
    const onHashChange = () => {
      setSection(currentSection());
      setIsAdmin(isAdminRoute());
      setHash(location.hash);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    // Reuses the cached session check (src/app/auth/session.js) the global nav already made,
    // and follows every later login/logout, including one from the mobile dock.
    const sync = () => getSession().then((s: Session | null) => setSession(s ?? { authenticated: false }));
    void sync();
    window.addEventListener('whmx:session-change', sync);
    return () => window.removeEventListener('whmx:session-change', sync);
  }, []);

  useEffect(() => {
    if (!session || !isAdmin) return;
    if (!session.authenticated && hash !== LOGIN_HASH) nextAfterLogin.current = hash;
    const target = authRedirect(hash, session.authenticated, nextAfterLogin.current);
    if (!target) return;
    if (session.authenticated) nextAfterLogin.current = '';
    location.replace(target);
  }, [session, isAdmin, hash]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        setLoginError(response.status === 401 ? 'Thông tin đăng nhập không hợp lệ.' : 'Không thể kết nối dịch vụ đăng nhập.');
        return;
      }
    } catch {
      setLoginError('Không thể kết nối dịch vụ đăng nhập.');
      return;
    }
    await refreshSession();
  }

  if (!isAdmin) return null;

  if (!session) {
    return (
      <main className="admin-react-root grid min-h-screen place-items-center bg-(--bg-main) text-(--text-main) md:ml-[60px] md:w-[calc(100%-60px)]">
        <p role="status" className="text-sm text-(--text-muted)">Đang xác thực phiên quản trị…</p>
      </main>
    );
  }

  if (!session.authenticated) {
    return (
      <main className="admin-react-root grid min-h-screen place-items-center bg-(--bg-main) px-4 py-12 text-(--text-main) md:ml-[60px] md:w-[calc(100%-60px)]">
        <MagicCard className="w-full max-w-[380px] rounded-xl border-2" gradientSize={300}>
          <section aria-labelledby="admin-login-title">
            <header className="border-b border-(--border-color) px-6 py-5">
              <h1 id="admin-login-title" className="admin-serif text-2xl font-semibold leading-tight">Đăng nhập</h1>
            </header>
            <form onSubmit={(event) => { setLoggingIn(true); void handleLogin(event).finally(() => setLoggingIn(false)); }}>
              <div className="grid gap-4 px-6 py-6">
                <Field label="Email"><input required name="email" type="email" autoComplete="username" className={`${inputClass} h-10`} /></Field>
                <Field label="Mật khẩu">
                  <span className="relative block">
                    <input required name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" className={`${inputClass} h-10 pr-10`} />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      aria-pressed={showPassword}
                      className="absolute inset-y-0 right-0 grid w-10 place-items-center text-(--text-muted) hover:text-(--text-main) focus-visible:outline-2 focus-visible:outline-(--accent)"
                    >
                      {showPassword ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                    </button>
                  </span>
                </Field>
                {loginError && <Notice>{loginError}</Notice>}
              </div>
              <div className="border-t border-(--border-color) px-6 py-4">
                <Button type="submit" variant="primary" disabled={loggingIn} className="h-10 w-full">{loggingIn ? 'Đang đăng nhập…' : 'Đăng nhập'}</Button>
              </div>
            </form>
          </section>
        </MagicCard>
      </main>
    );
  }

  const isOwner = session.user?.role === 'owner';
  const shown = (active: boolean) => (active ? 'flex min-h-0 flex-1 flex-col' : undefined);

  return (
    <main className="admin-react-root flex min-h-screen flex-col bg-(--bg-main) text-(--text-main) md:ml-[60px] md:w-[calc(100%-60px)] md:flex-row lg:h-screen lg:overflow-hidden">
      <Sidebar section={section} name={session.user?.name ?? ''} role={session.user?.role ?? ''} isOwner={isOwner} onLogout={() => void signOut()} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {previewMounted && (
          <div hidden={section !== 'preview'} className={shown(section === 'preview')}>
            <PreviewView isOwner={isOwner} />
          </div>
        )}
        {section === 'accounts' && <AccountsView isOwner={isOwner} />}
        {charactersMounted && (
          <div hidden={section !== 'characters'} className={shown(section === 'characters')}>
            <ViewHeader title="Khí Giả" meta="Nhân vật & trang phục · bản dịch tiếng Việt" />
            <CharactersView />
          </div>
        )}
      </div>
    </main>
  );
}

function NavItem({ entry, active, locked }: { entry: NavEntry; active: boolean; locked: boolean }) {
  const Icon = entry.icon;
  const label = locked ? `${entry.label} (chỉ owner)` : entry.label;
  return (
    <a
      href={entry.href}
      title={label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-8 shrink-0 items-center gap-2.5 rounded-md px-2.5 text-sm focus-visible:outline-2 focus-visible:outline-(--accent) max-xl:justify-center max-xl:px-0',
        active ? 'bg-(--bg-surface-hover) font-medium text-(--text-main)' : 'text-(--text-muted) hover:bg-(--bg-surface-hover) hover:text-(--text-main)',
      )}
    >
      <Icon size={16} className="shrink-0" />
      <span className="truncate max-xl:sr-only">{label}</span>
      {locked && <Lock size={12} aria-hidden className="ml-auto text-(--text-muted) max-xl:hidden" />}
    </a>
  );
}

/**
 * Admin areas nav. Below 768px it's hidden: the mobile dock (src/app/layout/mobileDock.js) lists the admin
 * areas instead. 768–1279px: a 56px icon column (labels as tooltips). ≥1280px: full sidebar.
 */
function Sidebar({ section, name, role, isOwner, onLogout }: { section: Section; name: string; role: string; isOwner: boolean; onLogout: () => void }) {
  const item = (entry: NavEntry) => (
    <NavItem key={entry.id} entry={entry} active={section === entry.id} locked={Boolean(entry.ownerOnly && !isOwner)} />
  );
  return (
    <nav aria-label="Khu quản trị" className="flex shrink-0 flex-col border-r border-(--border-color) bg-(--bg-main) px-2 py-3 max-md:hidden md:sticky md:top-0 md:h-screen md:w-14 md:self-start xl:w-[208px] xl:px-3">
      <div className="mb-6 mt-1 flex items-baseline gap-2 px-2.5 max-xl:justify-center max-xl:px-0">
        <span lang="zh" className="admin-cn text-[15px] font-bold text-(--text-main)">物<span className="max-xl:hidden">华弥新</span></span>
        <span className="text-xs text-(--text-muted) max-xl:hidden">Quản trị</span>
      </div>
      <p className="px-2.5 pb-1.5 text-xs text-(--text-muted) max-xl:hidden">Sổ đăng ký</p>
      <div className="grid gap-0.5">{NAV.filter((entry) => !entry.foot).map(item)}</div>
      <div className="mt-auto grid gap-0.5">
        {NAV.filter((entry) => entry.foot).map(item)}
        <div className="mt-3 flex items-center gap-2 border-t border-(--border-color) pt-3 xl:px-2.5">
          <span className="block min-w-0 max-xl:hidden">
            <span className="block truncate text-sm text-(--text-main)">{name}</span>
            <span className="block text-xs capitalize text-(--text-muted)">{role}</span>
          </span>
          <Button variant="ghost" onClick={onLogout} aria-label="Đăng xuất" title="Đăng xuất" className="px-2 max-xl:mx-auto xl:-mr-2 xl:ml-auto">
            <LogOut size={15} aria-hidden />
          </Button>
        </div>
      </div>
    </nav>
  );
}
