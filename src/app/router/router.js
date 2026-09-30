/**
 * SPA Hash Router for WhmxCalc
 */
import { getGameData } from '../../data/loader.js';
import { setCharacter, state } from '../../data/state.js';
import { renderCharacterDetail } from '../../features/characters/views/characterDetail.js';
import { renderCharacterCatalogView } from '../../features/characters/views/characterCatalogView.js';
import { renderWeaponsView } from '../../features/weapons/views/weaponsView.js';
import { closeCalcPicker, selectCalculatorCharacter } from '../../ui/calcCharacterPicker.js';
import { renderHeader } from '../../features/characters/components/characterHeader.js';
import { canonicalCharacterHash } from './characterHash.mts';
import { staticView } from './staticRoutes.mts';
import { mountHomePage, unmountHomePage } from '../../features/home/HomePage.tsx';
import { mountBannersPage, unmountBannersPage } from '../../features/banners/BannersPage.tsx';
import { renderSkinGalleryView, renderGalleryDemoView } from '../../features/skins/views/skinGalleryView.js';
import { renderSkinDetailView } from '../../features/skins/views/skinDetailView.js';
import { gsap } from 'gsap';
import { updateSmoothScrollContainer, resizeSmoothScroll, setScrollPositionImmediate } from '../runtime/smoothScroll.js';

let previousRouteKey = null;
let activeRouteTransition = null;
let isPopStateNav = false;
const routeScrollCache = new Map();

