/**
 * Standalone Character Catalog Index Page (/characters)
 */
import { getGameData } from '../../../data/loader.js';
import { hasHuanZhang, HUANZHANG_INDICATOR_ICON } from '../../../ui/utils/huanzhang.js';
import { getCharacterCardUrl } from '../../assets/assetPaths.js';
import { fold } from '../../../lib/fold.mts';
import { jobName, RARITY_LABELS } from '../../../ui/utils/gameLabels.mts';
import { catalogCardHtml } from '../catalogCard.mts';
import { newestFirst } from '../../../lib/newest.mts';
import { getLang, txt } from '../../../i18n/lang.mts';
import { s } from '../../../i18n/strings.mts';

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

  function getCharacterStatValue(char, statKey) {
    if (!char || !char.stats) return null;
    const st = char.stats;
    if (statKey === 'hp') return st.hp_max ?? st.hp_base ?? null;
    if (statKey === 'atk') return st.atk_max ?? st.atk_base ?? null;
    if (statKey === 'def') return st.def_physic_max ?? st.def_physic_base ?? null;
    if (statKey === 'res') return st.def_magic_max ?? st.def_magic_base ?? null;
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
        const normQ = fold(rawQ);

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
          const normVal = fold(strVal);
          return strVal.includes(rawQ) || normVal.includes(normQ);
        });

        if (!match) return false;
      }

      return true;
    });

    return filtered.sort((a, b) => {
      if (catalogSortOption === 'name') {
        const comp = txt(a, 'name').localeCompare(txt(b, 'name'), getLang() === 'cn' ? 'zh' : 'vi', { numeric: true, sensitivity: 'base' });
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
        // Default: 'latest' — newest release first (src/lib/newest.mts, shared with the calculator picker and skins)
        return newestFirst(a.unlock_date, b.unlock_date, a.id, b.id);
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
          <p>${s('catEmpty')}</p>
        </div>
      `;
    }

    return filtered.map((char) => {
      const cards = char.cards || [];
      const primary = cards[0] ? getCharacterCardUrl(cards[0]) : (char.icon ? (char.icon.startsWith('/') ? char.icon : `/${char.icon}`) : '');
      return catalogCardHtml({
        slug: char.slug, name: txt(char, 'name'), rare: char.rare, rarityLabel: RARITY_LABELS[char.rare] || 'R',
        job: char.job, jobLabel: jobName(char.job) || s('jobOther'), limited: Boolean(char.is_limited), primary,
        secondary: cards[1] ? getCharacterCardUrl(cards[1]) : null, huanzhangIcon: hasHuanZhang(char) ? HUANZHANG_INDICATOR_ICON : null,
      });
    }).join('');
  }

  // Inner markup of .character-catalog-page. The page element itself is created once and kept:
  // Lenis measures it (src/app/runtime/smoothScroll.js), so replacing it left the scroll limit stuck
  // at the height of the first re-render (e.g. 473px after filtering R, on a 5 200px page).
  function renderPageInnerHtml() {
    const activeCount = getActiveFilterCount();

    return `
        <!-- Full-Width Visual Hero Header -->
        <section class="catalog-hero">
          <div class="catalog-hero-content">
            <h1 class="catalog-hero-title">${s('navCharacters')}</h1>
            <span class="catalog-hero-count">${Object.keys(gameData.characters).length} ${s('catRecords')}</span>
          </div>
        </section>

        <!-- Compact Search & Collapsible Filter Bar -->
        <section class="catalog-toolbar-wrapper">
          <div class="catalog-main-toolbar">
            <div class="catalog-search-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" 
                     id="catalog-search-input" 
                     placeholder="${s('catSearch')}" 
                     value="${catalogSearchQuery}" 
                     autocomplete="off" />
              <button type="button" id="catalog-search-clear" class="catalog-search-clear" aria-label="${s('catSearchClear')}" ${catalogSearchQuery ? '' : 'hidden'}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <button type="button" 
                    id="catalog-filter-toggle" 
                    class="catalog-filter-toggle-btn ${isFilterExpanded ? 'active' : ''}">
              <svg class="filter-chevron-icon ${isFilterExpanded ? 'open' : ''}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              <span>${s('catFilter')}</span>
              ${activeCount > 0 ? `<span class="filter-count-badge">${activeCount}</span>` : ''}
            </button>
          </div>

          <!-- Collapsible Expandable Filters Toolbar (Continuous Layout without Dividers) -->
          <div class="catalog-expandable-filters ${isFilterExpanded ? 'open' : ''}" id="catalog-expandable-filters">
            <div class="catalog-filters-clip">
            <div class="catalog-filters-body">
            <div class="compact-filter-grid">
              <!-- Job Segmented Control -->
              <div class="compact-filter-group group-job">
                <span class="cfg-label">${s('catJob')}</span>
                <div class="segmented-control" id="job-segmented-control">
                  <button class="seg-btn ${catalogJobFilters.has('1') ? 'active' : ''}" data-val="1">
                    <img src="/assets/jobs/job_1.png" alt="${s('job1')}" class="seg-btn-job-icon" />
                    <span>${s('job1')}</span>
                  </button>
                  <button class="seg-btn ${catalogJobFilters.has('2') ? 'active' : ''}" data-val="2">
                    <img src="/assets/jobs/job_2.png" alt="${s('job2')}" class="seg-btn-job-icon" />
                    <span>${s('job2')}</span>
                  </button>
                  <button class="seg-btn ${catalogJobFilters.has('3') ? 'active' : ''}" data-val="3">
                    <img src="/assets/jobs/job_3.png" alt="${s('job3')}" class="seg-btn-job-icon" />
                    <span>${s('job3')}</span>
                  </button>
                  <button class="seg-btn ${catalogJobFilters.has('4') ? 'active' : ''}" data-val="4">
                    <img src="/assets/jobs/job_4.png" alt="${s('job4')}" class="seg-btn-job-icon" />
                    <span>${s('job4')}</span>
                  </button>
                  <button class="seg-btn ${catalogJobFilters.has('5') ? 'active' : ''}" data-val="5">
                    <img src="/assets/jobs/job_5.png" alt="${s('job5')}" class="seg-btn-job-icon" />
                    <span>${s('job5')}</span>
                  </button>
                </div>
              </div>

              <!-- Rarity Segmented Control -->
              <div class="compact-filter-group group-rarity">
                <span class="cfg-label">${s('catRarity')}</span>
                <div class="segmented-control" id="rarity-segmented-control">
                  <button class="seg-btn seg-ssr ${catalogRarityFilters.has('4') ? 'active' : ''}" data-val="4">SSR</button>
                  <button class="seg-btn seg-sr ${catalogRarityFilters.has('3') ? 'active' : ''}" data-val="3">SR</button>
                  <button class="seg-btn seg-r ${catalogRarityFilters.has('2') ? 'active' : ''}" data-val="2">R</button>
                </div>
              </div>

              <!-- Pool Segmented Control -->
              <div class="compact-filter-group group-pool">
                <span class="cfg-label">${s('catPool')}</span>
                <div class="segmented-control" id="pool-segmented-control">
                  <button class="seg-btn ${catalogPoolFilters.has('limited') ? 'active' : ''}" data-val="limited">Limited</button>
                  <button class="seg-btn ${catalogPoolFilters.has('standard') ? 'active' : ''}" data-val="standard">${s('catStandard')}</button>
                </div>
              </div>

              <!-- Hoán Chương Segmented Control -->
              <div class="compact-filter-group group-huanzhang">
                <span class="cfg-label">${s('catHuanZhang')}</span>
                <div class="segmented-control" id="huanzhang-segmented-control">
                  <button class="seg-btn ${catalogHuanZhangFilter ? 'active' : ''}" id="hz-toggle-btn">${s('catHasHz')}</button>
                </div>
              </div>

              <!-- SẮP XẾP Group -->
              <div class="compact-filter-group group-sort">
                <span class="cfg-label">${s('catSort')}</span>
                <div class="segmented-control" id="sort-segmented-control">
                  <button class="seg-btn ${catalogSortOption === 'latest' ? 'active' : ''}" data-sort="latest">${s('catSortLatest')}</button>
                  <button class="seg-btn ${catalogSortOption === 'name' ? 'active' : ''}" data-sort="name">${s('catSortName')}</button>
                  <button class="seg-btn ${catalogSortOption === 'rarity' ? 'active' : ''}" data-sort="rarity">${s('catSortRarity')}</button>
                  <button class="seg-btn ${catalogSortOption === 'hp' ? 'active' : ''}" data-sort="hp">${s('catSortHp')}</button>
                  <button class="seg-btn ${catalogSortOption === 'atk' ? 'active' : ''}" data-sort="atk">${s('catSortAtk')}</button>
                  <button class="seg-btn ${catalogSortOption === 'def' ? 'active' : ''}" data-sort="def">${s('catSortDef')}</button>
                  <button class="seg-btn ${catalogSortOption === 'res' ? 'active' : ''}" data-sort="res">${s('catSortRes')}</button>
                </div>
              </div>

              <!-- Always in place (hidden while idle) so a first filter never makes the panel taller -->
              <div class="compact-filter-clear ${activeCount > 0 ? '' : 'is-idle'}">
                <button type="button" class="catalog-clear-filters-btn" id="catalog-clear-filters-btn">${s('catClear')}</button>
              </div>
            </div>
            </div>
            </div>
          </div>
        </section>

        <!-- Character Grid -->
        <div class="catalog-grid-container" id="catalog-cards-grid">
          ${renderGridHtml()}
        </div>
    `;
  }

  container.innerHTML = `<div class="character-catalog-page">${renderPageInnerHtml()}</div>`;
  attachEvents();

  function attachEvents() {
    const searchInput = container.querySelector('#catalog-search-input');
    const searchClear = container.querySelector('#catalog-search-clear');
    if (searchInput) {
      const clearSearch = () => {
        searchInput.value = '';
        catalogSearchQuery = '';
        if (searchClear) searchClear.hidden = true;
        updateGrid();
        searchInput.focus();
      };
      searchInput.addEventListener('input', (e) => {
        catalogSearchQuery = e.target.value.trim();
        if (searchClear) searchClear.hidden = !e.target.value;
        updateGrid();
      });
      // Esc clears a typed name, like the ✕.
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchInput.value) {
          e.preventDefault();
          clearSearch();
        }
      });
      searchClear?.addEventListener('click', clearSearch);
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
    const page = container.querySelector('.character-catalog-page');
    if (page) page.innerHTML = renderPageInnerHtml();
    else container.innerHTML = `<div class="character-catalog-page">${renderPageInnerHtml()}</div>`;
    attachEvents();
  }

  function updateGrid() {
    const gridContainer = container.querySelector('#catalog-cards-grid');
    if (gridContainer) {
      gridContainer.innerHTML = renderGridHtml();
    }
  }
}
