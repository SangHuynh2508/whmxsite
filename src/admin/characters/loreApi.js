import { api, json, requestId } from '../lib/api.js';

const enc = encodeURIComponent;
export const getLore = (id) => api(`/api/admin/lore/characters/${enc(id)}`);
export const patchLore = (id, { expectedRevision, texts }) => api(`/api/admin/lore/characters/${enc(id)}`, json('PATCH', { expectedRevision, texts, requestId: requestId() }));
export const getLoreProgress = () => api('/api/admin/lore/progress').then((d) => d.progress);
export const getLoreTerms = () => api('/api/admin/lore/terms').then((d) => d.terms);
export const patchLoreTerm = (code, { expectedRevision, nameVi, detailVi }) => api(`/api/admin/lore/terms/${enc(code)}`, json('PATCH', { expectedRevision, nameVi, detailVi, requestId: requestId() }));
export const publishLore = () => api('/api/admin/lore/publish', json('POST', {}));
