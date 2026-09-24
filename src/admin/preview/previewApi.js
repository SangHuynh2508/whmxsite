export const LIFECYCLES = ['unverified', 'unreleased', 'released', 'retired'];
export const VISIBILITIES = ['hidden', 'preview', 'public'];
export const ASSET_ROLES = ['avatar', 'card', 'drawing'];
export const PROVENANCES = ['manual_preview', 'manual_official', 'manual_placeholder'];

export function requestId() { return crypto.randomUUID(); }

// Throws Error(code) with .status (409 = VERSION_CONFLICT) and .payload.
async function api(path, options = {}) {
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

const json = (method, body) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export function listPreviews({ q = '', lifecycle = '', visibility = '' } = {}) {
  const query = new URLSearchParams();
  if (q) query.set('q', q);
  if (lifecycle) query.set('lifecycle', lifecycle);
  if (visibility) query.set('visibility', visibility);
  return api(`/api/admin/previews?${query}`).then((data) => data.previews || []);
}

export function getPreview(id) {
  return api(`/api/admin/previews/${encodeURIComponent(id)}`).then((data) => data.preview);
}

export function createPreview(values) {
  return api('/api/admin/previews', json('POST', { ...values, requestId: requestId() }));
}

export function savePreviewMetadata(preview, patch) {
  return api(`/api/admin/previews/${preview.entityId}`, json('PATCH', { expectedRevision: preview.revision, patch, requestId: requestId() }));
}

export function savePreviewState(preview, lifecycle, visibility) {
  return api(`/api/admin/previews/${preview.entityId}`, json('PATCH', { expectedRevision: preview.revision, lifecycle, visibility, requestId: requestId() }));
}

export function finalizeUpload(intentId, extra = {}) {
  return api(`/api/admin/assets/upload-intents/${encodeURIComponent(intentId)}/finalize`, json('POST', { requestId: requestId(), ...extra }));
}

// Request intent → PUT bytes to R2 → (owner only) finalize. onStatus gets progress strings.
export async function uploadAsset(preview, role, file, provenance, isOwner, onStatus = () => {}) {
  onStatus('Requesting upload intent…');
  const intent = await api('/api/admin/assets/upload-intents', json('POST', { entityId: preview.entityId, expectedRevision: preview.revision, assetRole: role, requestedFilename: file.name, requestedProvenance: provenance, requestId: requestId() }));
  onStatus('Uploading…');
  const put = await fetch(intent.uploadUrl, { method: 'PUT', body: file, headers: { 'content-type': file.type } });
  if (!put.ok) throw new Error('UPLOAD_FAILED');
  onStatus('Uploaded to quarantine. Owner finalization required.');
  if (!isOwner) return { finalized: false };
  onStatus('Verifying and activating…');
  await finalizeUpload(intent.id, { acknowledgePublicPlaceholder: provenance === 'manual_placeholder' });
  return { finalized: true };
}
