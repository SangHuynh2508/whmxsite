/**
 * WHMX Smooth Scroll Controller (Lenis 1.3.x)
 * 
 * Provides responsive, controlled desktop wheel smoothing for the active route container.
 * Touch scrolling remains 100% native (syncTouch: false).
 * Honors prefers-reduced-motion (respectReducedMotion: true).
 * Safely ignores and passes through nested scrollable elements.
 */
import Lenis from 'lenis';

let activeLenis = null;
let currentContainer = null;

function isReducedMotion() {
  return Boolean(
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Attaches or swaps Lenis smooth scrolling to the given active route container.
 * Cleans up any prior instance to ensure exactly ONE instance and RAF loop exist.
 *
 * @param {HTMLElement|null} container - The active view scroll container
 */
export function updateSmoothScrollContainer(container) {
  if (activeLenis) {
    try {
      activeLenis.destroy();
    } catch (e) {
      // ignore destruction errors
    }
    activeLenis = null;
    currentContainer = null;
  }

  if (!container || !(container instanceof HTMLElement)) {
    return null;
  }

  // If reduced motion is requested, do not initialize smooth scroll (native scroll only)
  if (isReducedMotion()) {
    currentContainer = container;
    return null;
  }

  currentContainer = container;

  // Controlled, snappy feel: lerp 0.14, wheelMultiplier 1.0
  activeLenis = new Lenis({
    wrapper: container,
    content: container,
    lerp: 0.14,
    wheelMultiplier: 1.0,
    smoothWheel: true,
    syncTouch: false, // Touch remains completely native
    respectReducedMotion: true,
    autoRaf: true,
    prevent: (node) => {
      if (!node || !(node instanceof HTMLElement)) return false;
      return Boolean(
        node.hasAttribute('data-lenis-prevent') ||
        node.closest('[data-lenis-prevent]') ||
        node.closest('.calc-picker-roster') ||
        node.closest('.adv-filter-panel') ||
        node.closest('.skin-lightbox-modal') ||
        node.closest('#sidebar')
      );
    }
  });

  return activeLenis;
}

/**
 * Returns the currently active Lenis instance (or null)
 */
export function getActiveLenis() {
  return activeLenis;
}

/**
 * Pauses smooth scroll (e.g. when modal / lightbox opens)
 */
export function stopSmoothScroll() {
  if (activeLenis) {
    activeLenis.stop();
  }
}

/**
 * Resumes smooth scroll (e.g. when modal / lightbox closes)
 */
export function startSmoothScroll() {
  if (activeLenis) {
    activeLenis.start();
  }
}

/**
 * Forces dimension recalculation (e.g. after dynamic images/data load)
 */
export function resizeSmoothScroll() {
  if (activeLenis) {
    activeLenis.resize();
  }
}

/**
 * Sets scroll position immediately (without animation)
 *
 * @param {number} position - target scroll in px
 */
export function setScrollPositionImmediate(position = 0) {
  const target = Math.max(0, position);
  if (activeLenis) {
    activeLenis.scrollTo(target, { immediate: true });
  } else if (currentContainer) {
    currentContainer.scrollTop = target;
  }
}

/**
 * Destroys any active Lenis instance cleanly
 */
export function destroySmoothScroll() {
  if (activeLenis) {
    try {
      activeLenis.destroy();
    } catch (e) {
      // ignore
    }
    activeLenis = null;
    currentContainer = null;
  }
}
