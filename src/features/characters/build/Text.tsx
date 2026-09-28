import type { Unit } from './buildView.mts';

// VI when translated, else CN with the untranslated dot (same convention as the lore tab). `id` lets a control be
// labelled by the name (aria-labelledby keeps lang="zh" for a Chinese name; spec §4.1).
export function Text({ unit, id }: { unit: Unit; id?: string }) {
  if (unit.untranslated) return <span id={id} className="build-cn" lang="zh">{unit.text}</span>;
  return id ? <span id={id}>{unit.text}</span> : <>{unit.text}</>;
}
