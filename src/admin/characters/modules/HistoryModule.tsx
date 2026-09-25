import { HistoryList } from '../components/HistoryList';
import { CHARACTER_FIELD_LABELS } from './OverviewModule';
import { SKIN_FIELD_LABELS } from './SkinsModule';
import type { ModuleProps } from '../types';

// Every edit on the character and its skins, newest first. Skin rows are prefixed with the skin ID.
export function HistoryModule({ data }: ModuleProps) {
  const skinIdByEntity = new Map(data.skins.map((s) => [s.entityId, s.skinId]));
  const entries = data.history.map((h) => {
    const skinId = skinIdByEntity.get(h.entityId);
    return skinId ? { ...h, fieldName: `${skinId} · ${SKIN_FIELD_LABELS[h.fieldName] ?? h.fieldName}` } : h;
  });
  return (
    <div className="min-h-0 flex-1 lg:overflow-y-auto">
      <HistoryList entries={entries} labels={CHARACTER_FIELD_LABELS} />
    </div>
  );
}
