// Admin areas with editors. Khí Giả stays mounted (hidden) while another area is open, so Ctrl/⌘+S saves only
// the editors of the area that is visible now (the one the editor was opened in).
const AREAS = ['#/admin/characters', '#/admin/dictionary'];
export const areaOf = (hash: string) => AREAS.find((a) => hash === a || hash.startsWith(`${a}/`)) ?? null;
export const isSaveShortcut = (e: { ctrlKey: boolean; metaKey: boolean; key: string }, hash: string, editorHash: string) =>
  (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && areaOf(hash) !== null && areaOf(hash) === areaOf(editorHash);
