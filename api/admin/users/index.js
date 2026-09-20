module.exports = async function adminUsersHandler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }
  try {
    const [{ authenticatedUser, requestBody, requestId }, { listAdminAccounts, provisionAdminAccount }] = await Promise.all([
      import('../../../server/admin-api.mjs'),
      import('../../../server/admin-account-domain.mjs'),
    ]);
    const user = await authenticatedUser(request, { requireOrigin: request.method !== 'GET' });
    if (request.method === 'GET') {
      const accounts = await listAdminAccounts(user.id);
      return response.status(200).json({ users: accounts });
    }
    const body = await requestBody(request);
    const account = await provisionAdminAccount({ ...body, actorUserId: user.id, requestId: requestId(body) });
    return response.status(201).json({ user: account });
  } catch (error) {
    const { sendAdminError } = await import('../../../server/admin-api.mjs');
    return sendAdminError(response, error);
  }
};

module.exports.config = { api: { bodyParser: false } };
