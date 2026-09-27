/**
 * "Về đầu trang" button: sits where the feedback button used to be (that one moved up),
 * shown once the page is scrolled past SHOW_AFTER px.
 */

import { getActiveScrollContainer, scrollActiveToTop } from '../runtime/smoothScroll.js';

const SHOW_AFTER = 400;

export function initBackToTopButton() {
  const btn = document.getElementById('whmx-top-btn');
  if (!btn) return;

  let frame = 0;
  const sync = () => {
    frame = 0;
    const container = getActiveScrollContainer();
    const scrolled = Math.max(window.scrollY, container ? container.scrollTop : 0);
    btn.classList.toggle('is-visible', scrolled > SHOW_AFTER);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(sync);
  };

  // scroll does not bubble; capture catches the route containers as well as the document.
  document.addEventListener('scroll', schedule, { capture: true, passive: true });
  window.addEventListener('hashchange', schedule);
  schedule();

  btn.addEventListener('click', () => {
    scrollActiveToTop();
  });
}
