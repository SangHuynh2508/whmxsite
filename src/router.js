/**
 * SPA Hash Router for WhmxCalc
 */
import { getGameData } from './data/loader.js';
import { setCharacter, state } from './data/state.js';
import { renderCharacterDetail } from './ui/characterDetail.js';
import { renderCharacterCatalogView } from './ui/characterCatalogView.js';
import { renderDataView } from './ui/dataView.js';
import { renderCatalog } from './ui/sidebar.js';

export function getCharBySlugOrId(slugOrId) {
  const gameData = getGameData();
  if (!gameData || !gameData.characters) return null;
  if (!slugOrId) return null;

  if (gameData.characters[slugOrId]) return gameData.characters[slugOrId];

  const target = slugOrId.toLowerCase();
  return Object.values(gameData.characters).find(c => 
    (c.slug && c.slug.toLowerCase() === target) || (c.id && c.id.toLowerCase() === target)
  ) || null;
}

export function parseHash() {
  const hash = window.location.hash.replace('#', '').trim();
  
  // Default home route: / or empty -> Characters Catalog
  if (!hash || hash === '/' || hash === '') {
    return {
      view: 'catalog',
      slug: '',
      subtab: ''
    };
  }

  // Format: /characters (Standalone Catalog)
  if (hash === '/characters' || hash === 'characters') {
    return {
      view: 'catalog',
      slug: '',
      subtab: ''
    };
  }

  // Format: /characters/:slug or /characters/:slug/skills
  const charRouteMatch = hash.match(/^\/?characters\/([^\/]+)(?:\/([^\/]+))?$/i);
  if (charRouteMatch) {
    return {
      view: 'character',
      slug: charRouteMatch[1],
      subtab: charRouteMatch[2] || 'overview'
    };
  }

  // Format: /data or data
  if (hash === '/data' || hash === 'data') {
    return {
      view: 'data',
      slug: '',
      subtab: ''
    };
  }

  // Format: calc or #calc?char=W0182 or calculator
  if (hash.startsWith('calc') || hash.startsWith('/calc') || hash.startsWith('calculator') || hash.startsWith('/calculator')) {
    const params = new URLSearchParams(hash.replace(/^(\/?calc|\/?calculator)\??/, ''));
    const charId = params.get('char') || params.get('id') || '';
    return {
      view: 'calculator',
      characterId: charId,
      subtab: ''
    };
  }

  // Legacy direct character ID hash e.g. #W0182
  if (hash && !hash.includes('/')) {
    return {
      view: 'calculator',
      characterId: hash,
      subtab: ''
    };
  }

  return {
    view: 'catalog',
    slug: '',
    subtab: ''
  };
}

