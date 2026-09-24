function pathSegments(request) {
  const pathname = String(request.url || '/api/admin').split('?')[0];
  const prefix = '/api/admin/';
  const suffix = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : '';
  return suffix.split('/').filter(Boolean).map(decodeURIComponent);
}

module.exports = async function adminApiDispatcher(request, response) {
  const [resource, ...rest] = pathSegments(request);

  try {
    switch (resource) {
      case 'characters': {
        const { characterList, characterDetail } = await import('../../server/admin-api-routes/characters.mjs');
        if (rest.length === 0) return characterList(request, response);
        request.query.characterId = rest[0];
        return characterDetail(request, response);
      }
      case 'skins': {
        const { skinIndex, skinDetail } = await import('../../server/admin-api-routes/skins.mjs');
        if (rest.length === 0) return skinIndex(request, response);
        request.query.skinId = rest[0];
        return skinDetail(request, response);
      }
      case 'users': {
        const { usersIndex, userDetail } = await import('../../server/admin-api-routes/users.mjs');
        if (rest.length === 0) return usersIndex(request, response);
        request.query.id = rest[0];
        return userDetail(request, response);
      }
      case 'previews': {
        const { previewList, previewDetail } = await import('../../server/admin-api-routes/previews.mjs');
        if (rest.length === 0) return previewList(request, response);
        request.query.id = rest[0];
        return previewDetail(request, response);
      }
      case 'assets': {
        const { uploadIntent, finalizeUpload } = await import('../../server/admin-api-routes/assets.mjs');
        if (rest.length === 1 && rest[0] === 'upload-intents') return uploadIntent(request, response);
        if (rest.length === 3 && rest[0] === 'upload-intents' && rest[2] === 'finalize') {
          request.query.id = rest[1];
          return finalizeUpload(request, response);
        }
        return response.status(404).json({ error: { code: 'NOT_FOUND' } });
      }
      case 'lore': {
        const { lorePublish } = await import('../../server/admin-api-routes/lore.mjs');
        if (rest.length === 1 && rest[0] === 'publish') return lorePublish(request, response);
        return response.status(404).json({ error: { code: 'NOT_FOUND' } });
      }
      default:
        return response.status(404).json({ error: { code: 'NOT_FOUND' } });
    }
  } catch (error) {
    const { sendAdminError } = await import('../../server/admin-api.mjs');
    return sendAdminError(response, error);
  }
};

module.exports.config = { api: { bodyParser: false } };
