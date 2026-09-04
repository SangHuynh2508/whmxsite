/**
 * Standalone Character Catalog Index Page (/characters)
 */
import { getGameData } from '../data/loader.js';

let catalogSearchQuery = '';
let catalogJobFilter = 'all';
let catalogRarityFilter = 'all';
let catalogPoolFilter = 'all';
let isFilterExpanded = false;

export function renderCharacterCatalogView(container) {
  const gameData = getGameData();
  if (!gameData || !gameData.characters) return;

  const jobNames = { 1: "Túc Vệ", 2: "Khinh Nhuệ", 3: "Viễn Kích", 4: "Cấu Thuật", 5: "Chiến Lược" };

  function removeVietnameseTones(str) {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();
  }

  function getFilteredChars() {
    const chars = Object.values(gameData.characters).sort((a, b) => {
      if (b.rare !== a.rare) return b.rare - a.rare;
      return a.id.localeCompare(b.id);
    });

    return chars.filter(char => {
      if (catalogJobFilter !== 'all' && String(char.job) !== catalogJobFilter) return false;
      if (catalogRarityFilter !== 'all' && String(char.rare) !== catalogRarityFilter) return false;
      if (catalogPoolFilter === 'limited' && !char.is_limited) return false;
      if (catalogPoolFilter === 'standard' && char.is_limited) return false;

      if (catalogSearchQuery) {
        const rawQ = catalogSearchQuery.trim().toLowerCase();
        const normQ = removeVietnameseTones(rawQ);

        const targets = [
          char.name_vi,
          char.nickname_vi,
          char.fullname_vi,
          char.name_cn,
          char.tags_vi,
          char.profile?.department,
          char.profile?.record_id,
          char.slug
        ];

        const match = targets.some(val => {
          if (!val) return false;
          const strVal = String(val).toLowerCase();
          const normVal = removeVietnameseTones(strVal);
          return strVal.includes(rawQ) || normVal.includes(normQ);
        });

        if (!match) return false;
      }

      return true;
    });
  }

  function getActiveFilterCount() {
    let count = 0;
    if (catalogJobFilter !== 'all') count++;
    if (catalogRarityFilter !== 'all') count++;
    if (catalogPoolFilter !== 'all') count++;
    return count;
  }

  function renderGridHtml() {
    const filtered = getFilteredChars();
    if (filtered.length === 0) {
      return `
        <div class="catalog-empty-msg">
          <p>Không tìm thấy nhân vật nào phù hợp với bộ lọc hiện tại.</p>
        </div>
      `;
    }

    return filtered.map(char => {
      const rarityClass = char.rare === 4 ? 'ssr' : char.rare === 3 ? 'sr' : 'r';
      const rarityLabel = char.rare === 4 ? 'SSR' : char.rare === 3 ? 'SR' : 'R';
      const jobLabel = jobNames[char.job] || 'Khác';
      
      const cards = char.cards || [];
      const baseCardImg = (cards.length > 0) ? `/assets/cards/${cards[0]}` : `/${char.icon}`;
      const tinhCardImg = (cards.length > 1) ? `/assets/cards/${cards[1]}` : null;

      return `
        <a href="#/characters/${char.slug}" class="cc-card rare-${rarityClass}">
          <div class="cc-card-img-wrapper">
            <img src="${baseCardImg}" alt="${char.name_vi || char.name_cn}" class="cc-card-img cc-card-img-base" loading="lazy" />
            ${tinhCardImg ? `<img src="${tinhCardImg}" alt="${char.name_vi || char.name_cn} - Tinh Nghiên" class="cc-card-img cc-card-img-tinh" loading="lazy" />` : ''}
            <div class="cc-card-rarity-badge ${rarityClass}">${rarityLabel}</div>
            ${char.is_limited ? '<div class="cc-card-limited-badge">LIMITED</div>' : ''}
            <div class="cc-card-job-badge" title="${jobLabel}">
              <img src="/assets/jobs/job_${char.job}.png" alt="${jobLabel}" class="cc-job-icon" />
            </div>
          </div>

          <div class="cc-card-content">
            <h3 class="cc-card-title">${char.name_vi || char.name_cn}</h3>
            ${char.name_cn ? `<div class="cc-card-cn cn-font">${char.name_cn}</div>` : ''}
          </div>
        </a>
      `;
    }).join('');
  }

  const activeCount = getActiveFilterCount();
  const totalChars = Object.keys(gameData.characters).length;

  container.innerHTML = `
    <div class="character-catalog-page">
      <!-- Full-Width Visual Hero Header -->
      <section class="catalog-hero">
        <div class="catalog-hero-content">
          <h1 class="catalog-hero-title">KHÍ GIẢ</h1>
        </div>
      </section>

      <!-- Compact Search & Collapsible Filter Bar -->
      <section class="catalog-toolbar-wrapper">
        <div class="catalog-main-toolbar">
          <div class="catalog-search-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" 
                   id="catalog-search-input" 
                   placeholder="Tìm kiếm theo tên nhân vật..." 
                   value="${catalogSearchQuery}" 
                   autocomplete="off" />
          </div>

          <button type="button" 
                  id="catalog-filter-toggle" 
                  class="catalog-filter-toggle-btn ${isFilterExpanded ? 'active' : ''}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
            <span>Bộ Lọc</span>
            ${activeCount > 0 ? `<span class="filter-count-badge">${activeCount}</span>` : ''}
          </button>
        </div>

        <!-- Collapsible Expandable Filters Toolbar -->
        <div class="catalog-expandable-filters ${isFilterExpanded ? 'open' : ''}" id="catalog-expandable-filters">
          <div class="compact-filter-row">
            <!-- Job Segmented Control -->
            <div class="compact-filter-group">
              <span class="cfg-label">Lớp:</span>
              <div class="segmented-control" id="job-segmented-control">
                <button class="seg-btn ${catalogJobFilter === 'all' ? 'active' : ''}" data-val="all">Tất cả</button>
                <button class="seg-btn ${catalogJobFilter === '1' ? 'active' : ''}" data-val="1">Túc Vệ</button>
                <button class="seg-btn ${catalogJobFilter === '2' ? 'active' : ''}" data-val="2">Khinh Nhuệ</button>
                <button class="seg-btn ${catalogJobFilter === '3' ? 'active' : ''}" data-val="3">Viễn Kích</button>
                <button class="seg-btn ${catalogJobFilter === '4' ? 'active' : ''}" data-val="4">Cấu Thuật</button>
                <button class="seg-btn ${catalogJobFilter === '5' ? 'active' : ''}" data-val="5">Chiến Lược</button>
              </div>
            </div>

            <!-- Rarity Segmented Control -->
            <div class="compact-filter-group">
              <span class="cfg-label">Hiếm:</span>
              <div class="segmented-control" id="rarity-segmented-control">
                <button class="seg-btn ${catalogRarityFilter === 'all' ? 'active' : ''}" data-val="all">Tất cả</button>
                <button class="seg-btn ${catalogRarityFilter === '4' ? 'active' : ''}" data-val="4">SSR</button>
                <button class="seg-btn ${catalogRarityFilter === '3' ? 'active' : ''}" data-val="3">SR</button>
                <button class="seg-btn ${catalogRarityFilter === '2' ? 'active' : ''}" data-val="2">R</button>
              </div>
            </div>

            <!-- Pool Segmented Control -->
            <div class="compact-filter-group">
              <span class="cfg-label">Hồ:</span>
              <div class="segmented-control" id="pool-segmented-control">
                <button class="seg-btn ${catalogPoolFilter === 'all' ? 'active' : ''}" data-val="all">Tất cả</button>
                <button class="seg-btn ${catalogPoolFilter === 'limited' ? 'active' : ''}" data-val="limited">Limited</button>
                <button class="seg-btn ${catalogPoolFilter === 'standard' ? 'active' : ''}" data-val="standard">Thường</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Character Grid -->
      <div class="catalog-grid-container" id="catalog-cards-grid">
        ${renderGridHtml()}
      </div>
    </div>
  `;

  // Attach Event Listeners
  const searchInput = container.querySelector('#catalog-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      catalogSearchQuery = e.target.value.trim();
      updateGrid();
    });
  }

  const filterToggleBtn = container.querySelector('#catalog-filter-toggle');
  const expandablePanel = container.querySelector('#catalog-expandable-filters');
  if (filterToggleBtn && expandablePanel) {
    filterToggleBtn.addEventListener('click', () => {
      isFilterExpanded = !isFilterExpanded;
      filterToggleBtn.classList.toggle('active', isFilterExpanded);
      expandablePanel.classList.toggle('open', isFilterExpanded);
    });
  }

  // Segmented control click handlers
  container.querySelectorAll('#job-segmented-control .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      catalogJobFilter = btn.dataset.val;
      container.querySelectorAll('#job-segmented-control .seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateGrid();
    });
  });

  container.querySelectorAll('#rarity-segmented-control .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      catalogRarityFilter = btn.dataset.val;
      container.querySelectorAll('#rarity-segmented-control .seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateGrid();
    });
  });

  container.querySelectorAll('#pool-segmented-control .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      catalogPoolFilter = btn.dataset.val;
      container.querySelectorAll('#pool-segmented-control .seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateGrid();
    });
  });

  function updateGrid() {
    const gridContainer = container.querySelector('#catalog-cards-grid');
    if (gridContainer) {
      gridContainer.innerHTML = renderGridHtml();
    }
  }
}

