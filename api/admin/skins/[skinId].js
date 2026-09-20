module.exports = async function skinDetailHandler(request, response) {
  if (!['GET', 'PATCH'].includes(request.method)) {
    response.setHeader('Allow', 'GET, PATCH');
    return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }
  try {
    const [{ authenticatedUser, requestBody, requestId }, domain] = await Promise.all([
      import('../../../server/admin-api.mjs'),
      import('../../../server/character-skin-admin-domain.mjs'),
    ]);
    const user = await authenticatedUser(request, { requireOrigin: request.method !== 'GET' });
    const rawSkinId = request.query?.skinId;
    const skinId = Array.isArray(rawSkinId) ? rawSkinId[0] : rawSkinId;
    if (request.method === 'GET') return response.status(200).json(await domain.getSkin(skinId));
    const body = await requestBody(request);
    return response.status(200).json(await domain.updateSkin(skinId, { ...body, actorUserId: user.id, requestId: requestId(body) }));
  } catch (error) {
    const { sendAdminError } = await import('../../../server/admin-api.mjs');
    return sendAdminError(response, error);
  }
};

module.exports.config = { api: { bodyParser: false } };
