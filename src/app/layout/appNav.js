import { createIcons, UsersRound, Shirt, Sword, Database, Calculator, LogIn, ShieldCheck } from 'lucide';
import { getSession, isAuthorizedEditor } from '../auth/session.js';

export function initAppNav() {
  createIcons({
    icons: {
      UsersRound,
      Shirt,
      Sword,
      Database,
      Calculator,
      LogIn,
      ShieldCheck
    },
    attrs: {
      width: 20,
      height: 20,
      'stroke-width': 2,
      stroke: 'currentColor'
    }
  });
  syncAdminNavEntry();
}

// The entry is always visible (it's the discoverable shortcut to #/admin,
// per Roadmap Phase 2) — its icon/label reflect the boot-time session check
// (src/app/auth/session.js): a plain login icon by default, swapping to a
// "you're the admin" icon once authorized. WHMX login has no
// general-audience purpose beyond letting an already-authenticated
// owner/editor jump back in.
function syncAdminNavEntry() {
  const link = document.getElementById('app-nav-admin-link');
  const label = document.getElementById('app-nav-admin-label');
  const loggedOutIcon = document.getElementById('app-nav-admin-icon-loggedout');
  const loggedInIcon = document.getElementById('app-nav-admin-icon-loggedin');
  if (!link || !label || !loggedOutIcon || !loggedInIcon) return;
  getSession().then((session) => {
    const authorized = isAuthorizedEditor(session);
    const text = authorized ? 'Quản trị' : 'Đăng nhập';
    label.textContent = text;
    link.dataset.tooltip = text;
    loggedOutIcon.classList.toggle('hidden', authorized);
    loggedInIcon.classList.toggle('hidden', !authorized);
  });
}
