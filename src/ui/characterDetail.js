/**
 * Master Character Detail View Shell & Orchestrator
 */
import { getGameData } from '../data/loader.js';
import { getCharBySlugOrId } from '../router.js';
import { renderTagChipsHtml } from './utils/tagColors.js';

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
          <img src="/${char.icon}" 
               alt="${char.name_vi || char.name_cn}" 
               class="cd-avatar-img" 
               onerror="this.onerror=null; this.src='/assets/avatars/W0001.png';" />
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
          <span class="tab-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          </span>
          <span class="tab-label">Tổng Quan</span>
        </a>

        <a href="#/characters/${slug}/info" class="cd-tab-item ${activeTab === 'info' || activeTab === 'skills' ? 'active' : ''}">
          <span class="tab-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          </span>
          <span class="tab-label">Thông Tin</span>
        </a>

        <a href="#/characters/${slug}/talents" class="cd-tab-item ${activeTab === 'talents' ? 'active' : ''}">
          <span class="tab-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          </span>
          <span class="tab-label">Thiên Phú</span>
        </a>

        <a href="#/characters/${slug}/build" class="cd-tab-item ${activeTab === 'build' ? 'active' : ''}">
          <span class="tab-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
          </span>
          <span class="tab-label">Build</span>
        </a>

        <a href="#/characters/${slug}/gallery" class="cd-tab-item ${activeTab === 'gallery' ? 'active' : ''}">
          <span class="tab-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          </span>
          <span class="tab-label">Thư Viện</span>
        </a>
      </div>
    </nav>

    <!-- Dynamic Sub-Tab Content Body -->
    <div class="cd-content-body" id="cd-tab-content">
      <!-- Populated dynamically -->
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


