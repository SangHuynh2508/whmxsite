const { timingSafeEqual } = require('node:crypto');

function hasExpectedBearerToken(request) {
  const secret = process.env.DB_HEALTHCHECK_SECRET;
  const authorization = request.headers.authorization || '';
  const expected = `Bearer ${secret || ''}`;

  if (!secret || authorization.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(authorization), Buffer.from(expected));
}

module.exports = async function databaseHealthHandler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }

  if (!hasExpectedBearerToken(request)) {
    return response.status(401).json({ error: { code: 'UNAUTHORIZED' } });
  }

  try {
    const { checkDatabaseHealth } = await import('../../db/client.mjs');
    await checkDatabaseHealth();
    return response.status(200).json({ ok: true });
  } catch {
    return response.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE' } });
  }
};
