/**
 * WHMX Skin Gallery & Library Component (/gallery or /skins)
 * Uses Variant 2 Museum / Curatorial Collage as the authoritative hero.
 * Browses ACTUAL SKINS ONLY (145 custom skins), removing base/breakthrough appearances.
 */
import { gsap } from 'gsap';
import { getGameData } from '../data/loader.js';
import { resolveAssetUrl, getSkinAssetUrls } from '../features/assets/assetPaths.js';
import { createLoreReveal } from './loreReveal.js';
import { stopSmoothScroll, startSmoothScroll } from '../app/runtime/smoothScroll.js';
import './skinGalleryView.css';

/**
 * Formats curatorial lore quote for high skin hero spotlight
 */
function formatHeroLore(skin) {
  if (skin.storyVi && skin.storyVi !== skin.obtainVi) return skin.storyVi;
  if (skin.storyCn) return skin.storyCn;
  return 'Chế tác mô phỏng dáng hình kiệt tác. Nét vẽ thanh thoát, thần thái tôn nghiêm, toát lên phong vận hội họa cổ truyền đỉnh cao.';
}

// Canonical order for actual-skin series IDs (202 to 220)
const CANONICAL_SERIES_IDS = [
  202, 203, 204, 205, 206, 207, 208, 209, 210,
  211, 212, 213, 214, 215, 216, 217, 218, 219, 220
];

// Acquisition taxonomy definition (Batch 2.5 proven taxonomy)
const ACQUISITION_TAXONOMY = [
  { id: 'all', label: 'Tất Cả Nguồn' },
  { id: 'paid', label: 'Vé Trang Phục' },
  { id: 'highskin', label: 'Cao Cấp' },
  { id: 'travel', label: 'Du Lịch' },
  { id: 'event', label: 'Sự Kiện' },
  { id: 'shop', label: 'Cửa Hàng' },
  { id: 'training', label: 'Tập Huấn' },
  { id: 'story', label: 'Cốt Truyện' },
  { id: 'free', label: 'Miễn Phí' }
];

const SORT_OPTIONS = [
  { value: 'default', label: 'Mặc định' },
  { value: 'name-asc', label: 'Tên trang phục (A-Z)' },
  { value: 'char-asc', label: 'Tên Khí Giả (A-Z)' },
  { value: 'price-asc', label: 'Giá vé (Thấp đến Cao)' },
  { value: 'date-desc', label: 'Mới ra mắt gần đây' }
];

// State
let searchQuery = '';
let selectedAcquisition = 'all'; // 'all' | 'paid' | 'highskin' | 'travel' | 'event' | 'shop' | 'training' | 'story' | 'free'
let selectedSeries = 'all'; // 'all' | '202' .. '220'
let selectedCharacterId = 'all';
let sortOrder = 'default'; // 'default' | 'name-asc' | 'char-asc' | 'price-asc' | 'date-desc'

// Collapsible UI state (in-memory, default collapsed)
let isAcqOpen = false;
let isSeriesOpen = false;

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
 * Resolves compact semantic acquisition metadata for skins.
 * Authoritative Batch 2.5 taxonomy resolver.
 */
