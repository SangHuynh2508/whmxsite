import { loadGameData } from './data/loader.js';
import { state, subscribe, setCharacter } from './data/state.js';
import { calculateResources } from './data/calculator.js';
import { initSidebar, renderCatalog } from './ui/sidebar.js';
import { renderHeader } from './ui/characterHeader.js';
import { initLevelProgress, renderLevelProgress } from './ui/levelProgress.js';
import { renderTalentGraph } from './ui/talentGraph.js';
import { renderResourceSummary } from './ui/resourceSummary.js';
import { initTheme } from './ui/theme.js';

function selectCharFromUrl(gameData) {
  const hash = window.location.hash.replace('#', '').trim();
  const searchParams = new URLSearchParams(window.location.search);
  const charId = hash || searchParams.get('char') || searchParams.get('id');

  if (charId && gameData.characters[charId]) {
    setCharacter(gameData.characters[charId]);
  }
}

async function boot() {
  initTheme();
  const gameData = await loadGameData();
  
  initSidebar('char-catalog', 'search-input');
  initLevelProgress('level-current', 'level-target');

  // Load character from URL if present
  selectCharFromUrl(gameData);

  window.addEventListener('popstate', () => {
    selectCharFromUrl(gameData);
    renderCatalog();
  });

  subscribe(async (currentState) => {
    if (currentState.character) {
      document.getElementById('empty-state').classList.add('hidden');
      document.getElementById('main-content').classList.remove('hidden');
      
      renderHeader();
      renderLevelProgress();
      renderTalentGraph(document.getElementById('talent-graph-container'));
      
      const currentData = await loadGameData();
      const resources = calculateResources(currentData, currentState);
      renderResourceSummary(resources);
    } else {
      document.getElementById('main-content').classList.add('hidden');
      document.getElementById('empty-state').classList.remove('hidden');
    }
  });
}

document.addEventListener('DOMContentLoaded', boot);
