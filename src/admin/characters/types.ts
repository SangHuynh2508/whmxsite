import type { HistoryEntry } from './components/HistoryList';

// Shapes returned by /api/admin/characters and /api/admin/skins (server/character-skin-admin-domain.mjs).
export type FieldState = { value: string | null; source: string | null; override: string | null; state: string };

export type Character = {
  entityId: string;
  characterId: string;
  revision: number;
  nameCn: string | null;
  fullnameCn: string | null;
  tagsCn: string | null;
  nameVi: FieldState;
  fullnameVi: FieldState;
  nicknameVi: FieldState;
  tagsVi: FieldState;
  protected?: Record<string, unknown> & { rawRare?: number | null; rawIdentity?: Record<string, unknown> | null };
};

export type Skin = {
  entityId: string;
  skinId: string;
  revision: number;
  skinNameCn: string | null;
  descriptionCn: string | null;
  obtainCn: string | null;
  skinNameVi: FieldState;
  descriptionVi: FieldState;
  obtainVi: FieldState;
  source?: Record<string, unknown>;
  relations?: {
    series?: { source: { seriesId: number; nameCn?: string; nameVi?: string } | null; overrideMode?: string | null; state?: string } | null;
    acquisition?: { source: { id: string; labelVi?: string; labelCn?: string | null } | null; state?: string } | null;
  };
  assets?: { assetRole: string; source: { url: string | null } | null; override: { url: string | null } | null; state: string }[];
};

export type CharacterData = { character: Character; skins: Skin[]; history: HistoryEntry[] };
export type ModuleProps = { data: CharacterData; reload: () => Promise<Character | null> };

export const RARE_LABEL: Record<number, string> = { 5: 'EXTRA', 4: 'SSR', 3: 'SR', 2: 'R', 1: 'N' };
