import { selectCalculatorCharacter } from '../../ui/calcCharacterPicker.js';
import { state, setCharacter } from '../../data/state.js';
import { getGameData } from '../../data/loader.js';
import { parseHash } from '../router/router.js';
import { getCharacterAvatarUrl } from '../../ui/utils/avatar.js';
import { hasHuanZhang } from '../../ui/utils/huanzhang.js';

let elCatalog, elSearch;
let activeJob = null;
let activeRarity = null;
let activePool = null;
let activeHuanzhang = false;

export function openMobileDrawer() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('drawer-backdrop');
  if (sidebar && backdrop) {
    sidebar.classList.remove('hidden');
    sidebar.classList.add('open');
    backdrop.classList.remove('hidden');
    backdrop.classList.add('active');
    document.body.classList.add('drawer-open');
    
    renderCatalog();

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      setTimeout(() => searchInput.focus(), 50);
    }
  }
}

export function closeMobileDrawer() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('drawer-backdrop');
  if (sidebar && backdrop) {
    sidebar.classList.remove('open');
    backdrop.classList.remove('active');
    document.body.classList.remove('drawer-open');
  }
}

export function initSidebar(catalogId, searchId) {
  elCatalog = document.getElementById(catalogId);
  elSearch = document.getElementById(searchId);

  elSearch.addEventListener('input', renderCatalog);

  // Advanced Filter Toggle Button
  const btnAdvFilter = document.getElementById('adv-filter-btn');
  const panelAdvFilter = document.getElementById('adv-filter-panel');
  
  if (btnAdvFilter && panelAdvFilter) {
    btnAdvFilter.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = panelAdvFilter.classList.contains('hidden');
      if (isHidden) {
        panelAdvFilter.classList.remove('hidden');
        btnAdvFilter.classList.add('active');
      } else {
        panelAdvFilter.classList.add('hidden');
        btnAdvFilter.classList.remove('active');
      }
    });

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      if (!panelAdvFilter.contains(e.target) && !btnAdvFilter.contains(e.target)) {
        panelAdvFilter.classList.add('hidden');
        btnAdvFilter.classList.remove('active');
      }
    });
  }

  // Job filter chips (deselect on second click)
  const jobFilter = document.getElementById('job-filter');
  if (jobFilter) {
    jobFilter.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      const val = btn.dataset.job;
      if (activeJob === val) {
        activeJob = null;
        btn.classList.remove('active');
      } else {
        jobFilter.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        activeJob = val;
      }
      updateFilterBadge();
      renderCatalog();
    });
  }

  // Rarity filter chips (deselect on second click)
  const rarityFilter = document.getElementById('rarity-filter');
  if (rarityFilter) {
    rarityFilter.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      const val = btn.dataset.rarity;
      if (activeRarity === val) {
        activeRarity = null;
        btn.classList.remove('active');
      } else {
        rarityFilter.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        activeRarity = val;
      }
      updateFilterBadge();
      renderCatalog();
    });
  }

  // Pool filter chips (deselect on second click)
  const poolFilter = document.getElementById('pool-filter');
  if (poolFilter) {
    poolFilter.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      const val = btn.dataset.pool;
      if (activePool === val) {
        activePool = null;
        btn.classList.remove('active');
      } else {
        poolFilter.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        activePool = val;
      }
      updateFilterBadge();
      renderCatalog();
    });
  }

  // Hoán Chương filter chip
  const hzFilter = document.getElementById('huanzhang-filter');
  if (hzFilter) {
    hzFilter.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      activeHuanzhang = !activeHuanzhang;
      btn.classList.toggle('active', activeHuanzhang);
      updateFilterBadge();
      renderCatalog();
    });
  }

  // Clear Filter Button
  const resetBtn = document.getElementById('reset-filter-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      activeJob = null;
      activeRarity = null;
      activePool = null;
      activeHuanzhang = false;

      if (jobFilter) jobFilter.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      if (rarityFilter) rarityFilter.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      if (poolFilter) poolFilter.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      if (hzFilter) hzFilter.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));

      updateFilterBadge();
      renderCatalog();
    });
  }

  // Mobile drawer controls
  const btnOpen = document.getElementById('mobile-char-select-btn');
  const btnOpenEmpty = document.getElementById('empty-char-select-btn');
  const btnClose = document.getElementById('sidebar-close-btn');
  const backdrop = document.getElementById('drawer-backdrop');

  if (btnOpen) btnOpen.addEventListener('click', openMobileDrawer);
  if (btnOpenEmpty) btnOpenEmpty.addEventListener('click', openMobileDrawer);
  if (btnClose) btnClose.addEventListener('click', closeMobileDrawer);
  if (backdrop) backdrop.addEventListener('click', closeMobileDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMobileDrawer();
    }
  });

  updateFilterBadge();
  renderCatalog();
}

