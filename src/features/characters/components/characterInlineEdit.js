/**
 * Roadmap Phase 3 — contextual inline edit MVP (Character, Overview tab).
 *
 * Small, standalone enhancer: it imports nothing from the Admin (React,
 * src/admin/characters/). It only reuses the same public admin mutation
 * contract (GET/PATCH /api/admin/characters/:id) the Admin calls.
 *
 * UX: one visible "Sửa" toggle next to the "Hồ Sơ Khí Giả" section header
 * (not a tiny pencil per field — the first version of this feature used one
 * and it was too small/easy to miss). Clicking it turns every field that
 * supports editing into an input at once; fields with no data-field hook
 * (not part of the server allowlist) are left exactly as rendered. One Save
 * sends every changed field in a single PATCH, matching how the admin
 * workspace batches its own diff.
 */
import '../styles/characterInlineEdit.css';
import { getSession, isAuthorizedEditor } from '../../../app/auth/session.js';
import { renderOverviewTab } from '../views/detail/overviewView.js';

// snake_case (public data model) -> camelCase (admin API `changes` key), the
// exact allowlist server/character-skin-admin-domain.mjs enforces.
const FIELD_CONFIG = {
  name_vi: { apiKey: 'nameVi', label: 'Tên hiển thị' },
  fullname_vi: { apiKey: 'fullnameVi', label: 'Tên đầy đủ' },
  nickname_vi: { apiKey: 'nicknameVi', label: 'Tên thường gọi' },
};

// Per-character GET cache so re-entering edit mode reuses one revision
// lookup; cleared after every successful save so the next edit always starts
// from the authoritative revision.
const detailCache = new Map();

function loadDetail(characterId) {
  if (!detailCache.has(characterId)) {
    const promise = fetch(`/api/admin/characters/${encodeURIComponent(characterId)}`, { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) throw Object.assign(new Error('LOAD_FAILED'), { status: response.status });
        return response.json();
      })
      .catch((error) => {
        detailCache.delete(characterId);
        throw error;
      });
    detailCache.set(characterId, promise);
  }
  return detailCache.get(characterId);
}

async function saveFields(characterId, changes) {
  const detail = await loadDetail(characterId);
  const expectedRevision = detail?.character?.revision;
  const response = await fetch(`/api/admin/characters/${encodeURIComponent(characterId)}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ expectedRevision, changes, requestId: crypto.randomUUID() }),
  });
  const payload = await response.json().catch(() => ({}));
  detailCache.delete(characterId);
  if (!response.ok) throw Object.assign(new Error(payload?.error?.code || 'SERVICE_ERROR'), { status: response.status });
  return payload;
}

function errorMessage(status) {
  if (status === 409) return 'Dữ liệu đã thay đổi ở nơi khác. Vui lòng tải lại trang.';
  if (status === 403) return 'Bạn không có quyền chỉnh sửa.';
  if (status === 422) return 'Một hoặc nhiều giá trị không hợp lệ.';
  return 'Không thể lưu thay đổi. Vui lòng thử lại.';
}

function editIconSvg() {
  return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>';
}

function enterEditMode(container, char, characterId, toggleBtn) {
  const fieldEntries = Object.keys(FIELD_CONFIG)
    .map((field) => ({ field, el: container.querySelector(`[data-field="${field}"]`) }))
    .filter((entry) => entry.el);
  if (!fieldEntries.length) return;

  toggleBtn.classList.add('hidden');

  const actionBar = document.createElement('span');
  actionBar.className = 'char-edit-actionbar';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'char-inline-edit-save';
  saveBtn.textContent = 'Lưu thay đổi';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'char-inline-edit-cancel';
  cancelBtn.textContent = 'Hủy';
  const status = document.createElement('span');
  status.className = 'char-inline-edit-status';
  actionBar.append(saveBtn, cancelBtn, status);
  toggleBtn.insertAdjacentElement('afterend', actionBar);

  const inputs = new Map();
  for (const { field, el } of fieldEntries) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'char-inline-edit-input';
    // From the data, not the rendered text: name_vi falls back to the CN name on screen.
    input.value = (char[field] ?? '').toString().trim();
    input.maxLength = 200;
    input.placeholder = 'Chưa có — nhập để thêm';
    el.closest('.info-cell')?.classList.remove('hidden'); // empty fields are rendered hidden
    el.replaceWith(input);
    inputs.set(field, input);
  }
  inputs.get('name_vi')?.focus();

  function exit() {
    // Re-render from the (possibly just-mutated) char object rather than
    // trying to restore each swapped node by hand — also re-mounts a fresh
    // toggle button, so Cancel and Save both leave the tab in a clean state.
    renderOverviewTab(container, char);
    mountEditToggle(container, char, characterId);
  }

  cancelBtn.addEventListener('click', exit);
  actionBar.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') exit();
  });

  saveBtn.addEventListener('click', async () => {
    const changes = {};
    for (const [field, input] of inputs) {
      const nextValue = input.value.trim();
      const currentValue = (char[field] ?? '').toString().trim();
      if (nextValue !== currentValue) changes[FIELD_CONFIG[field].apiKey] = nextValue || null;
    }
    if (!Object.keys(changes).length) {
      exit();
      return;
    }
    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    status.textContent = 'Đang lưu…';
    try {
      await saveFields(characterId, changes);
      for (const [field, input] of inputs) char[field] = input.value.trim() || null;
      exit();
    } catch (error) {
      status.textContent = errorMessage(error.status);
      saveBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  });
}

function mountEditToggle(container, char, characterId) {
  const header = container.querySelector('.overview-section-header');
  const heading = header?.querySelector('h3');
  if (!header || !heading) return;
  const hasEditableField = Object.keys(FIELD_CONFIG).some((field) => container.querySelector(`[data-field="${field}"]`));
  if (!hasEditableField) return;

  // Group the heading + toggle so the button sits right beside "Hồ Sơ Khí
  // Giả" (not far right where the rarity badge is pinned by
  // .overview-section-header's space-between layout).
  const titleGroup = document.createElement('div');
  titleGroup.className = 'overview-title-group';
  header.insertBefore(titleGroup, heading);
  titleGroup.appendChild(heading);

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'char-edit-toggle-btn';
  toggleBtn.innerHTML = `${editIconSvg()}<span>Sửa</span>`;
  titleGroup.appendChild(toggleBtn);
  toggleBtn.addEventListener('click', () => enterEditMode(container, char, characterId, toggleBtn));
}

export async function enhanceCharacterOverviewEditing(container, char) {
  const session = await getSession();
  if (!isAuthorizedEditor(session)) return;
  // The public snapshot has no revision info of its own — see saveFields'
  // lazy GET above, which is the only admin-API traffic this adds, and only
  // for confirmed owner/editor sessions opening this tab.
  mountEditToggle(container, char, char.id);
}
