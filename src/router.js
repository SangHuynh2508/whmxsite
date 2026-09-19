/**
 * SPA Hash Router for WhmxCalc
 */
import { getGameData } from './data/loader.js';
import { setCharacter, state } from './data/state.js';
import { renderCharacterDetail } from './ui/characterDetail.js';
import { renderCharacterCatalogView } from './ui/characterCatalogView.js';
import { renderWeaponsView } from './ui/weaponsView.js';
import { renderDataView } from './ui/dataView.js';
import { renderCatalog } from './ui/sidebar.js';
import { selectCalculatorCharacter } from './ui/calcCharacterPicker.js';
import { renderHeader } from './ui/characterHeader.js';
import { renderSkinGalleryView, renderGalleryDemoView } from './ui/skinGalleryView.js';
import { renderSkinDetailView } from './ui/skinDetailView.js';
import { gsap } from 'gsap';

let previousRouteKey = null;
let activeRouteTransition = null;
let activeIncomingEl = null;

function isReducedMotion() {
  return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

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

  // Format: /weapons or weapons
  if (hash === '/weapons' || hash === 'weapons') {
    return {
      view: 'weapons',
      slug: '',
      subtab: ''
    };
  }

  // Backward compatibility: /data redirects to /weapons
  if (hash === '/data' || hash === 'data') {
    window.location.hash = '#/weapons';
    return {
      view: 'weapons',
      slug: '',
      subtab: ''
    };
  }

  // Format: /skins/:skinId
  const skinRouteMatch = hash.match(/^\/?skins\/([^\/]+)$/i);
  if (skinRouteMatch) {
    return {
      view: 'skin-detail',
      skinId: skinRouteMatch[1],
      slug: '',
      subtab: ''
    };
  }

  // Format: /gallery-demo, gallery-demo -> backward-compatible alias redirect to /gallery
  if (hash === '/gallery-demo' || hash === 'gallery-demo') {
    window.location.hash = '#/gallery';
    return {
      view: 'gallery',
      slug: '',
      subtab: ''
    };
  }

  // Format: /gallery, gallery, /skins, skins
  if (hash === '/gallery' || hash === 'gallery' || hash === '/skins' || hash === 'skins') {
    return {
      view: 'gallery',
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

function renderRouteView(route, refs) {
  const {
    mainContent,
    sidebar,
    emptyState,
    charCatalogView,
    charDetailView,
    weaponsView,
    skinGalleryView,
    skinDetailView,
    gameData
  } = refs;

  if (route.view === 'catalog') {
    if (mainContent) mainContent.classList.add('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (sidebar) sidebar.classList.add('hidden');
    if (charDetailView) {
      charDetailView.classList.add('hidden');
      charDetailView.innerHTML = '';
    }
    if (weaponsView) {
      weaponsView.classList.add('hidden');
      weaponsView.innerHTML = '';
    }
    if (skinGalleryView) {
      skinGalleryView.classList.add('hidden');
      skinGalleryView.innerHTML = '';
    }
    if (skinDetailView) {
      skinDetailView.classList.add('hidden');
      skinDetailView.innerHTML = '';
    }

    if (charCatalogView) {
      charCatalogView.classList.remove('hidden');
      renderCharacterCatalogView(charCatalogView);
    }
  } else if (route.view === 'weapons' || route.view === 'data') {
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
    if (skinGalleryView) {
      skinGalleryView.classList.add('hidden');
      skinGalleryView.innerHTML = '';
    }
    if (skinDetailView) {
      skinDetailView.classList.add('hidden');
      skinDetailView.innerHTML = '';
    }

    if (weaponsView) {
      weaponsView.classList.remove('hidden');
      renderWeaponsView(weaponsView);
    }
  } else if (route.view === 'gallery') {
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
    if (weaponsView) {
      weaponsView.classList.add('hidden');
      weaponsView.innerHTML = '';
    }
    if (skinDetailView) {
      skinDetailView.classList.add('hidden');
      skinDetailView.innerHTML = '';
    }

    if (skinGalleryView) {
      skinGalleryView.classList.remove('hidden');
      renderSkinGalleryView(skinGalleryView);
    }
  } else if (route.view === 'skin-detail') {
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
    if (weaponsView) {
      weaponsView.classList.add('hidden');
      weaponsView.innerHTML = '';
    }
    if (skinGalleryView) {
      skinGalleryView.classList.add('hidden');
      skinGalleryView.innerHTML = '';
    }

    if (skinDetailView) {
      skinDetailView.classList.remove('hidden');
      renderSkinDetailView(skinDetailView, route.skinId);
    }
  } else if (route.view === 'character') {
    if (mainContent) mainContent.classList.add('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (sidebar) sidebar.classList.add('hidden');
    if (charCatalogView) {
      charCatalogView.classList.add('hidden');
      charCatalogView.innerHTML = '';
    }
    if (weaponsView) {
      weaponsView.classList.add('hidden');
      weaponsView.innerHTML = '';
    }
    if (skinGalleryView) {
      skinGalleryView.classList.add('hidden');
      skinGalleryView.innerHTML = '';
    }
    if (skinDetailView) {
      skinDetailView.classList.add('hidden');
      skinDetailView.innerHTML = '';
    }

    if (charDetailView) {
      charDetailView.classList.remove('hidden');
      renderCharacterDetail(route.slug, route.subtab);
    }
  } else {
    if (charCatalogView) {
      charCatalogView.classList.add('hidden');
      charCatalogView.innerHTML = '';
    }
    if (charDetailView) {
      charDetailView.classList.add('hidden');
      charDetailView.innerHTML = '';
    }
    if (weaponsView) {
      weaponsView.classList.add('hidden');
      weaponsView.innerHTML = '';
    }
    if (skinGalleryView) {
      skinGalleryView.classList.add('hidden');
      skinGalleryView.innerHTML = '';
    }
    if (skinDetailView) {
      skinDetailView.classList.add('hidden');
      skinDetailView.innerHTML = '';
    }
    if (sidebar) sidebar.classList.add('hidden');

    let targetCharId = route.characterId;
    if (!targetCharId && state.character) {
      targetCharId = state.character.id;
    }

    if (targetCharId && gameData.characters[targetCharId]) {
      selectCalculatorCharacter(targetCharId);
    } else {
      if (mainContent) mainContent.classList.remove('hidden');
      if (emptyState) emptyState.classList.add('hidden');
      renderHeader();
    }
  }
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
  const weaponsView = document.getElementById('weapons-view') || document.getElementById('data-view');
  const skinGalleryView = document.getElementById('skin-gallery-view');
  const skinDetailView = document.getElementById('skin-detail-view');

  // Update Navigation Active Highlights
  updateAppNavHighlights(route.view);

  // Compute semantic route key (subtabs within the same character share the same routeKey)
  let routeKey = route.view;
  if (route.view === 'character') {
    routeKey = `character:${route.slug}`;
  } else if (route.view === 'skin-detail') {
    routeKey = `skin-detail:${route.skinId}`;
  } else if (route.view === 'calculator') {
    routeKey = `calculator:${route.characterId || ''}`;
  }

  // Determine target incoming container
  let incomingContainer = null;
  if (route.view === 'catalog') incomingContainer = charCatalogView;
  else if (route.view === 'weapons' || route.view === 'data') incomingContainer = weaponsView;
  else if (route.view === 'gallery') incomingContainer = skinGalleryView;
  else if (route.view === 'skin-detail') incomingContainer = skinDetailView;
  else if (route.view === 'character') incomingContainer = charDetailView;
  else incomingContainer = mainContent;

  const allViewContainers = [charCatalogView, weaponsView, skinGalleryView, skinDetailView, charDetailView, mainContent].filter(Boolean);
  const outgoingContainer = allViewContainers.find(el => !el.classList.contains('hidden') && el !== incomingContainer);

  const isRealRouteChange = previousRouteKey !== null && previousRouteKey !== routeKey;

  // Interruption safety: cancel any running animation and reset element styles
  if (activeRouteTransition) {
    activeRouteTransition.kill();
    activeRouteTransition = null;
  }
  if (activeIncomingEl) {
    gsap.set(activeIncomingEl, { clearProps: 'transform,opacity' });
    activeIncomingEl = null;
  }

  const doRender = () => {
    renderRouteView(route, {
      mainContent,
      sidebar,
      emptyState,
      charCatalogView,
      charDetailView,
      weaponsView,
      skinGalleryView,
      skinDetailView,
      gameData
    });
  };

  if (!isRealRouteChange || !outgoingContainer || isReducedMotion()) {
    previousRouteKey = routeKey;
    allViewContainers.forEach(el => gsap.set(el, { clearProps: 'transform,opacity' }));
    doRender();
    return;
  }

  // Perform subtle route change transition:
  // OUTGOING: opacity 1 -> 0, translateY 0 -> -4px (~110ms)
  // INCOMING: opacity 0 -> 1, translateY +5px -> 0 (~200ms)
  previousRouteKey = routeKey;

  activeRouteTransition = gsap.timeline();
  activeRouteTransition.to(outgoingContainer, {
    opacity: 0,
    y: -4,
    duration: 0.11,
    ease: 'power1.out',
    onComplete: () => {
      outgoingContainer.classList.add('hidden');
      gsap.set(outgoingContainer, { clearProps: 'transform,opacity' });

      doRender();

      if (incomingContainer) {
        activeIncomingEl = incomingContainer;
        gsap.fromTo(incomingContainer,
          { opacity: 0, y: 5 },
          {
            opacity: 1,
            y: 0,
            duration: 0.20,
            ease: 'power2.out',
            clearProps: 'transform,opacity',
            onComplete: () => {
              activeRouteTransition = null;
              activeIncomingEl = null;
            }
          }
        );
      }
    }
  });
}

function updateAppNavHighlights(activeView) {
  // Update desktop vertical nav rail links
  document.querySelectorAll('.app-nav-item').forEach(item => {
    const tooltip = item.dataset.tooltip;
    if (tooltip === 'Máy Tính' || tooltip === 'Calculator' || tooltip === 'Công cụ') {
      item.classList.toggle('active', activeView === 'calculator');
    } else if (tooltip === 'Khí Giả' || tooltip === 'Characters') {
      item.classList.toggle('active', activeView === 'catalog' || activeView === 'character');
    } else if (tooltip === 'Thư Viện Trang Phục' || tooltip === 'Trang Phục' || tooltip === 'Y Phục' || tooltip === 'Gallery') {
      item.classList.toggle('active', activeView === 'gallery' || activeView === 'skin-detail');
    } else if (tooltip === 'Vũ Khí' || tooltip === 'Weapons' || tooltip === 'Dữ Liệu' || tooltip === 'Data') {
      item.classList.toggle('active', activeView === 'weapons' || activeView === 'data');
    }
  });

  // Update mobile top nav links
  document.querySelectorAll('.top-nav .nav-links a').forEach(link => {
    const text = link.textContent.trim();
    if (text === 'Calculator' || text === 'Máy Tính' || text === 'Công cụ') {
      link.classList.toggle('active', activeView === 'calculator');
    } else if (text === 'Characters' || text === 'Khí Giả') {
      link.classList.toggle('active', activeView === 'catalog' || activeView === 'character');
    } else if (text === 'Thư Viện Trang Phục' || text === 'Trang Phục' || text === 'Y Phục' || text === 'Gallery') {
      link.classList.toggle('active', activeView === 'gallery' || activeView === 'skin-detail');
    } else if (text === 'Vũ Khí' || text === 'Weapons' || text === 'Data' || text === 'Dữ Liệu') {
      link.classList.toggle('active', activeView === 'weapons' || activeView === 'data');
    }
  });
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  window.addEventListener('popstate', handleRoute);

  // Wire up App Nav item clicks
  document.querySelectorAll('.app-nav-item, .top-nav .nav-links a').forEach(el => {
    const text = el.dataset.tooltip || el.textContent.trim();
    if (text === 'Characters' || text === 'Khí Giả') {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = '#/characters';
      });
    } else if (text === 'Thư Viện Trang Phục' || text === 'Trang Phục' || text === 'Y Phục' || text === 'Gallery') {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = '#/gallery';
      });
    } else if (text === 'Vũ Khí' || text === 'Weapons') {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = '#/weapons';
      });
    } else if (text === 'Data' || text === 'Dữ Liệu') {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = '#/weapons';
      });
    } else if (text === 'Calculator' || text === 'Máy Tính' || text === 'Công cụ') {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const curCharId = state.character ? state.character.id : '';
        window.location.hash = curCharId ? `#calc?char=${curCharId}` : '#calc';
      });
    }
  });
}
