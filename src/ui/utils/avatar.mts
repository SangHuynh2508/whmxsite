/**
 * Shared resolver for character avatar image URLs.
 * Returns root-relative URL path to character avatar asset.
 */
export function getCharacterAvatarUrl(char: { icon?: string } | null | undefined): string {
  if (!char || !char.icon) return '';
  const path = char.icon.includes('assets/avatars/') ? char.icon.replace('assets/avatars/', 'assets/characters/avatars/') : char.icon;
  return path.startsWith('/') ? path : `/${path}`;
}
