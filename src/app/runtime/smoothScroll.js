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
let activeResizeObserver = null;

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
  if (activeResizeObserver) {
    try {
      activeResizeObserver.disconnect();
    } catch (e) {
      // ignore
    }
    activeResizeObserver = null;
  }

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

  // Resolve content element: for Calculator (#main-content), .content-body encompasses
  // all vertical calculation content. For other views, first child or container.
  const resolvedContent =
    container.querySelector('.content-body') ||
    container.firstElementChild ||
    container;

  // Controlled, snappy feel: lerp 0.14, wheelMultiplier 1.0
  activeLenis = new Lenis({
    wrapper: container,
    content: resolvedContent,
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
        node.closest('.skin-lightbox-modal')
      );
    }
  });

  // Attach scoped ResizeObserver on the actual growing content root(s)
  // to guarantee Lenis synchronizes dimensions immediately whenever dynamic content grows or shrinks.
  activeResizeObserver = new ResizeObserver(() => {
    if (activeLenis) {
      activeLenis.resize();
    }
  });

  if (resolvedContent && resolvedContent !== container) {
    activeResizeObserver.observe(resolvedContent);
  }
  const calcWrapper = container.querySelector('.calc-wrapper');
  if (calcWrapper) {
    activeResizeObserver.observe(calcWrapper);
  }
  Array.from(container.children).forEach(child => {
    if (child instanceof HTMLElement) {
      activeResizeObserver.observe(child);
    }
  });

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
 * The route container that scrolls on desktop (null before the first route).
 * On phones the document scrolls instead (see scrollActiveToTop).
 */
export function getActiveScrollContainer() {
  return currentContainer;
}

/**
 * Scrolls the page back to the top: the route container (through Lenis when active)
 * and the document, whichever of them is scrolled.
 */
export function scrollActiveToTop() {
  const smooth = !isReducedMotion();
  if (activeLenis) {
    activeLenis.scrollTo(0, smooth ? { duration: 0.9 } : { immediate: true });
  } else if (currentContainer) {
    currentContainer.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
  }
  window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
}