export function handleRoute() {
  const gameData = getGameData();
  if (!gameData) return;

  const route = parseHash();

  // Redirect / or empty hash to canonical #/characters
  const rawHash = window.location.hash;
  if (!rawHash || rawHash === '#' || rawHash === '#/') {
    history.replaceState(null, '', '#/characters');
  }

  const mainContent = document.getElementById('main-content');
  const sidebar = document.getElementById('sidebar');
  const emptyState = document.getElementById('empty-state');
  const charCatalogView = document.getElementById('character-catalog-view');
  const charDetailView = document.getElementById('character-detail-view');
  const dataView = document.getElementById('data-view');

  // Update Navigation Active Highlights
  updateAppNavHighlights(route.view);

  if (route.view === 'catalog') {
    // Hide Calculator Views, Character Detail, and Data View
    if (mainContent) mainContent.classList.add('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (sidebar) sidebar.classList.add('hidden');
    if (charDetailView) {
      charDetailView.classList.add('hidden');
      charDetailView.innerHTML = '';
    }
    if (dataView) {
      dataView.classList.add('hidden');
      dataView.innerHTML = '';
    }

    // Show Standalone Catalog View
    if (charCatalogView) {
      charCatalogView.classList.remove('hidden');
      renderCharacterCatalogView(charCatalogView);
    }
  } else if (route.view === 'data') {
    // Hide Calculator Views, Catalog, and Character Detail
    if (mainContent) mainContent.classList.add('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (sidebar) sidebar.classList.add('hidden');
    if (charCatalogView) {
      charCatalogView.classList.add('hidden');
      charCatalogView.innerHTML = '';
    }
    if (charDetailView) {
      charDetailView.classList.add('hidden');
      charDetailView.innerHTML = '';
    }

    // Show Standalone Data View
    if (dataView) {
      dataView.classList.remove('hidden');
      renderDataView(dataView);
    }
  } else if (route.view === 'character') {
    // Hide Calculator Views, Standalone Catalog, and Data View
    if (mainContent) mainContent.classList.add('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (sidebar) sidebar.classList.add('hidden');
    if (charCatalogView) {
      charCatalogView.classList.add('hidden');
      charCatalogView.innerHTML = '';
    }
    if (dataView) {
      dataView.classList.add('hidden');
      dataView.innerHTML = '';
    }

    // Show Character Detail View
    if (charDetailView) {
      charDetailView.classList.remove('hidden');
      renderCharacterDetail(route.slug, route.subtab);
    }
  } else {
    // Calculator View
    if (charCatalogView) {
      charCatalogView.classList.add('hidden');
      charCatalogView.innerHTML = '';
    }
    if (charDetailView) {
      charDetailView.classList.add('hidden');
      charDetailView.innerHTML = '';
    }
    if (dataView) {
      dataView.classList.add('hidden');
      dataView.innerHTML = '';
    }
    if (sidebar) sidebar.classList.remove('hidden');

    let targetCharId = route.characterId;
    if (!targetCharId && state.character) {
      targetCharId = state.character.id;
    }

    if (targetCharId && gameData.characters[targetCharId]) {
      if (!state.character || state.character.id !== targetCharId) {
        setCharacter(gameData.characters[targetCharId]);
      }
      if (mainContent) mainContent.classList.remove('hidden');
      if (emptyState) emptyState.classList.add('hidden');
    } else {
      if (mainContent) mainContent.classList.add('hidden');
      if (emptyState) emptyState.classList.remove('hidden');
    }

    // Sync left sidebar catalog active state ONLY for Calculator
    renderCatalog();
  }
}

function updateAppNavHighlights(activeView) {
  // Update desktop vertical nav rail links
  document.querySelectorAll('.app-nav-item').forEach(item => {
    const tooltip = item.dataset.tooltip;
    if (tooltip === 'Calculator') {
      item.classList.toggle('active', activeView === 'calculator');
    } else if (tooltip === 'Characters') {
      item.classList.toggle('active', activeView === 'catalog' || activeView === 'character');
    } else if (tooltip === 'Data') {
      item.classList.toggle('active', activeView === 'data');
    }
  });

  // Update mobile top nav links
  document.querySelectorAll('.top-nav .nav-links a').forEach(link => {
    const text = link.textContent.trim();
    if (text === 'Calculator') {
      link.classList.toggle('active', activeView === 'calculator');
    } else if (text === 'Characters') {
      link.classList.toggle('active', activeView === 'catalog' || activeView === 'character');
    } else if (text === 'Data') {
      link.classList.toggle('active', activeView === 'data');
    }
  });
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  window.addEventListener('popstate', handleRoute);

  // Wire up App Nav item clicks
  document.querySelectorAll('.app-nav-item, .top-nav .nav-links a').forEach(el => {
    const text = el.dataset.tooltip || el.textContent.trim();
    if (text === 'Characters') {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = '#/characters';
      });
    } else if (text === 'Data') {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = '#/data';
      });
    } else if (text === 'Calculator') {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const curCharId = state.character ? state.character.id : '';
        window.location.hash = curCharId ? `#calc?char=${curCharId}` : '#calc';
      });
    }
  });
}
