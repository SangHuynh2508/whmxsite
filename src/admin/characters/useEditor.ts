import { useCallback, useEffect, useReducer, useState } from 'react';
import { changedDraft, changesFor, conflictRows, draftToRestore, fieldValue } from './lib/fields.mts';
import { isSaveShortcut } from './lib/shortcut.mts';
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
  // Reads the saved version without replacing the editor's record (for "Xem khác biệt" after a 409).
  peek?: () => Promise<Rec | null>;
};
type DirtyFlag = { __whmxAdminDirty?: boolean };
const valuesOf = (record: Rec | null, keys: string[]) => Object.fromEntries(keys.map((k) => [k, fieldValue(record, k)]));

export function useEditor({ scope, id, record, keys, save, reload, peek }: Args) {
  const key = draftKey(scope, id);
  const [state, dispatch] = useReducer(editorReducer, initialEditor(valuesOf(record, keys), record));
  // Until the hydrate for a newly loaded record lands, the draft belongs to the previous one: no changes, no draft write.
  const synced = state.source === record;
  const changes = synced ? changesFor(state.draft, record ?? {}, keys) : {};
  const dirtyCount = Object.keys(changes).length;
  const [diff, setDiff] = useState<ReturnType<typeof conflictRows> | null>(null);

  useEffect(() => {
    if (!record) return; // still loading: ask about a draft once, when there is something to restore it onto
    setDiff(null);
    dispatch({ type: 'hydrate', draft: valuesOf(record, keys), source: record });
    const restore = draftToRestore(loadDraft(localStorage, key), record, keys);
    if (!restore) { clearDraft(localStorage, key); return; }
    // Ask after this render has painted (never inside a view-transition update). StrictMode's
    // mount → unmount → mount cancels the first timer, so the question is asked once.
    const timer = setTimeout(() => {
      if (confirm('Có bản nháp chưa lưu. Khôi phục?')) dispatch({ type: 'hydrate', draft: restore, source: record });
      else clearDraft(localStorage, key); // declined once, don't ask on every open
    }, 0);
    return () => clearTimeout(timer);
  }, [key, record]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!synced) return;
    if (dirtyCount) saveDraft(localStorage, key, changedDraft(state.draft, record ?? {}, keys));
    else if (state.edited) clearDraft(localStorage, key); // typed, then undone by hand: nothing to restore
  }, [key, state.draft, state.edited, dirtyCount, synced, record, keys]);

  const onSave = useCallback(async () => {
    if (!dirtyCount || state.status === 'saving') return;
    dispatch({ type: 'saveStart' });
    try { await save(changes); } catch (error) { dispatch({ type: 'saveFail', error }); return; }
    clearDraft(localStorage, key);
    try { dispatch({ type: 'saveOk', draft: valuesOf(await reload(), keys) }); }
    catch { dispatch({ type: 'saveFail', error: { savedButStale: true } }); } // saved; only the refresh failed
  }, [dirtyCount, state.status, changes, save, reload, key, keys]);

  const onDiscard = () => { clearDraft(localStorage, key); dispatch({ type: 'discard', draft: valuesOf(record, keys) }); };
  // After a 409: load the other person's version; the typed text stays in the browser draft and is offered back.
  const onReload = () => { void reload(); };

  // Unsaved-change guards: Ctrl+S, tab close, and a flag read by in-app navigation.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (isSaveShortcut(event, location.hash)) { event.preventDefault(); void onSave(); } };
    const onUnload = (event: BeforeUnloadEvent) => { if (dirtyCount) { event.preventDefault(); event.returnValue = ''; } };
    (window as DirtyFlag).__whmxAdminDirty = dirtyCount > 0;
    addEventListener('keydown', onKey);
    addEventListener('beforeunload', onUnload);
    return () => { removeEventListener('keydown', onKey); removeEventListener('beforeunload', onUnload); (window as DirtyFlag).__whmxAdminDirty = false; };
  }, [onSave, dirtyCount]);

  const setField = useCallback((k: string, v: string) => dispatch({ type: 'edit', key: k, value: v }), []);
  const onShowDiff = peek ? async () => setDiff(conflictRows(state.draft, record ?? {}, (await peek()) ?? {}, keys)) : undefined;
  return { diff, onShowDiff, onHideDiff: () => setDiff(null), draft: state.draft, changes, setField, dirtyCount, status: state.status, message: state.message, onSave, onDiscard, onReload };
}
