/**
 * Standalone Weapons View (/weapons) - Production Safe Placeholder
 */

import { s } from '../../../i18n/strings.mts';

export function renderWeaponsView(container) {
  if (!container) return;

  container.innerHTML = `
    <div class="data-page-wrapper">
      <div class="data-page-card">
        <h2 class="data-card-title">${s('ifWeapons')}</h2>
        <p class="data-card-subtext">${s('wpPlaceholder')}</p>
      </div>
    </div>
  `;
}
