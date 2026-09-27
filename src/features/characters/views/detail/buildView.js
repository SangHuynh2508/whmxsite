/**
 * Build Sub-View Component (/characters/:characterId/build)
 * Builds written in Admin, published in game.<hash>.json (src/features/characters/build/).
 */
import { mountBuildTab } from '../../build/BuildTab.tsx';

// Empty state first; mountBuildTab replaces it once the published game document has builds for this character.
export function renderBuildTab(container, char) {
  container.innerHTML = `
    <div class="build-page-wrapper">
      <div class="build-empty-state">
        <div class="build-empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
        </div>
        <h3 class="build-empty-title">Chưa có hướng dẫn build</h3>
        <p class="build-empty-desc">
          Dữ liệu khuyến nghị trang bị, thâm tạo và đội hình cho <strong>${char.name_vi || char.name_cn}</strong> đang chưa được làm.
        </p>
      </div>
    </div>
  `;
  mountBuildTab(container, char);
}
