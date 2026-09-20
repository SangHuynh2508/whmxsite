module.exports = async function adminSessionHandler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }
  try {
    const { authenticatedUser } = await import('../../server/admin-api.mjs');
    const user = await authenticatedUser(request, { requireOrigin: false });
    return response.status(200).json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      sessionExpiresAt: user.sessionExpiresAt,
    });
  } catch (error) {
    const { sendAdminError } = await import('../../server/admin-api.mjs');
    return sendAdminError(response, error);
  }
};
