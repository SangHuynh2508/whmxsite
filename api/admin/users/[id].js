module.exports = async function adminUserHandler(request, response) {
  if (request.method !== 'PATCH') {
    response.setHeader('Allow', 'PATCH');
    return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }
  try {
    const [{ authenticatedUser, requestBody, requestId }, { updateAdminAccount }] = await Promise.all([
      import('../../../server/admin-api.mjs'),
      import('../../../server/admin/accounts/admin-account-domain.mjs'),
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
    const { sendAdminError } = await import('../../../server/admin-api.mjs');
    return sendAdminError(response, error);
  }
};

module.exports.config = { api: { bodyParser: false } };
