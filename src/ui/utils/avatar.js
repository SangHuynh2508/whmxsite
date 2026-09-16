/**
 * Shared resolver for character avatar image URLs.
 * Returns root-relative URL path to character avatar asset.
 */
export function getCharacterAvatarUrl(char) {
  if (!char || !char.icon) return '';
  let path = char.icon;
  if (path.includes('assets/avatars/')) {
    path = path.replace('assets/avatars/', 'assets/characters/avatars/');
  }
  return path.startsWith('/') ? path : `/${path}`;
}
