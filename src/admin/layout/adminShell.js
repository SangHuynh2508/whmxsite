const ADMIN_HASH = '#/admin';
import { renderPreviewWorkspace } from '../preview/previewWorkspace.js';

// Keep the authenticated session for client-side admin navigation. The API
// remains the authority for every read/write; this only avoids revalidating
// the same cookie while the user moves between already-authenticated islands.
let sessionCache = null;
let renderSequence = 0;
let characterWorkspaceModulePromise = null;
let characterWorkspaceApp = null;

function isAdminRoute() {
  return window.location.hash === ADMIN_HASH || window.location.hash.startsWith(`${ADMIN_HASH}/`);
}

function isCharacterSkinRoute() {
  return window.location.hash === '#/admin/characters' || window.location.hash.startsWith('#/admin/characters/');
}

function apiError(payload) {
  return payload?.error?.code || payload?.code || 'AUTH_OPERATION_FAILED';
}

async function fetchSession() {
  const response = await fetch('/api/admin/session', { credentials: 'same-origin' });
  if (!response.ok) return null;
  return response.json();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function loginMarkup(message = '') {
  return `
    <main class="admin-auth-page">
      <section class="admin-auth-card" aria-labelledby="admin-login-title">
        <p class="admin-eyebrow">WHMX ADMIN</p>
        <h1 id="admin-login-title">Đăng nhập quản trị</h1>
        <p>Chỉ tài khoản đã được owner cấp quyền mới có thể truy cập.</p>
        <form id="admin-login-form" class="admin-form">
          <label>Email<input required name="email" type="email" autocomplete="username"></label>
          <label>Mật khẩu<input required name="password" type="password" autocomplete="current-password"></label>
          <p class="admin-form-error" role="alert">${escapeHtml(message)}</p>
          <button type="submit">Đăng nhập</button>
        </form>
      </section>
    </main>`;
}

function adminLoadingMarkup() {
  return `<main class="admin-auth-page"><section class="admin-shell admin-shell-loading"><p class="admin-eyebrow">WHMX ADMIN</p><p class="admin-route-loading">Đang xác thực phiên quản trị…</p></section></main>`;
}

function usersMarkup(users) {
  const rows = users.map((user) => `
    <tr>
      <td>${escapeHtml(user.name)}</td>
      <td>${escapeHtml(user.email)}</td>
      <td>${escapeHtml(user.role)}</td>
      <td>${escapeHtml(user.status)}</td>
    </tr>`).join('');
  return `
    <section class="admin-users" aria-labelledby="admin-users-title">
      <h2 id="admin-users-title">Tài khoản</h2>
      <form id="admin-provision-form" class="admin-form admin-provision-form">
        <label>Tên hiển thị<input required name="name" maxlength="200"></label>
        <label>Email<input required name="email" type="email" maxlength="320"></label>
        <label>Mật khẩu tạm thời<input required name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password"></label>
        <label>Vai trò<select name="role"><option value="editor">Editor</option><option value="owner">Owner</option></select></label>
        <p class="admin-form-error" role="alert"></p>
        <button type="submit">Cấp tài khoản</button>
      </form>
      <div class="admin-table-wrap"><table><thead><tr><th>Tên</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th></tr></thead><tbody>${rows}</tbody></table></div>
    </section>`;
}

async function renderAuthenticated(root, session, sequence) {
  const characterRoute = isCharacterSkinRoute();
  if (characterWorkspaceApp) {
    characterWorkspaceApp.unmount();
    characterWorkspaceApp = null;
  }
  root.innerHTML = `
    <main class="admin-auth-page">
      <section class="admin-shell">
        <header class="admin-shell-header">
          <div><p class="admin-eyebrow">WHMX ADMIN</p><h1>Quản trị</h1></div>
          <div class="admin-identity"><span>${escapeHtml(session.user.name)}</span><span class="admin-role">${escapeHtml(session.user.role)}</span><button id="admin-logout" type="button">Đăng xuất</button></div>
        </header>
        <nav class="admin-module-nav" aria-label="Admin modules">
          <a href="#/admin/characters" class="${characterRoute ? 'is-active' : ''}">Characters / Skins</a>
          <a href="#/admin" class="${!characterRoute ? 'is-active' : ''}">Preview / Users</a>
        </nav>
        ${characterRoute ? '<div id="admin-character-workspace-root"></div>' : `<div id="admin-users-root">${session.user.role === 'owner' ? '<p>Đang tải tài khoản…</p>' : '<p>Phiên đăng nhập hợp lệ. Chức năng quản lý tài khoản chỉ dành cho owner.</p>'}</div><div id="admin-preview-root"></div>`}
      </section>
    </main>`;
  root.querySelector('#admin-logout').addEventListener('click', async () => {
    await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' });
    sessionCache = null;
    await renderAdmin(root, { forceSession: true });
  });
  if (characterRoute) {
    const characterWorkspaceRoot = root.querySelector('#admin-character-workspace-root');
    // Paint the route shell before the island chunk resolves. This makes the
    // navigation click visible immediately on a cold Vercel function.
    characterWorkspaceRoot.innerHTML = '<div class="character-workspace-loading"><span>WHMX / Characters &amp; Skins</span><strong>Đang mở workspace…</strong></div>';
    characterWorkspaceModulePromise ||= import('../../characterSkinAdminWorkspace.js');
    characterWorkspaceModulePromise.then(({ mountCharacterSkinAdmin }) => {
      if (sequence !== renderSequence || !isCharacterSkinRoute()) return;
      characterWorkspaceApp = mountCharacterSkinAdmin(characterWorkspaceRoot, session);
    }).catch(() => {
      if (sequence !== renderSequence) return;
      characterWorkspaceRoot.innerHTML = '<p class="admin-form-error">Không thể mở workspace Character / Skin.</p>';
    });
    return;
  }
  const previewPromise = renderPreviewWorkspace(root.querySelector('#admin-preview-root'), session);
  if (session.user.role !== 'owner') {
    await previewPromise;
    return;
  }
  const usersRoot = root.querySelector('#admin-users-root');
  // The preview and account lists are independent after the authenticated
  // session is known. Start both requests together so Vercel Dev's per-route
  // overhead is paid once per request rather than as a serial waterfall.
  const usersResponsePromise = fetch('/api/admin/users', { credentials: 'same-origin' }).catch(() => null);
  const [response] = await Promise.all([usersResponsePromise, previewPromise]);
  const payload = await response?.json().catch(() => ({}));
  if (!response?.ok) {
    usersRoot.innerHTML = '<p class="admin-form-error">Không thể tải tài khoản.</p>';
    return;
  }
  usersRoot.innerHTML = usersMarkup(payload.users || []);
  usersRoot.querySelector('#admin-provision-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const error = form.querySelector('.admin-form-error');
    error.textContent = '';
    const values = Object.fromEntries(new FormData(form));
    const result = await fetch('/api/admin/users', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!result.ok) {
      error.textContent = apiError(await result.json().catch(() => ({})));
      return;
    }
    form.reset();
    await renderAuthenticated(root, session);
  });
}

