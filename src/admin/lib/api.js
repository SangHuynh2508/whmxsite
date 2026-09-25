// Shared by every admin area (moved from previewApi.js).
export function requestId() { return crypto.randomUUID(); }

// Throws Error(code) with .status (409 = VERSION_CONFLICT) and .payload.
export async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.code || 'REQUEST_FAILED');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export const json = (method, body) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
