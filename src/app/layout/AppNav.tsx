import { StrictMode, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { Calculator, LayoutGrid, ListOrdered, LogIn, LogOut, Search, ShieldCheck, Shirt, UsersRound } from 'lucide-react';
import { Menu, X } from 'lucide'; // morph data, not components
import { MorphIcon } from 'morphicons/react';
import { getSession, isAuthorizedEditor, signOut } from '../auth/session.js';
import { calculatorHash, parseHash } from '../router/router.js';
import { gsap } from 'gsap';
import { getGameData } from '../../data/loader.js';
import { getCharacterAvatarUrl } from '../../ui/utils/avatar.mts';
import { searchSite } from './siteSearch.mts';
import { NAV, currentSection, isAdminRoute } from '../../admin/layout/nav';

/*
 * Global navigation, one React root: the desktop rail (≥769px) and the mobile
 * menu (≤768px: floating ☰ + full-screen sheet with search) share the link list, the active-route rule and
 * the session state. Which one shows is pure CSS (src/style.css .app-nav*, .mobile-menu*).
 */

// Only the hot pages sit in the rail; Home is the brand mark, Banner and Vũ Khí live in "Thông tin" (owner 2026-09-30).
const PUBLIC_LINKS = [
  { href: '#/characters', label: 'Khí Giả', icon: UsersRound, views: ['catalog', 'character'] },
  { href: '#/tier-list', label: 'Tier List', icon: ListOrdered, views: ['tier-list'] },
  { href: '#/gallery', label: 'Trang Phục', icon: Shirt, views: ['gallery', 'skin-detail'] },
  { href: '#/info', label: 'Thông tin', icon: LayoutGrid, views: ['info', 'banners', 'weapons'] },
  { href: '#calc', label: 'Công cụ', icon: Calculator, views: ['calculator'] },
];

// The calculator link keeps the currently selected character.
const linkClick = (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
  if (href === '#calc') {
    event.preventDefault();
    location.hash = calculatorHash();
  }
  event.currentTarget.blur(); // the rail expands on :focus-within; let it collapse after a click
};

function AppNav() {
  const [, setHash] = useState(location.hash); // re-render on navigation; the active item is read from location
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const onHash = () => setHash(location.hash);
    const syncAuth = () => getSession().then((session: unknown) => setAuthorized(isAuthorizedEditor(session)));
    void syncAuth();
    window.addEventListener('hashchange', onHash);
    window.addEventListener('whmx:session-change', syncAuth);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('whmx:session-change', syncAuth);
    };
  }, []);

  const view: string = parseHash().view;
  return (
    <>
      <DesktopRail view={view} authorized={authorized} />
      <MobileMenu view={view} authorized={authorized} />
    </>
  );
}

/* ---------- Desktop rail: 60px, expands on hover; one highlight slides to the active item ---------- */

