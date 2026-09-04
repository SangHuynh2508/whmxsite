import { state, setCharacter } from '../data/state.js';
import { getGameData } from '../data/loader.js';
import { parseHash } from '../router.js';

let elCatalog, elSearch;
let activeJob = 'all';
let activeRarity = 'all';
let activePool = 'all';

export function openMobileDrawer() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('drawer-backdrop');
  if (sidebar && backdrop) {
    sidebar.classList.add('open');
    backdrop.classList.add('active');
    document.body.classList.add('drawer-open');
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

  // Job filter chips
  const jobFilter = document.getElementById('job-filter');
  if (jobFilter) {
    jobFilter.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      jobFilter.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      activeJob = btn.dataset.job;
      updateFilterBadge();
      renderCatalog();
    });
  }

  // Rarity filter chips
  const rarityFilter = document.getElementById('rarity-filter');
  if (rarityFilter) {
    rarityFilter.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      rarityFilter.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      activeRarity = btn.dataset.rarity;
      updateFilterBadge();
      renderCatalog();
    });
  }

  // Pool filter chips (Limited / Standard)
  const poolFilter = document.getElementById('pool-filter');
  if (poolFilter) {
    poolFilter.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      poolFilter.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      activePool = btn.dataset.pool;
      updateFilterBadge();
      renderCatalog();
    });
  }

  // Reset Filter Button
  const resetBtn = document.getElementById('reset-filter-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      activeJob = 'all';
      activeRarity = 'all';
      activePool = 'all';

      if (jobFilter) {
        jobFilter.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        const def = jobFilter.querySelector('[data-job="all"]');
        if (def) def.classList.add('active');
      }
      if (rarityFilter) {
        rarityFilter.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        const def = rarityFilter.querySelector('[data-rarity="all"]');
        if (def) def.classList.add('active');
      }
      if (poolFilter) {
        poolFilter.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        const def = poolFilter.querySelector('[data-pool="all"]');
        if (def) def.classList.add('active');
      }

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
  if (activeJob !== 'all') count++;
  if (activeRarity !== 'all') count++;
  if (activePool !== 'all') count++;

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
    if (activeJob !== 'all' && String(char.job) !== activeJob) return;
    // Rarity filter
    if (activeRarity !== 'all' && String(char.rare) !== activeRarity) return;
    // Pool filter (Limited / Standard)
    if (activePool === 'limited' && !char.is_limited) return;
    if (activePool === 'standard' && char.is_limited) return;

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
      closeMobileDrawer();

      const currentRoute = parseHash();
      if (currentRoute.view === 'character') {
        const subtab = (currentRoute.subtab && currentRoute.subtab !== 'overview') ? currentRoute.subtab : '';
        window.location.hash = subtab ? `#/characters/${char.id}/${subtab}` : `#/characters/${char.id}`;
      } else {
        setCharacter(char);
      }
    };

    const rareText = getRarityText(char.rare);
    const limitedBadge = char.is_limited ? `<span class="char-item-limited-tag">LIMITED</span>` : '';
    
    div.innerHTML = `
      <img class="char-item-icon" src="/${char.icon}" alt="${char.name_vi}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 1 1\\'/%3E'"/>
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
