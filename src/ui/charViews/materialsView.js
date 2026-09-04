/**
 * Materials Sub-View Component (/characters/:characterId/materials)
 * Reuses Calculator resource calculation logic & formatVan formatting
 */
import { getGameData } from '../../data/loader.js';
import { calculateResources } from '../../data/calculator.js';
import { formatVan } from '../resourceSummary.js';
import { setCharacter, updateLevels } from '../../data/state.js';

export function renderMaterialsTab(container, char) {
  const gameData = getGameData();
  
  // Preset 1 State: Level 1 -> 120 only (No talents)
  const stateLevelOnly = {
    character: char,
    levelCur: 1,
    levelTgt: 120,
    talentNodes: {}
  };

  // Preset 2 State: Level 1 -> 120 + Max All Talents
  const stateFullMax = {
    character: char,
    levelCur: 1,
    levelTgt: 120,
    talentNodes: {}
  };
  (char.talents || []).forEach(t => {
    stateFullMax.talentNodes[t.id] = 'target';
  });

  let activePreset = 'full'; // 'level' or 'full'

  function getActiveResources() {
    const activeState = activePreset === 'full' ? stateFullMax : stateLevelOnly;
    return calculateResources(gameData, activeState);
  }

  function renderContent() {
    const res = getActiveResources();

    container.innerHTML = `
      <div class="materials-page-wrapper">
        <div class="materials-page-header">
          <div class="m-header-text">
            <h2>BÁO CÁO NGUYÊN LIỆU NÂNG CẤP</h2>
            <p class="m-sub-text">Tổng hợp tài nguyên cần thiết để phát triển nhân vật <strong>${char.name_vi || char.name_cn}</strong></p>
          </div>

          <div class="materials-header-actions">
            <button type="button" class="open-calc-btn" id="open-in-calc-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="16" y1="14" x2="16" y2="18"></line></svg>
              <span>Mở trong Calculator</span>
            </button>
          </div>
        </div>

        <!-- Presets Selector -->
        <div class="materials-preset-bar">
          <span class="preset-label">Mẫu cấu hình sẵn:</span>
          <div class="preset-buttons">
            <button type="button" class="preset-btn ${activePreset === 'full' ? 'active' : ''}" data-preset="full">
              Full Đầu Tư (Lv.1 → 120 + Full Thiên Phú)
            </button>
            <button type="button" class="preset-btn ${activePreset === 'level' ? 'active' : ''}" data-preset="level">
              Chỉ Cấp Độ (Lv.1 → 120)
            </button>
          </div>
        </div>

        <!-- Summary Stats Card -->
        <div class="materials-summary-card">
          <div class="m-stat-box">
            <span class="m-stat-label">ĐÔNG CỐC TỆ</span>
            <span class="m-stat-val coin-val">${formatVan(res.totalCoin || 0)}</span>
          </div>

          <div class="m-stat-divider"></div>

          <div class="m-stat-box">
            <span class="m-stat-label">KINH NGHIỆM (EXP)</span>
            <span class="m-stat-val exp-val">${formatVan(res.totalExp || 0)}</span>
          </div>
        </div>

        <!-- Material Icons Grid -->
        <div class="materials-grid-section">
          <h3>DANH SÁCH VẬT LIỆU CẦN (${(res.mats || []).length} loại)</h3>
          
          <div class="material-grid">
            ${(res.mats || []).map(mat => `
              <div class="mat-card category-${mat.category || 'other'}">
                <div class="mat-icon-box">
                  <img src="${mat.icon || `/assets/items/itemicon_${mat.id}.png`}" 
                       alt="${mat.name_vi || mat.name_cn || mat.id}"
                       onerror="this.onerror=null; this.src='/assets/items/itemicon_3.png';" />
                  <span class="mat-count-badge">${formatVan(mat.count)}</span>
                </div>
                <div class="mat-name-box">
                  <span class="mat-name-vi">${mat.name_vi || mat.name_cn || `Vật phẩm ${mat.id}`}</span>
                  ${mat.name_cn ? `<span class="mat-name-cn cn-font">${mat.name_cn}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // Event listeners
    const openCalcBtn = container.querySelector('#open-in-calc-btn');
    if (openCalcBtn) {
      openCalcBtn.addEventListener('click', () => {
        setCharacter(char);
        if (activePreset === 'full') {
          updateLevels(1, 120);
        }
        window.location.hash = `#${char.id}`;
      });
    }

    const presetBtns = container.querySelectorAll('.preset-btn');
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        activePreset = btn.dataset.preset;
        renderContent();
      });
    });
  }

  renderContent();
}