function DesktopRail({ view, authorized }: { view: string; authorized: boolean }) {
  const railRef = useRef<HTMLElement>(null);
  const [top, setTop] = useState<number | null>(null);
  const [animated, setAnimated] = useState(false);

  useLayoutEffect(() => {
    const place = () => {
      const rail = railRef.current;
      const active = rail?.querySelector('.app-nav-item.active');
      setTop(rail && active ? active.getBoundingClientRect().top - rail.getBoundingClientRect().top : null);
    };
    place();
    window.addEventListener('resize', place); // the footer (login) item moves with the viewport height
    return () => window.removeEventListener('resize', place);
  }, [view, authorized]);

  // Place the highlight without a slide on first paint, then animate every later move.
  useEffect(() => {
    if (top === null || animated) return;
    const frame = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(frame);
  }, [top, animated]);

  const adminLabel = authorized ? 'Quản trị' : 'Đăng nhập';
  const AdminIcon = authorized ? ShieldCheck : LogIn;
  const adminHref = authorized ? '#/admin' : '#/login';
  return (
    <aside ref={railRef} className="app-nav" id="app-nav" aria-label="Thanh điều hướng ứng dụng">
      <span
        aria-hidden
        className={`app-nav-indicator${animated ? ' is-animated' : ''}`}
        style={top === null ? { opacity: 0 } : { transform: `translateY(${top}px)` }}
      />
      <div className="app-nav-header">
        <a href="#/" className="app-nav-brand" title="Trang chủ · Vật Hoa Di Tân" onClick={linkClick('#/')}>
          <span className="app-nav-brand-mark">物</span>
          <span className="app-nav-brand-full">
            <span className="brand-title">物华弥新</span>
            <span className="brand-subtitle">Vật Hoa Di Tân</span>
          </span>
        </a>
      </div>
      <ul className="app-nav-menu">
        {PUBLIC_LINKS.map(({ href, label, icon: Icon, views }) => (
          <li key={href}>
            <a
              href={href}
              className={`app-nav-item${views.includes(view) ? ' active' : ''}`}
              aria-current={views.includes(view) ? 'page' : undefined}
              data-tooltip={label}
              onClick={linkClick(href)}
            >
              <span className="app-nav-icon"><Icon size={20} /></span>
              <span className="app-nav-label">{label}</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="app-nav-footer">
        <a
          href={adminHref}
          id="app-nav-admin-link"
          className={`app-nav-item${view === 'admin' ? ' active' : ''}`}
          aria-current={view === 'admin' ? 'page' : undefined}
          data-tooltip={adminLabel}
          onClick={linkClick(adminHref)}
        >
          <span className="app-nav-icon"><AdminIcon size={20} /></span>
          <span className="app-nav-label">{adminLabel}</span>
        </a>
      </div>
    </aside>
  );
}

/* ---------- Mobile menu (≤768px, owner 2026-09-28, direction A "Mục lục", docs/public-redesign/mobile-nav/): the
 * bottom dock is gone; a floating ☰ sits bottom-left under the report badge and opens a full-screen sheet with a
 * global search on top. ---------- */

const BAR_STROKE = 2.5; // icons a touch bolder than lucide's default 2 (owner request)
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function MobileMenu({ view, authorized }: { view: string; authorized: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const sheetRef = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Native modal <dialog>: Esc, focus trap and an inert page come for free. The report badge steps aside while it
  // is open (owner: "ẩn nút report đi cho đỡ vướng").
  useEffect(() => {
    const sheet = sheetRef.current;
    if (open && !sheet?.open) {
      sheet?.showModal();
      closeRef.current?.focus(); // showModal focuses the search box, which pops the phone keyboard over the menu
    }
    if (!open && sheet?.open) sheet.close();
    document.body.classList.toggle('mobile-menu-open', open);
    if (!open) setQuery('');
  }, [open]);

  // GSAP: the sheet fades in and its blocks rise in order; closing is instant.
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!open || !sheet || reducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(sheet, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: 'power1.out' });
      gsap.fromTo(sheet.querySelectorAll('.mobile-menu-search, .mobile-menu-list > *'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.45, ease: 'expo.out', stagger: 0.035, clearProps: 'opacity,transform' });
    }, sheet);
    return () => ctx.revert();
  }, [open]);
  // A new query brings its results in the same way.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!open || !list || reducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(list.children, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4, ease: 'expo.out', stagger: 0.03, clearProps: 'opacity,transform' });
    }, list);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const characters = (getGameData()?.characters ?? {}) as Record<string, { id: string; icon?: string }>;
  const results = query.trim() ? searchSite(query, characters) : [];
  // Any link in the sheet closes it; the hash change does the navigation.
  const closeOnLink = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest('a')) setOpen(false);
  };
  const section = isAdminRoute() ? currentSection() : null;

  return (
    <>
      <button type="button" className="mobile-menu-fab" aria-label="Menu" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <MorphIcon icon={Menu} size={20} strokeWidth={BAR_STROKE} reducedMotion="user" />
      </button>

      <dialog ref={sheetRef} className="mobile-menu-sheet" aria-label="Menu" onClose={() => setOpen(false)}>
        <div className="mobile-menu-body" onClick={closeOnLink}>
          <label className="mobile-menu-search">
            <Search size={18} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && results[0]) { location.hash = results[0].href; setOpen(false); } }}
              placeholder="Tìm Khí Giả hoặc trang phục"
              aria-label="Tìm Khí Giả hoặc trang phục"
              autoComplete="off"
              enterKeyHint="search"
            />
          </label>
          <div ref={listRef} className="mobile-menu-list">
            {query.trim() ? (
              results.length ? results.map((r) => (
                <a key={r.href} href={r.href} className="mobile-menu-result">
                  <img src={getCharacterAvatarUrl(characters[r.characterId])} alt="" loading="lazy" />
                  <span><b>{r.title}</b><small>{r.sub}</small></span>
                  <em>{r.kind === 'character' ? 'Khí Giả' : 'Trang phục'}</em>
                </a>
              )) : <p className="mobile-menu-empty">Không tìm thấy. Thử tên tiếng Trung hoặc bỏ dấu.</p>
            ) : (
              <>
                <p className="mobile-menu-heading">Trang</p>
                <ul>
                  {/* no rail logo on phones: the brand row is the way home */}
                  <li>
                    <a href="#/" className={view === 'home' ? 'active' : undefined} aria-current={view === 'home' ? 'page' : undefined} onClick={linkClick('#/')}>
                      <span className="mobile-menu-mark" aria-hidden="true">物</span>Vật Hoa Di Tân
                    </a>
                  </li>
                  {PUBLIC_LINKS.map(({ href, label, icon: Icon, views }) => (
                    <li key={href}>
                      <a href={href} className={views.includes(view) ? 'active' : undefined} aria-current={views.includes(view) ? 'page' : undefined} onClick={linkClick(href)}>
                        <Icon size={20} />{label}
                      </a>
                    </li>
                  ))}
                </ul>
                {authorized ? (
                  <>
                    <p className="mobile-menu-heading">Quản trị</p>
                    <ul>
                      {NAV.map(({ id, href, label, icon: Icon }) => (
                        <li key={id}>
                          <a href={href} className={section === id ? 'active' : undefined} aria-current={section === id ? 'page' : undefined}>
                            <Icon size={20} />{label}
                          </a>
                        </li>
                      ))}
                      <li>
                        <button type="button" onClick={() => { setOpen(false); void signOut(); }}><LogOut size={20} />Đăng xuất</button>
                      </li>
                    </ul>
                  </>
                ) : (
                  <>
                    <p className="mobile-menu-heading">Tài khoản</p>
                    <a href="#/login" className={view === 'admin' ? 'active' : undefined}><LogIn size={20} />Đăng nhập</a>
                  </>
                )}
              </>
            )}
          </div>
          {/* Exactly where ☰ is, morphing with the same `open ? X : Menu`; focused on open so the phone keyboard stays
              down until the search box is tapped. */}
          <button ref={closeRef} type="button" className="mobile-menu-fab" aria-label="Đóng menu" onClick={() => setOpen(false)}>
            <MorphIcon icon={open ? X : Menu} size={20} strokeWidth={BAR_STROKE} reducedMotion="user" />
          </button>
        </div>
      </dialog>
    </>
  );
}

export function initAppNav() {
  const container = document.createElement('div');
  document.body.prepend(container); // before #app, where the static rail markup used to be
  createRoot(container).render(<StrictMode><AppNav /></StrictMode>);
}
