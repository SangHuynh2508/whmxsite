/**
 * Master Character Detail View Shell & Orchestrator
 */
import { getGameData } from '../data/loader.js';
import { getCharBySlugOrId } from '../router.js';
import { renderTagChipsHtml } from './utils/tagColors.js';
import { getCharacterAvatarUrl } from './utils/avatar.js';

import { renderOverviewTab } from './charViews/overviewView.js';
import { renderInfoTab } from './charViews/infoView.js';
import { renderTalentsTab } from './charViews/talentsView.js';
import { renderBuildTab } from './charViews/buildView.js';
import { renderGalleryTab } from './charViews/galleryView.js';

export function renderCharacterDetail(slugOrId, activeTab = 'overview') {
  const container = document.getElementById('character-detail-view');
  if (!container) return;

  const gameData = getGameData();
  if (!gameData || !gameData.characters) return;

  const char = getCharBySlugOrId(slugOrId);
  if (!char) {
    container.innerHTML = `
      <div class="char-not-found">
        <h2>Không tìm thấy nhân vật</h2>
        <p>Thẻ nhân vật "${slugOrId}" không tồn tại hoặc đã bị ẩn.</p>
        <a href="#/characters" class="btn-primary">← Về danh sách nhân vật</a>
      </div>
    `;
    return;
  }

  const jobNames = { 1: "Túc Vệ", 2: "Khinh Nhuệ", 3: "Viễn Kích", 4: "Cấu Thuật", 5: "Chiến Lược" };
  const rarityMap = { 4: { label: "SSR", class: "ssr" }, 3: { label: "SR", class: "sr" }, 2: { label: "R", class: "r" } };
  const rarityInfo = rarityMap[char.rare] || { label: `★${char.rare}`, class: "sr" };
  const jobName = jobNames[char.job] || "Chức nghiệp";
  const slug = char.slug || char.id;

  const tagStr = char.tags_vi || char.tags_cn || "";

  container.innerHTML = `
    <div class="character-detail-content">
      <!-- Top Breadcrumb Bar -->
      <div class="cd-breadcrumb-bar">
        <a href="#/characters" class="cd-breadcrumb-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          <span>Danh Sách Khí Giả</span>
        </a>
      </div>

      <!-- Corrected Character Header Layout -->
      <header class="cd-shared-header">
        <!-- LEFT SIDE: Avatar + Name + Limited Badge + CN Name + Individual Semantic Tag Chips -->
        <div class="cd-header-left">
          <div class="cd-avatar-box">
            <img src="${getCharacterAvatarUrl(char)}" 
                 alt="${char.name_vi || char.name_cn}" 
                 class="cd-avatar-img" 
                 onerror="this.onerror=null; this.src='/assets/characters/avatars/W0001.png';" />
          </div>

          <div class="cd-identity-box">
            <div class="cd-title-row">
              <h1 class="cd-name-vi">${char.name_vi || char.name_cn}</h1>
              ${char.is_limited ? '<span class="cd-limited-badge">LIMITED</span>' : ''}
            </div>

            ${char.name_cn ? `<div class="cd-name-cn cn-font">${char.name_cn}</div>` : ''}

            ${tagStr ? `
            <div class="cd-tags-list">
              ${renderTagChipsHtml(tagStr)}
            </div>
            ` : ''}
          </div>
        </div>

        <!-- RIGHT SIDE: ONLY Large Class Icon + Rarity Badge -->
        <div class="cd-header-right">
          <div class="cd-class-rarity-block">
            <img src="/assets/jobs/job_${char.job}.png" 
                 alt="${jobName}" 
                 class="cd-job-large-icon" 
                 title="Lớp: ${jobName}" />
            <div class="cd-rarity-badge-large ${rarityInfo.class}">${rarityInfo.label}</div>
          </div>
        </div>
      </header>

      <!-- Sub-Navigation Tabs: Tổng Quan | Thông Tin | Thiên Phú | Build | Thư Viện -->
      <nav class="cd-sub-nav" aria-label="Điều hướng chi tiết nhân vật">
        <div class="cd-nav-scroll-wrapper">
          <a href="#/characters/${slug}" class="cd-tab-item ${activeTab === 'overview' ? 'active' : ''}">
            <span class="tab-label">Tổng Quan</span>
          </a>

          <a href="#/characters/${slug}/info" class="cd-tab-item ${activeTab === 'info' || activeTab === 'skills' ? 'active' : ''}">
            <span class="tab-label">Thông Tin</span>
          </a>

          <a href="#/characters/${slug}/talents" class="cd-tab-item ${activeTab === 'talents' ? 'active' : ''}">
            <span class="tab-label">Thiên Phú</span>
          </a>

          <a href="#/characters/${slug}/build" class="cd-tab-item ${activeTab === 'build' ? 'active' : ''}">
            <span class="tab-label">Build</span>
          </a>

          <a href="#/characters/${slug}/gallery" class="cd-tab-item ${activeTab === 'gallery' ? 'active' : ''}">
            <span class="tab-label">Thư Viện</span>
          </a>
        </div>
      </nav>

      <!-- Dynamic Sub-Tab Content Body -->
      <div class="cd-content-body" id="cd-tab-content">
        <!-- Populated dynamically -->
      </div>
    </div>
  `;

  // Auto-scroll active tab into view on mobile
  const activeTabEl = container.querySelector('.cd-tab-item.active');
  if (activeTabEl) {
    activeTabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  // Render sub tab content
  const tabContentContainer = document.getElementById('cd-tab-content');
  if (!tabContentContainer) return;

  switch (activeTab) {
    case 'info':
    case 'skills':
      renderInfoTab(tabContentContainer, char);
      break;
    case 'talents':
      renderTalentsTab(tabContentContainer, char);
      break;
    case 'build':
      renderBuildTab(tabContentContainer, char);
      break;
    case 'gallery':
      renderGalleryTab(tabContentContainer, char);
      break;
    case 'overview':
    default:
      renderOverviewTab(tabContentContainer, char);
      break;
  }
}

