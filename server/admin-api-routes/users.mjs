export async function usersIndex(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }
  try {
    const [{ authenticatedUser, requestBody, requestId }, { listAdminAccounts, provisionAdminAccount }] = await Promise.all([
      import('../admin-api.mjs'),
      import('../admin/accounts/admin-account-domain.mjs'),
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
    const { sendAdminError } = await import('../admin-api.mjs');
    return sendAdminError(response, error);
  }
}

export async function userDetail(request, response) {
  if (request.method !== 'PATCH') {
    response.setHeader('Allow', 'PATCH');
    return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }
  try {
    const [{ authenticatedUser, requestBody, requestId }, { updateAdminAccount }] = await Promise.all([
      import('../admin-api.mjs'),
      import('../admin/accounts/admin-account-domain.mjs'),
    ]);
    const user = await authenticatedUser(request);
    const body = await requestBody(request);
    const subjectUserId = request.query?.id;
    if (typeof subjectUserId !== 'string') return response.status(400).json({ error: { code: 'INVALID_USER_ID' } });
    const account = await updateAdminAccount({
      ...body,
      actorUserId: user.id,
      subjectUserId,
      requestId: requestId(body),
    });
    return response.status(200).json({ user: account });
  } catch (error) {
    const { sendAdminError } = await import('../admin-api.mjs');
    return sendAdminError(response, error);
  }
}
