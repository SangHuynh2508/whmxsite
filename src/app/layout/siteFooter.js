/**
 * One site footer, kept at the end of whichever view is showing (every view is its own scroll container on desktop).
 * Views rewrite their own DOM (innerHTML, React roots appending after it), so a MutationObserver puts the footer back
 * at the end whenever something lands after it or wipes it.
 */
import { s } from '../../i18n/strings.mts';

let footer = null;
let watcher = null;

function build() {
  const el = document.createElement('footer');
  el.className = 'app-footer';
  el.innerHTML = '<p class="app-footer-rights"></p><p class="app-footer-fan"></p>';
  const text = () => {
    el.querySelector('.app-footer-rights').textContent = s('cFooter');
    el.querySelector('.app-footer-fan').textContent = s('cFooterFan');
  };
  text();
  window.addEventListener('whmx:lang', text);
  return el;
}

export function attachSiteFooter(container) {
  watcher?.disconnect();
  watcher = null;
  if (!(container instanceof HTMLElement)) return;
  footer ??= build();
  const keepLast = () => {
    if (container.lastElementChild !== footer) container.appendChild(footer);
  };
  keepLast();
  watcher = new MutationObserver(keepLast);
  watcher.observe(container, { childList: true });
}
