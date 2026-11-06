/**
 * Gallery Sub-View Component (/characters/:slug/gallery)
 * Showcase full character drawing (.webp) on canvas with 3-step interactive zoom & pan
 */
import { resolveAssetUrl } from '../../../assets/assetPaths.js';
import { getLang, txt } from '../../../../i18n/lang.mts';
import { s } from '../../../../i18n/strings.mts';

export function renderGalleryTab(container, char) {
  const skins = char.skins || [];

  // Images are supplied by build data as local paths or absolute storage-neutral URLs.
  let displayItems = [];

  if (skins.length > 0) {
    displayItems = skins.map((sk, idx) => {
      const skinId = sk.skinID || `${char.id}00${idx + 1}`;
      const imagePath = resolveAssetUrl(sk.image);

      let label = getLang() === 'cn' ? sk.name_cn : sk.name_vi;
      if (!label || label === '写照' || label === '肖形' || label === '造形') {
        if (sk.name_cn === '写照' || label === '写照') label = s('glPortrait');
        else if (sk.name_cn === '肖形' || sk.name_cn === '造形' || label === '肖形' || label === '造形') label = s('glModel');
        else label = txt(sk, 'name') || (sk.is_base ? s('glModel') : `${s('glSkin')} ${idx + 1}`);
      }

      return {
        id: idx,
        skinID: skinId,
        label,
        src: imagePath,
        desc: sk.description_cn || ''
      };
    });
  } else {
    // The builder validates drawing mappings, so do not invent a remote path here.
    displayItems = [{ id: 0, skinID: char.id, label: s('glBase'), src: resolveAssetUrl(char.icon), desc: '' }];
  }

  let activeIndex = 0;

  // 3-Step Zoom & Pan State (1.0x -> 1.4x -> 1.8x -> 1.0x)
  const ZOOM_LEVELS = [1.0, 1.4, 1.8];
  let zoomIndex = 0;

  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let pointerDown = false;
  let startX = 0;
  let startY = 0;
  let initialPanX = 0;
  let initialPanY = 0;
  let hasDragged = false;

  let activeKeyHandler = null;

  function resetZoom() {
    zoomIndex = 0;
    panX = 0;
    panY = 0;
    isDragging = false;
    pointerDown = false;
    hasDragged = false;
    applyTransform(true);
  }

  function cycleZoom() {
    const oldScale = ZOOM_LEVELS[zoomIndex];
    zoomIndex = (zoomIndex + 1) % ZOOM_LEVELS.length;
    const newScale = ZOOM_LEVELS[zoomIndex];

    if (zoomIndex === 0) {
      panX = 0;
      panY = 0;
    } else {
      // Preserve current pan position clamped to the new zoom level's limits
      const { maxPanX, maxPanY } = getPanLimits(newScale, oldScale);
      panX = Math.min(maxPanX, Math.max(-maxPanX, panX));
      panY = Math.min(maxPanY, Math.max(-maxPanY, panY));
    }
    applyTransform(true);
  }

  function applyTransform(withTransition = true) {
    const stageEl = container.querySelector('.gallery-canvas-stage');
    const imgEl = container.querySelector('.gallery-canvas-drawing');
    if (!stageEl || !imgEl) return;

    if (withTransition && !isDragging) {
      imgEl.style.transition = 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)';
    } else {
      imgEl.style.transition = 'none';
    }

    const scale = ZOOM_LEVELS[zoomIndex];
    imgEl.style.transform = `translate3d(${panX}px, ${panY}px, 0px) scale(${scale})`;

    const currentSkin = displayItems[activeIndex] || displayItems[0];
    const charName = txt(char, 'name');
    const labelPrefix = `${charName} - ${currentSkin.label}`;

    // Manage zoom level classes & dynamic cursor states
    stageEl.classList.remove('zoom-lvl-0', 'zoom-lvl-1', 'zoom-lvl-2', 'is-zoomed');
    imgEl.classList.remove('zoom-lvl-0', 'zoom-lvl-1', 'zoom-lvl-2', 'is-zoomed');

    stageEl.classList.add(`zoom-lvl-${zoomIndex}`);
    imgEl.classList.add(`zoom-lvl-${zoomIndex}`);

    if (zoomIndex > 0) {
      stageEl.classList.add('is-zoomed');
      imgEl.classList.add('is-zoomed');
    }

    // Accessible labels reflecting the 3-step state without boolean aria-expanded
    stageEl.removeAttribute('aria-expanded');
    if (zoomIndex === 0) {
      stageEl.setAttribute('aria-label', s('glZoom1').replace('{x}', labelPrefix));
    } else if (zoomIndex === 1) {
      stageEl.setAttribute('aria-label', s('glZoom2').replace('{x}', labelPrefix));
    } else {
      stageEl.setAttribute('aria-label', s('glZoom0').replace('{x}', labelPrefix));
    }

    if (isDragging) {
      imgEl.classList.add('is-dragging');
    } else {
      imgEl.classList.remove('is-dragging');
    }
  }

  function getPanLimits(targetScale = ZOOM_LEVELS[zoomIndex], currentAppliedScale = ZOOM_LEVELS[zoomIndex]) {
    const stageEl = container.querySelector('.gallery-canvas-stage');
    const imgEl = container.querySelector('.gallery-canvas-drawing');
    if (!stageEl || !imgEl) return { maxPanX: 0, maxPanY: 0 };

    const stageRect = stageEl.getBoundingClientRect();
    const imgRect = imgEl.getBoundingClientRect();

    if (imgRect.width === 0 || imgRect.height === 0) return { maxPanX: 0, maxPanY: 0 };

    const baseWidth = imgRect.width / currentAppliedScale;
    const baseHeight = imgRect.height / currentAppliedScale;

    const scaledWidth = baseWidth * targetScale;
    const scaledHeight = baseHeight * targetScale;

    const maxPanX = Math.max(0, (scaledWidth - stageRect.width) / 2);
    const maxPanY = Math.max(0, (scaledHeight - stageRect.height) / 2);

    return { maxPanX, maxPanY };
  }

  function setupZoomEvents() {
    const stageEl = container.querySelector('.gallery-canvas-stage');
    if (!stageEl) return;

    if (activeKeyHandler) {
      window.removeEventListener('keydown', activeKeyHandler);
      activeKeyHandler = null;
    }

    activeKeyHandler = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (zoomIndex !== 0) {
          resetZoom();
        }
      }
    };
    window.addEventListener('keydown', activeKeyHandler);

    stageEl.addEventListener('pointerdown', (e) => {
      if (e.button && e.button !== 0) return;
      pointerDown = true;
      hasDragged = false;
      startX = e.clientX;
      startY = e.clientY;
      initialPanX = panX;
      initialPanY = panY;

      if (zoomIndex > 0) {
        try {
          stageEl.setPointerCapture(e.pointerId);
        } catch (_) {}
      }
    });

    stageEl.addEventListener('pointermove', (e) => {
      if (!pointerDown || zoomIndex === 0) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!hasDragged && Math.hypot(dx, dy) > 5) {
        hasDragged = true;
        isDragging = true;
      }

      if (hasDragged) {
        const { maxPanX, maxPanY } = getPanLimits();
        panX = Math.min(maxPanX, Math.max(-maxPanX, initialPanX + dx));
        panY = Math.min(maxPanY, Math.max(-maxPanY, initialPanY + dy));
        applyTransform(false);
      }
    });

    const handlePointerEnd = (e) => {
      if (!pointerDown) return;
      pointerDown = false;

      if (zoomIndex > 0) {
        try {
          if (stageEl.hasPointerCapture(e.pointerId)) {
            stageEl.releasePointerCapture(e.pointerId);
          }
        } catch (_) {}
      }

      if (isDragging) {
        isDragging = false;
        applyTransform(true);
      } else if (!hasDragged) {
        cycleZoom();
      }
    };

    stageEl.addEventListener('pointerup', handlePointerEnd);
    stageEl.addEventListener('pointercancel', handlePointerEnd);

    stageEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        cycleZoom();
      }
    });
  }

  function renderGallery() {
    const currentSkin = displayItems[activeIndex] || displayItems[0];
    const charName = txt(char, 'name');

    container.innerHTML = `
      <div class="gallery-canvas-wrapper">
        <!-- Compact Horizontal Skin Tab Strip -->
        ${displayItems.length > 1 ? `
        <div class="gallery-skin-strip-container">
          <div class="gallery-skin-strip">
            ${displayItems.map((skin, idx) => `
              <button type="button" 
                      class="skin-strip-tab ${idx === activeIndex ? 'active' : ''}" 
                      data-idx="${idx}">
                <span>${skin.label}</span>
              </button>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <!-- Direct Showcase Canvas for Full Character Drawing -->
        <div class="gallery-canvas-stage" 
             tabindex="0" 
             role="button" 
             aria-label="${s('glZoom1').replace('{x}', `${charName} - ${currentSkin.label}`)}">
          <img src="${currentSkin.src}" 
               alt="${charName} - ${currentSkin.label}" 
               class="gallery-canvas-drawing" />
        </div>

        <!-- Minimal Sub-Caption Below Drawing -->
        <div class="gallery-skin-caption">
          <span class="caption-char-name">${charName}</span>
          <span class="caption-separator">•</span>
          <span class="caption-skin-name">${currentSkin.label}</span>
        </div>
      </div>
    `;

    resetZoom();
    setupZoomEvents();

    // Event listeners for skin tabs
    container.querySelectorAll('.skin-strip-tab').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx, 10);
        if (!isNaN(idx) && idx !== activeIndex) {
          activeIndex = idx;
          renderGallery();
        }
      });
    });
  }

  renderGallery();
}
