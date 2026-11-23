/**
 * Master Character Detail View Shell & Orchestrator
 */
import { gsap } from 'gsap';
import { getGameData, isCharacterDetailLoaded, loadCharacterDetail } from '../../../data/loader.js';
import { getCharBySlugOrId } from '../../../app/router/router.js';
import { navigate } from '../../../app/router/location.mts';
import { escapeHtml } from '../../../lib/escapeHtml.mts';
import { charsWithTag, renderTagChipsHtml } from '../../../ui/utils/tagColors.mts';
import { getCharacterAvatarUrl } from '../../../ui/utils/avatar.mts';
import { jobName as jobLabel, RARITY_LABELS } from '../../../ui/utils/gameLabels.mts';
import { getLang, txt } from '../../../i18n/lang.mts';
import { s } from '../../../i18n/strings.mts';

import { renderOverviewTab } from './detail/overviewView.js';
import { renderInfoTab } from './detail/infoView.js';
import { renderTalentsTab } from './detail/talentsView.js';
import { renderBuildTab } from './detail/buildView.js';
import { renderGalleryTab } from './detail/galleryView.js';
import { mountLoreQuote, mountLoreTab, unmountLoreTab } from '../lore/LoreTab.tsx';
import { unmountBuildTab } from '../build/BuildTab.tsx';
import { mountTeaTab, unmountTeaTab } from '../tea/TeaTab.tsx';
import { mountVoiceTab, unmountVoiceTab } from '../voice/VoiceTab.tsx';
import { loadVoiceIndexCached } from '../voice/voiceData.mts';

// A tab switch replaces the history entry, so Back leaves the character page instead of stepping back through
// every tab opened (owner 2026-09-28, like s1n.gg). Modified clicks (new tab/window) keep the browser default.
document.addEventListener('click', (event) => {
  const link = event.target instanceof Element ? event.target.closest('a.cd-tab-item') : null;
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(link.getAttribute('href'), { replace: true });
});

// Internal Tab State & Controller
let currentRenderedCharId = null;
let currentRenderedLang = null;
let currentActiveTab = null;
let latestDetailRequest = ''; // `${slugOrId}|${tab}` of the last renderCharacterDetail call
let activeTabTransition = null;
let tabSwitchToken = 0; // bumps on every tab swap; a late island mount checks it before animating

