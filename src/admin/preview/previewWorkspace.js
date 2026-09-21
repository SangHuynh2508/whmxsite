const LIFECYCLES = ['unverified', 'unreleased', 'released', 'retired'];
const VISIBILITIES = ['hidden', 'preview', 'public'];
const ROLES = ['avatar', 'card', 'drawing'];

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function errorCode(payload) { return payload?.error?.code || 'REQUEST_FAILED'; }
function requestId() { return crypto.randomUUID(); }

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(errorCode(payload));
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function assetThumb(asset, label) {
  if (!asset?.url) return `<div class="admin-asset-empty">${escapeHtml(label)}<br><small>Chưa có</small></div>`;
  const warning = asset.provenance === 'manual_placeholder' ? '<span class="admin-placeholder-warning">Temporary / Placeholder image</span>' : '';
  return `<div class="admin-asset-thumb"><img src="${escapeHtml(asset.url)}" alt="${escapeHtml(label)}"><span>${escapeHtml(asset.provenance)} · ${escapeHtml(asset.verificationState)}</span>${warning}</div>`;
}

function listMarkup(items) {
  if (!items.length) return '<p class="admin-muted">Chưa có Preview Character phù hợp.</p>';
  return `<div class="admin-preview-list">${items.map((item) => `
    <button class="admin-preview-row" data-preview-id="${escapeHtml(item.entityId)}" type="button">
      <span class="admin-preview-row-image">${(item.assets?.avatar?.url || item.assets?.card?.url) ? `<img src="${escapeHtml(item.assets?.avatar?.url || item.assets?.card?.url)}" alt="">` : '物'}</span>
      <span class="admin-preview-row-main"><strong>${escapeHtml(item.nameVi || item.nameCn || 'Untitled Preview')}</strong><small>manual preview · ${escapeHtml(item.lifecycle)} · ${escapeHtml(item.visibility)}</small></span>
      <span class="admin-preview-row-meta"><span>rev ${escapeHtml(item.revision)}</span><span>${escapeHtml(item.claimedRawId || 'no claimed ID')}</span></span>
    </button>`).join('')}</div>`;
}

function createMarkup() {
  return `<details class="admin-preview-create"><summary>+ Tạo Preview Character</summary><form id="admin-preview-create-form" class="admin-preview-form">
    <label>Tên Việt<input name="nameVi" maxlength="10000"></label><label>Tên Trung<input name="nameCn" maxlength="10000"></label>
    <label>Fullname Việt<input name="fullnameVi" maxlength="10000"></label><label>Fullname Trung<input name="fullnameCn" maxlength="10000"></label>
    <label>Nickname<input name="nicknameVi" maxlength="10000"></label><label>Tags<input name="tagsVi" maxlength="10000"></label>
    <label>Claimed raw ID<input name="claimedRawId" maxlength="10000"></label>
    <label>Evidence / notes<textarea name="claimedRawIdEvidence" rows="3" placeholder="JSON object, e.g. {&quot;source&quot;:&quot;review note&quot;}"></textarea></label>
    <label>Manual metadata<textarea name="manualMetadata" rows="3" placeholder="JSON object"></textarea></label>
    <label>Provenance notes<textarea name="provenanceNotes" rows="3"></textarea></label>
    <p class="admin-form-error" data-create-error role="alert"></p><button type="submit">Tạo bản nháp hidden / unverified</button>
  </form></details>`;
}

