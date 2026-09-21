import { computed, createApp, h, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

const CHARACTER_FIELDS = [
  ['nameVi', 'Tên tiếng Việt'],
  ['fullnameVi', 'Tên đầy đủ tiếng Việt'],
  ['nicknameVi', 'Biệt danh tiếng Việt'],
  ['tagsVi', 'Thẻ tiếng Việt'],
];
const SKIN_FIELDS = [
  ['skinNameVi', 'Tên skin tiếng Việt'],
  ['descriptionVi', 'Mô tả tiếng Việt'],
  ['obtainVi', 'Cách nhận tiếng Việt'],
];
const MODULES = [
  ['overview', 'Tổng quan'],
  ['skins', 'Skins'],
  ['source', 'Nguồn'],
  ['history', 'Lịch sử'],
];
const HISTORY_EVENT_LABELS = {
  source_baseline: 'Baseline nguồn được tạo',
  source_import: 'Import dữ liệu nguồn',
  admin_override: 'Override Admin được cập nhật',
  override_cleared: 'Override được xoá, trả về nguồn',
};
const FIELD_LABELS = Object.fromEntries([...CHARACTER_FIELDS, ...SKIN_FIELDS]);

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.code || 'SERVICE_ERROR');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

const workspaceCaches = new Map();
function cacheKey(session) { return session?.user?.id || session?.user?.email || 'admin-session'; }
function getWorkspaceCache(session) {
  const key = cacheKey(session);
  if (!workspaceCaches.has(key)) workspaceCaches.set(key, { characters: null, listPromise: null, details: new Map(), detailPromises: new Map() });
  return workspaceCaches.get(key);
}
function valueOf(record, key) { return record?.[key]?.value ?? ''; }
function labelForState(field) {
  if (field?.state === 'source_changed') return 'Nguồn đã thay đổi — cần rà soát';
  if (field?.state === 'active') return 'OVERRIDE · đang áp dụng';
  return 'SOURCE DATA · chỉ đọc nền';
}
function rawChineseFor(record, field) {
  if (!record) return null;
  if (field === 'nameVi') return record.nameCn;
  if (field === 'fullnameVi') return record.fullnameCn;
  if (field === 'skinNameVi') return record.skinNameCn;
  if (field === 'descriptionVi') return record.descriptionCn;
  if (field === 'obtainVi') return record.obtainCn;
  if (field === 'tagsVi') return record.tagsCn;
  return null;
}
function readableEventType(value) { return HISTORY_EVENT_LABELS[value] || 'Thay đổi dữ liệu'; }
function readableHistoryValue(value) {
  if (value === null || value === undefined || value === '') return '∅';
  try {
    const parsed = typeof value === 'string' && /^[{[]/.test(value) ? JSON.parse(value) : value;
    const format = (input) => {
      if (input === null || input === undefined || input === '') return '∅';
      if (Array.isArray(input)) return input.map(format).join(', ');
      if (typeof input === 'object') return Object.entries(input).map(([key, nested]) => `${key}: ${format(nested)}`).join(' · ');
      return String(input);
    };
    return format(parsed);
  } catch { /* keep the authoritative raw value */ }
  return String(value);
}
function routeCharacterId() {
  const match = window.location.hash.match(/^#\/admin\/characters\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}
function statusText(status) {
  return { clean: 'Đã đồng bộ', dirty: 'Có thay đổi chưa lưu', saving: 'Đang lưu…', saved: 'Đã lưu', conflict: 'Xung đột phiên bản', error: 'Lỗi dịch vụ' }[status] || status;
}

const App = {
  props: { session: { type: Object, required: true } },
  setup(props) {
    const workspaceCache = getWorkspaceCache(props.session);
    const characters = ref(workspaceCache.characters || []);
    const query = ref('');
    const selectedCharacterId = ref(null);
    const loadingCharacterId = ref(null);
    const selected = ref(null);
    const selectedSkinId = ref(null);
    const activeModule = ref('overview');
    const characterDraft = ref({});
    const skinDraft = ref({});
    const loading = ref(!workspaceCache.characters);
    const detailLoading = ref(false);
    const saving = ref(false);
    const status = ref('clean');
    const error = ref('');
    const conflict = ref(false);
    const avatarStates = ref({});
    const editingContext = ref(null);
    const closePending = ref(false);
    let detailController = null;
    let detailRequestId = 0;

    const currentCharacter = computed(() => selected.value?.character || null);
    const currentSkin = computed(() => selected.value?.skins?.find((skin) => skin.skinId === selectedSkinId.value) || null);
    const dirty = computed(() => {
      const characterDirty = currentCharacter.value && CHARACTER_FIELDS.some(([key]) => (characterDraft.value[key] ?? '') !== valueOf(currentCharacter.value, key));
      const skinDirty = currentSkin.value && SKIN_FIELDS.some(([key]) => (skinDraft.value[key] ?? '') !== valueOf(currentSkin.value, key));
      return Boolean(characterDirty || skinDirty);
    });
    const filteredCharacters = computed(() => {
      const needle = query.value.trim().toLowerCase();
      if (!needle) return characters.value;
      return characters.value.filter((item) => `${item.characterId} ${item.nameCn} ${valueOf(item, 'nameVi')} ${valueOf(item, 'fullnameVi')}`.toLowerCase().includes(needle));
    });

    function hydrateDrafts(detail) {
      characterDraft.value = Object.fromEntries(CHARACTER_FIELDS.map(([key]) => [key, valueOf(detail.character, key)]));
      skinDraft.value = {};
    }
    async function loadCharacters() {
      if (workspaceCache.characters) {
        characters.value = workspaceCache.characters;
        loading.value = false;
        return;
      }
      loading.value = true;
      error.value = '';
      try {
        workspaceCache.listPromise ||= api('/api/admin/characters');
        workspaceCache.characters = (await workspaceCache.listPromise).characters || [];
        characters.value = workspaceCache.characters;
      } catch (failure) {
        workspaceCache.listPromise = null;
        error.value = failure.status === 401 ? 'Phiên đăng nhập không còn hợp lệ.' : 'Không thể tải danh sách Character.';
      } finally { loading.value = false; }
    }
    async function selectCharacter(characterId) {
      if (!characterId) return;
      if (selectedCharacterId.value === characterId && loadingCharacterId.value === characterId) return;
      const requestId = ++detailRequestId;
      if (loadingCharacterId.value && loadingCharacterId.value !== characterId) detailController?.abort();
      selectedCharacterId.value = characterId;
      selectedSkinId.value = null;
      editingContext.value = null;
      activeModule.value = 'overview';
      status.value = 'clean';
      conflict.value = false;
      error.value = '';
      const cachedDetail = workspaceCache.details.get(characterId);
      if (cachedDetail) {
        loadingCharacterId.value = null;
        detailLoading.value = false;
        selected.value = cachedDetail;
        hydrateDrafts(cachedDetail);
        return;
      }
      loadingCharacterId.value = characterId;
      detailLoading.value = true;
      detailController = new AbortController();
      try {
        const pending = workspaceCache.detailPromises.get(characterId) || api(`/api/admin/characters/${encodeURIComponent(characterId)}`, { signal: detailController.signal });
        workspaceCache.detailPromises.set(characterId, pending);
        const detail = await pending;
        workspaceCache.detailPromises.delete(characterId);
        workspaceCache.details.set(characterId, detail);
        if (requestId !== detailRequestId) return;
        loadingCharacterId.value = null;
        detailLoading.value = false;
        selected.value = detail;
        hydrateDrafts(detail);
      } catch (failure) {
        workspaceCache.detailPromises.delete(characterId);
        if (failure?.name === 'AbortError' || requestId !== detailRequestId) return;
        loadingCharacterId.value = null;
        detailLoading.value = false;
        error.value = failure.status === 404 ? 'Không tìm thấy Character.' : 'Không thể tải dữ liệu Character.';
      }
    }
    function goToCharacter(characterId) {
      if (selectedCharacterId.value === characterId && loadingCharacterId.value === characterId) return;
      window.location.hash = `#/admin/characters/${encodeURIComponent(characterId)}`;
    }
    function goToIndex() { window.location.hash = '#/admin/characters'; }
    function handleRoute() {
      const id = routeCharacterId();
      if (!id) {
        ++detailRequestId;
        detailController?.abort();
        loadingCharacterId.value = null;
        detailLoading.value = false;
        selectedCharacterId.value = null;
        selected.value = null;
        selectedSkinId.value = null;
        editingContext.value = null;
        return;
      }
      if (selectedCharacterId.value === id && (selected.value || loadingCharacterId.value === id)) return;
      void selectCharacter(id);
    }
    function selectSkin(skin) {
      selectedSkinId.value = skin.skinId;
      skinDraft.value = Object.fromEntries(SKIN_FIELDS.map(([key]) => [key, valueOf(skin, key)]));
      activeModule.value = 'skins';
      editingContext.value = 'skin';
      closePending.value = false;
      status.value = 'clean';
      conflict.value = false;
      error.value = '';
      void nextTick(() => document.querySelector('.character-cms-modal textarea')?.focus());
    }
    function updateDraft(target, key, event) {
      target.value = { ...target.value, [key]: event.target.value };
      status.value = 'dirty';
      conflict.value = false;
    }
    function avatarFor(character, extraClass = '') {
      if (!character) return null;
      const id = character.characterId;
      if (avatarStates.value[id] === 'missing') return h('span', { class: ['character-cms-avatar-fallback', extraClass] }, id.slice(-2));
      return h('img', { class: extraClass, src: `/assets/characters/avatars/${id}.png`, alt: '', onLoad: () => { if (avatarStates.value[id] !== 'ready') avatarStates.value = { ...avatarStates.value, [id]: 'ready' }; }, onError: () => { avatarStates.value = { ...avatarStates.value, [id]: 'missing' }; } });
    }
    async function save() {
      if (!selected.value || saving.value || !dirty.value) return;
      saving.value = true;
      status.value = 'saving';
      error.value = '';
      try {
        const characterChanges = {};
        for (const [key] of CHARACTER_FIELDS) if ((characterDraft.value[key] ?? '') !== valueOf(currentCharacter.value, key)) characterChanges[key] = characterDraft.value[key] || null;
        if (Object.keys(characterChanges).length) await api(`/api/admin/characters/${encodeURIComponent(currentCharacter.value.characterId)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision: currentCharacter.value.revision, changes: characterChanges, requestId: crypto.randomUUID() }) });
        if (currentSkin.value) {
          const skinChanges = {};
          for (const [key] of SKIN_FIELDS) if ((skinDraft.value[key] ?? '') !== valueOf(currentSkin.value, key)) skinChanges[key] = skinDraft.value[key] || null;
          if (Object.keys(skinChanges).length) await api(`/api/admin/skins/${encodeURIComponent(currentSkin.value.skinId)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision: currentSkin.value.revision, changes: skinChanges, requestId: crypto.randomUUID() }) });
        }
        const id = currentCharacter.value.characterId;
        workspaceCache.details.delete(id);
        await selectCharacter(id);
        status.value = 'saved';
      } catch (failure) {
        if (failure.status === 409) { status.value = 'conflict'; conflict.value = true; error.value = 'Data đã thay đổi ở nơi khác. Tải lại dữ liệu mới trước khi lưu.'; }
        else if (failure.status === 403) { status.value = 'error'; error.value = 'Bạn không có quyền thực hiện thay đổi này.'; }
        else if (failure.status === 422) { status.value = 'error'; error.value = 'Một hoặc nhiều trường không hợp lệ.'; }
        else { status.value = 'error'; error.value = 'Không thể lưu thay đổi. Vui lòng thử lại.'; }
      } finally { saving.value = false; }
    }
    async function discard() {
      if (!currentCharacter.value) return;
      if (editingContext.value === 'skin') {
        const skin = currentSkin.value;
        if (skin) skinDraft.value = Object.fromEntries(SKIN_FIELDS.map(([key]) => [key, valueOf(skin, key)]));
      } else hydrateDrafts(selected.value);
      status.value = 'clean';
      conflict.value = false;
      error.value = '';
    }
    function openCharacterEditor() {
      editingContext.value = 'character';
      closePending.value = false;
      status.value = 'clean';
      error.value = '';
      void nextTick(() => document.querySelector('.character-cms-modal textarea')?.focus());
    }
    function requestCloseEditor() {
      if (saving.value) return;
      if (dirty.value) {
        closePending.value = true;
        return;
      }
      editingContext.value = null;
      closePending.value = false;
    }
    async function confirmCloseEditor() {
      if (saving.value) return;
      await discard();
      closePending.value = false;
      editingContext.value = null;
    }
    function cancelCloseEditor() { closePending.value = false; }
    function handleEditorKeydown(event) {
      if (event.key === 'Escape' && editingContext.value) {
        event.preventDefault();
        requestCloseEditor();
      }
    }
    function fieldControl(field, target, record) {
      const [key, label] = field;
      const descriptor = record?.[key];
      const rawCn = rawChineseFor(record, key);
      const hasTrustedRaw = Boolean(rawCn);
      return h('label', { class: 'character-cms-field' }, [
        h('span', { class: 'character-cms-field-label' }, [h('strong', { class: 'character-cms-field-name' }, label), h('small', { class: descriptor?.state === 'source_changed' ? 'character-cms-warning' : 'character-cms-field-state' }, labelForState(descriptor))]),
        h('div', { class: 'character-cms-field-reference' }, [
          h('div', { class: 'character-cms-raw-source' }, [h('span', 'Raw CN · chỉ đọc'), h('strong', { class: hasTrustedRaw ? '' : 'is-empty', lang: 'zh-Hans' }, hasTrustedRaw ? rawCn : 'Không có nguồn CN trực tiếp')]),
          h('div', { class: 'character-cms-workbook-source' }, [h('span', 'Workbook VI · chỉ đọc'), h('span', descriptor?.source || 'Chưa có giá trị workbook')]),
        ]),
        h('div', { class: 'character-cms-field-editor' }, [
          h('span', { class: 'character-cms-input-label' }, 'Override VI · có thể chỉnh'),
          h('textarea', { value: target.value[key] ?? '', rows: key === 'descriptionVi' || key === 'obtainVi' ? 6 : 3, maxlength: 10000, onInput: (event) => updateDraft(target, key, event) }),
        ]),
      ]);
    }
    function renderStatus() {
      return h('div', { class: 'character-cms-status' }, [h('span', { class: ['admin-status-dot', `is-${status.value}`] }), h('strong', statusText(status.value)), currentCharacter.value ? h('small', `Character rev ${currentCharacter.value.revision}${currentSkin.value ? ` · Skin rev ${currentSkin.value.revision}` : ''}`) : null, error.value ? h('p', { class: conflict.value ? 'admin-conflict' : 'admin-error' }, error.value) : null]);
    }
    function renderDrawer() {
      if (!editingContext.value || !currentCharacter.value) return null;
      const skin = editingContext.value === 'skin' ? currentSkin.value : null;
      return h('div', { class: 'character-cms-modal-backdrop', onClick: (event) => { if (event.target === event.currentTarget) requestCloseEditor(); } }, [h('aside', { class: 'character-cms-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': skin ? 'Chỉnh sửa Skin' : 'Chỉnh sửa Character' }, [h('header', { class: 'character-cms-modal-head' }, [h('div', [h('span', { class: 'admin-kicker' }, skin ? 'SKIN EDITOR' : 'CHARACTER EDITOR'), h('h2', skin ? (valueOf(skin, 'skinNameVi') || skin.skinNameCn) : (valueOf(currentCharacter.value, 'nameVi') || currentCharacter.value.nameCn)), h('p', { class: 'character-cms-modal-legend' }, 'Các ô bên dưới chỉnh override tiếng Việt. Raw CN và Workbook VI chỉ dùng để đối chiếu.')]), h('button', { class: 'character-cms-close', onClick: requestCloseEditor, 'aria-label': 'Đóng' }, '×')]), h('div', { class: 'character-cms-modal-fields' }, skin ? SKIN_FIELDS.map((field) => fieldControl(field, skinDraft, skin)) : CHARACTER_FIELDS.map((field) => fieldControl(field, characterDraft, currentCharacter.value))), h('footer', { class: 'character-cms-modal-actions' }, [closePending.value ? h('div', { class: 'character-cms-close-confirm', role: 'alert' }, [h('span', 'Bạn có thay đổi chưa lưu.'), h('div', { class: 'admin-actions' }, [h('button', { class: 'admin-secondary', onClick: cancelCloseEditor }, 'Tiếp tục chỉnh sửa'), h('button', { class: 'admin-primary', onClick: confirmCloseEditor }, 'Bỏ thay đổi')])]) : null, renderStatus(), h('div', { class: 'admin-actions' }, [h('button', { class: 'admin-secondary', disabled: !dirty.value || saving.value, onClick: discard }, 'Bỏ thay đổi'), h('button', { class: 'admin-primary', disabled: !dirty.value || saving.value, onClick: save }, saving.value ? 'Đang lưu…' : 'Lưu thay đổi')])])])]);
    }
    function renderIndex() {
      const cards = filteredCharacters.value.map((item) => h('button', { class: ['character-cms-tile', selectedCharacterId.value === item.characterId ? 'is-selected' : '', loadingCharacterId.value === item.characterId ? 'is-loading' : ''], role: 'listitem', onClick: () => goToCharacter(item.characterId) }, [
        h('span', { class: 'character-cms-tile-avatar' }, avatarFor(item)),
        h('span', { class: 'character-cms-tile-name' }, valueOf(item, 'nameVi') || valueOf(item, 'fullnameVi') || item.nameCn),
        h('span', { class: 'character-cms-tile-cn', lang: 'zh-Hans' }, item.nameCn || '—'),
        h('span', { class: 'character-cms-tile-meta' }, `${item.characterId} · rev ${item.revision}`),
      ]));
      const content = loading.value ? h('div', { class: 'character-cms-loading' }, 'Đang tải danh sách Character…') : error.value && !characters.value.length ? h('div', { class: 'character-cms-empty admin-error' }, error.value) : !filteredCharacters.value.length ? h('div', { class: 'character-cms-empty' }, 'Không có Character phù hợp.') : h('div', { class: 'character-cms-grid', role: 'list' }, cards);
      return h('section', { class: 'character-cms character-cms-index' }, [h('header', { class: 'character-cms-index-head' }, [h('div', [h('span', { class: 'admin-kicker' }, 'CHARACTER CMS'), h('h1', 'Characters'), h('p', { class: 'admin-muted' }, 'Duyệt nhanh roster canonical, mở workspace khi cần biên tập.')]), h('div', { class: 'character-cms-index-tools' }, [h('span', { class: 'character-cms-count' }, loading.value ? 'Đang tải…' : `${filteredCharacters.value.length} / ${characters.value.length}`), h('input', { class: 'character-cms-search', value: query.value, placeholder: 'Tìm ID / tên Việt / 中文…', onInput: (event) => { query.value = event.target.value; } })])]), content]);
    }
    function renderOverview() {
      const character = currentCharacter.value;
      return h('section', { class: 'character-cms-module character-cms-overview' }, [h('div', { class: 'character-cms-module-title' }, [h('div', [h('span', { class: 'admin-kicker' }, 'OVERVIEW'), h('h2', 'Character profile'), h('p', { class: 'admin-muted' }, 'Tách rõ nguồn CN, giá trị workbook và override tiếng Việt.')]), h('button', { class: 'admin-secondary character-cms-edit-button', onClick: openCharacterEditor }, 'Chỉnh sửa override')]), h('div', { class: 'character-cms-overview-grid' }, [h('div', { class: 'character-cms-data-grid' }, CHARACTER_FIELDS.map(([key, label]) => h('div', { class: 'character-cms-data-row' }, [h('span', { class: 'character-cms-data-label' }, label), h('div', [h('strong', valueOf(character, key) || 'Chưa có giá trị'), h('small', labelForState(character[key]))])]))), h('aside', { class: 'character-cms-overview-source' }, [h('span', { class: 'admin-kicker' }, 'SOURCE EVIDENCE'), h('div', [h('strong', 'Raw CN'), h('span', character.nameCn || '—')]), h('div', [h('strong', 'Fullname CN'), h('span', character.fullnameCn || '—')]), h('div', [h('strong', 'Character ID'), h('code', character.characterId)]), h('div', [h('strong', 'Revision'), h('code', String(character.revision))])])]), h('div', { class: 'character-cms-evidence' }, [h('span', `Raw Job: ${character.protected?.rawJob ?? '—'}`), h('span', `Raw Rare: ${character.protected?.rawRare ?? '—'}`), h('span', `Source snapshot: ${character.protected?.sourceSnapshotId ?? '—'}`)])]);
    }
    function renderSkins() {
      const skins = selected.value?.skins || [];
      return h('section', { class: 'character-cms-module character-cms-skins' }, [h('div', { class: 'character-cms-module-title' }, [h('div', [h('span', { class: 'admin-kicker' }, 'SKINS'), h('h2', 'Canonical skins'), h('p', { class: 'admin-muted' }, 'Chọn một Skin để mở editor; relation và asset source chỉ đọc.')])]), skins.length ? h('div', { class: 'character-cms-skin-grid' }, skins.map((skin) => h('button', { class: ['character-cms-skin-card', selectedSkinId.value === skin.skinId ? 'is-selected' : ''], onClick: () => selectSkin(skin), 'aria-label': `Mở editor ${valueOf(skin, 'skinNameVi') || skin.skinNameCn}` }, [h('div', { class: 'character-cms-skin-image' }, skin.assets?.find((asset) => asset.source?.url)?.source?.url ? h('img', { src: skin.assets.find((asset) => asset.source?.url).source.url, alt: '' }) : h('span', skin.skinId.slice(-2))), h('span', { class: 'character-cms-skin-meta' }, [h('strong', valueOf(skin, 'skinNameVi') || skin.skinNameCn), h('span', { class: 'character-cms-skin-cn', lang: 'zh-Hans' }, skin.skinNameCn || '—'), h('span', { class: 'character-cms-mono' }, skin.skinId), h('small', `${valueOf(skin, 'obtainVi') || 'Chưa có cách nhận'} · ${skin.source?.skinType || '—'}`)])]))) : h('div', { class: 'character-cms-empty' }, 'Không có Skin liên kết.')]);
    }
    function renderSource() {
      const character = currentCharacter.value;
      const identity = character.protected?.rawIdentity || {};
      return h('section', { class: 'character-cms-module' }, [h('div', { class: 'character-cms-module-title' }, [h('span', { class: 'admin-kicker' }, 'SOURCE'), h('h2', 'Nguồn canonical'), h('p', { class: 'admin-muted' }, 'Bằng chứng importer được trình bày theo ngữ nghĩa operator, không dump object thô.')]), h('div', { class: 'character-cms-source-grid' }, [h('div', { class: 'character-cms-source-list' }, [['Character ID', character.characterId], ['Source snapshot', character.protected?.sourceSnapshotId], ['Workbook snapshot', character.protected?.workbookSnapshotId], ['Raw unlock date', character.protected?.rawUnlockDate], ['Raw Job', character.protected?.rawJob], ['Raw Rare', character.protected?.rawRare]].map(([label, value]) => h('div', { class: 'character-cms-data-row' }, [h('span', { class: 'character-cms-data-label' }, label), h('code', String(value ?? '—'))]))), h('div', { class: 'character-cms-source-list character-cms-structured' }, [h('h3', 'Raw identity'), ...Object.entries(identity).map(([key, value]) => h('div', { class: 'character-cms-data-row' }, [h('span', { class: 'character-cms-data-label' }, key), h('span', String(value ?? '—'))]))])])]);
    }
    function renderHistory() {
      const entries = selected.value?.history || [];
      return h('section', { class: 'character-cms-module' }, [h('div', { class: 'character-cms-module-title' }, [h('span', { class: 'admin-kicker' }, 'HISTORY'), h('h2', 'Revision history'), h('p', { class: 'admin-muted' }, 'Audit trail được diễn giải theo hành động và thay đổi, vẫn giữ raw code ở lớp phụ.')]), entries.length ? h('div', { class: 'character-cms-history-table' }, entries.map((entry) => h('div', { class: 'character-cms-history-row' }, [h('div', [h('strong', FIELD_LABELS[entry.fieldName] || entry.fieldName), h('small', `${new Date(entry.editedAt).toLocaleString('vi-VN')} · actor ${String(entry.actorUserId || '').slice(0, 8)}`)]), h('div', [h('strong', readableEventType(entry.eventType)), h('small', entry.eventType)]), h('span', readableHistoryValue(entry.oldValue)), h('span', '→'), h('span', readableHistoryValue(entry.newValue))]))) : h('div', { class: 'character-cms-empty' }, 'Chưa có audit event.')]);
    }
    function renderWorkspace() {
      const listCharacter = characters.value.find((item) => item.characterId === selectedCharacterId.value);
      const character = currentCharacter.value || listCharacter;
      if (!character) return h('section', { class: 'character-cms character-cms-character' }, h('div', { class: 'character-cms-loading' }, 'Đang mở Character…'));
      const moduleContent = detailLoading.value ? h('div', { class: 'character-cms-loading' }, 'Đang tải dữ liệu chi tiết…') : activeModule.value === 'skins' ? renderSkins() : activeModule.value === 'source' ? renderSource() : activeModule.value === 'history' ? renderHistory() : renderOverview();
      return h('section', { class: 'character-cms character-cms-character' }, [h('header', { class: 'character-cms-workspace-head' }, [h('button', { class: 'character-cms-back', onClick: goToIndex }, '← Characters'), h('div', { class: 'character-cms-identity' }, [h('div', { class: 'character-cms-avatar-hero' }, avatarFor(character)), h('div', [h('span', { class: 'admin-kicker' }, character.characterId), h('h1', valueOf(character, 'nameVi') || character.nameCn), h('p', { class: 'character-cms-cn' }, character.nameCn || '—')])]), h('div', { class: 'character-cms-head-meta' }, [h('span', `Revision ${character.revision ?? '—'}`), h('span', `Skins ${selected.value?.skins?.length ?? '—'}`)])]), h('nav', { class: 'character-cms-module-nav', 'aria-label': 'Character modules' }, MODULES.map(([key, label]) => h('button', { class: activeModule.value === key ? 'is-active' : '', onClick: () => { activeModule.value = key; if (key !== 'skins') { selectedSkinId.value = null; editingContext.value = null; } } }, label))), h('main', { class: 'character-cms-module-content' }, [moduleContent]), editingContext.value ? renderDrawer() : renderStatus()]);
    }
    function onHashChange() { handleRoute(); }
    onMounted(async () => { window.addEventListener('hashchange', onHashChange); window.addEventListener('keydown', handleEditorKeydown); await loadCharacters(); handleRoute(); });
    onBeforeUnmount(() => { window.removeEventListener('hashchange', onHashChange); window.removeEventListener('keydown', handleEditorKeydown); detailController?.abort(); });
    return () => h('div', { class: 'character-cms-root' }, selectedCharacterId.value ? renderWorkspace() : renderIndex());
  },
};

export function mountCharacterSkinAdmin(container, session) {
  const app = createApp(App, { session });
  app.mount(container);
  return app;
}
