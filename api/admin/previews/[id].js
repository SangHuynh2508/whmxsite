module.exports = async function previewDetailHandler(request, response) {
  if (!['GET', 'PATCH'].includes(request.method)) {
    response.setHeader('Allow', 'GET, PATCH');
    return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }
  try {
    const [{ authenticatedUser, requestBody, requestId }, previewOperations] = await Promise.all([
      import('../../../server/admin-api.mjs'),
      import('../../../server/preview-characters/preview-character-operations.mjs'),
    ]);
    const user = await authenticatedUser(request, { requireOrigin: request.method === 'PATCH' });
    const entityId = request.query?.id;
    if (typeof entityId !== 'string') return response.status(400).json({ error: { code: 'INVALID_PREVIEW_ID' } });
    if (request.method === 'GET') {
      const preview = await previewOperations.getPreviewCharacter(entityId);
      if (!preview) return response.status(404).json({ error: { code: 'NOT_FOUND' } });
      return response.status(200).json({ preview });
    }
    const body = await requestBody(request);
    const base = { ...body, actorUserId: user.id, entityId, requestId: requestId(body) };
    let result;
    if (body.lifecycle !== undefined || body.visibility !== undefined) {
      result = await previewOperations.setPreviewPublicationState({
        ...base,
        lifecycle: body.lifecycle,
        visibility: body.visibility,
      });
    } else {
      result = await previewOperations.updatePreviewCharacter(base);
    }
    return response.status(200).json(result);
  } catch (error) {
    const { sendAdminError } = await import('../../../server/admin-api.mjs');
    return sendAdminError(response, error);
  }
};

module.exports.config = { api: { bodyParser: false } };
