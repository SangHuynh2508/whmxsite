import { saveErrorMessage } from './saveError.mts';

export type EditorStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';
export type EditorState = { draft: Record<string, string>; status: EditorStatus; message: string };
export type EditorAction =
  | { type: 'edit'; key: string; value: string }
  | { type: 'hydrate' | 'saveOk' | 'discard'; draft: Record<string, string> }
  | { type: 'saveStart' }
  | { type: 'saveFail'; error: unknown };

export const initialEditor = (draft: Record<string, string>): EditorState => ({ draft, status: 'idle', message: '' });

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'edit': return { ...state, draft: { ...state.draft, [action.key]: action.value }, status: state.status === 'saved' ? 'idle' : state.status };
    // A reload right after saving re-hydrates; keep the "saved" feedback.
    case 'hydrate': return state.status === 'saved' ? { ...state, draft: action.draft } : initialEditor(action.draft);
    case 'saveStart': return { ...state, status: 'saving', message: '' };
    case 'saveOk': return { draft: action.draft, status: 'saved', message: 'Đã lưu.' };
    case 'discard': return initialEditor(action.draft);
    // The typed draft is never touched on failure (409, 401, network): nothing is lost.
    case 'saveFail': {
      const status = (action.error as { status?: number })?.status === 409 ? 'conflict' : 'error';
      return { ...state, status, message: saveErrorMessage(action.error) };
    }
  }
}
