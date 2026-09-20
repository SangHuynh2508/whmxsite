/** Resolve app-local paths and storage-neutral published asset URLs safely. */
export function resolveAssetUrl(path) {
  const value = String(path || '').trim();
  if (!value) return '';

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return value.startsWith('/') ? value : `/${value}`;
}

export function getCharacterCardUrl(cardPath) {
  const value = String(cardPath || '').trim();
  if (!value) return '';

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  // Already a relative/local path such as assets/characters/cards/foo.png
  if (value.includes('/')) {
    return resolveAssetUrl(value);
  }

  // Current data.json stores card entries as filenames only.
  return `/assets/characters/cards/${value}`;
}

export function getSkinAvatarUrl(skinId) {
  const sid = String(skinId || '').trim().toLowerCase();
  if (!sid) return '';
  return `/assets/characters/avatars/${sid}.png`;
}

export function getItemIconUrl(itemId) {
  const id = String(itemId || '').trim();
  if (!id) return '';
  return `/assets/items/itemicon_${id}.png`;
}

export function getSkinSeriesBadgeUrl(seriesId) {
  const sid = String(seriesId || '').trim();
  if (!sid || sid === '0') return '';
  return `/assets/series/skinlogo_${sid}.png`;
}

/**
 * Centralized resolver for skin visual assets (drawing, card crop, avatar)
 * Ensures consistency between Skin Gallery and Skin Detail views.
 */
export function getSkinAssetUrls(skin, char) {
  const charId = (char?.id || '').toLowerCase();
  const skinId = (skin?.skinID || skin?.id || '').toLowerCase();

  const drawingUrl = resolveAssetUrl(skin?.image);
  const cardUrl = skin?.image
    ? skin.image.replace('/drawings/', '/cards/').replace('drawings', 'cards')
    : (charId && skinId ? `https://pub-c0dceaa4fc5b48d1811c48f6f91a899c.r2.dev/characters/${charId}/cards/${skinId}.webp` : '');
  const avatarUrl = getSkinAvatarUrl(skinId);

  // Reliable character fallback avatar
  let fallbackAvatarUrl = '';
  if (char?.icon) {
    let iconPath = char.icon;
    if (iconPath.includes('assets/avatars/')) {
      iconPath = iconPath.replace('assets/avatars/', 'assets/characters/avatars/');
    }
    fallbackAvatarUrl = resolveAssetUrl(iconPath);
  } else if (char?.id) {
    fallbackAvatarUrl = `/assets/characters/avatars/${char.id}.png`;
  }

  return {
    drawingUrl,
    cardUrl,
    avatarUrl,
    fallbackAvatarUrl
  };
}
