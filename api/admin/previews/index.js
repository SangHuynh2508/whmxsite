module.exports = async function previewListHandler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }
  try {
    const [{ authenticatedUser, requestBody, requestId }, { getDb }, previewRead, previewDomain] = await Promise.all([
      import('../../../server/admin-api.mjs'),
      import('../../../db/client.mjs'),
      import('../../../server/preview-characters/preview-character-read-domain.mjs'),
      import('../../../server/preview-characters/preview-character-domain.mjs'),
    ]);
    const user = await authenticatedUser(request, { requireOrigin: request.method === 'POST' });
    if (request.method === 'GET') {
      return response.status(200).json({ previews: await previewRead.listPreviewCharacters(request.query || {}) });
    }
    const body = await requestBody(request);
    const result = await getDb().transaction((tx) => previewDomain.createPreviewCharacter(tx, {
      ...body,
      actorUserId: user.id,
      requestId: requestId(body),
    }));
    return response.status(201).json(result);
  } catch (error) {
    const { sendAdminError } = await import('../../../server/admin-api.mjs');
    return sendAdminError(response, error);
  }
};

module.exports.config = { api: { bodyParser: false } };
