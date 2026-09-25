const AREA = '#/admin/characters';
// Khí Giả stays mounted (hidden) while Preview/Accounts is open; the shortcut must not save it from there.
export const isSaveShortcut = (e: { ctrlKey: boolean; metaKey: boolean; key: string }, hash: string) =>
  (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && (hash === AREA || hash.startsWith(`${AREA}/`));