function isReducedMotion() {
  return typeof window !== 'undefined' && 
         window.matchMedia && 
         window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function normalizeTab(activeTab) {
  if (activeTab === 'skills') return 'info';
  return activeTab || 'overview';
}

// React tabs live in their own roots: emptying the container leaves them (and a playing voice line) running, so
// every tab swap, character change and route away from the page calls this.
export function unmountCharacterTabs() {
  unmountLoreTab();
  unmountBuildTab();
  unmountTeaTab();
  unmountVoiceTab();
}

function renderTabContent(container, char, tabName) {
  tabSwitchToken += 1;
  unmountCharacterTabs();
  switch (tabName) {
    case 'info':
      renderInfoTab(container, char);
      break;
    case 'talents':
      renderTalentsTab(container, char);
      break;
    case 'build':
      return renderBuildTab(container, char); // resolves when the sheet is in the DOM
    case 'gallery':
      renderGalleryTab(container, char);
      break;
    case 'lore':
      mountLoreTab(container, char);
      break;
    case 'tea':
      mountTeaTab(container, char);
      break;
    case 'voice':
      mountVoiceTab(container, char);
      break;
    case 'overview':
    default:
      renderOverviewTab(container, char);
      mountLoreQuote(container.querySelector('.overview-quote-slot'), char);
      // ponytail: public inline edit (components/characterInlineEdit.js) is off until P5 publishes
      // admin overrides — until then an edit there never shows on the public page. Re-add
      // `void enhanceCharacterOverviewEditing(container, char);` here when P5 lands.
      break;
  }
}

// A role tag opens the characters sharing it (owner 2026-11-23); a pick goes to that character's page.
function wireTagChips(container, char, gameData) {
  const pop = container.querySelector('#cd-tag-pop');
  if (!pop?.showPopover) return;
  container.querySelectorAll('.cd-tags-list button.cd-tag-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const list = charsWithTag(Object.values(gameData.characters), chip.dataset.tag);
      pop.innerHTML = `
        <div class="cd-tag-pop-head">${chip.textContent} <span>${list.length}</span></div>
        <div class="cd-tag-pop-list">${list.map((c) => `
          <a href="/characters/${c.slug || c.id}" class="cd-tag-pop-item${c.id === char.id ? ' is-current' : ''}"${c.id === char.id ? ' aria-current="page"' : ''}>
            <img src="${getCharacterAvatarUrl(c)}" alt="" loading="lazy" width="40" height="40" />
            <span>${escapeHtml(txt(c, 'name'))}</span>
          </a>`).join('')}</div>`;
      pop.showPopover();
      const r = chip.getBoundingClientRect();
      const w = pop.offsetWidth;
      pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`;
      pop.style.top = `${r.bottom + 6}px`;
    });
  });
  pop.addEventListener('click', (e) => { if (e.target.closest('a')) pop.hidePopover(); });
}

// Lồng tiếng shows only for characters in public/voice/index.json; the index arrives after the shell is drawn.
function addVoiceTab(container, char, slug) {
  void loadVoiceIndexCached().then((index) => {
    if (!index?.ids.includes(char.id) || currentRenderedCharId !== char.id) return;
    const tea = container.querySelector('.cd-tab-item[href$="/tea"]');
    if (!tea || container.querySelector('.cd-tab-item[href$="/voice"]')) return;
    tea.insertAdjacentHTML('afterend', `<a href="/characters/${slug}/voice" class="cd-tab-item"><span class="tab-label">${s('tabVoice')}</span></a>`);
    updateNavTabs(container, currentActiveTab);
  });
}

function updateNavTabs(container, tabName) {
  const tabLinks = container.querySelectorAll('.cd-tab-item');
  tabLinks.forEach(link => {
    // #/characters/<slug>[/<tab>] — no tab segment means Tổng Quan. (A hard-coded "not info/talents/…" list
    // missed new tabs: Tổng Quan and Hồ Sơ Lưu Trữ were both highlighted.)
    const linkTab = (link.getAttribute('href') || '').split('/')[3] || 'overview';
    link.classList.toggle('active', linkTab === tabName);
    if (linkTab === tabName) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
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
      <div class="char-not-found empty-state">
        <div class="empty-state-content">
          <h1 class="empty-state-title">${s('cdNotFound')}</h1>
          <p class="empty-state-text">${s('cdNotFoundText').replace('{id}', escapeHtml(slugOrId))}</p>
          <a href="/characters" class="cd-breadcrumb-back">${s('cdBackList')}</a>
        </div>
      </div>
    `;
    return;
  }

  // Skills, talents, zhizhi, Hoán Chương and profile live in data/c/<id>.json (docs/DATA_SPLIT.md): load, then render
  // the latest request (a tab switch or another character while loading wins).
  latestDetailRequest = `${slugOrId}|${activeTab}`;
  if (!isCharacterDetailLoaded(char.id)) {
    const request = latestDetailRequest;
    container.setAttribute('aria-busy', 'true');
    loadCharacterDetail(char.id).then(
      () => { if (latestDetailRequest === request) renderCharacterDetail(slugOrId, activeTab); },
      (error) => {
        console.error('Error loading character detail:', error);
        if (latestDetailRequest !== request) return;
        currentRenderedCharId = null;
        currentActiveTab = null;
        container.innerHTML = `<div class="empty-state"><div class="empty-state-content"><h2 class="empty-state-title">${s('ldErr')}</h2><p class="empty-state-text">${s('ldErrText')}</p></div></div>`;
      },
    ).finally(() => { if (latestDetailRequest === request) container.removeAttribute('aria-busy'); });
    return;
  }

  const normTab = normalizeTab(activeTab);
  const shellExists = !!container.querySelector('.character-detail-content');
  const isSameChar = currentRenderedCharId === char.id && currentRenderedLang === getLang() && shellExists;

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
        // Swap content inside hidden container. The Build island fills in after the game document resolves: wait for
        // it (at most 300 ms, then the empty state animates in and the sheet replaces it) so the height measured
        // below is the real one — measuring too early made Build/Lore jump in after the fade (owner 2026-09-28).
        const ready = renderTabContent(tabContentContainer, char, normTab);
        const token = tabSwitchToken;
        Promise.race([ready, new Promise((resolve) => setTimeout(resolve, 300))]).then(() => {
          if (token !== tabSwitchToken) return; // another tab was picked meanwhile

          // Measure next natural content height
          tabContentContainer.style.height = 'auto';
          const targetHeight = tabContentContainer.offsetHeight;

          // Constrain height temporarily to prevent layout jump
          tabContentContainer.style.height = startHeight + 'px';
          tabContentContainer.style.overflow = 'hidden';

          // Set incoming initial state (+4px offset, opacity 0)
          gsap.set(tabContentContainer, { opacity: 0, y: 4 });

          // Start on the next frame: rendering a big island costs a frame, and a timeline created before it jumped
          // ahead by that much (first visible frame already at 40 % opacity).
          requestAnimationFrame(() => {
            if (token !== tabSwitchToken) return;
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
          });
        });
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
  currentRenderedLang = getLang(); // a language switch re-renders the whole shell
  currentActiveTab = normTab;

  const rarityLabel = RARITY_LABELS[char.rare] || `★${char.rare}`;
  const rarityInfo = { label: rarityLabel, class: RARITY_LABELS[char.rare] ? rarityLabel.toLowerCase() : "sr" };
  const jobName = jobLabel(char.job) || s('catJob');
  const slug = char.slug || char.id;
  const tagStr = txt(char, 'tags');

  container.innerHTML = `
    <div class="character-detail-content">
      <!-- Top Breadcrumb Bar -->
      <div class="cd-breadcrumb-bar">
        <a href="/characters" class="cd-breadcrumb-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          <span>${s('cdBreadcrumb')}</span>
        </a>
      </div>

      <!-- Corrected Character Header Layout -->
      <header class="cd-shared-header">
        <!-- LEFT SIDE: Avatar + Name + Limited Badge + CN Name + Individual Semantic Tag Chips -->
        <div class="cd-header-left">
          <div class="cd-avatar-box">
            <img src="${getCharacterAvatarUrl(char)}" 
                 alt="${txt(char, 'name')}" 
                 class="cd-avatar-img" 
                 onerror="this.onerror=null; this.src='/assets/characters/avatars/W0001.png';" />
          </div>

          <div class="cd-identity-box">
            <div class="cd-title-row">
              <h1 class="cd-name-vi">${txt(char, 'name')}</h1>
              ${char.is_limited ? '<span class="cd-limited-badge">LIMITED</span>' : ''}
            </div>

            ${char.name_cn && getLang() !== 'cn' ? `<div class="cd-name-cn cn-font">${char.name_cn}</div>` : ''}

            ${tagStr ? `
            <div class="cd-tags-list">
              ${renderTagChipsHtml(char.tags_vi || tagStr, true)}
            </div>
            <div class="cd-tag-pop" id="cd-tag-pop" popover="auto" role="dialog" data-lenis-prevent></div>
            ` : ''}
          </div>
        </div>

        <!-- RIGHT SIDE: ONLY Large Class Icon + Rarity Badge -->
        <div class="cd-header-right">
          <div class="cd-class-rarity-block">
            <img src="/assets/jobs/job_${char.job}.png" 
                 alt="${jobName}" 
                 class="cd-job-large-icon" 
                 title="${s('cdClass')}: ${jobName}" />
            <div class="cd-rarity-badge-large ${rarityInfo.class}">${rarityInfo.label}</div>
          </div>
        </div>
      </header>

      <!-- Sub-Navigation Tabs: Tổng Quan | Thông Tin | Thiên Phú | Build | Hồ Sơ Lưu Trữ | Phòng Trà | Thư Viện (gallery stays last) -->
      <nav class="cd-sub-nav" aria-label="${s('cdSubNav')}">
        <div class="cd-nav-scroll-wrapper">
          <a href="/characters/${slug}" class="cd-tab-item ${normTab === 'overview' ? 'active' : ''}">
            <span class="tab-label">${s('tabOverview')}</span>
          </a>

          <a href="/characters/${slug}/info" class="cd-tab-item ${normTab === 'info' ? 'active' : ''}">
            <span class="tab-label">${s('tabInfo')}</span>
          </a>

          <a href="/characters/${slug}/talents" class="cd-tab-item ${normTab === 'talents' ? 'active' : ''}">
            <span class="tab-label">${s('tabTalents')}</span>
          </a>

          <a href="/characters/${slug}/build" class="cd-tab-item ${normTab === 'build' ? 'active' : ''}">
            <span class="tab-label">${s('tabBuild')}</span>
          </a>

          <a href="/characters/${slug}/lore" class="cd-tab-item ${normTab === 'lore' ? 'active' : ''}">
            <span class="tab-label">${s('tabLore')}</span>
          </a>

          <a href="/characters/${slug}/tea" class="cd-tab-item ${normTab === 'tea' ? 'active' : ''}">
            <span class="tab-label">${s('tabTea')}</span>
          </a>

          <a href="/characters/${slug}/gallery" class="cd-tab-item ${normTab === 'gallery' ? 'active' : ''}">
            <span class="tab-label">${s('tabGallery')}</span>
          </a>

        </div>
      </nav>

      <!-- Dynamic Sub-Tab Content Body -->
      <div class="cd-content-body" id="cd-tab-content">
        <!-- Populated dynamically -->
      </div>
    </div>
  `;

  updateNavTabs(container, normTab); // marks the active tab (aria-current) and scrolls it into view on phones
  addVoiceTab(container, char, slug);
  wireTagChips(container, char, gameData);

  // Render initial tab content directly (NO double animation with route entry)
  const tabContentContainer = document.getElementById('cd-tab-content');
  if (tabContentContainer) {
    gsap.set(tabContentContainer, { clearProps: 'transform,opacity,height,overflow' });
    tabContentContainer.style.height = '';
    tabContentContainer.style.overflow = '';
    renderTabContent(tabContentContainer, char, normTab);
  }
}