async function renderAdmin(root, { forceSession = false } = {}) {
  if (!isAdminRoute()) return;
  const sequence = ++renderSequence;
  const session = (!forceSession && sessionCache) ? sessionCache : await fetchSession().catch(() => null);
  if (sequence !== renderSequence || !isAdminRoute()) return;
  if (!session?.authenticated) {
    sessionCache = null;
    root.innerHTML = loginMarkup();
    root.querySelector('#admin-login-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const error = form.querySelector('.admin-form-error');
      error.textContent = '';
      const values = Object.fromEntries(new FormData(form));
      try {
        const response = await fetch('/api/auth/sign-in/email', {
          method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values),
        });
        if (!response.ok) {
          // Only a normal authentication rejection is shown as an invalid
          // credential. Missing routes, origin/configuration failures, and
          // server errors must not be misrepresented as a bad password.
          error.textContent = response.status === 401
            ? 'Thông tin đăng nhập không hợp lệ.'
            : 'Không thể kết nối dịch vụ đăng nhập.';
          return;
        }
      } catch {
        error.textContent = 'Không thể kết nối dịch vụ đăng nhập.';
        return;
      }
      await renderAdmin(root, { forceSession: true });
    });
    return;
  }
  sessionCache = session;
  await renderAuthenticated(root, session, sequence);
}

export function initAdminShell() {
  const root = document.createElement('div');
  root.id = 'admin-auth-root';
  root.className = 'hidden';
  document.body.append(root);
  const sync = () => {
    const active = isAdminRoute();
    root.classList.toggle('hidden', !active);
    root.classList.toggle('admin-character-workspace-active', active && isCharacterSkinRoute());
    document.body.classList.toggle('admin-route-active', active);
    if (active) {
      // The first session check can be cold on Vercel Dev. Show an honest
      // loading shell immediately; protected content is still gated by the
      // server session response below.
      if (!sessionCache && !root.querySelector('.admin-route-loading')) root.innerHTML = adminLoadingMarkup();
      // The Character/Skin island owns its hash sub-routes. Keep the mounted
      // Vue cache alive while it moves between index and workspace modules.
      if (characterWorkspaceApp && isCharacterSkinRoute()) return;
      void renderAdmin(root);
    }
  };
  window.addEventListener('hashchange', sync);
  sync();
}
