/**
 * WHMX Skin Detail View Component (/skins/:skinId)
 * Uses Variant 3 Featured Spotlight visual language.
 * Displays real audited metadata, flavor lore, and in-app asset lightbox.
 */
import { getGameData } from '../../../data/loader.js';
import { resolveAssetUrl, getSkinAvatarUrl, getItemIconUrl, getSkinAssetUrls } from '../../assets/assetPaths.js';
import { createLoreReveal } from '../../../ui/loreReveal.js';
import { stopSmoothScroll, startSmoothScroll } from '../../../app/runtime/smoothScroll.js';
import { getLang, txt } from '../../../i18n/lang.mts';
import { s } from '../../../i18n/strings.mts';

export function renderSkinDetailView(container, skinId) {
  const gameData = getGameData();
  if (!gameData || !gameData.characters) {
    container.innerHTML = `<div class="whmx-skin-gallery"><p>${s('sdLoading')}</p></div>`;
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
          <h2>${s('sdNotFound')}</h2>
          <p>${s('sdNotFoundText').replace('{id}', skinId)}</p>
          <a href="#/gallery" class="skin-back-btn">${s('sdBack')}</a>
        </div>
      </div>
    `;
    return;
  }

  const skinNameVi = txt(targetSkin, 'name') || targetSkin.skinID;
  const charNameVi = txt(targetChar, 'name') || targetChar.id;
  const charId = targetChar.id;
  const charSlug = targetChar.slug || targetChar.id;

  // Assets
  const { drawingUrl, cardUrl, avatarUrl, fallbackAvatarUrl } = getSkinAssetUrls(targetSkin, targetChar);

  // Proven Metadata
  const price = targetSkin.price;
  const currency = targetSkin.currency || s('skTicket');
  const ticketIconUrl = getItemIconUrl(8);
  const priceDisplay = price 
    ? `<span class="price-with-icon"><img src="${ticketIconUrl}" alt="${currency}" class="currency-ticket-icon" /> ${price} ${currency}</span>` 
    : (txt(targetSkin, 'obtain') || s('sdEventFree'));
  const obtainDisplay = txt(targetSkin, 'obtain') || targetSkin.description_cn || s('sdNoInfo');
  const isHighSkin = targetSkin.is_high_skin === true;
  const cvName = targetSkin.cv_name || '';

  // Series metadata
  const seriesId = targetSkin.series_id || null;
  const seriesName = txt(targetSkin, 'series_name');
  const seriesBadgeUrl = seriesId ? `/assets/series/skinlogo_${seriesId}.png` : '';
  const seriesHeroName = seriesName;
  const seriesDossierName = (seriesId === 205 && getLang() === 'vi')
    ? 'Phi Di (Di sản phi vật thể)'
    : seriesName;

  // Lore / Flavor text: presented as quotation in Hero only
  const loreText = (txt(targetSkin, 'story') || targetSkin.description_cn || '').trim();
  const loreQuoteHtml = loreText ? `<blockquote class="hero-lore-quote" id="skin-detail-lore-quote"></blockquote>` : '';

  // Release Date
  let releaseDateStr = s('ovUnknown');
  if (targetSkin.unlock_date) {
    const d = new Date(targetSkin.unlock_date * 1000);
    releaseDateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }

  container.innerHTML = `
    <div class="whmx-skin-gallery skin-detail-page">
      <!-- Breadcrumb Bar -->
      <nav class="skin-detail-nav" aria-label="${s('sdNav')}">
        <a href="#/gallery" class="skin-back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>${s('sdLibrary')}</span>
        </a>
        <span class="nav-sep">/</span>
        <span class="nav-current">${skinNameVi}</span>
      </nav>

      <!-- VARIANT 3: FEATURED SPOTLIGHT HERO SECTION (ONE UNIFIED CANVAS) -->
      <section class="skin-spotlight-hero" aria-label="${s('sdHeroAria')}">
        <!-- Left: Text directly laid onto the shared dark-gold canvas -->
        <div class="spotlight-unified-info">
          ${seriesId ? `
            <div class="spotlight-badge-row">
              <span class="spotlight-badge-series" title="${s('skSeriesOf').replace('{n}', seriesHeroName)}">
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
        <div class="spotlight-artwork-stage" id="spotlight-artwork-stage" title="${s('sdZoomHint')}">
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
            <span>${s('sdDossier')}</span>
          </div>

          <div class="spec-rows-list">
            <div class="spec-row">
              <span class="spec-label">${s('ovName')}</span>
              <span class="spec-value highlight-gold">${skinNameVi}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">${s('sdOwner')}</span>
              <span class="spec-value">
                <a href="#/characters/${charSlug}" class="spec-char-link">${charNameVi}</a>
              </span>
            </div>
            <div class="spec-row">
              <span class="spec-label">${s('skAcqTitle')}:</span>
              <span class="spec-value">${obtainDisplay}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">${s('sdCost')}</span>
              <span class="spec-value highlight-gold">${priceDisplay}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">${s('sdRelease')}</span>
              <span class="spec-value">${releaseDateStr}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">${s('sdClass')}</span>
              <span class="spec-value">${isHighSkin ? s('sdHighType') : s('sdNormalType')}</span>
            </div>
            ${seriesId ? `
            <div class="spec-row">
              <span class="spec-label">${s('sdSeries')}</span>
              <span class="spec-value series-spec-value">
                <img src="${seriesBadgeUrl}" alt="${seriesDossierName}" class="spec-series-logo" />
                <span class="series-vi-name">${seriesDossierName}</span>
              </span>
            </div>` : ''}
            ${cvName ? `
            <div class="spec-row">
              <span class="spec-label">${s('sdCv')}</span>
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
            <span>${s('sdAssets')}</span>
          </div>

          <div class="asset-cards-layout">
            <!-- Full Drawing Item -->
            <button type="button" class="asset-preview-item" data-asset-url="${drawingUrl}" aria-label="${s('sdDrawingAria')}">
              <div class="asset-thumb-wrap drawing-wrap">
                <img src="${drawingUrl}" alt="${skinNameVi} Drawing" loading="lazy" onerror="this.onerror=null; this.src='${cardUrl}';" />
              </div>
              <div class="asset-info">
                <span class="asset-title">${s('sdDrawing')}</span>
                <span class="asset-sub">${s('sdDrawingSub')}</span>
              </div>
            </button>

            <!-- Card Crop Item -->
            <button type="button" class="asset-preview-item" data-asset-url="${cardUrl}" aria-label="${s('sdCardAria')}">
              <div class="asset-thumb-wrap card-wrap">
                <img src="${cardUrl}" alt="${skinNameVi} Card" loading="lazy" onerror="this.onerror=null; this.src='${drawingUrl}';" />
              </div>
              <div class="asset-info">
                <span class="asset-title">${s('sdCard')}</span>
                <span class="asset-sub">${s('sdCardSub')}</span>
              </div>
            </button>

            <!-- Avatar Crop Item -->
            <button type="button" class="asset-preview-item" data-asset-url="${avatarUrl}" aria-label="${s('sdAvatarAria')}">
              <div class="asset-thumb-wrap avatar-wrap">
                <img src="${avatarUrl}" 
                     alt="${skinNameVi} Avatar" 
                     loading="lazy" 
                     onerror="this.onerror=null; if ('${fallbackAvatarUrl}' && this.src !== '${fallbackAvatarUrl}') { this.src='${fallbackAvatarUrl}'; const p=this.closest('.asset-preview-item'); if(p) p.dataset.assetUrl='${fallbackAvatarUrl}'; } else { this.style.opacity='0'; }" />
              </div>
              <div class="asset-info">
                <span class="asset-title">${s('sdAvatar')}</span>
                <span class="asset-sub">${s('sdAvatarSub')}</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- IN-APP IMAGE LIGHTBOX MODAL (IMAGE-ONLY FLOATING VIEW) -->
      <div id="skin-lightbox-modal" class="skin-lightbox-modal hidden" role="dialog" aria-modal="true" aria-label="${s('skZoomAria')}">
        <div class="skin-lightbox-backdrop" id="skin-lightbox-backdrop"></div>
        <button type="button" class="skin-lightbox-close-floating" id="skin-lightbox-close" aria-label="${s('skCloseEsc')}">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div class="skin-lightbox-stage" id="skin-lightbox-stage">
          <img id="skin-lightbox-img" class="skin-lightbox-floating-img" src="" alt="${s('skZoomAlt')}" />
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