function detailMarkup(preview, isOwner) {
  const value = (key) => escapeHtml(preview[key] || '');
  const lifecycleOptions = LIFECYCLES.map((item) => `<option value="${item}" ${item === preview.lifecycle ? 'selected' : ''}>${item}</option>`).join('');
  const visibilityOptions = VISIBILITIES.map((item) => `<option value="${item}" ${item === preview.visibility ? 'selected' : ''}>${item}</option>`).join('');
  const assets = ROLES.map((role) => {
    const asset = preview.assets?.[role];
    const pending = (preview.pendingUploads || []).filter((item) => item.assetRole === role);
    return `<article class="admin-asset-card"><h4>${role}</h4>${assetThumb(asset, role)}<div class="admin-asset-meta">${asset ? `${escapeHtml(asset.mimeType || '')} · ${escapeHtml(asset.width || '?')}×${escapeHtml(asset.height || '?')}` : 'No verified active asset'}</div><label class="admin-file-label">Upload candidate<input type="file" data-asset-role="${role}" accept="image/png,image/jpeg,image/webp"></label><select data-provenance-role="${role}" ${isOwner ? '' : 'disabled'}><option value="manual_preview">manual_preview</option><option value="manual_official">manual_official</option><option value="manual_placeholder">manual_placeholder</option></select>${pending.map((item) => `<button type="button" class="admin-finalize-pending" data-intent-id="${item.id}" ${isOwner ? '' : 'disabled'}>Finalize pending (${escapeHtml(item.requestedProvenance)})</button>`).join('')}<p class="admin-upload-status" data-upload-status="${role}" role="status"></p></article>`;
  }).join('');
  const history = (preview.history || []).map((item) => `<li><strong>${escapeHtml(item.fieldName)}</strong><span>${escapeHtml(item.editedAt)}</span><small>actor ${escapeHtml(item.actorUserId || 'system')}</small></li>`).join('');
  const recon = (preview.reconciliation || []).map((item) => `<article class="admin-recon-card"><strong>${escapeHtml(item.status)}</strong><p>Official: ${escapeHtml(item.officialCharacterId || item.officialCharacterEntityId)}</p><p>${escapeHtml(item.officialNameVi || item.officialNameCn || '')}</p><small>Evidence: ${escapeHtml(JSON.stringify(item.candidateEvidence || {}))}</small></article>`).join('') || '<p class="admin-muted">Chưa có reconciliation record. Confirm/reject chưa được mở trong D0C.</p>';
  return `<section class="admin-preview-detail"><button type="button" id="admin-preview-back" class="admin-secondary">← Danh sách</button><div class="admin-preview-detail-head"><div><p class="admin-eyebrow">MANUAL PREVIEW · ${escapeHtml(preview.publicKey)}</p><h2>${escapeHtml(preview.nameVi || preview.nameCn || 'Untitled Preview')}</h2><p class="admin-muted">UUID ${escapeHtml(preview.entityId)} · revision ${escapeHtml(preview.revision)} · created ${escapeHtml(preview.createdAt)} · updated ${escapeHtml(preview.updatedAt)}</p><p class="admin-muted">created by ${escapeHtml(preview.createdByUserId)} · updated by ${escapeHtml(preview.updatedByUserId)}</p></div><div class="admin-state-pills"><span>${escapeHtml(preview.lifecycle)}</span><span>${escapeHtml(preview.visibility)}</span><span>${escapeHtml(preview.origin)}</span></div></div>
    <form id="admin-preview-edit-form" class="admin-preview-form"><label>Tên Việt<input name="nameVi" value="${value('nameVi')}" maxlength="10000"></label><label>Tên Trung<input name="nameCn" value="${value('nameCn')}" maxlength="10000"></label><label>Fullname Việt<input name="fullnameVi" value="${value('fullnameVi')}" maxlength="10000"></label><label>Fullname Trung<input name="fullnameCn" value="${value('fullnameCn')}" maxlength="10000"></label><label>Nickname<input name="nicknameVi" value="${value('nicknameVi')}" maxlength="10000"></label><label>Tags<input name="tagsVi" value="${value('tagsVi')}" maxlength="10000"></label><label>Claimed raw ID<input name="claimedRawId" value="${value('claimedRawId')}" maxlength="10000"></label><label>Claim evidence<textarea name="claimedRawIdEvidence" rows="4">${escapeHtml(JSON.stringify(preview.claimedRawIdEvidence || {}, null, 2))}</textarea></label><label>Manual metadata<textarea name="manualMetadata" rows="4">${escapeHtml(JSON.stringify(preview.manualMetadata || {}, null, 2))}</textarea></label><label>Provenance notes<textarea name="provenanceNotes" rows="4">${value('provenanceNotes')}</textarea></label><p class="admin-form-error" data-edit-error role="alert"></p><button type="submit">Lưu metadata</button></form>
    <section class="admin-owner-controls"><h3>Lifecycle / visibility</h3><p class="admin-muted">Chỉ owner; server vẫn kiểm tra role và revision.</p><label>Lifecycle<select id="admin-preview-lifecycle" ${isOwner ? '' : 'disabled'}>${lifecycleOptions}</select></label><label>Visibility<select id="admin-preview-visibility" ${isOwner ? '' : 'disabled'}>${visibilityOptions}</select></label><button type="button" id="admin-preview-state-save" ${isOwner ? '' : 'disabled'}>Lưu trạng thái</button><p class="admin-form-error" data-state-error role="alert"></p></section>
    <section class="admin-assets-section"><h3>Managed assets</h3><p class="admin-muted">Editor có thể stage manual_preview cho draft hidden/unverified; chỉ owner finalize/activate.</p><div class="admin-assets-grid">${assets}</div></section>
    <section class="admin-history-section"><h3>History</h3><ul class="admin-history-list">${history || '<li class="admin-muted">Chưa có history.</li>'}</ul></section><section class="admin-recon-section"><h3>Reconciliation state</h3>${recon}</section></section>`;
}

