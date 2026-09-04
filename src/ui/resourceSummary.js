import { getGameData } from '../data/loader.js';

const EXP_BOOK_ID = '2105';   // Thâm Độ Xã Hội Học — 8000 EXP each
const EXP_PER_BOOK = 8000;

export function renderResourceSummary(resources) {
  const { totalExp, totalCoin, mats } = resources;
  const gameData = getGameData();

  const fmt = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

  // Header stats — raw numbers only
  document.getElementById('total-coin').textContent = fmt(totalCoin);
  document.getElementById('total-exp').textContent = totalExp > 0 ? `${fmt(totalExp)} EXP` : '0 EXP';

  const elMatGrid = document.getElementById('material-grid');
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
    const item = gameData.items[iid] || {
      name_vi: `ID ${iid}`,
      icon: `assets/items/itemicon_${iid}.png`
    };

    const div = document.createElement('div');
    div.className = 'mat-item';
    div.title = item.name_vi;
    div.innerHTML = `
      <img class="mat-icon" src="/${item.icon}" alt="${item.name_vi}" loading="lazy"
           onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22/%3E'"/>
      <div class="mat-info">
        <span class="mat-count">×${fmt(count)}</span>
        <span class="mat-name">${item.name_vi}</span>
      </div>
    `;
    elMatGrid.appendChild(div);
  });
}
