import { api, json, requestId } from '../lib/api.js';

const enc = encodeURIComponent;
// server/admin-api-routes/builds.mjs
export const getBuilds = (characterId) => api(`/api/admin/builds/characters/${enc(characterId)}`);
export const createBuild = (characterId, doc) => api(`/api/admin/builds/characters/${enc(characterId)}`, json('POST', { doc, requestId: requestId() }));
export const saveBuild = (buildId, expectedRevision, doc) => api(`/api/admin/builds/${enc(buildId)}`, json('PATCH', { expectedRevision, doc, requestId: requestId() }));
export const deleteBuild = (buildId, expectedRevision) => api(`/api/admin/builds/${enc(buildId)}`, json('DELETE', { expectedRevision, requestId: requestId() }));
