import { api, json, requestId } from '../lib/api.js';

const enc = encodeURIComponent;
// server/admin-api-routes/tier-lists.mjs
export const listTierLists = () => api('/api/admin/tier-lists');
export const createTierList = (slug, title) => api('/api/admin/tier-lists', json('POST', { slug, title, requestId: requestId() }));
export const getTierList = (slug) => api(`/api/admin/tier-lists/${enc(slug)}`);
export const saveTierList = (slug, expectedRevision, patch) => api(`/api/admin/tier-lists/${enc(slug)}`, json('PATCH', { expectedRevision, ...patch, requestId: requestId() }));
export const deleteTierList = (slug, expectedRevision) => api(`/api/admin/tier-lists/${enc(slug)}`, json('DELETE', { expectedRevision, requestId: requestId() }));
