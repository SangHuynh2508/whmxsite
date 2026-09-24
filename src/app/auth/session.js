const SESSION_ENDPOINT = '/api/admin/session';

// The HttpOnly session cookie is the real authorization boundary, validated
// server-side on every admin mutation. This cache only avoids re-fetching the
// same check across public-page code (nav, contextual edit) within one boot —
// it must never be trusted as authorization by itself.
let sessionPromise = null;

async function fetchSession() {
  try {
    const response = await fetch(SESSION_ENDPOINT, { credentials: 'same-origin' });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export function initSession() {
  sessionPromise ||= fetchSession();
  return sessionPromise;
}

export function getSession() {
  return sessionPromise ?? initSession();
}

export function refreshSession() {
  sessionPromise = fetchSession();
  sessionPromise.then(() => window.dispatchEvent(new Event('whmx:session-change')));
  return sessionPromise;
}

// Shared by the Admin shell and the mobile dock; listeners re-sync via `whmx:session-change`.
export async function signOut() {
  await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => {});
  return refreshSession();
}

export function isAuthorizedEditor(session) {
  return Boolean(session?.authenticated && session.user?.status === 'active');
}
