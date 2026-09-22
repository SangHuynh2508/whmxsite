export async function characterList(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }
  try {
    const [{ authenticatedUser }, { listCharacters }] = await Promise.all([
      import('../admin-api.mjs'),
      import('../character-skin-admin-domain.mjs'),
    ]);
    await authenticatedUser(request, { requireOrigin: false });
    const rawQuery = request.query?.q || request.query?.query || '';
    const query = Array.isArray(rawQuery) ? rawQuery[0] || '' : String(rawQuery);
    return response.status(200).json({ characters: await listCharacters({ query }) });
  } catch (error) {
    const { sendAdminError } = await import('../admin-api.mjs');
    return sendAdminError(response, error);
  }
}

export async function characterDetail(request, response) {
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
    const rawCharacterId = request.query?.characterId;
    const characterId = Array.isArray(rawCharacterId) ? rawCharacterId[0] : rawCharacterId;
    if (request.method === 'GET') return response.status(200).json(await domain.getCharacter(characterId));
    const body = await requestBody(request);
    return response.status(200).json(await domain.updateCharacter(characterId, { ...body, actorUserId: user.id, requestId: requestId(body) }));
  } catch (error) {
    const { sendAdminError } = await import('../admin-api.mjs');
    return sendAdminError(response, error);
  }
}
