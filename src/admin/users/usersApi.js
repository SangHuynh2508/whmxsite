export const ROLES = ['editor', 'owner'];

// Returns null when the list can't be loaded.
export async function listUsers() {
  const response = await fetch('/api/admin/users', { credentials: 'same-origin' }).catch(() => null);
  const payload = await response?.json().catch(() => ({}));
  return response?.ok ? payload.users || [] : null;
}

// Returns null on success, an error code string on failure.
export async function provisionUser(values) {
  const result = await fetch('/api/admin/users', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(values),
  });
  if (result.ok) return null;
  const payload = await result.json().catch(() => ({}));
  return payload?.error?.code || payload?.code || 'AUTH_OPERATION_FAILED';
}
