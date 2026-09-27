import { areaOf } from '../../characters/lib/shortcut.mts';

// Khí Giả and Từ điển are the admin areas with unsaved editor state.
export const mustAskBeforeLeaving = (from: string, to: string, dirty: boolean) => dirty && from !== to && areaOf(from) !== null;
