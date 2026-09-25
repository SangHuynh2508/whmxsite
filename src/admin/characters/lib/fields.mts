type Field = { value?: string | null; source?: string | null };
export const fieldValue = (record: Record<string, Field | unknown> | null | undefined, key: string) =>
  String((record?.[key] as Field | undefined)?.value ?? '');

// Empty input means "back to source". The server clears an override only when it receives the source
// value itself (null would be stored as an empty override), so an emptied field sends the source.
export function changesFor(draft: Record<string, string>, record: Record<string, unknown>, keys: string[]) {
  const changes: Record<string, string | null> = {};
  for (const key of keys) {
    const next = (draft[key] ?? '').trim() || ((record[key] as Field | undefined)?.source ?? '').trim();
    if (next !== fieldValue(record, key).trim()) changes[key] = next || null;
  }
  return changes;
}

// What goes into the browser draft: only the fields the user changed, as typed (restored over the
// record's current values, so other people's newer values are kept).
export const changedDraft = (draft: Record<string, string>, record: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(Object.keys(changesFor(draft, record, keys)).map((k) => [k, draft[k] ?? '']));

// The stored draft merged over the record's current values, or null when it changes nothing.
export function draftToRestore(stored: Record<string, string> | null, record: Record<string, unknown>, keys: string[]) {
  if (!stored) return null;
  const merged = { ...Object.fromEntries(keys.map((k) => [k, fieldValue(record, k)])), ...stored };
  return Object.keys(changesFor(merged, record, keys)).length ? merged : null;
}

// For a 409: every field the user changed, with the value they started from and what is saved now.
export const conflictRows = (draft: Record<string, string>, base: Record<string, unknown>, fresh: Record<string, unknown>, keys: string[]) =>
  Object.keys(changesFor(draft, base, keys)).map((key) => ({ key, base: fieldValue(base, key), theirs: fieldValue(fresh, key), yours: draft[key] ?? '' }));
