const STORAGE_KEY = 'whmx_nav_expanded';

export function isNavExpanded() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'true';
}

export function setNavExpanded(expanded, save = true) {
  const isExpanded = Boolean(expanded);
  document.documentElement.setAttribute('data-nav-expanded', isExpanded ? 'true' : 'false');
  if (save) {
    localStorage.setItem(STORAGE_KEY, isExpanded ? 'true' : 'false');
  }
  updateToggleIcon(isExpanded);
}

export function toggleNav() {
  const current = document.documentElement.getAttribute('data-nav-expanded') === 'true';
  setNavExpanded(!current, true);
}

function updateToggleIcon(expanded) {
  const toggleBtn = document.getElementById('app-nav-toggle');
  if (!toggleBtn) return;

  // Left chevron when expanded (to collapse), Right chevron when collapsed (to expand)
  const chevronLeft = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
  const chevronRight = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;

  toggleBtn.innerHTML = expanded ? chevronLeft : chevronRight;
  toggleBtn.setAttribute('title', expanded ? 'Thu gọn thanh điều hướng' : 'Mở rộng thanh điều hướng');
  toggleBtn.setAttribute('aria-label', expanded ? 'Thu gọn thanh điều hướng' : 'Mở rộng thanh điều hướng');
}

export function initAppNav() {
  const expanded = isNavExpanded();
  setNavExpanded(expanded, false);

  const toggleBtn = document.getElementById('app-nav-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleNav);
  }
}
