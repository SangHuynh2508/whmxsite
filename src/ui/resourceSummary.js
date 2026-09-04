import { getGameData } from '../data/loader.js';

const EXP_BOOK_ID = '2105';   // Thâm Độ Xã Hội Học — 8000 EXP each
const EXP_PER_BOOK = 8000;

/**
 * Format numbers with "Vạn" priority (1 vạn = 10,000), followed by detailed number in parentheses.
 * Example: 10102 -> "1,01 vạn (10.102)"
 * Example for EXP: 2108770 -> "210,88 vạn (2.108.770 EXP)"
 */
export function formatVanHtml(num, suffix = '') {
  const n = Math.round(num || 0);
  const fmtRaw = new Intl.NumberFormat('vi-VN').format(n);

  if (n < 10000) {
    return suffix ? `${fmtRaw} ${suffix}`.trim() : fmtRaw;
  }

  const vanVal = (n / 10000).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  const detailStr = suffix ? `${fmtRaw} ${suffix}`.trim() : fmtRaw;

  return `${vanVal} vạn <span class="stat-detail">(${detailStr})</span>`;
}

export function formatVan(num, suffix = '') {
  const n = Math.round(num || 0);
  const fmtRaw = new Intl.NumberFormat('vi-VN').format(n);

  if (n < 10000) {
    return suffix ? `${fmtRaw} ${suffix}`.trim() : fmtRaw;
  }

  const vanVal = (n / 10000).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  const detailStr = suffix ? `${fmtRaw} ${suffix}`.trim() : fmtRaw;

  return `${vanVal} vạn (${detailStr})`;
}

export function renderResourceSummary(resources) {
  const { totalExp, totalCoin, mats } = resources;
  const gameData = getGameData();

  // Header stats — Vạn priority + detailed number in parentheses
  const elCoin = document.getElementById('total-coin');
  const elExp  = document.getElementById('total-exp');

  if (elCoin) elCoin.innerHTML = formatVanHtml(totalCoin);
  if (elExp)  elExp.innerHTML  = formatVanHtml(totalExp, 'EXP');

  const elMatGrid = document.getElementById('material-grid');
  if (!elMatGrid) return;
  elMatGrid.innerHTML = '';

  // Build material list: inject EXP books first if exp > 0
  const allMats = { ...mats };
  if (totalExp > 0) {
    const bookCount = Math.ceil(totalExp / EXP_PER_BOOK);
    allMats[EXP_BOOK_ID] = (allMats[EXP_BOOK_ID] || 0) + bookCount;
  }

  const sorted = Object.entries(allMats).sort((a, b) => {
    // EXP books always first
    if (a[0] === EXP_BOOK_ID) return -1;
    if (b[0] === EXP_BOOK_ID) return 1;
    return b[1] - a[1];
  });

  if (sorted.length === 0) {
    elMatGrid.innerHTML = '<div class="mat-empty">Không cần tài nguyên cho khoảng này.</div>';
    return;
  }

  sorted.forEach(([iid, count]) => {
    const item = (gameData && gameData.items && gameData.items[iid]) ? gameData.items[iid] : {
      name_vi: `ID ${iid}`,
      icon: `assets/items/itemicon_${iid}.png`
    };

    const countText = count >= 10000 ? formatVan(count) : new Intl.NumberFormat('vi-VN').format(count);

    const div = document.createElement('div');
    div.className = 'mat-item';
    div.title = item.name_vi;
    div.innerHTML = `
      <img class="mat-icon" src="/${item.icon}" alt="${item.name_vi}" loading="lazy"
           onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22/%3E'"/>
      <div class="mat-info">
        <span class="mat-count">×${countText}</span>
        <span class="mat-name">${item.name_vi}</span>
      </div>
    `;
    elMatGrid.appendChild(div);
  });
}
