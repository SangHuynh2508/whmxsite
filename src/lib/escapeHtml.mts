// For text that is interpolated into innerHTML templates (e.g. DB/R2-sourced profile fields).
const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (ch) => ENTITIES[ch]);