export async function renderPreviewWorkspace(root, session) {
  const isOwner = session.user.role === 'owner';
  root.innerHTML = `<section class="admin-preview-workspace"><header class="admin-preview-toolbar"><div><p class="admin-eyebrow">PREVIEW CHARACTERS</p><h2>Manual preview workspace</h2><p class="admin-muted">Preview data is separate from source-backed Character rows and is not exported publicly.</p></div><button type="button" id="admin-preview-refresh" class="admin-secondary">Refresh</button></header><div class="admin-preview-filters"><input id="admin-preview-search" placeholder="Search name / claimed ID"><select id="admin-preview-filter-lifecycle"><option value="">All lifecycle</option>${LIFECYCLES.map((item) => `<option>${item}</option>`).join('')}</select><select id="admin-preview-filter-visibility"><option value="">All visibility</option>${VISIBILITIES.map((item) => `<option>${item}</option>`).join('')}</select></div>${createMarkup()}<div id="admin-preview-content"><p class="admin-muted">Loading…</p></div></section>`;

  let selectedId = null;
  let currentPreview = null;
  const content = root.querySelector('#admin-preview-content');
  const loadList = async () => {
    selectedId = null;
    currentPreview = null;
    const query = new URLSearchParams();
    const q = root.querySelector('#admin-preview-search').value.trim();
    const lifecycle = root.querySelector('#admin-preview-filter-lifecycle').value;
    const visibility = root.querySelector('#admin-preview-filter-visibility').value;
    if (q) query.set('q', q); if (lifecycle) query.set('lifecycle', lifecycle); if (visibility) query.set('visibility', visibility);
    try { const data = await api(`/api/admin/previews?${query}`); content.innerHTML = listMarkup(data.previews || []); } catch { content.innerHTML = '<p class="admin-form-error">Không thể tải Preview Characters.</p>'; }
  };
  const loadDetail = async (id) => {
    try { const data = await api(`/api/admin/previews/${encodeURIComponent(id)}`); selectedId = id; currentPreview = data.preview; content.innerHTML = detailMarkup(currentPreview, isOwner); bindDetail(); } catch { content.innerHTML = '<p class="admin-form-error">Không thể tải Preview Character.</p>'; }
  };
  const bindDetail = () => {
    root.querySelector('#admin-preview-back').onclick = loadList;
    root.querySelector('#admin-preview-edit-form').onsubmit = async (event) => {
      event.preventDefault(); const form = event.currentTarget; const error = form.querySelector('[data-edit-error]'); error.textContent = '';
      const values = Object.fromEntries(new FormData(form)); let evidence = {}; let manualMetadata = {};
      try { evidence = values.claimedRawIdEvidence ? JSON.parse(values.claimedRawIdEvidence) : {}; manualMetadata = values.manualMetadata ? JSON.parse(values.manualMetadata) : {}; } catch { error.textContent = 'Evidence and manual metadata must be valid JSON.'; return; }
      try { await api(`/api/admin/previews/${currentPreview.entityId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision: currentPreview.revision, patch: { ...values, claimedRawIdEvidence: evidence, manualMetadata }, requestId: requestId() }) }); await loadDetail(currentPreview.entityId); } catch (failure) { if (failure.status === 409) error.textContent = 'VERSION_CONFLICT: record changed; your draft remains in the form. Copy it or reload, then retry manually.'; else error.textContent = failure.message; }
    };
    root.querySelector('#admin-preview-state-save').onclick = async () => {
      const error = root.querySelector('[data-state-error]'); error.textContent = '';
      try { await api(`/api/admin/previews/${currentPreview.entityId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision: currentPreview.revision, lifecycle: root.querySelector('#admin-preview-lifecycle').value, visibility: root.querySelector('#admin-preview-visibility').value, requestId: requestId() }) }); await loadDetail(currentPreview.entityId); } catch (failure) { error.textContent = failure.status === 409 ? 'VERSION_CONFLICT: reload required; no overwrite occurred.' : failure.message; }
    };
    for (const input of root.querySelectorAll('input[type="file"][data-asset-role]')) input.onchange = () => uploadCandidate(input);
    for (const button of root.querySelectorAll('.admin-finalize-pending')) button.onclick = () => finalizePending(button.dataset.intentId, button);
  };
  const finalizePending = async (intentId, button) => {
    const status = button.parentElement.querySelector('.admin-upload-status'); status.textContent = 'Finalizing…';
    try { await api(`/api/admin/assets/upload-intents/${encodeURIComponent(intentId)}/finalize`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requestId: requestId() }) }); await loadDetail(currentPreview.entityId); } catch (failure) { status.textContent = failure.message === 'OBJECT_NOT_FOUND' ? 'Object not uploaded yet.' : failure.message; }
  };
  const uploadCandidate = async (input) => {
    const role = input.dataset.assetRole; const status = root.querySelector(`[data-upload-status="${role}"]`); const file = input.files?.[0]; if (!file || !currentPreview) return;
    status.textContent = 'Requesting upload intent…'; const provenance = root.querySelector(`[data-provenance-role="${role}"]`).value;
    try {
      const intent = await api('/api/admin/assets/upload-intents', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entityId: currentPreview.entityId, expectedRevision: currentPreview.revision, assetRole: role, requestedFilename: file.name, requestedProvenance: provenance, requestId: requestId() }) });
      status.textContent = 'Uploading…'; const put = await fetch(intent.uploadUrl, { method: 'PUT', body: file, headers: { 'content-type': file.type } }); if (!put.ok) throw new Error('UPLOAD_FAILED');
      status.textContent = 'Uploaded to quarantine. Owner finalization required.';
      if (isOwner) { status.textContent = 'Verifying and activating…'; await api(`/api/admin/assets/upload-intents/${encodeURIComponent(intent.id)}/finalize`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requestId: requestId(), acknowledgePublicPlaceholder: provenance === 'manual_placeholder' }) }); await loadDetail(currentPreview.entityId); }
    } catch (failure) { status.textContent = failure.message === 'FORBIDDEN' ? 'Permission denied by server.' : failure.message; }
  };
  root.querySelector('#admin-preview-refresh').onclick = loadList;
  root.querySelector('#admin-preview-search').oninput = () => { clearTimeout(root._previewSearchTimer); root._previewSearchTimer = setTimeout(loadList, 250); };
  root.querySelector('#admin-preview-filter-lifecycle').onchange = loadList; root.querySelector('#admin-preview-filter-visibility').onchange = loadList;
  root.querySelector('#admin-preview-create-form').onsubmit = async (event) => {
    event.preventDefault(); const form = event.currentTarget; const error = form.querySelector('[data-create-error]'); error.textContent = ''; const values = Object.fromEntries(new FormData(form)); let evidence = {};
    try { evidence = values.claimedRawIdEvidence ? JSON.parse(values.claimedRawIdEvidence) : {}; values.manualMetadata = values.manualMetadata ? JSON.parse(values.manualMetadata) : {}; } catch { error.textContent = 'Evidence and manual metadata must be valid JSON.'; return; }
    try { const result = await api('/api/admin/previews', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...values, claimedRawIdEvidence: evidence, requestId: requestId() }) }); form.reset(); event.currentTarget.closest('details').open = false; await loadDetail(result.entityId); } catch (failure) { error.textContent = failure.message; }
  };
  content.onclick = (event) => { const button = event.target.closest('[data-preview-id]'); if (button) void loadDetail(button.dataset.previewId); };
  await loadList();
}
