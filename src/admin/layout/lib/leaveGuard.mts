const AREA = '#/admin/characters';
const inArea = (hash: string) => hash === AREA || hash.startsWith(`${AREA}/`);
// Khí Giả is the only admin area with unsaved editor state.
export const mustAskBeforeLeaving = (from: string, to: string, dirty: boolean) => dirty && from !== to && inArea(from);
