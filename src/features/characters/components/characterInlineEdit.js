/**
 * Roadmap Phase 3 — contextual inline edit MVP (Character, Overview tab).
 *
 * Small, standalone enhancer: it does NOT import anything from
 * src/admin/character-skin/characterSkinAdminWorkspace.js (that file is
 * flagged as a god-component in project docs — nothing new should couple to
 * its internals). It only reuses the same public admin mutation contract
 * (GET/PATCH /api/admin/characters/:id) the workspace already calls, mirrored
 * independently here.
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

// Per-character GET cache so opening several field editors on the same
// character reuses one revision lookup; cleared after every successful save
// so the next edit always starts from the authoritative revision.
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

async function saveField(characterId, apiKey, value) {
  const detail = await loadDetail(characterId);
  const expectedRevision = detail?.character?.revision;
  const response = await fetch(`/api/admin/characters/${encodeURIComponent(characterId)}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ expectedRevision, changes: { [apiKey]: value || null }, requestId: crypto.randomUUID() }),
  });
  const payload = await response.json().catch(() => ({}));
  detailCache.delete(characterId);
  if (!response.ok) throw Object.assign(new Error(payload?.error?.code || 'SERVICE_ERROR'), { status: response.status });
  return payload;
}

function errorMessage(status) {
  if (status === 409) return 'Dữ liệu đã thay đổi ở nơi khác. Vui lòng tải lại trang.';
  if (status === 403) return 'Bạn không có quyền chỉnh sửa trường này.';
  if (status === 422) return 'Giá trị không hợp lệ.';
  return 'Không thể lưu thay đổi. Vui lòng thử lại.';
}

function pencilButton(label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'char-inline-edit-btn';
  button.setAttribute('aria-label', `Sửa ${label}`);
  button.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>';
  return button;
}

function openInlineForm({ valueEl, button, characterId, field, char, container }) {
  const config = FIELD_CONFIG[field];
  const form = document.createElement('span');
  form.className = 'char-inline-edit-form';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'char-inline-edit-input';
  input.value = valueEl.textContent.trim();
  input.maxLength = 200;

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'char-inline-edit-save';
  saveBtn.textContent = 'Lưu';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'char-inline-edit-cancel';
  cancelBtn.textContent = 'Hủy';

  const status = document.createElement('span');
  status.className = 'char-inline-edit-status';

  form.append(input, saveBtn, cancelBtn, status);
  valueEl.classList.add('hidden');
  button.classList.add('hidden');
  valueEl.insertAdjacentElement('afterend', form);
  input.focus();
  input.select();

  function close() {
    form.remove();
    valueEl.classList.remove('hidden');
    button.classList.remove('hidden');
  }

  cancelBtn.addEventListener('click', close);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
    if (event.key === 'Enter') saveBtn.click();
  });

  saveBtn.addEventListener('click', async () => {
    const nextValue = input.value.trim();
    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    status.textContent = 'Đang lưu…';
    try {
      await saveField(characterId, config.apiKey, nextValue);
      char[field] = nextValue || null;
      // Full tab re-render keeps every derived display of this field (e.g.
      // the art caption title, which also reads char.name_vi) consistent,
      // rather than patching each DOM spot by hand.
      renderOverviewTab(container, char);
      attachEditors(container, char, characterId);
    } catch (error) {
      status.textContent = errorMessage(error.status);
      saveBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  });
}

function attachEditors(container, char, characterId) {
  for (const field of Object.keys(FIELD_CONFIG)) {
    const valueEl = container.querySelector(`[data-field="${field}"]`);
    if (!valueEl || valueEl.dataset.editWired) continue;
    const button = pencilButton(FIELD_CONFIG[field].label);
    valueEl.insertAdjacentElement('afterend', button);
    valueEl.dataset.editWired = 'true';
    button.addEventListener('click', () => {
      if (valueEl.nextElementSibling?.classList.contains('char-inline-edit-form')) return;
      openInlineForm({ valueEl, button, characterId, field, char, container });
    });
  }
}

export async function enhanceCharacterOverviewEditing(container, char) {
  const session = await getSession();
  if (!isAuthorizedEditor(session)) return;
  // The public snapshot has no revision info of its own — see saveField's
  // lazy GET above, which is the only admin-API traffic this adds, and only
  // for confirmed owner/editor sessions opening this tab.
  attachEditors(container, char, char.id);
}
