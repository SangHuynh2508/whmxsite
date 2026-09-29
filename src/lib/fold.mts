// Accent-insensitive search key for Vietnamese ("Thương Chu" → "thuong chu"); Chinese passes through unchanged.
export const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