function isReducedMotion() {
  return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function cancelActiveTransition(allViewContainers) {
  if (activeRouteTransition) {
    activeRouteTransition.kill();
    activeRouteTransition = null;
  }
  if (allViewContainers) {
    allViewContainers.forEach(el => {
      gsap.set(el, { clearProps: 'transform,opacity' });
    });
  }
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

  const pageView = staticView(window.location.hash);
  if (pageView) return { view: pageView, slug: '', subtab: '' };

  // Admin routes are owned by the React shell (src/admin/layout/AdminApp.tsx).
  if (hash === '/login' || hash === '/admin' || hash.startsWith('/admin/') || hash.startsWith('/admin?')) {
    return {
      view: 'admin',
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

// Route view -> its container; every other container is hidden and emptied. A view not listed is the calculator
// (#main-content).
const VIEW_CONTAINERS = {
  home: 'home-view',
  banners: 'banners-view',
  catalog: 'character-catalog-view',
  character: 'character-detail-view',
  weapons: 'weapons-view',
  gallery: 'skin-gallery-view',
  'skin-detail': 'skin-detail-view',
};
const containerOf = (view) => (Object.hasOwn(VIEW_CONTAINERS, view) ? document.getElementById(VIEW_CONTAINERS[view]) : null);

function renderRouteView(route, target, gameData) {
  for (const id of Object.values(VIEW_CONTAINERS)) {
    const el = document.getElementById(id);
    if (el && el !== target) {
      if (id === 'home-view') unmountHomePage();
      if (id === 'banners-view') unmountBannersPage();
      el.classList.add('hidden');
      el.innerHTML = '';
    }
  }
  const mainContent = document.getElementById('main-content');
  if (target !== mainContent) {
    mainContent.classList.add('hidden');
    target.classList.remove('hidden');
    if (route.view === 'home') mountHomePage(target);
    else if (route.view === 'banners') mountBannersPage(target);
    else if (route.view === 'catalog') renderCharacterCatalogView(target);
    else if (route.view === 'character') renderCharacterDetail(route.slug, route.subtab);
    else if (route.view === 'weapons') renderWeaponsView(target);
    else if (route.view === 'gallery') renderSkinGalleryView(target);
    else renderSkinDetailView(target, route.skinId);
    return;
  }
  const targetCharId = route.characterId || state.character?.id;
  if (targetCharId && gameData.characters[targetCharId]) {
    selectCalculatorCharacter(targetCharId);
  } else {
    mainContent.classList.remove('hidden');
    renderHeader();
  }
}

export function handleRoute() {
  const gameData = getGameData();
  if (!gameData) return;

  const route = parseHash();

  // A new route closes what the old page left open: the calculator picker, and the scroll lock of a skin lightbox
  // (the lightbox's own close never runs once its page is replaced, which froze the next page on phones).
  closeCalcPicker();
  document.body.style.overflow = '';

  // One URL per character: an ID URL (#/characters/W0182) is rewritten to the slug URL in place.
  if (route.view === 'character') {
    const char = getCharBySlugOrId(route.slug);
    const canonical = canonicalCharacterHash(route.slug, route.subtab, char);
    if (canonical) {
      history.replaceState(null, '', canonical);
      route.slug = char.slug;
    }
  }

  // The React admin shell owns #/admin; nav highlights live in src/app/layout/AppNav.tsx.
  if (route.view === 'admin') return;

  // Compute semantic route key (subtabs within the same character share the same routeKey)
  let routeKey = route.view;
  if (route.view === 'character') {
    routeKey = `character:${route.slug}`;
  } else if (route.view === 'skin-detail') {
    routeKey = `skin-detail:${route.skinId}`;
  } else if (route.view === 'calculator') {
    routeKey = `calculator:${route.characterId || ''}`;
  }

  const mainContent = document.getElementById('main-content');
  const incomingContainer = containerOf(route.view) || mainContent;
  const allViewContainers = [...Object.keys(VIEW_CONTAINERS).map(containerOf), mainContent].filter(Boolean);
  const outgoingContainer = allViewContainers.find(el => !el.classList.contains('hidden'));

  // Save outgoing container scroll position before route change
  if (previousRouteKey && outgoingContainer) {
    routeScrollCache.set(previousRouteKey, outgoingContainer.scrollTop);
  }

  // Determine target scroll position (Back/Forward restores previous position; forward nav resets to 0)
  const isBackForward = isPopStateNav;
  isPopStateNav = false;
  const targetScroll = isBackForward ? (routeScrollCache.get(routeKey) ?? 0) : 0;

  const isRealRouteChange = previousRouteKey !== null && previousRouteKey !== routeKey;

  const doRender = () => renderRouteView(route, incomingContainer, gameData);

  // CASE 1: Same semantic route key (e.g. internal Character Detail subtab change) or initial mount
  if (!isRealRouteChange) {
    doRender();
    if (previousRouteKey === null) {
      previousRouteKey = routeKey;
      allViewContainers.forEach(el => gsap.set(el, { clearProps: 'transform,opacity' }));
      updateSmoothScrollContainer(incomingContainer);
      setScrollPositionImmediate(targetScroll);
    } else {
      // Subtab switch inside same mounted shell preserves scroll position and resizes smooth scroll
      resizeSmoothScroll();
    }
    return;
  }

  // CASE 2: User prefers reduced motion: instant swap without sliding/fading
  if (isReducedMotion()) {
    cancelActiveTransition(allViewContainers);
    previousRouteKey = routeKey;
    doRender();
    updateSmoothScrollContainer(incomingContainer);
    setScrollPositionImmediate(targetScroll);
    return;
  }

  // CASE 3: Top-level route change transition
  // OUTGOING: opacity 1 -> 0, y: 0 -> -4px (~110ms, power1.out)
  // SWAP & SCROLL: DOM swap, set target scroll position (0 or restored), attach Lenis
  // INCOMING: opacity 0 -> 1, y: +5px -> 0 (~200ms, power2.out)
  cancelActiveTransition(allViewContainers);
  previousRouteKey = routeKey;

  const sameContainer = outgoingContainer && outgoingContainer === incomingContainer;

  if (sameContainer) {
    // Navigation between different items sharing the same view shell (e.g. character to character)
    activeRouteTransition = gsap.timeline();
    activeRouteTransition.to(incomingContainer, {
      opacity: 0,
      y: -4,
      duration: 0.11,
      ease: 'power1.out',
      onComplete: () => {
        gsap.set(incomingContainer, { opacity: 0, y: 5 });
        doRender();
        updateSmoothScrollContainer(incomingContainer);
        setScrollPositionImmediate(targetScroll);

        gsap.to(incomingContainer, {
          opacity: 1,
          y: 0,
          duration: 0.20,
          ease: 'power2.out',
          clearProps: 'transform,opacity',
          onComplete: () => {
            activeRouteTransition = null;
          }
        });
      }
    });
  } else if (outgoingContainer) {
    // Standard cross-view page transition
    activeRouteTransition = gsap.timeline();
    activeRouteTransition.to(outgoingContainer, {
      opacity: 0,
      y: -4,
      duration: 0.11,
      ease: 'power1.out',
      onComplete: () => {
        outgoingContainer.classList.add('hidden');
        gsap.set(outgoingContainer, { clearProps: 'transform,opacity' });

        if (incomingContainer) {
          gsap.set(incomingContainer, { opacity: 0, y: 5 });
          incomingContainer.classList.remove('hidden');
          doRender();
          updateSmoothScrollContainer(incomingContainer);
          setScrollPositionImmediate(targetScroll);

          gsap.to(incomingContainer, {
            opacity: 1,
            y: 0,
            duration: 0.20,
            ease: 'power2.out',
            clearProps: 'transform,opacity',
            onComplete: () => {
              activeRouteTransition = null;
            }
          });
        } else {
          doRender();
          activeRouteTransition = null;
        }
      }
    });
  } else {
    // Fallback if no container was actively visible
    if (incomingContainer) {
      gsap.set(incomingContainer, { opacity: 0, y: 5 });
      incomingContainer.classList.remove('hidden');
    }
    doRender();
    updateSmoothScrollContainer(incomingContainer);
    setScrollPositionImmediate(targetScroll);
    if (incomingContainer) {
      gsap.to(incomingContainer, {
        opacity: 1,
        y: 0,
        duration: 0.20,
        ease: 'power2.out',
        clearProps: 'transform,opacity',
        onComplete: () => {
          activeRouteTransition = null;
        }
      });
    }
  }
}

// The calculator link keeps the currently selected character (src/app/layout/AppNav.tsx).
export function calculatorHash() {
  return state.character ? `#calc?char=${state.character.id}` : '#calc';
}

export function initRouter() {
  window.addEventListener('popstate', () => {
    isPopStateNav = true;
  });
  window.addEventListener('hashchange', handleRoute);
}