function resolveAcquisitionLabel(skin) {
  if (skin.price) {
    return {
      type: 'paid',
      shortLabel: String(skin.price),
      fullTitle: `Giá: ${skin.price} ${skin.currency || 'Vé Trang Phục'}`,
      typeClass: 'gallery-card-paid'
    };
  }

  // High Skin eligibility MUST check is_high_skin, short label is "Cao Cấp"
  if (skin.isHighSkin || skin.is_high_skin === true) {
    return {
      type: 'highskin',
      shortLabel: 'Cao Cấp',
      fullTitle: skin.obtainVi || skin.obtain_vi || 'Trang phục cao cấp (Bán giới hạn qua gói quà)',
      typeClass: 'gallery-card-highskin'
    };
  }

  const rawVi = (skin.obtainVi || skin.obtain_vi || '').trim();
  const rawCn = (skin.obtainCn || skin.obtain_cn || '').trim();
  const combined = `${rawVi} ${rawCn}`.toLowerCase();

  // Lore / Story unlock
  if (/chương|cốt truyện|通关|第七章/.test(combined)) {
    return {
      type: 'story',
      shortLabel: 'Cốt Truyện',
      fullTitle: rawVi || 'Mở khóa sau khi hoàn thành cốt truyện',
      typeClass: 'gallery-card-story'
    };
  }

  // Training / Tập Huấn rewards
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

  // Free / Easter egg gift
  if (/彩蛋|trứng phục sinh|赠送|tặng/.test(combined)) {
    return {
      type: 'free',
      shortLabel: 'Miễn Phí',
      fullTitle: rawVi || 'Quà tặng trứng phục sinh (彩蛋赠送)',
      typeClass: 'gallery-card-gift'
    };
  }

  // Truthful fallback
  return {
    type: 'event',
    shortLabel: rawVi ? (rawVi.length > 12 ? rawVi.slice(0, 10) + '...' : rawVi) : 'Sự Kiện',
    fullTitle: rawVi || rawCn || 'Cách thức sở hữu đặc biệt',
    typeClass: 'gallery-card-event'
  };
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
      const sid = skin.skinID || skin.id || '';
      const suf = sid.slice(-3);
      if (suf === '001' || suf === '002' || skin.is_base === true || skin.skin_type === 1 || skin.skin_type === 2) {
        return;
      }

      const { drawingUrl, cardUrl } = getSkinAssetUrls(skin, char);

      const acqInfo = resolveAcquisitionLabel(skin);

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
        acquisitionType: acqInfo.type,
        acquisitionLabel: acqInfo.shortLabel,
        sourceCategory: acqInfo.type,
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

  // High Skin Spotlight Pool dynamically derived strictly from s.isHighSkin
  const highSkins = skins
    .filter(s => s.isHighSkin)
    .sort((a, b) => (a.skinId || '').localeCompare(b.skinId || ''));

  // Deterministic initial spotlight item (stable across renders)
  const initialSkin = highSkins[0] || skins[0];
  const initialChar = gameData.characters[initialSkin.charId] || {};
  const initialLore = formatHeroLore(initialSkin);

  // Background preload drawings for smooth transitions across spotlight pool
  highSkins.forEach(s => {
    if (s.drawingUrl) {
      const img = new Image();
      img.src = s.drawingUrl;
    }
  });

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

  const currentChar = charsWithSkins.find(c => c.id === selectedCharacterId);
  const currentCharLabel = currentChar ? currentChar.name_vi : 'Tất cả Khí Giả';
  const currentSortOpt = SORT_OPTIONS.find(o => o.value === sortOrder) || SORT_OPTIONS[0];

  const isAcqActive = selectedAcquisition !== 'all';
  const currentAcqOpt = ACQUISITION_TAXONOMY.find(t => t.id === selectedAcquisition);
  const acqSummaryHtml = isAcqActive && currentAcqOpt
    ? `<span class="gallery-filter-active-dot" aria-hidden="true"></span><span class="gallery-filter-active-text"> ${currentAcqOpt.label}</span>`
    : '';

  const isSeriesActive = selectedSeries !== 'all';
  const sMeta = isSeriesActive ? seriesMetaMap[selectedSeries] : null;
  const sName = sMeta ? (sMeta.nameVi || sMeta.nameCn) : selectedSeries;
  const seriesSummaryHtml = isSeriesActive
    ? `<span class="gallery-filter-active-dot" aria-hidden="true"></span><span class="gallery-filter-active-text"> ${sName}</span>`
    : '';

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

      <!-- VARIANT 2: MUSEUM / CURATORIAL COLLAGE HERO (HIGH SKIN SPOTLIGHT) -->
      <section class="gallery-hero-container" id="gallery-hero-stage" aria-label="Triển lãm tiêu điểm trang phục cao cấp">
        <div class="hero-variant-museum">
          <!-- Left Curatorial Plaque -->
          <div class="museum-curatorial-col" id="hero-curatorial-col">
            <div class="museum-exhibit-seal">
              <div class="museum-seal-info">
                <span>HỒ SƠ GIÁM ĐỊNH</span>
                <span class="museum-seal-dot" aria-hidden="true">•</span>
                <span class="museum-seal-badge-text">TIÊU ĐIỂM CAO CẤP</span>
              </div>
              <div class="museum-seal-logo-wrap" title="Dòng y phục: ${initialSkin.seriesNameVi || initialSkin.seriesNameCn || 'Vân Tưởng Tân Thường'}">
                <img id="hero-series-badge" class="museum-seal-logo" src="${initialSkin.seriesBadge || '/assets/series/skinlogo_220.png'}" alt="Logo dòng y phục" />
              </div>
            </div>

            <!-- Content Stage for Left Information Panel -->
            <div class="museum-text-stage" id="hero-text-stage">
              <h2 class="museum-title" id="hero-skin-title">${initialSkin.nameVi}</h2>
              <div class="museum-char-meta" id="hero-char-meta">
                <a href="#/characters/${initialChar.slug || initialChar.id || initialSkin.charId}" class="char-link-gold" id="hero-char-link">${initialChar.name_vi || initialChar.name_cn || initialSkin.charId}</a>
              </div>
              <div class="museum-notes" id="hero-skin-notes"></div>
              <div class="museum-data-table" id="hero-data-table">
                <div class="museum-data-row">
                  <span>Tên nguyên bản</span>
                  <span class="val" id="hero-val-cn">${initialSkin.nameCn || '—'}</span>
                </div>
                <div class="museum-data-row">
                  <span>Cách thức sở hữu</span>
                  <span class="val" id="hero-val-obtain">${initialSkin.obtainVi || 'Bán qua gói quà'}</span>
                </div>
                <div class="museum-data-row">
                  <span>Giá xuất xưởng</span>
                  <span class="val highlight-price" id="hero-val-price">${initialSkin.price ? `${initialSkin.price} ${initialSkin.currency}` : 'Giới hạn'}</span>
                </div>
              </div>
            </div>

            <!-- Plaque Footer: Detail Action + Spotlight Nav -->
            <div class="museum-footer-row">
              <a href="#/skins/${initialSkin.skinId}" class="museum-explore-btn" id="hero-detail-cta" title="Xem chi tiết trang phục ${initialSkin.nameVi}">
                <span>Xem chi tiết trang phục</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </a>

              <div class="museum-spotlight-nav" aria-label="Điều hướng tiêu điểm cao cấp">
                <button type="button" class="museum-nav-btn" id="hero-prev-btn" aria-label="Trang phục tiêu điểm trước">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
                <div class="museum-nav-progress-block">
                  <div class="museum-nav-segments" id="hero-nav-segments" role="progressbar" aria-label="Tiến trình tiêu điểm" aria-valuemin="1" aria-valuemax="${highSkins.length}" aria-valuenow="1">
                    ${highSkins.map((_, i) => `<span class="hero-progress-segment ${i === 0 ? 'is-active' : (Math.abs(i - 0) === 1 ? 'is-nearby' : 'is-distant')}" data-index="${i}" title="Chuyển đến tiêu điểm ${i + 1}"></span>`).join('')}
                  </div>
                  <span class="museum-nav-counter" id="hero-nav-counter" aria-live="off">01 / ${String(highSkins.length).padStart(2, '0')}</span>
                </div>
                <button type="button" class="museum-nav-btn" id="hero-next-btn" aria-label="Trang phục tiêu điểm kế tiếp">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Center-Right Large Framed Masterpiece (Dominant Focus, Click opens Lightbox) -->
          <div class="museum-center-frame" id="hero-artwork-frame" role="button" tabindex="0" title="Nhấn để xem ảnh phóng to (Drawing)" aria-label="Xem ảnh phóng to trang phục tiêu điểm">
            <span class="museum-frame-corner top-left"></span>
            <span class="museum-frame-corner top-right"></span>
            <span class="museum-frame-corner bottom-left"></span>
            <span class="museum-frame-corner bottom-right"></span>
            
            <div class="museum-artwork-stage" id="hero-artwork-stage">
              <img 
                id="hero-art-layer-a"
                class="museum-main-drawing is-active" 
                src="${initialSkin.drawingUrl}" 
                alt="${initialSkin.nameVi}" 
                loading="eager"
                onerror="this.src='${initialSkin.cardUrl}'"
              />
              <img 
                id="hero-art-layer-b"
                class="museum-main-drawing is-standby" 
                src="" 
                alt="" 
                loading="eager"
              />
            </div>

            <div class="museum-center-tag">
              <span class="museum-tag-dot" aria-hidden="true"></span>
              <span>TIÊU ĐIỂM TRIỂN LÃM</span>
            </div>
          </div>
        </div>
      </section>

      <!-- FILTER & SEARCH TOOLBAR (COMPACT GALLERY FILTER SYSTEM + SERIES CABINET) -->
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

          <!-- Controls: Custom Character Dropdown & Sort Dropdown -->
          <div class="gallery-controls-group">
            <!-- Custom Character Dropdown -->
            <div class="whmx-dropdown" id="gallery-char-dropdown">
              <button 
                type="button" 
                class="whmx-dropdown-trigger" 
                id="gallery-char-trigger" 
                role="combobox"
                aria-haspopup="listbox" 
                aria-expanded="false" 
                aria-controls="gallery-char-menu"
                aria-label="Lọc theo Khí Giả"
              >
                <svg class="whmx-dropdown-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span class="whmx-dropdown-label" id="gallery-char-label">${currentCharLabel}</span>
                <svg class="whmx-dropdown-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              <div class="whmx-dropdown-menu" id="gallery-char-menu" role="listbox" aria-label="Lọc theo Khí Giả" tabindex="-1">
                <div 
                  class="whmx-dropdown-item ${selectedCharacterId === 'all' ? 'active' : ''}" 
                  role="option" 
                  aria-selected="${selectedCharacterId === 'all' ? 'true' : 'false'}" 
                  data-value="all" 
                  tabindex="-1"
                >
                  Tất cả Khí Giả
                </div>
                ${charsWithSkins.map(c => `
                  <div 
                    class="whmx-dropdown-item ${selectedCharacterId === c.id ? 'active' : ''}" 
                    role="option" 
                    aria-selected="${selectedCharacterId === c.id ? 'true' : 'false'}" 
                    data-value="${c.id}" 
                    tabindex="-1"
                  >
                    ${c.name_vi}
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Custom Sort Dropdown -->
            <div class="whmx-dropdown" id="gallery-sort-dropdown">
              <button 
                type="button" 
                class="whmx-dropdown-trigger" 
                id="gallery-sort-trigger" 
                role="combobox"
                aria-haspopup="listbox" 
                aria-expanded="false" 
                aria-controls="gallery-sort-menu"
                aria-label="Sắp xếp trang phục"
              >
                <svg class="whmx-dropdown-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="m3 16 4 4 4-4"></path><path d="M7 20V4"></path><path d="m21 8-4-4-4 4"></path><path d="M17 4v16"></path>
                </svg>
                <span class="whmx-dropdown-label" id="gallery-sort-label">${currentSortOpt.label}</span>
                <svg class="whmx-dropdown-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              <div class="whmx-dropdown-menu menu-align-right" id="gallery-sort-menu" role="listbox" aria-label="Sắp xếp trang phục" tabindex="-1">
                ${SORT_OPTIONS.map(opt => `
                  <div 
                    class="whmx-dropdown-item ${sortOrder === opt.value ? 'active' : ''}" 
                    role="option" 
                    aria-selected="${sortOrder === opt.value ? 'true' : 'false'}" 
                    data-value="${opt.value}" 
                    tabindex="-1"
                  >
                    ${opt.label}
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- Collapsible Row 1: Phương Thức Sở Hữu -->
        <div class="gallery-collapsible-section ${isAcqActive ? 'has-active-filter' : ''}" id="gallery-acq-section">
          <button 
            type="button" 
            class="gallery-collapsible-header ${isAcqOpen ? 'is-open' : ''} ${isAcqActive ? 'has-active-filter' : ''}" 
            id="gallery-acq-toggle" 
            aria-expanded="${isAcqOpen ? 'true' : 'false'}" 
            aria-controls="gallery-acq-drawer"
          >
            <div class="gallery-collapsible-title-wrap">
              <svg class="gallery-collapsible-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                <line x1="7" y1="7" x2="7.01" y2="7"></line>
              </svg>
              <span class="gallery-collapsible-title" id="gallery-acq-title-label">Phương thức sở hữu</span>
              <span class="gallery-filter-active-summary" id="gallery-acq-active-summary">
                ${acqSummaryHtml}
              </span>
            </div>
            <svg class="gallery-collapsible-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
          <div class="gallery-collapsible-drawer ${isAcqOpen ? 'is-open' : ''}" id="gallery-acq-drawer" ${isAcqOpen ? '' : 'inert'} aria-hidden="${isAcqOpen ? 'false' : 'true'}">
            <div class="gallery-collapsible-drawer-inner">
              <div class="gallery-collapsible-content" id="gallery-acq-content">
                <div class="gallery-category-chips" id="gallery-category-chips">
                  ${ACQUISITION_TAXONOMY.map(tax => {
    const count = tax.id === 'all' ? skins.length : skins.filter(s => s.acquisitionType === tax.id).length;
    return `
                      <button 
                        type="button" 
                        class="gallery-chip-btn ${selectedAcquisition === tax.id ? 'active' : ''}" 
                        data-acq="${tax.id}"
                      >
                        <span>${tax.label}</span>
                        <span class="gallery-chip-count">(${count})</span>
                      </button>
                    `;
  }).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Collapsible Row 2: Dòng Y Phục (Series Cabinet / Inventory Grid) -->
        <div class="gallery-collapsible-section ${isSeriesActive ? 'has-active-filter' : ''}" id="gallery-series-section">
          <button 
            type="button" 
            class="gallery-collapsible-header ${isSeriesOpen ? 'is-open' : ''} ${isSeriesActive ? 'has-active-filter' : ''}" 
            id="gallery-series-toggle" 
            aria-expanded="${isSeriesOpen ? 'true' : 'false'}" 
            aria-controls="gallery-series-drawer"
          >
            <div class="gallery-collapsible-title-wrap">
              <svg class="gallery-collapsible-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect width="20" height="5" x="2" y="3" rx="1"></rect>
                <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path>
                <path d="M10 12h4"></path>
              </svg>
              <span class="gallery-collapsible-title" id="gallery-series-title-label">Dòng Y Phục</span>
              <span class="gallery-filter-active-summary" id="gallery-series-active-summary">
                ${seriesSummaryHtml}
              </span>
            </div>
            <svg class="gallery-collapsible-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
          <div class="gallery-collapsible-drawer ${isSeriesOpen ? 'is-open' : ''}" id="gallery-series-drawer" ${isSeriesOpen ? '' : 'inert'} aria-hidden="${isSeriesOpen ? 'false' : 'true'}">
            <div class="gallery-collapsible-drawer-inner">
              <div class="gallery-collapsible-content" id="gallery-series-content">
                <div class="series-cabinet-grid" id="series-cabinet-grid" role="group" aria-label="Tủ dòng y phục" data-lenis-prevent>
                  <!-- Tất Cả Slot -->
                  <button 
                    type="button" 
                    class="series-cabinet-slot ${selectedSeries === 'all' ? 'active' : ''}" 
                    data-series="all" 
                    aria-label="Tất Cả Series (${skins.length})"
                  >
                    <div class="cabinet-slot-visual">
                      <svg class="cabinet-all-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                        <polyline points="2 17 12 22 22 17"></polyline>
                        <polyline points="2 12 12 17 22 12"></polyline>
                      </svg>
                    </div>
                    <div class="cabinet-slot-meta">
                      <span class="cabinet-slot-name">Tất Cả</span>
                      <span class="cabinet-slot-count">${skins.length}</span>
                    </div>
                  </button>
                  <!-- 19 Series Slots (202 to 220) -->
                  ${seriesList.map(item => `
                    <button 
                      type="button" 
                      class="series-cabinet-slot ${String(selectedSeries) === String(item.id) ? 'active' : ''}" 
                      data-series="${item.id}" 
                      aria-label="${item.nameVi} (${item.count})"
                    >
                      <div class="cabinet-slot-visual">
                        <img src="${item.badge}" alt="${item.nameVi}" class="cabinet-slot-badge" loading="lazy" />
                      </div>
                      <div class="cabinet-slot-meta">
                        <span class="cabinet-slot-name" title="${item.nameVi}">${item.nameVi}</span>
                        <span class="cabinet-slot-count">${item.count}</span>
                      </div>
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>
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

      <!-- IN-APP IMAGE LIGHTBOX MODAL (IMAGE-ONLY FLOATING VIEW) -->
      <div id="skin-lightbox-modal" class="skin-lightbox-modal hidden" role="dialog" aria-modal="true" aria-label="Xem ảnh phóng to">
        <div class="skin-lightbox-backdrop" id="skin-lightbox-backdrop"></div>
        <button type="button" class="skin-lightbox-close-floating" id="skin-lightbox-close" aria-label="Đóng (Escape)">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div class="skin-lightbox-stage" id="skin-lightbox-stage">
          <img id="skin-lightbox-img" class="skin-lightbox-floating-img" src="" alt="Trang phục phóng to" />
        </div>
      </div>
    </div>
  `;

  // Render cards
  renderGridCards(skins);

  // Event handlers
  setupEventListeners(container, skins, seriesMetaMap, highSkins, gameData);
}

// Backward-compatible alias export
export { renderSkinGalleryView as renderGalleryDemoView };

function getFilteredSkins(skins) {
  const filtered = skins.filter(skin => {
    // Acquisition filter
    if (selectedAcquisition !== 'all') {
      if (skin.acquisitionType !== selectedAcquisition) {
        return false;
      }
    }

    // Series filter (S0174003 has seriesId null/0, included when selectedSeries === 'all')
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

/**
 * Reusable accessible custom dropdown binder
 */
function setupCustomDropdown({ container, dropdownId, triggerId, menuId, labelId, onSelect }) {
  const dropdownEl = container.querySelector(`#${dropdownId}`);
  const triggerEl = container.querySelector(`#${triggerId}`);
  const menuEl = container.querySelector(`#${menuId}`);
  const labelEl = container.querySelector(`#${labelId}`);

  if (!dropdownEl || !triggerEl || !menuEl) return;

  function openMenu() {
    // Close other dropdowns
    document.querySelectorAll('.whmx-dropdown.is-open').forEach(d => {
      if (d !== dropdownEl) {
        d.classList.remove('is-open');
        const trig = d.querySelector('.whmx-dropdown-trigger');
        if (trig) trig.setAttribute('aria-expanded', 'false');
      }
    });

    dropdownEl.classList.add('is-open');
    triggerEl.setAttribute('aria-expanded', 'true');
    const activeItem = menuEl.querySelector('.whmx-dropdown-item.active') || menuEl.querySelector('.whmx-dropdown-item');
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' });
      activeItem.focus();
    }
  }

  function closeMenu(restoreFocus = false) {
    dropdownEl.classList.remove('is-open');
    triggerEl.setAttribute('aria-expanded', 'false');
    if (restoreFocus) {
      triggerEl.focus();
    }
  }

  triggerEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dropdownEl.classList.contains('is-open')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  triggerEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openMenu();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu();
    }
  });

  const items = Array.from(menuEl.querySelectorAll('.whmx-dropdown-item'));
  items.forEach((item, idx) => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = item.dataset.value;
      const text = item.textContent.trim();
      items.forEach(it => {
        const isIt = it === item;
        it.classList.toggle('active', isIt);
        it.setAttribute('aria-selected', isIt ? 'true' : 'false');
      });
      if (labelEl) labelEl.textContent = text;
      closeMenu(true);
      onSelect(val);
    });

    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        item.click();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = items[idx + 1] || items[0];
        if (next) next.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = items[idx - 1] || items[items.length - 1];
        if (prev) prev.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        if (items[0]) items[0].focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        if (items[items.length - 1]) items[items.length - 1].focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu(true);
      } else if (e.key === 'Tab') {
        closeMenu(false);
      }
    });
  });
}

