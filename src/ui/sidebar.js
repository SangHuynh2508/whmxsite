import { state, setCharacter } from '../data/state.js';
import { getGameData } from '../data/loader.js';

let elCatalog, elSearch;
let activeJob = 'all';
let activeRarity = 'all';

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

  // Job filter chips
  document.getElementById('job-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    document.querySelectorAll('#job-filter .chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    activeJob = btn.dataset.job;
    renderCatalog();
  });

  // Rarity filter chips
  document.getElementById('rarity-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    document.querySelectorAll('#rarity-filter .chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    activeRarity = btn.dataset.rarity;
    renderCatalog();
  });

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

  renderCatalog();
}

function getRarityText(rareNum) {
  const map = { 5: 'EXTRA', 4: 'SSR', 3: 'SR', 2: 'R', 1: 'N' };
  return map[rareNum] || `R${rareNum}`;
}

export function renderCatalog() {
  const gameData = getGameData();
  const query = elSearch.value.toLowerCase().trim();

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
    // Search
    if (query) {
      const match =
        (char.name_vi || '').toLowerCase().includes(query) ||
        (char.fullname_vi || '').toLowerCase().includes(query) ||
        (char.name_cn || '').toLowerCase().includes(query) ||
        char.id.toLowerCase().includes(query);
      if (!match) return;
    }

    const div = document.createElement('div');
    div.className = `char-item ${state.character && state.character.id === char.id ? 'active' : ''}`;
    div.onclick = () => {
      document.querySelectorAll('.char-item').forEach(el => el.classList.remove('active'));
      div.classList.add('active');
      setCharacter(char);
      closeMobileDrawer();
    };

    const rareText = getRarityText(char.rare);
    
    div.innerHTML = `
      <img class="char-item-icon" src="/${char.icon}" alt="${char.name_vi}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 1 1\\'/%3E'"/>
      <div class="char-item-info">
        <span class="char-item-name">${char.name_vi || char.name_cn}</span>
        <span class="char-item-rare rare-${char.rare}">${rareText}</span>
      </div>
    `;
    
    elCatalog.appendChild(div);
  });

  if (elCatalog.children.length === 0) {
    elCatalog.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:13px;">Không tìm thấy nhân vật.</div>';
  }
}
