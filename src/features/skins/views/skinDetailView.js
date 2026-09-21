/**
 * WHMX Skin Detail View Component (/skins/:skinId)
 * Uses Variant 3 Featured Spotlight visual language.
 * Displays real audited metadata, flavor lore, and in-app asset lightbox.
 */
import { getGameData } from '../../../data/loader.js';
import { resolveAssetUrl, getSkinAvatarUrl, getItemIconUrl, getSkinAssetUrls } from '../../assets/assetPaths.js';
import { createLoreReveal } from '../../../ui/loreReveal.js';
import { stopSmoothScroll, startSmoothScroll } from '../../../app/runtime/smoothScroll.js';

export function renderSkinDetailView(container, skinId) {
  const gameData = getGameData();
  if (!gameData || !gameData.characters) {
    container.innerHTML = `<div class="whmx-skin-gallery"><p>Đang tải dữ liệu trang phục...</p></div>`;
    return;
  }

  // Find skin and parent character
  let targetSkin = null;
  let targetChar = null;

  const targetIdUpper = (skinId || '').toUpperCase().trim();

  for (const char of Object.values(gameData.characters)) {
    if (Array.isArray(char.skins)) {
      const found = char.skins.find(s => (s.skinID || '').toUpperCase() === targetIdUpper);
      if (found) {
        targetSkin = found;
        targetChar = char;
        break;
      }
    }
  }

  if (!targetSkin || !targetChar) {
    container.innerHTML = `
      <div class="whmx-skin-gallery">
        <div class="gallery-grid-empty">
          <h2>Không tìm thấy trang phục</h2>
          <p>Mã trang phục "${skinId}" không tồn tại hoặc chưa được phát hành.</p>
          <a href="#/gallery" class="skin-back-btn">← Quay lại Thư Viện Trang Phục</a>
        </div>
      </div>
    `;
    return;
  }

  const skinNameVi = targetSkin.name_vi || targetSkin.name_cn || targetSkin.skinID;
  const skinNameCn = targetSkin.name_cn || '';
  const charNameVi = targetChar.name_vi || targetChar.name_cn || targetChar.id;
  const charId = targetChar.id;
  const charSlug = targetChar.slug || targetChar.id;

  // Assets
  const { drawingUrl, cardUrl, avatarUrl, fallbackAvatarUrl } = getSkinAssetUrls(targetSkin, targetChar);

  // Proven Metadata
  const price = targetSkin.price;
  const currency = targetSkin.currency || 'Vé Trang Phục';
  const ticketIconUrl = getItemIconUrl(8);
  const priceDisplay = price 
    ? `<span class="price-with-icon"><img src="${ticketIconUrl}" alt="${currency}" class="currency-ticket-icon" /> ${price} ${currency}</span>` 
    : (targetSkin.obtain_vi || 'Sự kiện / Miễn phí');
  const obtainDisplay = targetSkin.obtain_vi || targetSkin.obtain_cn || targetSkin.description_cn || 'Chưa có thông tin';
  const isHighSkin = targetSkin.is_high_skin === true;
  const cvName = targetSkin.cv_name || '';

  // Series metadata
  const seriesId = targetSkin.series_id || null;
  const seriesNameVi = targetSkin.series_name_vi || '';
  const seriesNameCn = targetSkin.series_name_cn || '';
  const seriesBadgeUrl = seriesId ? `/assets/series/skinlogo_${seriesId}.png` : '';
  const seriesHeroName = seriesNameVi || seriesNameCn;
  const seriesDossierName = (seriesId === 205)
    ? 'Phi Di (Di sản phi vật thể)'
    : (seriesNameVi || seriesNameCn);

  // Lore / Flavor text: presented as quotation in Hero only
  const loreVi = (targetSkin.story_vi || '').trim();
  const loreCn = (targetSkin.story_cn || targetSkin.description_cn || '').trim();
  const loreText = loreVi || loreCn || '';
  const loreQuoteHtml = loreText ? `<blockquote class="hero-lore-quote" id="skin-detail-lore-quote"></blockquote>` : '';

  // Release Date
  let releaseDateStr = 'Chưa xác định';
  if (targetSkin.unlock_date) {
    const d = new Date(targetSkin.unlock_date * 1000);
    releaseDateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }

  container.innerHTML = `
    <div class="whmx-skin-gallery skin-detail-page">
      <!-- Breadcrumb Bar -->
      <nav class="skin-detail-nav" aria-label="Điều hướng trang phục">
        <a href="#/gallery" class="skin-back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>Thư Viện Trang Phục</span>
        </a>
        <span class="nav-sep">/</span>
        <span class="nav-current">${skinNameVi}</span>
      </nav>

      <!-- VARIANT 3: FEATURED SPOTLIGHT HERO SECTION (ONE UNIFIED CANVAS) -->
      <section class="skin-spotlight-hero" aria-label="Hình ảnh tiêu điểm trang phục">
        <!-- Left: Text directly laid onto the shared dark-gold canvas -->
        <div class="spotlight-unified-info">
          ${seriesId ? `
            <div class="spotlight-badge-row">
              <span class="spotlight-badge-series" title="Dòng y phục: ${seriesHeroName}">
                <img src="${seriesBadgeUrl}" class="badge-series-icon" alt="${seriesHeroName}" />
                <span>${seriesHeroName}</span>
              </span>
            </div>
          ` : ''}
          <h1 class="hero-title-main">${skinNameVi}</h1>
          <div class="hero-char-name">
            <a href="#/characters/${charSlug}" class="char-link-inline">${charNameVi}</a>
          </div>
          ${loreQuoteHtml}
        </div>

        <!-- Right: Large Artwork Stage on the same shared canvas (Click opens Lightbox, Zero hover movement) -->
        <div class="spotlight-artwork-stage" id="spotlight-artwork-stage" title="Nhấn để xem ảnh phóng to">
          <img 
            class="spotlight-stage-img" 
            src="${drawingUrl}" 
            alt="${skinNameVi} - ${charNameVi}" 
            loading="eager"
            onerror="this.src='${cardUrl}'"
          />
        </div>
      </section>

      <!-- TWO-COLUMN AUDITED METADATA & ASSET PREVIEW -->
      <div class="skin-detail-content-grid">
        <!-- Left: Proven MasterData Specifications -->
        <div class="skin-spec-card">
          <div class="spec-card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span>Hồ Sơ Giám Định Trang Phục</span>
          </div>

          <div class="spec-rows-list">
            <div class="spec-row">
              <span class="spec-label">Tên Tiếng Việt:</span>
              <span class="spec-value highlight-gold">${skinNameVi}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Tên gốc tiếng Trung:</span>
              <span class="spec-value">${skinNameCn || '—'}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Khí Giả sở hữu:</span>
              <span class="spec-value">
                <a href="#/characters/${charSlug}" class="spec-char-link">${charNameVi}</a>
              </span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Phương thức sở hữu:</span>
              <span class="spec-value">${obtainDisplay}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Chi phí / Tiền tệ:</span>
              <span class="spec-value highlight-gold">${priceDisplay}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Thời điểm phát hành:</span>
              <span class="spec-value">${releaseDateStr}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Phân loại y phục:</span>
              <span class="spec-value">${isHighSkin ? 'Trang Phục Tương Tác Cao Cấp' : 'Trang Phục Thường'}</span>
            </div>
            ${seriesId ? `
            <div class="spec-row">
              <span class="spec-label">Dòng y phục (Series):</span>
              <span class="spec-value series-spec-value">
                <img src="${seriesBadgeUrl}" alt="${seriesDossierName}" class="spec-series-logo" />
                <span class="series-vi-name">${seriesDossierName}</span>
              </span>
            </div>` : ''}
            ${cvName ? `
            <div class="spec-row">
              <span class="spec-label">Diễn viên lồng tiếng (CV):</span>
              <span class="spec-value">${cvName}</span>
            </div>` : ''}
          </div>
        </div>

        <!-- Right: Visual Asset Variants (Clickable Rows -> In-App Lightbox) -->
        <div class="skin-assets-card">
          <div class="spec-card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span>Bộ Tài Nguyên Hình Ảnh</span>
          </div>

          <div class="asset-cards-layout">
            <!-- Full Drawing Item -->
            <button type="button" class="asset-preview-item" data-asset-url="${drawingUrl}" aria-label="Xem ảnh phóng to Toàn Cảnh">
              <div class="asset-thumb-wrap drawing-wrap">
                <img src="${drawingUrl}" alt="${skinNameVi} Drawing" loading="lazy" onerror="this.onerror=null; this.src='${cardUrl}';" />
              </div>
              <div class="asset-info">
                <span class="asset-title">Toàn Cảnh (Drawing)</span>
                <span class="asset-sub">Đồ họa toàn thân độ phân giải cao • Nhấn để xem toàn màn hình</span>
              </div>
            </button>

            <!-- Card Crop Item -->
            <button type="button" class="asset-preview-item" data-asset-url="${cardUrl}" aria-label="Xem ảnh phóng to Thẻ Bài">
              <div class="asset-thumb-wrap card-wrap">
                <img src="${cardUrl}" alt="${skinNameVi} Card" loading="lazy" onerror="this.onerror=null; this.src='${drawingUrl}';" />
              </div>
              <div class="asset-info">
                <span class="asset-title">Thẻ Bài (Card)</span>
                <span class="asset-sub">Hình dạng thẻ bài trong giao diện tra cứu • Nhấn để xem</span>
              </div>
            </button>

            <!-- Avatar Crop Item -->
            <button type="button" class="asset-preview-item" data-asset-url="${avatarUrl}" aria-label="Xem ảnh phóng to Chân Dung">
              <div class="asset-thumb-wrap avatar-wrap">
                <img src="${avatarUrl}" 
                     alt="${skinNameVi} Avatar" 
                     loading="lazy" 
                     onerror="this.onerror=null; if ('${fallbackAvatarUrl}' && this.src !== '${fallbackAvatarUrl}') { this.src='${fallbackAvatarUrl}'; const p=this.closest('.asset-preview-item'); if(p) p.dataset.assetUrl='${fallbackAvatarUrl}'; } else { this.style.opacity='0'; }" />
              </div>
              <div class="asset-info">
                <span class="asset-title">Chân Dung (Avatar)</span>
                <span class="asset-sub">Ảnh đại diện khí giả khi khoác y phục • Nhấn để xem</span>
              </div>
            </button>
          </div>
        </div>
      </div>

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

  // Attach Lightbox Handlers
  setupLightboxHandlers(container, drawingUrl);

  // Shared Lore Reveal: trigger once on the detail lore blockquote
  const loreQuoteEl = container.querySelector('#skin-detail-lore-quote');
  if (loreQuoteEl && loreText) {
    const detailLoreReveal = createLoreReveal(loreQuoteEl);
    detailLoreReveal.start(`\u201C${loreText}\u201D`);
  }
}

function setupLightboxHandlers(container, defaultDrawingUrl) {
  const modal = container.querySelector('#skin-lightbox-modal');
  const backdrop = container.querySelector('#skin-lightbox-backdrop');
  const closeBtn = container.querySelector('#skin-lightbox-close');
  const imgEl = container.querySelector('#skin-lightbox-img');

  if (!modal || !backdrop || !closeBtn || !imgEl) return;

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

  // Close handlers
  closeBtn.addEventListener('click', closeLightbox);
  backdrop.addEventListener('click', closeLightbox);

  // Asset button clicks (clicking anywhere on row opens lightbox)
  const previewItems = container.querySelectorAll('.asset-preview-item');
  previewItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.assetUrl;
      openLightbox(url);
    });
  });

  // Also clicking hero drawing opens lightbox
  const heroStage = container.querySelector('#spotlight-artwork-stage');
  if (heroStage) {
    heroStage.addEventListener('click', () => {
      openLightbox(defaultDrawingUrl);
    });
  }
}
