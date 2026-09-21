/**
 * Standalone Character Catalog Index Page (/characters)
 */
import { getGameData } from '../../../data/loader.js';
import { hasHuanZhang, HUANZHANG_INDICATOR_ICON } from '../../../ui/utils/huanzhang.js';
import { getCharacterCardUrl } from '../../assets/assetPaths.js';

let catalogSearchQuery = '';
let catalogJobFilters = new Set(); // Set of '1' | '2' | '3' | '4' | '5'
let catalogRarityFilters = new Set(); // Set of '4' | '3' | '2'
let catalogPoolFilters = new Set(); // Set of 'limited' | 'standard'
let catalogHuanZhangFilter = false; // false | true
let catalogSortOption = 'latest'; // 'latest' | 'name' | 'rarity' | 'hp' | 'atk' | 'def' | 'res'
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

  function getCharacterStatValue(char, statKey) {
    if (!char || !char.stats) return null;
    const s = char.stats;
    if (statKey === 'hp') return s.hp_max ?? s.hp_base ?? null;
    if (statKey === 'atk') return s.atk_max ?? s.atk_base ?? null;
    if (statKey === 'def') return s.def_physic_max ?? s.def_physic_base ?? null;
    if (statKey === 'res') return s.def_magic_max ?? s.def_magic_base ?? null;
    return null;
  }

  function getFilteredChars() {
    const chars = Object.values(gameData.characters);

    const filtered = chars.filter(char => {
      if (catalogJobFilters.size > 0 && !catalogJobFilters.has(String(char.job))) return false;
      if (catalogRarityFilters.size > 0 && !catalogRarityFilters.has(String(char.rare))) return false;
      if (catalogPoolFilters.size > 0) {
        const pool = char.is_limited ? 'limited' : 'standard';
        if (!catalogPoolFilters.has(pool)) return false;
      }
      if (catalogHuanZhangFilter && !hasHuanZhang(char)) return false;

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

    return filtered.sort((a, b) => {
      if (catalogSortOption === 'name') {
        const nameA = a.name_vi || a.name_cn || '';
        const nameB = b.name_vi || b.name_cn || '';
        const comp = nameA.localeCompare(nameB, 'vi', { numeric: true, sensitivity: 'base' });
        if (comp !== 0) return comp;
        return b.id.localeCompare(a.id);
      } else if (catalogSortOption === 'rarity') {
        if (b.rare !== a.rare) return b.rare - a.rare;
        return b.id.localeCompare(a.id);
      } else if (['hp', 'atk', 'def', 'res'].includes(catalogSortOption)) {
        const valA = getCharacterStatValue(a, catalogSortOption);
        const valB = getCharacterStatValue(b, catalogSortOption);
        if (valA === null && valB === null) return b.id.localeCompare(a.id);
        if (valA === null) return 1;
        if (valB === null) return -1;
        if (valB !== valA) return valB - valA;
        return b.id.localeCompare(a.id);
      } else {
        // Default: 'latest' (newest release order based on UnlockDate timestamp)
        const dateA = typeof a.unlock_date === 'number' && a.unlock_date > 0 ? a.unlock_date : 0;
        const dateB = typeof b.unlock_date === 'number' && b.unlock_date > 0 ? b.unlock_date : 0;

        if (dateA > 0 && dateB > 0) {
          if (dateB !== dateA) return dateB - dateA;
          return b.id.localeCompare(a.id);
        }
        if (dateA > 0 && dateB <= 0) return -1;
        if (dateB > 0 && dateA <= 0) return 1;
        return b.id.localeCompare(a.id);
      }
    });
  }

  function getActiveFilterCount() {
    return catalogJobFilters.size + catalogRarityFilters.size + catalogPoolFilters.size + (catalogHuanZhangFilter ? 1 : 0);
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

    return filtered.map((char) => {
      const rarityClass = char.rare === 4 ? 'ssr' : char.rare === 3 ? 'sr' : 'r';
      const rarityLabel = char.rare === 4 ? 'SSR' : char.rare === 3 ? 'SR' : 'R';
      const jobLabel = jobNames[char.job] || 'Khác';
      const hasHz = hasHuanZhang(char);
      
      const cards = char.cards || [];

      let baseCardImg = (cards.length > 0 && cards[0]) ? getCharacterCardUrl(cards[0]) : null;
      if (!baseCardImg) {
        baseCardImg = char.icon ? (char.icon.startsWith('/') ? char.icon : `/${char.icon}`) : '';
      }

      let tinhCardImg = (cards.length > 1 && cards[1]) ? getCharacterCardUrl(cards[1]) : null;

      const nameStr = char.name_vi || char.name_cn || '';
      const nameLength = nameStr.length;
      const nameTier = nameLength <= 11 ? 'name-short' : (nameLength <= 17 ? 'name-medium' : 'name-long');

      return `
        <a href="#/characters/${char.slug}" 
           class="cc-card rare-${rarityClass} ${char.is_limited ? 'is-limited' : ''} ${hasHz ? 'has-huanzhang' : ''} ${tinhCardImg ? 'has-hover-card' : ''} card-result-reveal" 
           ${hasHz ? 'data-huanzhang="true"' : ''}>
          <div class="card-media">
            <img src="${baseCardImg}" alt="${nameStr}" class="card-image-primary" loading="lazy" />
            ${tinhCardImg ? `<img src="${tinhCardImg}" alt="${nameStr}" class="card-image-secondary" loading="lazy" onerror="this.style.display='none'" />` : ''}
            ${hasHz ? `
              <div class="character-huanzhang-indicator" title="Có Hoán Chương">
                <img src="${HUANZHANG_INDICATOR_ICON}" alt="" class="hz-indicator-img" onerror="this.parentElement.style.display='none';" />
              </div>
            ` : ''}
            <div class="card-bottom-overlay"></div>
            <div class="rarity-label ${rarityClass}">${rarityLabel}</div>
            <div class="card-identity">
              <img src="/assets/jobs/job_${char.job}.png" alt="${jobLabel}" class="job-icon" title="${jobLabel}" />
              <div class="character-name-box">
                <span class="character-name ${nameTier}">${nameStr}</span>
              </div>
            </div>
          </div>
        </a>
      `;
    }).join('');
  }

  function renderToolbarHtml() {
    const activeCount = getActiveFilterCount();

    return `
      <div class="character-catalog-page">
        <!-- Full-Width Visual Hero Header -->
        <section class="catalog-hero">
          <div class="catalog-hero-content">
            <h1 class="catalog-hero-title">Khí Giả</h1>
            <span class="catalog-hero-count">${Object.keys(gameData.characters).length} hồ sơ</span>
          </div>
        </section>

        <!-- Compact Search & Collapsible Filter Bar -->
        <section class="catalog-toolbar-wrapper">
          <div class="catalog-main-toolbar">
            <div class="catalog-search-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" 
                     id="catalog-search-input" 
                     placeholder="Tìm kiếm theo tên nhân vật..." 
                     value="${catalogSearchQuery}" 
                     autocomplete="off" />
            </div>

            <button type="button" 
                    id="catalog-filter-toggle" 
                    class="catalog-filter-toggle-btn ${isFilterExpanded ? 'active' : ''}">
              <svg class="filter-chevron-icon ${isFilterExpanded ? 'open' : ''}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              <span>Bộ Lọc</span>
              ${activeCount > 0 ? `<span class="filter-count-badge">${activeCount}</span>` : ''}
            </button>
          </div>

          <!-- Collapsible Expandable Filters Toolbar (Continuous Layout without Dividers) -->
          <div class="catalog-expandable-filters ${isFilterExpanded ? 'open' : ''}" id="catalog-expandable-filters">
            <div class="compact-filter-grid">
              <!-- Job Segmented Control -->
              <div class="compact-filter-group group-job">
                <span class="cfg-label">Chức nghiệp</span>
                <div class="segmented-control" id="job-segmented-control">
                  <button class="seg-btn ${catalogJobFilters.has('1') ? 'active' : ''}" data-val="1">
                    <img src="/assets/jobs/job_1.png" alt="Túc Vệ" class="seg-btn-job-icon" />
                    <span>Túc Vệ</span>
                  </button>
                  <button class="seg-btn ${catalogJobFilters.has('2') ? 'active' : ''}" data-val="2">
                    <img src="/assets/jobs/job_2.png" alt="Khinh Nhuệ" class="seg-btn-job-icon" />
                    <span>Khinh Nhuệ</span>
                  </button>
                  <button class="seg-btn ${catalogJobFilters.has('3') ? 'active' : ''}" data-val="3">
                    <img src="/assets/jobs/job_3.png" alt="Viễn Kích" class="seg-btn-job-icon" />
                    <span>Viễn Kích</span>
                  </button>
                  <button class="seg-btn ${catalogJobFilters.has('4') ? 'active' : ''}" data-val="4">
                    <img src="/assets/jobs/job_4.png" alt="Cấu Thuật" class="seg-btn-job-icon" />
                    <span>Cấu Thuật</span>
                  </button>
                  <button class="seg-btn ${catalogJobFilters.has('5') ? 'active' : ''}" data-val="5">
                    <img src="/assets/jobs/job_5.png" alt="Chiến Lược" class="seg-btn-job-icon" />
                    <span>Chiến Lược</span>
                  </button>
                </div>
              </div>

              <!-- Rarity Segmented Control -->
              <div class="compact-filter-group group-rarity">
                <span class="cfg-label">Độ hiếm</span>
                <div class="segmented-control" id="rarity-segmented-control">
                  <button class="seg-btn seg-ssr ${catalogRarityFilters.has('4') ? 'active' : ''}" data-val="4">SSR</button>
                  <button class="seg-btn seg-sr ${catalogRarityFilters.has('3') ? 'active' : ''}" data-val="3">SR</button>
                  <button class="seg-btn seg-r ${catalogRarityFilters.has('2') ? 'active' : ''}" data-val="2">R</button>
                </div>
              </div>

              <!-- Pool Segmented Control -->
              <div class="compact-filter-group group-pool">
                <span class="cfg-label">Phân loại</span>
                <div class="segmented-control" id="pool-segmented-control">
                  <button class="seg-btn ${catalogPoolFilters.has('limited') ? 'active' : ''}" data-val="limited">Limited</button>
                  <button class="seg-btn ${catalogPoolFilters.has('standard') ? 'active' : ''}" data-val="standard">Thường</button>
                </div>
              </div>

              <!-- Hoán Chương Segmented Control -->
              <div class="compact-filter-group group-huanzhang">
                <span class="cfg-label">HOÁN CHƯƠNG</span>
                <div class="segmented-control" id="huanzhang-segmented-control">
                  <button class="seg-btn ${catalogHuanZhangFilter ? 'active' : ''}" id="hz-toggle-btn">Có Hoán Chương</button>
                </div>
              </div>

              <!-- SẮP XẾP Group -->
              <div class="compact-filter-group group-sort">
                <span class="cfg-label">SẮP XẾP</span>
                <div class="segmented-control" id="sort-segmented-control">
                  <button class="seg-btn ${catalogSortOption === 'latest' ? 'active' : ''}" data-sort="latest">Mới Nhất</button>
                  <button class="seg-btn ${catalogSortOption === 'name' ? 'active' : ''}" data-sort="name">Tên</button>
                  <button class="seg-btn ${catalogSortOption === 'rarity' ? 'active' : ''}" data-sort="rarity">Độ Hiếm</button>
                  <button class="seg-btn ${catalogSortOption === 'hp' ? 'active' : ''}" data-sort="hp">HP</button>
                  <button class="seg-btn ${catalogSortOption === 'atk' ? 'active' : ''}" data-sort="atk">ATK</button>
                  <button class="seg-btn ${catalogSortOption === 'def' ? 'active' : ''}" data-sort="def">DEF</button>
                  <button class="seg-btn ${catalogSortOption === 'res' ? 'active' : ''}" data-sort="res">RES</button>
                </div>
              </div>
            </div>

            ${activeCount > 0 ? `
              <div class="filter-bottom-actions">
                <button type="button" class="catalog-clear-filters-btn" id="catalog-clear-filters-btn">Xóa bộ lọc</button>
              </div>
            ` : ''}
          </div>
        </section>

        <!-- Character Grid -->
        <div class="catalog-grid-container" id="catalog-cards-grid">
          ${renderGridHtml()}
        </div>
      </div>
    `;
  }

  container.innerHTML = renderToolbarHtml();
  attachEvents();

  function attachEvents() {
    const searchInput = container.querySelector('#catalog-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        catalogSearchQuery = e.target.value.trim();
        updateGrid();
      });
    }

    const filterToggleBtn = container.querySelector('#catalog-filter-toggle');
    const expandablePanel = container.querySelector('#catalog-expandable-filters');
    const chevronIcon = container.querySelector('.filter-chevron-icon');
    if (filterToggleBtn && expandablePanel) {
      filterToggleBtn.addEventListener('click', () => {
        isFilterExpanded = !isFilterExpanded;
        filterToggleBtn.classList.toggle('active', isFilterExpanded);
        expandablePanel.classList.toggle('open', isFilterExpanded);
        if (chevronIcon) chevronIcon.classList.toggle('open', isFilterExpanded);
      });
    }

    // Multi-select click handlers
    container.querySelectorAll('#job-segmented-control .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.val;
        if (catalogJobFilters.has(val)) {
          catalogJobFilters.delete(val);
        } else {
          catalogJobFilters.add(val);
        }
        refreshUI();
      });
    });

    container.querySelectorAll('#rarity-segmented-control .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.val;
        if (catalogRarityFilters.has(val)) {
          catalogRarityFilters.delete(val);
        } else {
          catalogRarityFilters.add(val);
        }
        refreshUI();
      });
    });

    container.querySelectorAll('#pool-segmented-control .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.val;
        if (catalogPoolFilters.has(val)) {
          catalogPoolFilters.delete(val);
        } else {
          catalogPoolFilters.add(val);
        }
        refreshUI();
      });
    });

    const hzBtn = container.querySelector('#hz-toggle-btn');
    if (hzBtn) {
      hzBtn.addEventListener('click', () => {
        catalogHuanZhangFilter = !catalogHuanZhangFilter;
        refreshUI();
      });
    }

    // Sort handlers
    container.querySelectorAll('#sort-segmented-control .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sortVal = btn.dataset.sort;
        catalogSortOption = sortVal;
        refreshUI();
      });
    });

    const clearBtn = container.querySelector('#catalog-clear-filters-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        catalogJobFilters.clear();
        catalogRarityFilters.clear();
        catalogPoolFilters.clear();
        catalogHuanZhangFilter = false;
        catalogSortOption = 'latest';
        refreshUI();
      });
    }
  }

  function refreshUI() {
    container.innerHTML = renderToolbarHtml();
    attachEvents();
  }

  function updateGrid() {
    const gridContainer = container.querySelector('#catalog-cards-grid');
    if (gridContainer) {
      gridContainer.innerHTML = renderGridHtml();
    }
  }
}
