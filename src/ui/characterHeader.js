import { state } from '../data/state.js';
import { renderTagChipsHtml } from './utils/tagColors.js';
import { openCalcPicker } from './calcCharacterPicker.js';
import { getCharacterAvatarUrl } from './utils/avatar.js';
import { getCharacterCardUrl } from '../constants/assetPaths.js';

export function renderHeader() {
  const char = state.character;

  const elAvatarBox  = document.getElementById('profile-avatar-container');
  const elAvatar     = document.getElementById('profile-avatar');
  const elPlus       = document.getElementById('profile-avatar-plus');
  const elChangeBtn  = document.getElementById('profile-change-char-btn');
  const elRarity     = document.getElementById('profile-rarity');
  const elNameVi     = document.getElementById('profile-name-vi');
  const elNameCn     = document.getElementById('profile-name-cn');
  const elJobBlock   = document.getElementById('profile-job-block');
  const elClassBadge = document.getElementById('profile-class-badge');
  const elClassLabel = document.getElementById('profile-class-label');
  const elTags       = document.getElementById('profile-tags');

  // Style profile names container as clickable trigger
  const elNames = document.querySelector('.profile-names');
  if (elNames) {
    elNames.style.cursor = 'pointer';
  }

  const getRarityText = (r) => ({ 5: 'EXTRA', 4: 'SSR', 3: 'SR', 2: 'R', 1: 'N' }[r] || `R${r}`);

  if (!char) {
    // Unselected State
    if (elAvatarBox) elAvatarBox.setAttribute('aria-label', 'Chọn nhân vật');
    if (elAvatar) {
      elAvatar.classList.add('hidden');
      elAvatar.style.display = 'none';
    }
    if (elPlus) {
      elPlus.classList.remove('hidden');
      elPlus.style.display = 'flex';
    }
    if (elChangeBtn) {
      elChangeBtn.classList.add('hidden');
      elChangeBtn.style.display = 'none';
    }
    if (elRarity) elRarity.style.display = 'none';
    if (elNameVi) elNameVi.textContent = 'Chọn Nhân Vật';
    if (elNameCn) elNameCn.textContent = 'Bấm vào hình đại diện để chọn nhân vật';
    if (elJobBlock) elJobBlock.style.display = 'none';
    if (elTags) elTags.innerHTML = '';
    
    const cardPanel = document.getElementById('char-card-panel');
    if (cardPanel) cardPanel.style.display = 'none';
    return;
  }

  // Selected State
  if (elAvatarBox) elAvatarBox.setAttribute('aria-label', 'Đổi nhân vật');
  if (elPlus) {
    elPlus.classList.add('hidden');
    elPlus.style.display = 'none';
  }
  if (elAvatar) {
    elAvatar.src = getCharacterAvatarUrl(char);
    elAvatar.classList.remove('hidden');
    elAvatar.style.display = 'block';
  }
  if (elChangeBtn) {
    elChangeBtn.classList.remove('hidden');
    elChangeBtn.style.display = 'inline-flex';
  }
  if (elRarity) {
    elRarity.style.display = '';
    elRarity.className = `profile-rarity rare-${char.rare}`;
    elRarity.textContent = getRarityText(char.rare) + (char.is_limited ? ' • LIMITED' : '');
  }
  if (elNameVi) elNameVi.textContent = char.name_vi || char.name_cn;
  if (elNameCn) elNameCn.textContent = char.fullname_vi || char.fullname_cn || char.name_cn;

  // Class / Job Badge & Label Mapping
  const prefixes = { 1: 'sw', 2: 'qr', 3: 'yj', 4: 'gs', 5: 'zl' };
  const jobNames = { 1: 'Túc Vệ', 2: 'Khinh Nhuệ', 3: 'Viễn Kích', 4: 'Cấu Thuật', 5: 'Chiến Lược' };
  const colors   = { 2: 'blue', 3: 'yellow', 4: 'red', 5: 'red' };
  
  const prefix  = prefixes[char.job];
  const color   = colors[char.rare] || 'red';
  const jName   = jobNames[char.job] || '';

  if (prefix && elJobBlock && elClassBadge && elClassLabel) {
    elClassBadge.src = `/assets/jobs/ui_yc_${prefix}_${color}.png`;
    elClassBadge.alt = jName;
    elClassLabel.textContent = jName;
    elJobBlock.style.display = 'flex';
  } else if (elJobBlock) {
    elJobBlock.style.display = 'none';
  }

  // Globalized Gameplay Tags
  const tagStr = char.tags_vi || char.tags_cn || '';
  if (elTags) elTags.innerHTML = renderTagChipsHtml(tagStr);

  // Character Card Artwork & Gallery
  renderCardGallery(char);
}

function renderCardGallery(char) {
  const cardPanel  = document.getElementById('char-card-panel');
  const cardImg    = document.getElementById('profile-card-img');
  const thumbsWrap = document.getElementById('card-thumbnails');
  if (!cardPanel || !cardImg || !thumbsWrap) return;

  const cards = char.cards && char.cards.length > 0 ? char.cards : [];
  
  // Build variant list: artworkSrc (full card image) vs thumbnailSrc (square avatar)
  const variants = cards.map((cardName, idx) => ({
    id: `${char.id}_var_${idx}`,
    artworkSrc: getCharacterCardUrl(cardName),
    thumbnailSrc: (idx === 0) ? `/${char.icon}` : getCharacterCardUrl(cardName)
  }));

  // Initial artwork: use variant 0's artworkSrc
  if (!variants.length) { cardPanel.style.display = 'none'; return; }
  cardImg.src = variants[0].artworkSrc;
  cardPanel.style.display = '';

  // Render thumbnails
  thumbsWrap.innerHTML = '';
  if (variants.length > 1) {
    thumbsWrap.style.display = 'flex';
    variants.forEach((v, idx) => {
      const btn = document.createElement('button');
      btn.className = `thumb-btn${idx === 0 ? ' active' : ''}`;
      btn.title = `Biến thể ${idx + 1}`;
      btn.innerHTML = `<img src="${v.thumbnailSrc}" alt="Variant ${idx + 1}" />`;
      btn.addEventListener('click', () => {
        // Update main artwork to variant's full artworkSrc
        cardImg.src = v.artworkSrc;
        thumbsWrap.querySelectorAll('.thumb-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      thumbsWrap.appendChild(btn);
    });
  } else {
    thumbsWrap.style.display = 'none';
  }
}

