import { saveErrorMessage } from './saveError.mts';

export type EditorStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';
// `source` is the record the draft was hydrated from (identity only).
export type EditorState = { draft: Record<string, string>; status: EditorStatus; message: string; source?: unknown; edited: boolean; confirmed: string[] };
export type EditorAction =
  | { type: 'edit'; key: string; value: string }
  | { type: 'confirm'; key: string }
  | { type: 'hydrate'; draft: Record<string, string>; source?: unknown }
  | { type: 'saveOk' | 'discard'; draft: Record<string, string> }
  | { type: 'saveStart' }
  | { type: 'saveFail'; error: unknown };

export const initialEditor = (draft: Record<string, string>, source?: unknown): EditorState => ({ draft, status: 'idle', message: '', source, edited: false, confirmed: [] });

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'edit': {
      const draft = { ...state.draft, [action.key]: action.value };
      return { ...(state.status === 'saved' ? { ...state, status: 'idle' as const, message: '' } : state), draft, edited: true };
    }
    case 'confirm': return state.confirmed.includes(action.key) ? state : { ...state, confirmed: [...state.confirmed, action.key] };
    // A reload right after saving re-hydrates; keep the "saved" feedback.
    case 'hydrate': return state.status === 'saved' ? { ...state, draft: action.draft, source: action.source, edited: false, confirmed: [] } : initialEditor(action.draft, action.source);
    case 'saveStart': return { ...state, status: 'saving', message: '' };
    case 'saveOk': return { ...state, draft: action.draft, status: 'saved', message: 'Đã lưu.', edited: false, confirmed: [] };
    case 'discard': return initialEditor(action.draft, state.source);
    // The typed draft is never touched on failure (409, 401, network): nothing is lost.
    case 'saveFail': {
      const e = action.error as { status?: number; savedButStale?: boolean } | null;
      const status = e?.status === 409 || e?.savedButStale ? 'conflict' : 'error';
      return { ...state, status, message: saveErrorMessage(action.error) };
    }
  }
}
