import { loadGameData } from './data/loader.js';
import { state, subscribe, setCharacter } from './data/state.js';
import { calculateResources } from './data/calculator.js';
import { initSidebar, renderCatalog } from './ui/sidebar.js';
import { renderHeader } from './ui/characterHeader.js';
import { initLevelProgress, renderLevelProgress } from './ui/levelProgress.js';
import { renderTalentGraph } from './ui/talentGraph.js';
import { renderResourceSummary } from './ui/resourceSummary.js';
import { initTheme } from './ui/theme.js';
import { initAppNav } from './ui/appNav.js';
import { initRouter, handleRoute } from './router.js';

async function boot() {
  initAppNav();
  initTheme();
  const gameData = await loadGameData();
  
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
    }
  });
}

document.addEventListener('DOMContentLoaded', boot);

