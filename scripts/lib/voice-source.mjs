// scripts/lib/voice-source.mjs
// Pure: one public/voice/<ID>.json → profile_texts units (spec 2026-11-19-voice-translation §4).
// Main pack = langs[0]: voice.<skin>.<type>. Another pack gets voice.<skin>.<type>.<lang> only when its CN differs (V1).
import { createHash } from 'node:crypto';

const sha = (text) => createHash('sha256').update(text).digest('hex');
const clean = (value) => String(value ?? '').trim();

export function voiceUnits(doc) {
  const units = [];
  const unlocks = new Set();
  const [main] = doc?.langs ?? [];
  const mainCn = new Map((main?.lines ?? []).map((l) => [`${l.skin}.${l.type}`, clean(l.text)]));
  for (const lang of doc?.langs ?? []) {
    for (const l of lang.lines ?? []) {
      if (clean(l.unlock)) unlocks.add(clean(l.unlock));
      const cn = clean(l.text);
      const base = `${l.skin}.${l.type}`;
      if (!cn || (lang !== main && cn === mainCn.get(base))) continue;
      units.push({ unitKey: `voice.${base}${lang === main ? '' : `.${lang.lang}`}`, sourceCn: cn, sourceRef: `voice:${doc.id}/${lang.lang}/${l.skin}/${l.type}`, sourceHash: sha(cn) });
    }
  }
  return { units, unlocks: [...unlocks].sort() };
}

// VOICE_UNLOCK_<n>: an existing text keeps its code (matched by name_cn); new texts, in CN order, take the next numbers.
export function assignUnlockCodes(cns, existing) {
  let next = Math.max(0, ...[...existing.values()].map((code) => Number(String(code).replace('VOICE_UNLOCK_', '')) || 0));
  return new Map([...new Set(cns)].sort().map((cn) => [cn, existing.get(cn) ?? `VOICE_UNLOCK_${++next}`]));
}
