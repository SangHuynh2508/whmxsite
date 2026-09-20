async function bodyBuffer(request) {
  if (Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === 'string') return Buffer.from(request.body);
  if (request.body && typeof request.body === 'object') {
    return Buffer.from(JSON.stringify(request.body));
  }
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

function requestUrl(request) {
  const host = String(request.headers?.['x-forwarded-host'] || request.headers?.host || 'localhost:3000')
    .split(',')[0]
    .trim();
  const protocol = String(request.headers?.['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const url = new URL(request.url || '/api/auth', `${protocol}://${host}`);
  const authPath = request.query?.authPath ?? url.searchParams.get('authPath');
  if (typeof authPath === 'string' && authPath) {
    url.pathname = `/api/auth/${authPath.split('/').map(encodeURIComponent).join('/')}`;
    url.searchParams.delete('authPath');
  }
  return url.toString();
}

function copyResponseHeaders(source, response) {
  const setCookies = typeof source.headers.getSetCookie === 'function' ? source.headers.getSetCookie() : [];
  for (const [name, value] of source.headers.entries()) {
    if (name.toLowerCase() !== 'set-cookie') response.setHeader(name, value);
  }
  if (setCookies.length) response.setHeader('Set-Cookie', setCookies);
  else {
    const setCookie = source.headers.get('set-cookie');
    if (setCookie) response.setHeader('Set-Cookie', setCookie);
  }
}

async function disabledLoginAttempt(request, body) {
  if (request.method !== 'POST' || !String(request.url || '').includes('/sign-in/email')) return false;
  let email;
  try {
    email = JSON.parse(body?.toString('utf8') || '{}').email;
  } catch {
    return false;
  }
  if (typeof email !== 'string') return false;
  const [{ getDb }, { users }, { and, eq }] = await Promise.all([
    import('../../db/client.mjs'),
    import('../../db/schema/auth.mjs'),
    import('drizzle-orm'),
  ]);
  const [user] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email.trim().toLowerCase()), eq(users.status, 'disabled')));
  return Boolean(user);
}

module.exports = async function authHandler(request, response) {
  const body = await bodyBuffer(request);
  try {
    if (await disabledLoginAttempt(request, body)) {
      return response.status(401).json({ code: 'INVALID_EMAIL_OR_PASSWORD' });
    }
    const { auth } = await import('../../server/auth.mjs');
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers || {})) {
      if (Array.isArray(value)) headers.set(name, value.join(', '));
      else if (value !== undefined) headers.set(name, String(value));
    }
    const init = { method: request.method, headers };
    if (body && !['GET', 'HEAD'].includes(request.method)) init.body = body;
    const result = await auth.handler(new Request(requestUrl(request), init));
    copyResponseHeaders(result, response);
    return response.status(result.status).send(Buffer.from(await result.arrayBuffer()));
  } catch {
    return response.status(500).json({ code: 'AUTH_OPERATION_FAILED' });
  }
};

module.exports.config = {
  api: {
    bodyParser: false,
  },
};
