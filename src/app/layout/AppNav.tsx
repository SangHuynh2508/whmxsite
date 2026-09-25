import { StrictMode, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { Calculator, ChevronDown, ChevronUp, LogIn, LogOut, Search, ShieldCheck, Shirt, Sword, UsersRound } from 'lucide-react';
import { Menu, X } from 'lucide'; // morph data, not components
import { MorphIcon } from 'morphicons/react';
import { getSession, isAuthorizedEditor, signOut } from '../auth/session.js';
import { calculatorHash, parseHash } from '../router/router.js';
import { openMobileDrawer } from './sidebar.js';
import { NAV, currentSection, isAdminRoute } from '../../admin/layout/nav';

/*
 * Global navigation, one React root: the desktop rail (≥769px) and the mobile
 * bottom dock (≤768px) share the link list, the active-route rule and the
 * session state. Which one shows is pure CSS (src/style.css .app-nav*, .mobile-dock*).
 */

const PUBLIC_LINKS = [
  { href: '#/characters', label: 'Khí Giả', icon: UsersRound, views: ['catalog', 'character'] },
  { href: '#/gallery', label: 'Trang Phục', icon: Shirt, views: ['gallery', 'skin-detail'] },
  { href: '#/weapons', label: 'Vũ Khí', icon: Sword, views: ['weapons', 'data'] },
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
      <MobileDock view={view} authorized={authorized} />
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
        <a href="#/characters" className="app-nav-brand" title="Vật Hoa Di Tân" onClick={linkClick('#/characters')}>
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

/* ---------- Mobile dock: 🔍 focus the page's search box, ☰ menu sheet, ˅ collapse to a ˄ tab ---------- */

const COLLAPSED_KEY = 'whmx:mobile-dock-collapsed';
const BAR_STROKE = 2.5; // dock icons a touch bolder than lucide's default 2 (owner request)

// Every search box in the app (catalog, gallery, admin lists) has a "Tìm…" placeholder.
const visibleSearch = () =>
  [...document.querySelectorAll<HTMLInputElement>('input[placeholder^="Tìm"]')].find((input) => input.checkVisibility({ visibilityProperty: true }));
// The calculator's search lives in the (closed) character drawer.
const onCalculator = () => location.hash.startsWith('#calc');

function readCollapsed() {
  try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
}

function MobileDock({ view, authorized }: { view: string; authorized: boolean }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [hasSearch, setHasSearch] = useState(false);
  const sheetRef = useRef<HTMLDialogElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const tabRef = useRef<HTMLButtonElement>(null);
  const toggled = useRef(false);

  useEffect(() => {
    document.body.classList.toggle('mobile-dock-collapsed', collapsed);
    try { localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : ''); } catch { /* storage blocked: not remembered */ }
    // Move focus to whichever control just appeared (not on first mount).
    if (toggled.current) (collapsed ? tabRef : menuRef).current?.focus();
  }, [collapsed]);

  // Native modal <dialog>: Esc, focus move and an inert page come for free.
  useEffect(() => {
    const sheet = sheetRef.current;
    if (open && !sheet?.open) sheet?.showModal();
    if (!open && sheet?.open) sheet.close();
  }, [open]);

  useEffect(() => {
    // ponytail: re-checks on any DOM change (one rAF per batch) because views render async;
    // tag search inputs explicitly if this ever shows up in a profile.
    let frame = 0;
    const sync = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setHasSearch(Boolean(visibleSearch()) || onCalculator());
      });
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    sync();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);

  const toggleCollapsed = (value: boolean) => {
    toggled.current = true;
    setCollapsed(value);
  };
  const search = () => {
    const input = visibleSearch();
    if (input) input.focus();
    else if (onCalculator()) openMobileDrawer();
  };
  // Any link in the sheet closes it; the hash change does the navigation.
  const closeOnLink = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest('a')) setOpen(false);
  };
  const section = isAdminRoute() ? currentSection() : null;

  return (
    <>
      <nav className="mobile-dock" aria-label="Điều hướng">
        <div className="mobile-dock-bar">
          {hasSearch ? (
            <button type="button" aria-label="Tìm kiếm" onClick={search}><Search size={20} strokeWidth={BAR_STROKE} /></button>
          ) : (
            <span aria-hidden className="mobile-dock-spacer" />
          )}
          <button ref={menuRef} type="button" aria-label="Menu" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
            <MorphIcon icon={open ? X : Menu} size={20} strokeWidth={BAR_STROKE} reducedMotion="user" />
          </button>
          <button type="button" aria-label="Thu gọn thanh điều hướng" onClick={() => toggleCollapsed(true)}><ChevronDown size={20} strokeWidth={BAR_STROKE} /></button>
        </div>
        <button ref={tabRef} type="button" className="mobile-dock-tab" aria-label="Mở thanh điều hướng" onClick={() => toggleCollapsed(false)}>
          <ChevronUp size={20} strokeWidth={BAR_STROKE} />
        </button>
      </nav>

      <dialog ref={sheetRef} className="mobile-dock-sheet" aria-label="Menu" onClose={() => setOpen(false)}>
        <div className="mobile-dock-sheet-body" onClick={closeOnLink}>
          <p className="mobile-dock-brand">Vật Hoa Di Tân</p>
          <ul>
            {PUBLIC_LINKS.map(({ href, label, icon: Icon, views }) => (
              <li key={href}>
                <a
                  href={href}
                  className={views.includes(view) ? 'active' : undefined}
                  aria-current={views.includes(view) ? 'page' : undefined}
                  onClick={linkClick(href)}
                >
                  <Icon size={20} />{label}
                </a>
              </li>
            ))}
          </ul>
          {authorized ? (
            <>
              <p className="mobile-dock-heading">Quản trị</p>
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
            <a href="#/login" className={view === 'admin' ? 'active' : undefined}><LogIn size={20} />Đăng nhập</a>
          )}
          {/* Sits exactly where ☰ is, morphing with the same `open ? X : Menu`. */}
          <div className="mobile-dock-sheet-close">
            <button type="button" aria-label="Đóng menu" onClick={() => setOpen(false)}>
              <MorphIcon icon={open ? X : Menu} size={20} strokeWidth={BAR_STROKE} reducedMotion="user" />
            </button>
          </div>
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
