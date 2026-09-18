/**
 * WHMX Skin Gallery & Library Component (/gallery or /skins)
 * Uses Variant 2 Museum / Curatorial Collage as the authoritative hero.
 * Browses ACTUAL SKINS ONLY (145 custom skins), removing base/breakthrough appearances.
 */
import { getGameData } from '../data/loader.js';
import { resolveAssetUrl } from '../constants/assetPaths.js';
import './skinGalleryView.css';

// Featured skin configuration for Museum Curatorial Hero
// W0134003: Bút Dược Thiên Xuyên (Thiên Lý Giang Sơn Đồ)
const FEATURED_SKIN_CONFIG = {
  characterId: 'W0134',
  skinId: 'W0134003'
};

// Canonical order for actual-skin series IDs (202 to 220)
const CANONICAL_SERIES_IDS = [
  202, 203, 204, 205, 206, 207, 208, 209, 210,
  211, 212, 213, 214, 215, 216, 217, 218, 219, 220
];

// State
let searchQuery = '';
let selectedSource = 'all'; // 'all' | 'shop' | 'bundle' | 'travel' | 'event' | 'highskin'
let selectedSeries = 'all'; // 'all' | '202' .. '220'
let selectedCharacterId = 'all';
let sortOrder = 'default'; // 'default' | 'name-asc' | 'char-asc' | 'price-asc' | 'date-desc'

/**
 * Normalizes Vietnamese text for diacritic-insensitive search
 */
