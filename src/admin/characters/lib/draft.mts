// Browser drafts are a convenience; storage can be blocked, so nothing here may throw.
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
export const draftKey = (scope: string, id: string) => `whmx:admin-draft:${scope}:${id}`;

export function saveDraft(storage: Storage, key: string, value: object) {
  try { storage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}
export function loadDraft(storage: Storage, key: string): Record<string, string> | null {
  try { const raw = storage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function clearDraft(storage: Storage, key: string) {
  try { storage.removeItem(key); } catch { /* storage unavailable */ }
}
