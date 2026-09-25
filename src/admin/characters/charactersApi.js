import { api, json, requestId } from '../lib/api.js';

const enc = encodeURIComponent;
export const listCharacters = () => api('/api/admin/characters').then((data) => data.characters || []);
export const getCharacter = (id) => api(`/api/admin/characters/${enc(id)}`);
export const patchCharacter = (id, { expectedRevision, changes }) =>
  api(`/api/admin/characters/${enc(id)}`, json('PATCH', { expectedRevision, changes, requestId: requestId() }));
export const getSkin = (id) => api(`/api/admin/skins/${enc(id)}`);
export const patchSkin = (id, { expectedRevision, changes }) =>
  api(`/api/admin/skins/${enc(id)}`, json('PATCH', { expectedRevision, changes, requestId: requestId() }));
