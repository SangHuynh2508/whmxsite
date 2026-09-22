import { createIcons, UsersRound, Shirt, Sword, Database, Calculator, ShieldCheck } from 'lucide';
import { getSession, isAuthorizedEditor } from '../auth/session.js';

export function initAppNav() {
  createIcons({
    icons: {
      UsersRound,
      Shirt,
      Sword,
      Database,
      Calculator,
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

// WHMX has no general-audience login — the nav entry only exists for
// visitors who are already an authenticated owner/editor, never as an
// invitation to sign in. Hidden by default, shown once the boot-time
// session check (src/app/auth/session.js) resolves as authorized.
function syncAdminNavEntry() {
  const link = document.getElementById('app-nav-admin-link');
  if (!link) return;
  getSession().then((session) => {
    link.classList.toggle('hidden', !isAuthorizedEditor(session));
  });
}
