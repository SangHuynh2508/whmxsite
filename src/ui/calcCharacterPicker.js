import { state, setCharacter } from '../data/state.js';
import { getGameData } from '../data/loader.js';
import { renderHeader } from './characterHeader.js';
import { renderLevelProgress } from './levelProgress.js';
import { renderTalentGraph } from './talentGraph.js';
import { renderResourceSummary } from './resourceSummary.js';
import { calculateResources } from '../data/calculator.js';
import { closeMobileDrawer } from './sidebar.js';

import { getCharacterAvatarUrl } from './utils/avatar.js';

let activeJob = 'all';
let isInitialized = false;

export function isCalcPickerOpen() {
  const backdrop = document.getElementById('calc-char-picker-backdrop');
  return backdrop && !backdrop.classList.contains('hidden');
}

export function openCalcPicker() {
  initCalcPicker();
  const backdrop = document.getElementById('calc-char-picker-backdrop');
  if (!backdrop) return;

  backdrop.classList.remove('hidden');
  renderCalcPickerRoster();

  const searchInput = document.getElementById('calc-picker-search-input');
  if (searchInput) {
    setTimeout(() => searchInput.focus(), 50);
  }
}

export function closeCalcPicker() {
  const backdrop = document.getElementById('calc-char-picker-backdrop');
  if (backdrop) {
    backdrop.classList.add('hidden');
  }
}

export function selectCalculatorCharacter(characterOrId) {
  const gameData = getGameData();
  if (!gameData || !gameData.characters) return;

  let char = typeof characterOrId === 'string'
    ? (gameData.characters[characterOrId] || Object.values(gameData.characters).find(c =>
        (c.slug && c.slug.toLowerCase() === characterOrId.toLowerCase()) ||
        (c.id && c.id.toLowerCase() === characterOrId.toLowerCase())
      ))
    : characterOrId;

  if (!char) return;

  // 1. Update state
  setCharacter(char);

  // 2. Sync URL hash for sharing links when in calculator view
  if (!window.location.hash.includes('/characters/')) {
    const targetHash = `#calc?char=${char.id}`;
    if (window.location.hash !== targetHash) {
      history.replaceState(null, '', targetHash);
    }
  }

  // 3. Toggle main content vs empty state visibility
  const emptyState = document.getElementById('empty-state');
  const mainContent = document.getElementById('main-content');
  if (emptyState) emptyState.classList.add('hidden');
  if (mainContent) mainContent.classList.remove('hidden');

  // 4. Re-render Calculator view components
  renderHeader();
  renderLevelProgress();
  const graphContainer = document.getElementById('talent-graph-container');
  if (graphContainer) renderTalentGraph(graphContainer);

  const resources = calculateResources(gameData, state);
  renderResourceSummary(resources);

  // 5. Close pickers
  closeCalcPicker();
  try {
    closeMobileDrawer();
  } catch (e) {}
}

export function initCalcPicker() {
  if (isInitialized) return;
  isInitialized = true;

  const backdrop = document.getElementById('calc-char-picker-backdrop');
  const dialog = document.getElementById('calc-char-picker-dialog');
  const closeBtn = document.getElementById('calc-picker-close-btn');
  const searchInput = document.getElementById('calc-picker-search-input');
  const jobFilter = document.getElementById('calc-picker-job-filter');

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeCalcPicker();
    });
  }

  if (backdrop && dialog) {
    backdrop.addEventListener('click', (e) => {
      if (!dialog.contains(e.target)) {
        closeCalcPicker();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isCalcPickerOpen()) {
      closeCalcPicker();
    }
  });

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderCalcPickerRoster();
    });
  }

  if (jobFilter) {
    jobFilter.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      jobFilter.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeJob = chip.dataset.job || 'all';
      renderCalcPickerRoster();
    });
  }

  // Global Click Event Delegation for Avatar / Character Header clicks
  document.addEventListener('click', (e) => {
    const avatarBtn = e.target.closest('#profile-avatar-container, .profile-avatar-button');
    const changeBtn = e.target.closest('#profile-change-char-btn, .change-char-btn');
    const namesBox = e.target.closest('.profile-names');
    const emptyBtn = e.target.closest('#empty-char-select-btn');

    if (avatarBtn || changeBtn || namesBox || emptyBtn) {
      const isCalcHeader = (avatarBtn && avatarBtn.closest('#calc-profile-header')) ||
                           (changeBtn && changeBtn.closest('#calc-profile-header')) ||
                           (namesBox && namesBox.closest('#calc-profile-header'));
      if (isCalcHeader || emptyBtn) {
        e.preventDefault();
        e.stopPropagation();
        openCalcPicker();
      }
    }
  });
}

function getRarityText(rareNum) {
  const map = { 5: 'EXTRA', 4: 'SSR', 3: 'SR', 2: 'R', 1: 'N' };
  return map[rareNum] || `R${rareNum}`;
}

export function renderCalcPickerRoster() {
  const rosterEl = document.getElementById('calc-picker-roster-list');
  const searchInput = document.getElementById('calc-picker-search-input');
  const gameData = getGameData();

  if (!rosterEl || !gameData || !gameData.characters) return;

  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const currentSelectedId = state.character ? state.character.id : '';

  rosterEl.innerHTML = '';

  const chars = Object.values(gameData.characters).sort((a, b) => {
    if (b.rare !== a.rare) return b.rare - a.rare;
    return a.id.localeCompare(b.id);
  });

  let count = 0;
  chars.forEach(char => {
    // Job filter
    if (activeJob !== 'all' && String(char.job) !== activeJob) return;

    // Search query
    if (query) {
      const match =
        (char.name_vi || '').toLowerCase().includes(query) ||
        (char.fullname_vi || '').toLowerCase().includes(query) ||
        (char.name_cn || '').toLowerCase().includes(query) ||
        char.id.toLowerCase().includes(query);
      if (!match) return;
    }

    count++;
    const div = document.createElement('div');
    div.className = `calc-picker-item ${currentSelectedId === char.id ? 'active' : ''}`;
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');

    const rareText = getRarityText(char.rare);
    const limitedBadge = char.is_limited ? `<span class="char-item-limited-tag">LIMITED</span>` : '';

    div.innerHTML = `
      <img class="calc-picker-item-icon" src="${getCharacterAvatarUrl(char)}" alt="${char.name_vi}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 1 1\\'/%3E'"/>
      <div class="calc-picker-item-info">
        <div class="calc-picker-item-name-row">
          <span class="calc-picker-item-name">${char.name_vi || char.name_cn}</span>
        </div>
        <div class="calc-picker-item-meta-row">
          <span class="calc-picker-item-rare rare-${char.rare}">${rareText}</span>
          ${limitedBadge}
        </div>
      </div>
    `;

    div.addEventListener('click', () => selectCalculatorCharacter(char));
    div.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectCalculatorCharacter(char);
      }
    });

    rosterEl.appendChild(div);
  });

  if (count === 0) {
    rosterEl.innerHTML = '<div style="padding:24px;color:var(--text-muted);font-size:13px;text-align:center;">Không tìm thấy nhân vật phù hợp.</div>';
  }
}

