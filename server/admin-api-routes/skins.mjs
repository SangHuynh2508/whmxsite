export async function skinIndex(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }
  try {
    const [{ authenticatedUser }, domain] = await Promise.all([
      import('../admin-api.mjs'),
      import('../character-skin-admin-domain.mjs'),
    ]);
    await authenticatedUser(request, { requireOrigin: false });
    const rawId = request.query?.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id) return response.status(422).json({ error: { code: 'VALIDATION_FAILED' } });
    return response.status(200).json(await domain.getSkin(id));
  } catch (error) {
    const { sendAdminError } = await import('../admin-api.mjs');
    return sendAdminError(response, error);
  }
}

export async function skinDetail(request, response) {
  if (!['GET', 'PATCH'].includes(request.method)) {
    response.setHeader('Allow', 'GET, PATCH');
    return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }
  try {
    const [{ authenticatedUser, requestBody, requestId }, domain] = await Promise.all([
      import('../admin-api.mjs'),
      import('../character-skin-admin-domain.mjs'),
    ]);
    const user = await authenticatedUser(request, { requireOrigin: request.method !== 'GET' });
    const rawSkinId = request.query?.skinId;
    const skinId = Array.isArray(rawSkinId) ? rawSkinId[0] : rawSkinId;
    if (request.method === 'GET') return response.status(200).json(await domain.getSkin(skinId));
    const body = await requestBody(request);
    return response.status(200).json(await domain.updateSkin(skinId, { ...body, actorUserId: user.id, requestId: requestId(body) }));
  } catch (error) {
    const { sendAdminError } = await import('../admin-api.mjs');
    return sendAdminError(response, error);
  }
}
