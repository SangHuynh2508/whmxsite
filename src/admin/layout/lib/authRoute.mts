export const LOGIN_HASH = '#/login';
const ADMIN_HASH = '#/admin';

// Where the Admin shell should send the browser once the session is known, or null to stay.
// Signed-out visitors get #/login (the URL doesn't advertise the admin area); after signing in
// they go back to the admin page they asked for.
export function authRedirect(hash: string, authenticated: boolean, next?: string): string | null {
  const onAdmin = hash === ADMIN_HASH || hash.startsWith(`${ADMIN_HASH}/`);
  if (!authenticated) return onAdmin ? LOGIN_HASH : null;
  return hash === LOGIN_HASH ? next || ADMIN_HASH : null;
}
