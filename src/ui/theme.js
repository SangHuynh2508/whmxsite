export function getPreferredTheme() {
  return 'dark';
}

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', 'dark');
}

export function toggleTheme() {
  setTheme('dark');
}

export function initTheme() {
  document.documentElement.setAttribute('data-theme', 'dark');
}