/**
 * Orchestrates the High Skin Hero Spotlight transitions using GSAP.
 * Features:
 * - Atomic data synchronization across plaque text, CTA, and artwork layers
 * - Overlapping artwork crossfade (prevents blank canvas flash per Huashu pitfall #4)
 * - Grouped text fade and subtle stagger reveal (no PowerPoint sequencing)
 * - Pauseable 7-second auto-rotation (pauses on hover, focus, document.hidden)
 * - Restrained Previous / Next controls with counter resetting timer
 * - prefers-reduced-motion: instant content swap, auto-rotation disabled
 * - Safe interruption handling on rapid navigation (timeline.kill)
 */
function setupHeroSpotlight(container, highSkins, gameData) {
  if (!highSkins || highSkins.length === 0) return () => '';

  const total = highSkins.length;
  let currentIdx = 0;
  let activeTimeline = null;
  let activeLayerIsA = true;
  let autoTimer = null;
  let isHovered = false;

  const heroStage = container.querySelector('#gallery-hero-stage');
  const prevBtn = container.querySelector('#hero-prev-btn');
  const nextBtn = container.querySelector('#hero-next-btn');
  const segmentsContainer = container.querySelector('#hero-nav-segments');
  const counterEl = container.querySelector('#hero-nav-counter');
  const layerA = container.querySelector('#hero-art-layer-a');
  const layerB = container.querySelector('#hero-art-layer-b');
  const titleEl = container.querySelector('#hero-skin-title');
  const charMetaEl = container.querySelector('#hero-char-meta');
  const charLinkEl = container.querySelector('#hero-char-link');
  const notesEl = container.querySelector('#hero-skin-notes');
  const dataTableEl = container.querySelector('#hero-data-table');
  const valCnEl = container.querySelector('#hero-val-cn');
  const valObtainEl = container.querySelector('#hero-val-obtain');
  const valPriceEl = container.querySelector('#hero-val-price');
  const ctaBtn = container.querySelector('#hero-detail-cta');
  const seriesBadgeEl = container.querySelector('#hero-series-badge');

  const textGroup = [titleEl, charMetaEl, notesEl, dataTableEl].filter(Boolean);

  // Shared Lore Reveal instance for the hero notes element
  const heroLoreReveal = notesEl ? createLoreReveal(notesEl) : null;

  // Stable Lore Height Reservation across all High Skin spotlight entries
  const allHeroLores = highSkins.map(s => formatHeroLore(s));

  function updateHeroLoreStableHeight() {
    if (!notesEl || allHeroLores.length === 0) return;
    const width = notesEl.getBoundingClientRect().width;
    if (width <= 0) return;

    const probe = document.createElement('div');
    probe.className = 'museum-notes';
    probe.style.cssText = `
      position: absolute !important;
      visibility: hidden !important;
      pointer-events: none !important;
      user-select: none !important;
      top: -9999px !important;
      left: -9999px !important;
      width: ${width}px !important;
      min-height: 0 !important;
      height: auto !important;
      padding: 0 !important;
      margin: 0 !important;
      box-sizing: border-box !important;
    `;
    document.body.appendChild(probe);

    let maxHeight = 0;
    for (const lore of allHeroLores) {
      probe.textContent = lore;
      const h = probe.getBoundingClientRect().height;
      if (h > maxHeight) maxHeight = h;
    }
    document.body.removeChild(probe);

    if (maxHeight > 0) {
      notesEl.style.minHeight = `${Math.ceil(maxHeight)}px`;
    }
  }

  // Initial calculation of stable lore height
  updateHeroLoreStableHeight();

  // Responsive observation (only recalculate when width actually changes)
  let lastNotesWidth = 0;
  if (typeof ResizeObserver !== 'undefined' && notesEl) {
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w && Math.abs(w - lastNotesWidth) > 3) {
          lastNotesWidth = w;
          updateHeroLoreStableHeight();
        }
      }
    });
    ro.observe(notesEl);
  }

  // Deterministic resting initialization for both artwork layers
  const initialSkinObj = highSkins[0];
  if (layerA && initialSkinObj) {
    layerA.src = initialSkinObj.drawingUrl;
    layerA.alt = initialSkinObj.nameVi;
    layerA.onerror = () => {
      if (layerA.src !== initialSkinObj.cardUrl) layerA.src = initialSkinObj.cardUrl;
    };
    layerA.classList.remove('is-standby');
    layerA.classList.add('is-active');
    gsap.set(layerA, { opacity: 1, yPercent: 0, zIndex: 2 });
  }
  if (layerB) {
    layerB.src = '';
    layerB.alt = '';
    layerB.onerror = () => {};
    layerB.classList.remove('is-active');
    layerB.classList.add('is-standby');
    gsap.set(layerB, { opacity: 0, yPercent: 0, zIndex: 1 });
  }

  function isReducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function updateDomData(skin, char, index) {
    if (titleEl) titleEl.textContent = skin.nameVi;
    if (charLinkEl) {
      charLinkEl.textContent = char.name_vi || char.name_cn || skin.charId;
      charLinkEl.href = `#/characters/${char.slug || char.id || skin.charId}`;
    }
    // Lore text is updated via the lore reveal system, not raw textContent
    if (valCnEl) valCnEl.textContent = skin.nameCn || '—';
    if (valObtainEl) valObtainEl.textContent = skin.obtainVi || 'Bán qua gói quà';
    if (valPriceEl) valPriceEl.textContent = skin.price ? `${skin.price} ${skin.currency}` : 'Giới hạn';
    if (ctaBtn) {
      ctaBtn.href = `#/skins/${skin.skinId}`;
      ctaBtn.setAttribute('title', `Xem chi tiết trang phục ${skin.nameVi}`);
    }
    if (seriesBadgeEl) {
      seriesBadgeEl.src = skin.seriesBadge || `/assets/series/skinlogo_${skin.seriesId || 220}.png`;
      seriesBadgeEl.alt = skin.seriesNameVi || skin.seriesNameCn || 'Trang Phục Cao Cấp';
    }
    if (counterEl) {
      counterEl.textContent = `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
    }
    if (segmentsContainer) {
      segmentsContainer.setAttribute('aria-valuenow', String(index + 1));
      const segments = segmentsContainer.querySelectorAll('.hero-progress-segment');
      segments.forEach((seg, i) => {
        const dist = Math.abs(i - index);
        seg.classList.remove('is-active', 'is-nearby', 'is-distant');
        if (dist === 0) {
          seg.classList.add('is-active');
        } else if (dist === 1) {
          seg.classList.add('is-nearby');
        } else {
          seg.classList.add('is-distant');
        }
      });
    }
  }

  function goToIndex(nextIdx, direction) {
    nextIdx = (nextIdx + total) % total;
    if (nextIdx === currentIdx && !activeTimeline) return;

    const dir = direction || 1;

    // Interrupt previous timeline safely
    if (activeTimeline) {
      activeTimeline.kill();
      activeTimeline = null;

      // When interrupted, the incoming layer was transitioning in, so promote it to active
      const prevIncoming = activeLayerIsA ? layerB : layerA;
      const prevCurrent = activeLayerIsA ? layerA : layerB;

      if (prevIncoming) {
        prevIncoming.classList.remove('is-standby');
        prevIncoming.classList.add('is-active');
        gsap.set(prevIncoming, { opacity: 1, yPercent: 0, zIndex: 2 });
      }
      if (prevCurrent) {
        prevCurrent.classList.remove('is-active');
        prevCurrent.classList.add('is-standby');
        gsap.set(prevCurrent, { opacity: 0, yPercent: 0, zIndex: 1 });
      }
      activeLayerIsA = !activeLayerIsA;
      gsap.set(textGroup, { opacity: 1, y: 0 });
    }

    gsap.killTweensOf([layerA, layerB, textGroup]);

    const nextSkin = highSkins[nextIdx];
    const nextChar = (gameData && gameData.characters && gameData.characters[nextSkin.charId]) || {};

    const currentLayer = activeLayerIsA ? layerA : layerB;
    const incomingLayer = activeLayerIsA ? layerB : layerA;

    // Prefers-reduced-motion branch: Instant switch, zero animations
    if (isReducedMotion()) {
      currentIdx = nextIdx;
      updateDomData(nextSkin, nextChar, nextIdx);
      if (heroLoreReveal) heroLoreReveal.start(formatHeroLore(nextSkin));

      if (currentLayer) {
        currentLayer.classList.remove('is-active');
        currentLayer.classList.add('is-standby');
        gsap.set(currentLayer, { opacity: 0, yPercent: 0, zIndex: 1 });
      }
      if (incomingLayer) {
        incomingLayer.src = nextSkin.drawingUrl;
        incomingLayer.alt = nextSkin.nameVi;
        incomingLayer.onerror = () => {
          if (incomingLayer.src !== nextSkin.cardUrl) incomingLayer.src = nextSkin.cardUrl;
        };
        incomingLayer.classList.remove('is-standby');
        incomingLayer.classList.add('is-active');
        gsap.set(incomingLayer, { opacity: 1, yPercent: 0, zIndex: 2 });
      }
      activeLayerIsA = !activeLayerIsA;
      return;
    }

    // Directional Vertical Slide
    const exitY = dir * -10;
    const enterY = dir * 10;

    if (incomingLayer) {
      incomingLayer.src = nextSkin.drawingUrl;
      incomingLayer.alt = nextSkin.nameVi;
      incomingLayer.onerror = () => {
        if (incomingLayer.src !== nextSkin.cardUrl) incomingLayer.src = nextSkin.cardUrl;
      };
      // Explicitly initialize incoming layer: opacity 0, enter offset, on top (zIndex 2)
      gsap.set(incomingLayer, { opacity: 0, yPercent: enterY, zIndex: 2 });
    }
    if (currentLayer) {
      // Outgoing layer starts resting at center (zIndex 1)
      gsap.set(currentLayer, { opacity: 1, yPercent: 0, zIndex: 1 });
    }

    activeTimeline = gsap.timeline({
      onComplete: () => {
        // Explicitly normalize BOTH layers back to stable states
        if (incomingLayer) {
          incomingLayer.classList.remove('is-standby');
          incomingLayer.classList.add('is-active');
          gsap.set(incomingLayer, { opacity: 1, yPercent: 0, zIndex: 2 });
        }
        if (currentLayer) {
          currentLayer.classList.remove('is-active');
          currentLayer.classList.add('is-standby');
          gsap.set(currentLayer, { opacity: 0, yPercent: 0, zIndex: 1 });
        }
        activeLayerIsA = !activeLayerIsA;
        activeTimeline = null;
      }
    });

    // 1. Text fades out swiftly (120ms) — left region stays spatially stable
    activeTimeline.to(textGroup, {
      opacity: 0,
      duration: 0.12,
      ease: 'power1.out',
      onComplete: () => {
        // ATOMIC DOM DATA SWAP exactly while text is hidden
        updateDomData(nextSkin, nextChar, nextIdx);
        currentIdx = nextIdx;
        // Synchronously initialize lore reveal for the new skin while text is hidden
        if (heroLoreReveal) {
          heroLoreReveal.start(formatHeroLore(nextSkin));
        }
      }
    });

    // 2. Outgoing artwork slides out vertically + fades (450ms)
    if (currentLayer) {
      activeTimeline.to(currentLayer, {
        yPercent: exitY,
        opacity: 0,
        duration: 0.45,
        ease: 'power2.out'
      }, '<0.03');
    }

    // 3. Incoming artwork slides in from offset + reveals (450ms)
    if (incomingLayer) {
      activeTimeline.to(incomingLayer, {
        yPercent: 0,
        opacity: 1,
        duration: 0.45,
        ease: 'power2.out'
      }, '<0.03');
    }

    // 4. Text gently staggers back in
    activeTimeline.fromTo(textGroup,
      { opacity: 0, y: 3 },
      {
        opacity: 1,
        y: 0,
        duration: 0.20,
        stagger: 0.03,
        ease: 'power2.out'
      },
      '<0.05'
    );
  }

  function handlePrev() {
    resetTimer();
    goToIndex(currentIdx - 1, -1);
  }

  function handleNext() {
    resetTimer();
    goToIndex(currentIdx + 1, 1);
  }

  if (prevBtn) prevBtn.addEventListener('click', handlePrev);
  if (nextBtn) nextBtn.addEventListener('click', handleNext);

  if (segmentsContainer) {
    segmentsContainer.addEventListener('click', (e) => {
      const seg = e.target.closest('.hero-progress-segment');
      if (!seg) return;
      const targetIdx = parseInt(seg.dataset.index, 10);
      if (!isNaN(targetIdx) && targetIdx !== currentIdx) {
        resetTimer();
        goToIndex(targetIdx, targetIdx > currentIdx ? 1 : -1);
      }
    });
  }

  // Auto-rotation timer (~7 seconds)
  function startTimer() {
    stopTimer();
    if (isReducedMotion()) return;
    autoTimer = setInterval(() => {
      if (!isHovered && !document.hidden) {
        goToIndex(currentIdx + 1, 1);
      }
    }, 7000);
    window.__whmxHeroSpotlightTimer = autoTimer;
  }

  function stopTimer() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
    if (window.__whmxHeroSpotlightTimer) {
      clearInterval(window.__whmxHeroSpotlightTimer);
      window.__whmxHeroSpotlightTimer = null;
    }
  }

  function resetTimer() {
    stopTimer();
    startTimer();
  }

  // Hover & Focus pausing
  if (heroStage) {
    heroStage.addEventListener('mouseenter', () => { isHovered = true; });
    heroStage.addEventListener('mouseleave', () => { isHovered = false; });
    heroStage.addEventListener('focusin', () => { isHovered = true; });
    heroStage.addEventListener('focusout', () => { isHovered = false; });
  }

  // Document visibility listener (pause auto-rotation when tab is hidden)
  const onVisibilityChange = () => {
    if (document.hidden) {
      stopTimer();
    } else {
      startTimer();
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  // Keyboard navigation on controls
  if (heroStage) {
    heroStage.addEventListener('keydown', (e) => {
      if (e.target === prevBtn || e.target === nextBtn || e.target === heroStage) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handlePrev();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleNext();
        }
      }
    });
  }

  // Start auto-rotation
  startTimer();

  // Trigger initial lore reveal for the first spotlight skin
  if (heroLoreReveal && highSkins[0]) {
    heroLoreReveal.start(formatHeroLore(highSkins[0]));
  }

  // Return getter function for current spotlight image URL (for lightbox modal)
  return () => highSkins[currentIdx]?.drawingUrl;
}

/**
 * Connects the in-app lightbox modal to the hero artwork stage
 */
function setupHeroLightbox(container, getCurrentImageUrl) {
  const modal = container.querySelector('#skin-lightbox-modal');
  const backdrop = container.querySelector('#skin-lightbox-backdrop');
  const closeBtn = container.querySelector('#skin-lightbox-close');
  const imgEl = container.querySelector('#skin-lightbox-img');
  const heroFrame = container.querySelector('#hero-artwork-frame');

  if (!modal || !backdrop || !closeBtn || !imgEl || !heroFrame) return;

  let prevBodyOverflow = '';

  function openLightbox(url) {
    if (!url) return;
    imgEl.src = url;
    modal.classList.remove('hidden');
    prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    stopSmoothScroll();
  }

  function closeLightbox() {
    modal.classList.add('hidden');
    imgEl.src = '';
    document.body.style.overflow = prevBodyOverflow;
    document.removeEventListener('keydown', onKeyDown);
    startSmoothScroll();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      closeLightbox();
    }
  }

  closeBtn.addEventListener('click', closeLightbox);
  backdrop.addEventListener('click', closeLightbox);

  heroFrame.addEventListener('click', () => {
    openLightbox(getCurrentImageUrl());
  });

  heroFrame.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openLightbox(getCurrentImageUrl());
    }
  });
}

function setupEventListeners(container, skins, seriesMetaMap, highSkins, gameData) {
  // Hero Spotlight & Lightbox integration
  const getCurrentImageUrl = setupHeroSpotlight(container, highSkins, gameData);
  setupHeroLightbox(container, getCurrentImageUrl);

  // Global outside click listener (registered once)
  if (!window.__whmxGalleryDropdownListenerAttached) {
    window.__whmxGalleryDropdownListenerAttached = true;
    document.addEventListener('click', () => {
      document.querySelectorAll('.whmx-dropdown.is-open').forEach(d => {
        d.classList.remove('is-open');
        const trig = d.querySelector('.whmx-dropdown-trigger');
        if (trig) trig.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Search input
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

  // Custom Character Dropdown
  setupCustomDropdown({
    container,
    dropdownId: 'gallery-char-dropdown',
    triggerId: 'gallery-char-trigger',
    menuId: 'gallery-char-menu',
    labelId: 'gallery-char-label',
    onSelect: (val) => {
      selectedCharacterId = val;
      renderGridCards(skins);
    }
  });

  // Custom Sort Dropdown
  setupCustomDropdown({
    container,
    dropdownId: 'gallery-sort-dropdown',
    triggerId: 'gallery-sort-trigger',
    menuId: 'gallery-sort-menu',
    labelId: 'gallery-sort-label',
    onSelect: (val) => {
      sortOrder = val;
      renderGridCards(skins);
    }
  });

  // Header label updater for Acquisition
  function updateAcqHeaderLabel() {
    const summaryEl = container.querySelector('#gallery-acq-active-summary');
    const toggleEl = container.querySelector('#gallery-acq-toggle');
    const sectionEl = container.querySelector('#gallery-acq-section');
    const isDefault = selectedAcquisition === 'all';

    if (toggleEl) toggleEl.classList.toggle('has-active-filter', !isDefault);
    if (sectionEl) sectionEl.classList.toggle('has-active-filter', !isDefault);

    if (summaryEl) {
      if (isDefault) {
        summaryEl.innerHTML = '';
      } else {
        const item = ACQUISITION_TAXONOMY.find(t => t.id === selectedAcquisition);
        const label = item ? item.label : selectedAcquisition;
        summaryEl.innerHTML = `<span class="gallery-filter-active-dot" aria-hidden="true"></span><span class="gallery-filter-active-text"> ${label}</span>`;
      }
    }
  }

  // Header label updater for Series
  function updateSeriesHeaderLabel() {
    const summaryEl = container.querySelector('#gallery-series-active-summary');
    const toggleEl = container.querySelector('#gallery-series-toggle');
    const sectionEl = container.querySelector('#gallery-series-section');
    const isDefault = selectedSeries === 'all';

    if (toggleEl) toggleEl.classList.toggle('has-active-filter', !isDefault);
    if (sectionEl) sectionEl.classList.toggle('has-active-filter', !isDefault);

    if (summaryEl) {
      if (isDefault) {
        summaryEl.innerHTML = '';
      } else {
        const meta = seriesMetaMap[selectedSeries];
        const sName = meta ? (meta.nameVi || meta.nameCn) : selectedSeries;
        summaryEl.innerHTML = `<span class="gallery-filter-active-dot" aria-hidden="true"></span><span class="gallery-filter-active-text"> ${sName}</span>`;
      }
    }
  }

  // Acquisition Collapsible Toggle
  const acqToggle = container.querySelector('#gallery-acq-toggle');
  const acqDrawer = container.querySelector('#gallery-acq-drawer');
  if (acqToggle && acqDrawer) {
    acqToggle.addEventListener('click', () => {
      isAcqOpen = !isAcqOpen;
      acqToggle.classList.toggle('is-open', isAcqOpen);
      acqToggle.setAttribute('aria-expanded', isAcqOpen ? 'true' : 'false');
      acqDrawer.classList.toggle('is-open', isAcqOpen);
      acqDrawer.setAttribute('aria-hidden', isAcqOpen ? 'false' : 'true');
      if (isAcqOpen) {
        acqDrawer.removeAttribute('inert');
      } else {
        acqDrawer.setAttribute('inert', '');
      }
    });
  }

  // Acquisition Chips
  const acqChips = container.querySelectorAll('.gallery-chip-btn[data-acq]');
  acqChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const acq = chip.dataset.acq;
      if (!acq) return;
      selectedAcquisition = acq;
      acqChips.forEach(c => c.classList.toggle('active', c.dataset.acq === acq));
      updateAcqHeaderLabel();
      renderGridCards(skins);
    });
  });

  // Series Collapsible Toggle
  const seriesToggle = container.querySelector('#gallery-series-toggle');
  const seriesDrawer = container.querySelector('#gallery-series-drawer');
  if (seriesToggle && seriesDrawer) {
    seriesToggle.addEventListener('click', () => {
      isSeriesOpen = !isSeriesOpen;
      seriesToggle.classList.toggle('is-open', isSeriesOpen);
      seriesToggle.setAttribute('aria-expanded', isSeriesOpen ? 'true' : 'false');
      seriesDrawer.classList.toggle('is-open', isSeriesOpen);
      seriesDrawer.setAttribute('aria-hidden', isSeriesOpen ? 'false' : 'true');
      if (isSeriesOpen) {
        seriesDrawer.removeAttribute('inert');
      } else {
        seriesDrawer.setAttribute('inert', '');
      }
    });
  }

  // Series Cabinet Slots
  const cabinetSlots = container.querySelectorAll('.series-cabinet-slot[data-series]');
  cabinetSlots.forEach(slot => {
    slot.addEventListener('click', () => {
      const sid = slot.dataset.series;
      if (!sid) return;
      selectedSeries = sid;
      cabinetSlots.forEach(s => s.classList.toggle('active', s.dataset.series === sid));
      updateSeriesHeaderLabel();
      renderGridCards(skins);
    });
  });
}