function updateFilterBadge() {
  let count = 0;
  if (activeJob !== null) count++;
  if (activeRarity !== null) count++;
  if (activePool !== null) count++;
  if (activeHuanzhang) count++;

  const badge = document.getElementById('filter-active-count');
  if (badge) {
    if (count > 0) {
      badge.textContent = String(count);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

function getRarityText(rareNum) {
  const map = { 5: 'EXTRA', 4: 'SSR', 3: 'SR', 2: 'R', 1: 'N' };
  return map[rareNum] || `R${rareNum}`;
}

export function renderCatalog() {
  const gameData = getGameData();
  if (!gameData || !elCatalog) return;

  const query = elSearch.value.toLowerCase().trim();
  const route = parseHash();
  const activeCharId = route.view === 'character'
    ? route.characterId
    : (state.character ? state.character.id : '');

  elCatalog.innerHTML = '';
  
  const chars = Object.values(gameData.characters).sort((a, b) => {
    if (b.rare !== a.rare) return b.rare - a.rare;
    return a.id.localeCompare(b.id);
  });

  chars.forEach(char => {
    // Job filter
    if (activeJob !== null && String(char.job) !== activeJob) return;
    // Rarity filter
    if (activeRarity !== null && String(char.rare) !== activeRarity) return;
    // Pool filter (Limited / Standard)
    if (activePool === 'limited' && !char.is_limited) return;
    if (activePool === 'standard' && char.is_limited) return;
    // Hoán Chương filter
    if (activeHuanzhang && !hasHuanZhang(char)) return;

    // Search query
    if (query) {
      const match =
        (char.name_vi || '').toLowerCase().includes(query) ||
        (char.fullname_vi || '').toLowerCase().includes(query) ||
        (char.name_cn || '').toLowerCase().includes(query) ||
        char.id.toLowerCase().includes(query);
      if (!match) return;
    }

    const div = document.createElement('div');
    div.className = `char-item ${activeCharId === char.id ? 'active' : ''}`;
    div.onclick = () => {
      document.querySelectorAll('.char-item').forEach(el => el.classList.remove('active'));
      div.classList.add('active');

      const currentRoute = parseHash();
      if (currentRoute.view === 'character') {
        closeMobileDrawer();
        const subtab = (currentRoute.subtab && currentRoute.subtab !== 'overview') ? currentRoute.subtab : '';
        window.location.hash = subtab ? `#/characters/${char.id}/${subtab}` : `#/characters/${char.id}`;
      } else {
        selectCalculatorCharacter(char);
      }
    };

    const rareText = getRarityText(char.rare);
    const limitedBadge = char.is_limited ? `<span class="char-item-limited-tag">LIMITED</span>` : '';
    
    div.innerHTML = `
      <img class="char-item-icon" src="${getCharacterAvatarUrl(char)}" alt="${char.name_vi}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 1 1\\'/%3E'"/>
      <div class="char-item-info">
        <div class="char-item-name-row">
          <span class="char-item-name">${char.name_vi || char.name_cn}</span>
        </div>
        <div class="char-item-meta-row">
          <span class="char-item-rare rare-${char.rare}">${rareText}</span>
          ${limitedBadge}
        </div>
      </div>
    `;
    
    elCatalog.appendChild(div);
  });

  if (elCatalog.children.length === 0) {
    elCatalog.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:13px;text-align:center;">Không tìm thấy nhân vật phù hợp.</div>';
  }
}
