type Field = { value?: string | null };
export const fieldValue = (record: Record<string, Field | unknown> | null | undefined, key: string) =>
  String((record?.[key] as Field | undefined)?.value ?? '');

// Empty input means "back to source": the API clears the override when it receives null.
export function changesFor(draft: Record<string, string>, record: Record<string, unknown>, keys: string[]) {
  const changes: Record<string, string | null> = {};
  for (const key of keys) {
    const next = (draft[key] ?? '').trim();
    if (next !== fieldValue(record, key).trim()) changes[key] = next || null;
  }
  return changes;
}

export const isDirty = (draft: Record<string, string>, record: Record<string, unknown>, keys: string[]) =>
  Object.keys(changesFor(draft, record, keys)).length > 0;
