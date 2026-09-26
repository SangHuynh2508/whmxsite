/**
 * Master Character Detail View Shell & Orchestrator
 */
import { gsap } from 'gsap';
import { getGameData } from '../../../data/loader.js';
import { getCharBySlugOrId } from '../../../app/router/router.js';
import { renderTagChipsHtml } from '../../../ui/utils/tagColors.js';
import { getCharacterAvatarUrl } from '../../../ui/utils/avatar.js';

import { renderOverviewTab } from './detail/overviewView.js';
import { renderInfoTab } from './detail/infoView.js';
import { renderTalentsTab } from './detail/talentsView.js';
import { renderBuildTab } from './detail/buildView.js';
import { renderGalleryTab } from './detail/galleryView.js';
import { mountLoreTab, unmountLoreTab } from '../lore/LoreTab.tsx';

// Internal Tab State & Controller
let currentRenderedCharId = null;
let currentActiveTab = null;
let activeTabTransition = null;

function isReducedMotion() {
  return typeof window !== 'undefined' && 
         window.matchMedia && 
         window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function normalizeTab(activeTab) {
  if (activeTab === 'skills') return 'info';
  return activeTab || 'overview';
}

function renderTabContent(container, char, tabName) {
  unmountLoreTab(); // every tab swap and character change goes through here
  switch (tabName) {
    case 'info':
      renderInfoTab(container, char);
      break;
    case 'talents':
      renderTalentsTab(container, char);
      break;
    case 'build':
      renderBuildTab(container, char);
      break;
    case 'gallery':
      renderGalleryTab(container, char);
      break;
    case 'lore':
      mountLoreTab(container, char);
      break;
    case 'overview':
    default:
      renderOverviewTab(container, char);
      // ponytail: public inline edit (components/characterInlineEdit.js) is off until P5 publishes
      // admin overrides — until then an edit there never shows on the public page. Re-add
      // `void enhanceCharacterOverviewEditing(container, char);` here when P5 lands.
      break;
  }
}

function updateNavTabs(container, tabName) {
  const tabLinks = container.querySelectorAll('.cd-tab-item');
  tabLinks.forEach(link => {
    const href = link.getAttribute('href') || '';
    let isActive = false;
    if (tabName === 'overview') {
      isActive = !href.endsWith('/info') && !href.endsWith('/talents') && !href.endsWith('/build') && !href.endsWith('/gallery');
    } else {
      isActive = href.endsWith('/' + tabName);
    }
    link.classList.toggle('active', isActive);
  });

  const activeTabEl = container.querySelector('.cd-tab-item.active');
  if (activeTabEl && typeof activeTabEl.scrollIntoView === 'function') {
    activeTabEl.scrollIntoView({
      behavior: isReducedMotion() ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center'
    });
  }
}

export function renderCharacterDetail(slugOrId, activeTab = 'overview') {
  const container = document.getElementById('character-detail-view');
  if (!container) return;

  const gameData = getGameData();
  if (!gameData || !gameData.characters) return;

  const char = getCharBySlugOrId(slugOrId);
  if (!char) {
    if (activeTabTransition) {
      activeTabTransition.kill();
      activeTabTransition = null;
    }
    currentRenderedCharId = null;
    currentActiveTab = null;
    container.innerHTML = `
      <div class="char-not-found">
        <h2>Không tìm thấy nhân vật</h2>
        <p>Thẻ nhân vật "${slugOrId}" không tồn tại hoặc đã bị ẩn.</p>
        <a href="#/characters" class="btn-primary">← Về danh sách nhân vật</a>
      </div>
    `;
    return;
  }

  const normTab = normalizeTab(activeTab);
  const shellExists = !!container.querySelector('.character-detail-content');
  const isSameChar = currentRenderedCharId === char.id && shellExists;

  // CASE 1: Internal tab switch on already active character detail view
  if (isSameChar) {
    if (currentActiveTab === normTab && !activeTabTransition) {
      return;
    }

    currentActiveTab = normTab;
    updateNavTabs(container, normTab);

    const tabContentContainer = document.getElementById('cd-tab-content');
    if (!tabContentContainer) return;

    // Safety: kill any pending / active animation
    if (activeTabTransition) {
      activeTabTransition.kill();
      activeTabTransition = null;
    }

    // Reduced motion check: instantaneous swap with no transform, opacity, or height animation
    if (isReducedMotion()) {
      gsap.set(tabContentContainer, { clearProps: 'transform,opacity,height,overflow' });
      tabContentContainer.style.height = '';
      tabContentContainer.style.overflow = '';
      renderTabContent(tabContentContainer, char, normTab);
      return;
    }

    // Measure starting height before fade-out begins
    const startHeight = tabContentContainer.offsetHeight;

    // Outgoing animation: 0.09s (90ms), ease 'power1.out', translateY: 0 -> -4px
    activeTabTransition = gsap.to(tabContentContainer, {
      opacity: 0,
      y: -4,
      duration: 0.09,
      ease: 'power1.out',
      onComplete: () => {
        // Swap content inside hidden container
        renderTabContent(tabContentContainer, char, normTab);

        // Measure next natural content height
        tabContentContainer.style.height = 'auto';
        const targetHeight = tabContentContainer.offsetHeight;

        // Constrain height temporarily to prevent layout jump
        tabContentContainer.style.height = startHeight + 'px';
        tabContentContainer.style.overflow = 'hidden';

        // Set incoming initial state (+4px offset, opacity 0)
        gsap.set(tabContentContainer, { opacity: 0, y: 4 });

        // Coordinated incoming timeline
        const incomingTl = gsap.timeline({
          onComplete: () => {
            // Restore natural flow layout
            gsap.set(tabContentContainer, { clearProps: 'transform,opacity,height,overflow' });
            tabContentContainer.style.height = '';
            tabContentContainer.style.overflow = '';
            activeTabTransition = null;
          }
        });
        activeTabTransition = incomingTl;

        // Height stabilization interpolation (~180ms, power2.out)
        if (Math.abs(targetHeight - startHeight) > 2) {
          incomingTl.to(tabContentContainer, {
            height: targetHeight,
            duration: 0.18,
            ease: 'power2.out'
          }, 0);
        }

        // Incoming content fade & settle (~160ms, power2.out)
        incomingTl.to(tabContentContainer, {
          opacity: 1,
          y: 0,
          duration: 0.16,
          ease: 'power2.out'
        }, 0);
      }
    });

    return;
  }

  // CASE 2: Initial Render or Different Character
  if (activeTabTransition) {
    activeTabTransition.kill();
    activeTabTransition = null;
  }

  currentRenderedCharId = char.id;
  currentActiveTab = normTab;

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

      <!-- Sub-Navigation Tabs: Tổng Quan | Thông Tin | Thiên Phú | Build | Hồ Sơ Lưu Trữ | Thư Viện (gallery stays last) -->
      <nav class="cd-sub-nav" aria-label="Điều hướng chi tiết nhân vật">
        <div class="cd-nav-scroll-wrapper">
          <a href="#/characters/${slug}" class="cd-tab-item ${normTab === 'overview' ? 'active' : ''}">
            <span class="tab-label">Tổng Quan</span>
          </a>

          <a href="#/characters/${slug}/info" class="cd-tab-item ${normTab === 'info' ? 'active' : ''}">
            <span class="tab-label">Thông Tin</span>
          </a>

          <a href="#/characters/${slug}/talents" class="cd-tab-item ${normTab === 'talents' ? 'active' : ''}">
            <span class="tab-label">Thiên Phú</span>
          </a>

          <a href="#/characters/${slug}/build" class="cd-tab-item ${normTab === 'build' ? 'active' : ''}">
            <span class="tab-label">Build</span>
          </a>

          <a href="#/characters/${slug}/lore" class="cd-tab-item ${normTab === 'lore' ? 'active' : ''}">
            <span class="tab-label">Hồ Sơ Lưu Trữ</span>
          </a>

          <a href="#/characters/${slug}/gallery" class="cd-tab-item ${normTab === 'gallery' ? 'active' : ''}">
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
  if (activeTabEl && typeof activeTabEl.scrollIntoView === 'function') {
    activeTabEl.scrollIntoView({
      behavior: isReducedMotion() ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center'
    });
  }

  // Render initial tab content directly (NO double animation with route entry)
  const tabContentContainer = document.getElementById('cd-tab-content');
  if (tabContentContainer) {
    gsap.set(tabContentContainer, { clearProps: 'transform,opacity,height,overflow' });
    tabContentContainer.style.height = '';
    tabContentContainer.style.overflow = '';
    renderTabContent(tabContentContainer, char, normTab);
  }
}
