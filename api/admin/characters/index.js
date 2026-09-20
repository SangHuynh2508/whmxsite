module.exports = async function characterListHandler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }
  try {
    const [{ authenticatedUser }, { listCharacters }] = await Promise.all([
      import('../../../server/admin-api.mjs'),
      import('../../../server/character-skin-admin-domain.mjs'),
    ]);
    await authenticatedUser(request, { requireOrigin: false });
    const rawQuery = request.query?.q || request.query?.query || '';
    const query = Array.isArray(rawQuery) ? rawQuery[0] || '' : String(rawQuery);
    return response.status(200).json({ characters: await listCharacters({ query }) });
  } catch (error) {
    const { sendAdminError } = await import('../../../server/admin-api.mjs');
    return sendAdminError(response, error);
  }
};
