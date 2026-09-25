import { saveErrorMessage } from './saveError.mts';

export type EditorStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';
// `source` is the record the draft was hydrated from (identity only).
export type EditorState = { draft: Record<string, string>; status: EditorStatus; message: string; source?: unknown };
export type EditorAction =
  | { type: 'edit'; key: string; value: string }
  | { type: 'hydrate'; draft: Record<string, string>; source?: unknown }
  | { type: 'saveOk' | 'discard'; draft: Record<string, string> }
  | { type: 'saveStart' }
  | { type: 'saveFail'; error: unknown };

export const initialEditor = (draft: Record<string, string>, source?: unknown): EditorState => ({ draft, status: 'idle', message: '', source });

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'edit': {
      const draft = { ...state.draft, [action.key]: action.value };
      return state.status === 'saved' ? { ...state, draft, status: 'idle', message: '' } : { ...state, draft };
    }
    // A reload right after saving re-hydrates; keep the "saved" feedback.
    case 'hydrate': return state.status === 'saved' ? { ...state, draft: action.draft, source: action.source } : initialEditor(action.draft, action.source);
    case 'saveStart': return { ...state, status: 'saving', message: '' };
    case 'saveOk': return { ...state, draft: action.draft, status: 'saved', message: 'Đã lưu.' };
    case 'discard': return initialEditor(action.draft, state.source);
    // The typed draft is never touched on failure (409, 401, network): nothing is lost.
    case 'saveFail': {
      const status = (action.error as { status?: number })?.status === 409 ? 'conflict' : 'error';
      return { ...state, status, message: saveErrorMessage(action.error) };
    }
  }
}
