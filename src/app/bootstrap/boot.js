import { loadGameData } from '../../data/loader.js';
import { state, subscribe, setCharacter } from '../../data/state.js';
import { calculateResources } from '../../data/calculator.js';
import { initSidebar, renderCatalog } from '../layout/sidebar.js';
import { renderHeader } from '../../features/characters/components/characterHeader.js';
import { initLevelProgress, renderLevelProgress } from '../../features/calculator/views/levelProgress.js';
import { renderTalentGraph } from '../../ui/talentGraph.js';
import { renderResourceSummary } from '../../ui/resourceSummary.js';
import { resizeSmoothScroll } from '../runtime/smoothScroll.js';
import { initTheme } from '../settings/theme.js';
import { initAppNav } from '../layout/AppNav.tsx';
import { initRouter, handleRoute } from '../router/router.js';
import { initCalcPicker } from '../../ui/calcCharacterPicker.js';
import { initFeedbackButton } from '../layout/feedbackButton.js';
import { initAdminShell } from '../../admin/layout/mount.tsx';
import { initSession } from '../auth/session.js';
import { inject, pageview } from '@vercel/analytics';
import { pageForHash } from '../analytics/pageRoute.mts';

// Hash routing (#/characters/…) is invisible to analytics' pushState tracking, so every hash change is sent
// as a page view: Vercel Web Analytics always, Google Analytics 4 when VITE_GA_MEASUREMENT_ID is set.
function initAnalytics() {
  inject({ disableAutoTrack: true });
  const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (gaId) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', gaId, { send_page_view: false });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    document.head.append(script);
  }
  let last = null;
  const send = () => {
    const { path, route } = pageForHash(window.location.hash);
    if (path === last) return; // the router may rewrite the hash (e.g. '' → '#/characters')
    last = path;
    pageview({ route, path });
    window.gtag?.('event', 'page_view', { page_path: path, page_location: `${window.location.origin}${path}`, page_title: document.title });
  };
  window.addEventListener('hashchange', send);
  send();
}

export async function boot() {
  initAnalytics();
  initAdminShell();
  initSession();
  initAppNav();
  initTheme();
  initFeedbackButton();
  const gameData = await loadGameData();

  initCalcPicker();
  initSidebar('char-catalog', 'search-input');
  initLevelProgress('level-current', 'level-target');
  initRouter();

  // Handle initial route
  handleRoute();

  subscribe(async (currentState) => {
    // Only update calculator main content if we are in calculator view mode
    const hash = window.location.hash;
    const isCharRoute = hash.includes('/characters/');

    if (!isCharRoute && currentState.character) {
      document.getElementById('empty-state').classList.add('hidden');
      document.getElementById('main-content').classList.remove('hidden');

      renderHeader();
      renderLevelProgress();
      renderTalentGraph(document.getElementById('talent-graph-container'));

      const currentData = await loadGameData();
      const resources = calculateResources(currentData, currentState);
      renderResourceSummary(resources);
      resizeSmoothScroll();
    }
  });
}