function normalizeText(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/**
 * Classifies source category based on proven MasterData fields
 */
function classifySkinSource(skin) {
  if (skin.is_high_skin === true) return 'highskin';
  const desc = skin.obtain_cn || skin.description_cn || '';
  if (desc.includes('衣装店')) return 'shop';
  if (desc.includes('礼包')) return 'bundle';
  if (desc.includes('游历')) return 'travel';
  if (desc.includes('活动') || desc.includes('花朝昔时') || desc.includes('协韵行歌')) return 'event';
  return 'other';
}

/**
 * Collects ONLY real skins (skin_type == 3 / suffix 003+) from all public characters
 */
function getActualSkins(gameData) {
  if (!gameData || !gameData.characters) return [];
  const skinList = [];

  Object.values(gameData.characters).forEach(char => {
    if (!Array.isArray(char.skins)) return;
    char.skins.forEach(skin => {
      const sid = skin.skinID || '';
      const suf = sid.slice(-3);
      if (suf === '001' || suf === '002' || skin.is_base === true || skin.skin_type === 1 || skin.skin_type === 2) {
        return;
      }

      const drawingUrl = resolveAssetUrl(skin.image);
      const cardUrl = skin.image
        ? skin.image.replace('/drawings/', '/cards/').replace('drawings', 'cards')
        : `https://pub-c0dceaa4fc5b48d1811c48f6f91a899c.r2.dev/characters/${char.id.toLowerCase()}/cards/${sid.toLowerCase()}.webp`;

      const sourceCategory = classifySkinSource(skin);

      skinList.push({
        skinId: sid,
        nameVi: skin.name_vi || skin.name_cn || `Trang Phục ${sid}`,
        nameCn: skin.name_cn || '',
        storyCn: skin.story_cn || skin.skinFileLanText || '',
        storyVi: skin.story_vi || '',
        obtainCn: skin.obtain_cn || skin.description_cn || '',
        obtainVi: skin.obtain_vi || skin.obtain_cn || 'Bán tại Cửa Hàng / Sự Kiện',
        price: skin.price || null,
        currency: skin.currency || '',
        unlockDate: skin.unlock_date || null,
        isHighSkin: skin.is_high_skin === true,
        skinRare: skin.skin_rare || char.rare || 3,
        cvName: skin.cv_name || '',
        sourceCategory,
        seriesId: skin.series_id || null,
        seriesNameCn: skin.series_name_cn || '',
        seriesNameVi: skin.series_name_vi || '',
        seriesBadge: skin.series_badge || (skin.series_id ? `/assets/series/skinlogo_${skin.series_id}.png` : null),
        drawingUrl,
        cardUrl,
        charId: char.id,
        charNameVi: char.name_vi || char.name_cn || char.id,
        charNameCn: char.name_cn || '',
        charSlug: char.slug || char.id
      });
    });
  });

  return skinList;
}

export function renderSkinGalleryView(container) {
  const gameData = getGameData();
  if (!gameData || !gameData.characters) {
    container.innerHTML = `<div class="whmx-skin-gallery"><p>Đang tải dữ liệu thư viện trang phục...</p></div>`;
    return;
  }

  const skins = getActualSkins(gameData);
  const featuredChar = gameData.characters[FEATURED_SKIN_CONFIG.characterId] || Object.values(gameData.characters)[0];
  const featuredSkin = skins.find(s => s.skinId === FEATURED_SKIN_CONFIG.skinId) || skins[0];

  // Derive series metadata and counts dynamically from public skin data (Single Source of Truth)
  const seriesMetaMap = {};
  const seriesCounts = {};
  skins.forEach(s => {
    if (s.seriesId) {
      seriesCounts[s.seriesId] = (seriesCounts[s.seriesId] || 0) + 1;
      if (!seriesMetaMap[s.seriesId]) {
        seriesMetaMap[s.seriesId] = {
          nameVi: s.seriesNameVi || s.seriesNameCn || 'Chưa xác định',
          nameCn: s.seriesNameCn || '',
          badge: s.seriesBadge || `/assets/series/skinlogo_${s.seriesId}.png`
        };
      }
    }
  });

  const seriesList = CANONICAL_SERIES_IDS.map(id => {
    const meta = seriesMetaMap[id] || {};
    return {
      id,
      nameVi: meta.nameVi || meta.nameCn || 'Chưa xác định',
      nameCn: meta.nameCn || '',
      badge: meta.badge || `/assets/series/skinlogo_${id}.png`,
      count: seriesCounts[id] || 0
    };
  });

  // Characters that have at least 1 actual skin
  const charsWithSkins = Array.from(new Set(skins.map(s => s.charId)))
    .map(cid => gameData.characters[cid])
    .filter(Boolean)
    .sort((a, b) => (a.name_vi || '').localeCompare(b.name_vi || '', 'vi'));

  container.innerHTML = `
    <div class="whmx-skin-gallery">
      <!-- Gallery Top Header -->
      <header class="skin-gallery-header">
        <div class="skin-gallery-eyebrow">
          <span class="dot"></span>
          <span>BẢO TÀNG VẬT HOA DI TÂN • THƯ VIỆN TRANG PHỤC</span>
        </div>
        <h1 class="skin-gallery-title">Bộ Sưu Tập Y Phục Khí Giả</h1>
        <p class="skin-gallery-subtitle">
          Khám phá 145 trang phục đặc biệt ghi dấu điển cố lịch sử, phong vị bốn mùa và nghệ thuật cổ vật ngàn năm.
        </p>
      </header>

      <!-- VARIANT 2: MUSEUM / CURATORIAL COLLAGE HERO (TWO-COLUMN CURATORIAL CANVAS, NO 3RD COLUMN) -->
      <section class="gallery-hero-container" id="gallery-hero-stage" aria-label="Triển lãm tiêu điểm">
        <div class="hero-variant-museum">
          <!-- Left Curatorial Plaque -->
          <div class="museum-curatorial-col">
            <div class="museum-exhibit-seal">
              <span>HỒ SƠ GIÁM ĐỊNH</span>
              <span>PHÒNG TRIỂN LÃM TIÊU ĐIỂM</span>
            </div>
            <h2 class="museum-title">${featuredSkin.nameVi}</h2>
            <div class="museum-char-meta">
              <a href="#/characters/${featuredChar.slug || featuredChar.id}" class="char-link-gold">${featuredChar.name_vi}</a>
            </div>
            <div class="museum-notes">
              ${featuredSkin.storyVi || featuredSkin.storyCn || 'Chế tác mô phỏng dáng hình kiệt tác Bắc Tống. Nét vẽ thanh thoát, thần thái tôn nghiêm, toát lên phong vận hội họa cổ truyền đỉnh cao.'}
            </div>
            <div class="museum-data-table">
              <div class="museum-data-row">
                <span>Tên nguyên bản</span>
                <span class="val">${featuredSkin.nameCn || '—'}</span>
              </div>
              <div class="museum-data-row">
                <span>Cách thức sở hữu</span>
                <span class="val">${featuredSkin.obtainVi || 'Bán qua gói quà'}</span>
              </div>
              <div class="museum-data-row">
                <span>Giá xuất xưởng</span>
                <span class="val highlight-price">${featuredSkin.price ? `${featuredSkin.price} ${featuredSkin.currency}` : 'Giới hạn'}</span>
              </div>
            </div>
            <a href="#/skins/${featuredSkin.skinId}" class="museum-explore-btn">
              <span>Xem chi tiết trang phục</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </a>
          </div>

          <!-- Center-Right Large Framed Masterpiece (Dominant Focus) -->
          <a href="#/skins/${featuredSkin.skinId}" class="museum-center-frame" title="Xem chi tiết trang phục ${featuredSkin.nameVi}">
            <span class="museum-frame-corner top-left"></span>
            <span class="museum-frame-corner top-right"></span>
            <span class="museum-frame-corner bottom-left"></span>
            <span class="museum-frame-corner bottom-right"></span>
            <img 
              class="museum-main-drawing" 
              src="${featuredSkin.drawingUrl}" 
              alt="${featuredSkin.nameVi}" 
              loading="eager"
              onerror="this.src='${featuredSkin.cardUrl}'"
            />
            <div class="museum-center-tag">TIÊU ĐIỂM TRIỂN LÃM</div>
          </a>
        </div>
      </section>

      <!-- FILTER & SEARCH TOOLBAR (PROVEN PROVENANCE FILTERS ONLY) -->
      <section class="gallery-toolbar" aria-label="Bộ lọc và tìm kiếm trang phục">
        <div class="gallery-toolbar-row-top">
          <!-- Text Search -->
          <div class="gallery-search-wrap">
            <svg class="gallery-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              class="gallery-search-input" 
              id="gallery-search-input" 
              placeholder="Tìm theo tên trang phục, Khí Giả..." 
              value="${searchQuery}"
              autocomplete="off"
            />
          </div>

          <!-- Controls: Character Dropdown & Sort -->
          <div class="gallery-controls-group">
            <select class="gallery-select" id="gallery-char-select" aria-label="Lọc theo Khí Giả">
              <option value="all">Tất cả Khí Giả (${charsWithSkins.length})</option>
              ${charsWithSkins.map(c => `
                <option value="${c.id}" ${selectedCharacterId === c.id ? 'selected' : ''}>
                  ${c.name_vi}
                </option>
              `).join('')}
            </select>

            <select class="gallery-select" id="gallery-sort-select" aria-label="Sắp xếp trang phục">
              <option value="default" ${sortOrder === 'default' ? 'selected' : ''}>Mặc định</option>
              <option value="name-asc" ${sortOrder === 'name-asc' ? 'selected' : ''}>Tên trang phục (A-Z)</option>
              <option value="char-asc" ${sortOrder === 'char-asc' ? 'selected' : ''}>Tên Khí Giả (A-Z)</option>
              <option value="price-asc" ${sortOrder === 'price-asc' ? 'selected' : ''}>Giá vé (Thấp đến Cao)</option>
              <option value="date-desc" ${sortOrder === 'date-desc' ? 'selected' : ''}>Mới ra mắt gần đây</option>
            </select>
          </div>
        </div>

        <!-- Filter Row 1: Source Category Chips (No stars, no fake series) -->
        <div class="gallery-filter-group">
          <div class="gallery-filter-label">Phương thức sở hữu:</div>
          <div class="gallery-category-chips" id="gallery-category-chips">
            <button type="button" class="gallery-chip-btn ${selectedSource === 'all' ? 'active' : ''}" data-source="all">
              Tất Cả Nguồn (${skins.length})
            </button>
            <button type="button" class="gallery-chip-btn ${selectedSource === 'shop' ? 'active' : ''}" data-source="shop">
              Tiệm Y Phục (${skins.filter(s => s.sourceCategory === 'shop').length})
            </button>
            <button type="button" class="gallery-chip-btn ${selectedSource === 'bundle' ? 'active' : ''}" data-source="bundle">
              Gói Quà (${skins.filter(s => s.sourceCategory === 'bundle').length})
            </button>
            <button type="button" class="gallery-chip-btn ${selectedSource === 'travel' ? 'active' : ''}" data-source="travel">
              Du Lịch (${skins.filter(s => s.sourceCategory === 'travel').length})
            </button>
            <button type="button" class="gallery-chip-btn ${selectedSource === 'event' ? 'active' : ''}" data-source="event">
              Sự Kiện (${skins.filter(s => s.sourceCategory === 'event').length})
            </button>
            <button type="button" class="gallery-chip-btn ${selectedSource === 'highskin' ? 'active' : ''}" data-source="highskin">
              Tương Tác Cao Cấp (${skins.filter(s => s.isHighSkin).length})
            </button>
          </div>
        </div>

        <!-- Filter Row 2: Series Filter (Official SkinLogo Badges) -->
        <div class="gallery-filter-group">
          <div class="gallery-filter-label">Dòng y phục (Series):</div>
          <div class="gallery-series-chips" id="gallery-series-chips">
            <button type="button" class="gallery-series-chip ${selectedSeries === 'all' ? 'active' : ''}" data-series="all">
              <span>Tất Cả Series</span>
            </button>
            ${seriesList.map(item => `
              <button type="button" class="gallery-series-chip ${String(selectedSeries) === String(item.id) ? 'active' : ''}" data-series="${item.id}" title="Dòng: ${item.nameVi}">
                <img src="${item.badge}" alt="${item.nameVi}" class="series-chip-badge" loading="lazy" />
                <span class="series-chip-name">${item.nameVi}</span>
                <span class="series-chip-count">(${item.count})</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="gallery-results-count-bar">
          <span class="gallery-results-count" id="gallery-results-count">
            <!-- Dynamically populated -->
          </span>
        </div>
      </section>

      <!-- SKIN-ONLY GALLERY GRID (Skin Name Primary > Character Name Secondary) -->
      <section class="gallery-cards-grid" id="gallery-cards-grid" aria-label="Danh sách trang phục">
        <!-- Rendered via renderGridCards() -->
      </section>
    </div>
  `;

  // Render cards
  renderGridCards(skins);

  // Event handlers
  setupEventListeners(container, skins);
}

// Backward-compatible alias export
export { renderSkinGalleryView as renderGalleryDemoView };

function getFilteredSkins(skins) {
  const filtered = skins.filter(skin => {
    // Source filter
    if (selectedSource !== 'all') {
      if (selectedSource === 'highskin') {
        if (!skin.isHighSkin) return false;
      } else if (skin.sourceCategory !== selectedSource) {
        return false;
      }
    }

    // Series filter
    if (selectedSeries !== 'all') {
      if (String(skin.seriesId) !== String(selectedSeries)) {
        return false;
      }
    }

    // Character filter
    if (selectedCharacterId !== 'all' && skin.charId !== selectedCharacterId) {
      return false;
    }

    // Search query
    if (searchQuery) {
      const qNorm = normalizeText(searchQuery);
      const skinVi = normalizeText(skin.nameVi);
      const skinCn = normalizeText(skin.nameCn);
      const charVi = normalizeText(skin.charNameVi);
      const charId = normalizeText(skin.charId);
      const skinId = normalizeText(skin.skinId);
      const seriesVi = normalizeText(skin.seriesNameVi);
      const seriesCn = normalizeText(skin.seriesNameCn);

      const matches =
        skinVi.includes(qNorm) ||
        skinCn.includes(qNorm) ||
        charVi.includes(qNorm) ||
        charId.includes(qNorm) ||
        skinId.includes(qNorm) ||
        seriesVi.includes(qNorm) ||
        seriesCn.includes(qNorm);

      if (!matches) return false;
    }

    return true;
  });

  // Sort
  if (sortOrder === 'name-asc') {
    filtered.sort((a, b) => a.nameVi.localeCompare(b.nameVi, 'vi'));
  } else if (sortOrder === 'char-asc') {
    filtered.sort((a, b) => a.charNameVi.localeCompare(b.charNameVi, 'vi') || a.skinId.localeCompare(b.skinId));
  } else if (sortOrder === 'price-asc') {
    filtered.sort((a, b) => (a.price || 9999) - (b.price || 9999));
  } else if (sortOrder === 'date-desc') {
    filtered.sort((a, b) => (b.unlockDate || 0) - (a.unlockDate || 0));
  } else {
    filtered.sort((a, b) => a.skinId.localeCompare(b.skinId));
  }

  return filtered;
}

/**
 * Resolves compact semantic acquisition metadata for skins without a normal ticket price.
 * Full description is preserved for the accessible title/tooltip attribute.
 */
function resolveAcquisitionLabel(skin) {
  if (skin.price) {
    return {
      type: 'price',
      shortLabel: String(skin.price),
      fullTitle: `Giá: ${skin.price} ${skin.currency || 'Vé Trang Phục'}`,
      typeClass: 'gallery-card-paid'
    };
  }

  // Rule 6: High Skin eligibility MUST check isHighSkin, short label is "Cao Cấp"
  if (skin.isHighSkin || skin.is_high_skin === true) {
    return {
      type: 'highskin',
      shortLabel: 'Cao Cấp',
      fullTitle: skin.obtainVi || 'Trang phục cao cấp (Bán giới hạn qua gói quà)',
      typeClass: 'gallery-card-highskin'
    };
  }

  const rawVi = (skin.obtainVi || '').trim();
  const rawCn = (skin.obtainCn || '').trim();
  const combined = `${rawVi} ${rawCn}`.toLowerCase();

  // Lore / Story unlock (e.g. S0174003 / W0036003 special skin)
  if (/chương|cốt truyện|通关|第七章/.test(combined)) {
    return {
      type: 'story',
      shortLabel: 'Cốt Truyện',
      fullTitle: rawVi || 'Mở khóa sau khi hoàn thành cốt truyện',
      typeClass: 'gallery-card-story'
    };
  }

  // Training / Tập Huấn rewards (e.g. S0155003)
  if (/tập huấn|集训/.test(combined)) {
    return {
      type: 'training',
      shortLabel: 'Tập Huấn',
      fullTitle: rawVi || 'Nhận được thông qua Chợ Tập Huấn',
      typeClass: 'gallery-card-training'
    };
  }

  // Travel / Du Lịch
  if (/du lịch|游历/.test(combined)) {
    return {
      type: 'travel',
      shortLabel: 'Du Lịch',
      fullTitle: rawVi || 'Nhận được thông qua Du Lịch',
      typeClass: 'gallery-card-travel'
    };
  }

  // Shop / Tiệm y phục / Trân Tập Dịch Thị
  if (/cửa hàng|衣装店|珍集易市/.test(combined)) {
    return {
      type: 'shop',
      shortLabel: 'Cửa Hàng',
      fullTitle: rawVi || (rawCn.includes('珍集易市') ? 'Nhận được qua Trân Tập Dịch Thị' : 'Bán giới hạn tại Cửa Hàng Trang Phục'),
      typeClass: 'gallery-card-shop'
    };
  }

  // Event / Hoạt động / Hẹn trước
  if (/hoạt động|活动|花朝昔时|协韵行歌|预约|hẹn trước/.test(combined)) {
    let full = rawVi;
    if (!full) {
      if (rawCn.includes('预约')) full = 'Nhận được qua phần thưởng hẹn trước';
      else if (rawCn.includes('花朝昔时')) full = 'Nhận được qua hoạt động Hoa Triêu Tích Thời';
      else if (rawCn.includes('协韵行歌')) full = 'Nhận được qua hoạt động Hiệp Vận Hành Ca';
      else full = 'Nhận được thông qua hoạt động';
    }
    return {
      type: 'event',
      shortLabel: 'Sự Kiện',
      fullTitle: full,
      typeClass: 'gallery-card-event'
    };
  }

  // Gift bundle / Gói quà
  if (/gói quà|礼包/.test(combined)) {
    return {
      type: 'bundle',
      shortLabel: 'Gói Quà',
      fullTitle: rawVi || 'Bán qua gói quà',
      typeClass: 'gallery-card-gift'
    };
  }

  // Free / Easter egg gift
  if (/彩蛋|trứng phục sinh|赠送|tặng/.test(combined)) {
    return {
      type: 'free',
      shortLabel: 'Miễn Phí',
      fullTitle: rawVi || 'Quà tặng trứng phục sinh (彩蛋赠送)',
      typeClass: 'gallery-card-gift'
    };
  }

  // Neutral truthful fallback
  return {
    type: 'neutral',
    shortLabel: rawVi ? (rawVi.length > 12 ? rawVi.slice(0, 10) + '...' : rawVi) : 'Đặc Biệt',
    fullTitle: rawVi || rawCn || 'Cách thức sở hữu đặc biệt',
    typeClass: 'gallery-card-obtain'
  };
}

function renderGridCards(skins) {
  const gridEl = document.getElementById('gallery-cards-grid');
  const countEl = document.getElementById('gallery-results-count');
  if (!gridEl) return;

  const filtered = getFilteredSkins(skins);

  if (countEl) {
    countEl.textContent = `Hiển thị ${filtered.length} / ${skins.length} trang phục`;
  }

  if (filtered.length === 0) {
    gridEl.innerHTML = `
      <div class="gallery-grid-empty">
        <p>Không tìm thấy trang phục nào phù hợp với bộ lọc.</p>
      </div>
    `;
    return;
  }

  gridEl.innerHTML = filtered.map(skin => {
    const isHighSkin = skin.isHighSkin === true;
    const seriesTitle = skin.seriesNameVi || skin.seriesNameCn || '';

    // Price / Acquisition indicator for the lower subinfo row
    let priceHtml = '';
    if (skin.price) {
      priceHtml = `
        <span class="gallery-card-price tabular-nums" title="Giá: ${skin.price} ${skin.currency || 'Vé Trang Phục'}">
          <img src="/assets/items/itemicon_8.png" alt="Vé" class="gallery-card-price-icon" />
          <span class="gallery-price-val">${skin.price}</span>
        </span>
      `;
    } else {
      const acq = resolveAcquisitionLabel(skin);
      priceHtml = `<span class="gallery-card-price ${acq.typeClass}" title="${acq.fullTitle}">${acq.shortLabel}</span>`;
    }

    return `
      <a href="#/skins/${skin.skinId}" class="gallery-skin-card" data-skin-id="${skin.skinId}" aria-label="${skin.nameVi} - ${skin.charNameVi}">
        <div class="gallery-card-image-wrap">
          <img 
            class="gallery-card-img" 
            src="${skin.cardUrl}" 
            alt="${skin.nameVi}" 
            loading="lazy"
            onerror="this.src='${skin.drawingUrl}'"
          />
          ${skin.seriesBadge ? `
            <div class="gallery-card-series-badge ${isHighSkin ? 'is-highskin' : ''}" title="${isHighSkin ? 'Trang phục cao cấp - ' : ''}Dòng y phục: ${seriesTitle}">
              <img 
                src="${skin.seriesBadge}" 
                alt="${seriesTitle}" 
                class="card-series-badge-img" 
                loading="lazy"
              />
            </div>
          ` : ''}
        </div>
        <div class="gallery-card-content">
          <!-- Skin Name: Primary -->
          <div class="gallery-skin-name" title="${skin.nameVi}">${skin.nameVi}</div>
          <!-- Character Name: Secondary -->
          <div class="gallery-char-name" title="${skin.charNameVi}">${skin.charNameVi}</div>
          <div class="gallery-card-subinfo">
            <span class="gallery-card-cn" title="${skin.nameCn}">${skin.nameCn}</span>
            ${priceHtml}
          </div>
        </div>
      </a>
    `;
  }).join('');
}

function setupEventListeners(container, skins) {
  // Search
  const searchInput = container.querySelector('#gallery-search-input');
  let debounceTimer = null;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchQuery = e.target.value.trim();
        renderGridCards(skins);
      }, 150);
    });
  }

  // Character dropdown
  const charSelect = container.querySelector('#gallery-char-select');
  if (charSelect) {
    charSelect.addEventListener('change', (e) => {
      selectedCharacterId = e.target.value;
      renderGridCards(skins);
    });
  }

  // Sort dropdown
  const sortSelect = container.querySelector('#gallery-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      sortOrder = e.target.value;
      renderGridCards(skins);
    });
  }

  // Source category chips
  const sourceChips = container.querySelectorAll('.gallery-chip-btn');
  sourceChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const src = chip.dataset.source;
      if (!src) return;
      selectedSource = src;
      sourceChips.forEach(c => c.classList.toggle('active', c.dataset.source === src));
      renderGridCards(skins);
    });
  });

  // Series chips
  const seriesChips = container.querySelectorAll('.gallery-series-chip');
  seriesChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const sid = chip.dataset.series;
      if (!sid) return;
      selectedSeries = sid;
      seriesChips.forEach(c => c.classList.toggle('active', c.dataset.series === sid));
      renderGridCards(skins);
    });
  });
}
