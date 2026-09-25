import { useCallback, useEffect, useReducer } from 'react';
import { changesFor, fieldValue } from './lib/fields.mts';
import { clearDraft, draftKey, loadDraft, saveDraft } from './lib/draft.mts';
import { editorReducer, initialEditor } from './lib/editorState.mts';

type Rec = Record<string, unknown>;
type Args = {
  scope: string;
  id: string;
  record: Rec | null;
  keys: string[];
  save: (changes: Record<string, string | null>) => Promise<unknown>;
  // Returns the freshly loaded record so the editor shows exactly what the server stored.
  reload: () => Promise<Rec | null>;
};
type DirtyFlag = { __whmxAdminDirty?: boolean };
const valuesOf = (record: Rec | null, keys: string[]) => Object.fromEntries(keys.map((k) => [k, fieldValue(record, k)]));

export function useEditor({ scope, id, record, keys, save, reload }: Args) {
  const key = draftKey(scope, id);
  const [state, dispatch] = useReducer(editorReducer, initialEditor(valuesOf(record, keys), record));
  // Until the hydrate for a newly loaded record lands, the draft belongs to the previous one: no changes, no draft write.
  const synced = state.source === record;
  const changes = synced ? changesFor(state.draft, record ?? {}, keys) : {};
  const dirtyCount = Object.keys(changes).length;

  useEffect(() => {
    const stored = loadDraft(localStorage, key);
    const restore = Boolean(stored) && confirm('Có bản nháp chưa lưu. Khôi phục?');
    if (stored && !restore) clearDraft(localStorage, key); // declined once, don't ask on every open
    dispatch({ type: 'hydrate', draft: restore && stored ? stored : valuesOf(record, keys), source: record });
  }, [key, record]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (dirtyCount) saveDraft(localStorage, key, state.draft); }, [key, state.draft, dirtyCount]);

  const onSave = useCallback(async () => {
    if (!dirtyCount || state.status === 'saving') return;
    dispatch({ type: 'saveStart' });
    try {
      await save(changes);
      clearDraft(localStorage, key);
      dispatch({ type: 'saveOk', draft: valuesOf(await reload(), keys) });
    } catch (error) {
      dispatch({ type: 'saveFail', error });
    }
  }, [dirtyCount, state.status, changes, save, reload, key, keys]);

  const onDiscard = () => { clearDraft(localStorage, key); dispatch({ type: 'discard', draft: valuesOf(record, keys) }); };
  // After a 409: load the other person's version; the typed text stays in the browser draft and is offered back.
  const onReload = () => { void reload(); };

  // Unsaved-change guards: Ctrl+S, tab close, and a flag read by in-app navigation.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key === 's') { event.preventDefault(); void onSave(); } };
    const onUnload = (event: BeforeUnloadEvent) => { if (dirtyCount) { event.preventDefault(); event.returnValue = ''; } };
    (window as DirtyFlag).__whmxAdminDirty = dirtyCount > 0;
    addEventListener('keydown', onKey);
    addEventListener('beforeunload', onUnload);
    return () => { removeEventListener('keydown', onKey); removeEventListener('beforeunload', onUnload); (window as DirtyFlag).__whmxAdminDirty = false; };
  }, [onSave, dirtyCount]);

  const setField = useCallback((k: string, v: string) => dispatch({ type: 'edit', key: k, value: v }), []);
  return { draft: state.draft, changes, setField, dirtyCount, status: state.status, message: state.message, onSave, onDiscard, onReload };
}
