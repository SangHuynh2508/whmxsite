module.exports = async function skinListHandler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }
  try {
    const [{ authenticatedUser }, domain] = await Promise.all([
      import('../../../server/admin-api.mjs'),
      import('../../../server/character-skin-admin-domain.mjs'),
    ]);
    await authenticatedUser(request, { requireOrigin: false });
    const rawId = request.query?.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id) return response.status(422).json({ error: { code: 'VALIDATION_FAILED' } });
    return response.status(200).json(await domain.getSkin(id));
  } catch (error) {
    const { sendAdminError } = await import('../../../server/admin-api.mjs');
    return sendAdminError(response, error);
  }
};
