// `claimedRawIdEvidence` and `manualMetadata` are free JSON objects that nothing
// reads yet. Editors only see a plain-text "Căn cứ" note, stored as
// `claimedRawIdEvidence.note`; every other key is owner-only and must round-trip.
// Check: `node src/admin/preview/evidence.check.mjs`.

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The note an editor edits (only a string `note` counts). @returns {string} */
export const evidenceNote = (evidence) => (isObject(evidence) && typeof evidence.note === 'string' ? evidence.note : '');

/** Everything except that note — shown to owners as JSON, never dropped. @returns {Record<string, unknown>} */
export function evidenceExtra(evidence) {
  if (!isObject(evidence)) return {};
  const { note, ...rest } = evidence;
  return typeof note === 'string' ? rest : evidence;
}

/** A JSON-object textarea; empty means `{}`, null when invalid or not an object. @returns {Record<string, unknown> | null} */
export function parseJsonObject(text) {
  try {
    const value = text.trim() ? JSON.parse(text) : {};
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Evidence to save. `extraJson` is the owner's edited JSON of the other keys
 * (undefined for editors, who never see them). When those keys are unchanged,
 * `current`'s key order is kept so an untouched record doesn't look changed to
 * the server's JSON comparison. Null when `extraJson` is invalid.
 * @param {unknown} current @param {string} note @param {string} [extraJson]
 * @returns {Record<string, unknown> | null}
 */
export function buildEvidence(current, note, extraJson) {
  let base = isObject(current) ? current : {};
  if (extraJson !== undefined) {
    const extra = parseJsonObject(extraJson);
    if (!extra) return null;
    if (JSON.stringify(extra) !== JSON.stringify(evidenceExtra(base))) base = extra;
  }
  const next = { ...base };
  if (note.trim()) next.note = note;
  else if (typeof next.note === 'string') delete next.note;
  return next;
}
