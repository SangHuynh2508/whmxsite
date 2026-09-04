/**
 * Gallery Sub-View Component (/characters/:slug/gallery)
 * Showcase full character drawing (.webp) on canvas
 */
export function renderGalleryTab(container, char) {
  const skins = char.skins || [];

  // Build display items strictly from character drawing assets (characterSkins.skinID -> /assets/drawings/<skinID>.webp)
  let displayItems = [];

  if (skins.length > 0) {
    displayItems = skins.map((s, idx) => {
      const skinId = s.skinID || `${char.id}00${idx + 1}`;
      const imagePath = s.image ? `/${s.image.replace(/^\/+/, '')}` : `/assets/drawings/${skinId}.webp`;

      return {
        id: idx,
        skinID: skinId,
        label: s.name_vi || s.name_cn || (s.is_base ? 'Trang Phục Mặc Định' : `Trang Phục ${idx + 1}`),
        nameCn: s.name_cn || '',
        src: imagePath,
        desc: s.description_cn || ''
      };
    });
  } else {
    // Fallback using base character drawing skinID (e.g. W0182001.webp), NEVER avatar or card crop
    displayItems = [{
      id: 0,
      skinID: `${char.id}001`,
      label: 'Ảnh Gốc',
      nameCn: '',
      src: `/assets/drawings/${char.id}001.webp`,
      desc: ''
    }];
  }

  let activeIndex = 0;

  function renderGallery() {
    const currentSkin = displayItems[activeIndex] || displayItems[0];

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
        <div class="gallery-canvas-stage">
          <img src="${currentSkin.src}" 
               alt="${char.name_vi || char.name_cn} - ${currentSkin.label}" 
               class="gallery-canvas-drawing" />
        </div>

        <!-- Minimal Sub-Caption Below Drawing -->
        <div class="gallery-skin-caption">
          <span class="caption-char-name">${char.name_vi || char.name_cn}</span>
          <span class="caption-separator">•</span>
          <span class="caption-skin-name">${currentSkin.label}</span>
          ${currentSkin.nameCn ? `<span class="caption-skin-cn cn-font">(${currentSkin.nameCn})</span>` : ''}
        </div>
      </div>
    `;

    // Event listeners
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


