module.exports = async function adminSessionHandler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }
  // Public pages ask this on every load. "Not signed in" is a normal answer, not an
  // error: also when auth is not configured for this deployment (no DB/auth env vars).
  // `vercel dev` skips `.env.local`, where the local DB/auth vars live: load it before checking.
  await import('../../server/load-local-env.mjs');
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) {
    return response.status(200).json({ authenticated: false });
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
    if (error?.status === 401) return response.status(200).json({ authenticated: false });
    const { sendAdminError } = await import('../../server/admin-api.mjs');
    return sendAdminError(response, error);
  }
};
