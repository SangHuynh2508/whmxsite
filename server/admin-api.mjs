import { randomUUID } from 'node:crypto';

import { fromNodeHeaders } from 'better-auth/node';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client.mjs';
import { users } from '../db/schema/auth.mjs';
import { AdminAccountDomainError } from './admin/accounts/admin-account-domain.mjs';
import { auth } from './auth.mjs';
import { ManagedAssetError } from './assets/r2-managed-assets.mjs';
import { PreviewDomainError } from './preview-characters/preview-character-domain.mjs';
import { CharacterSkinDomainError } from './character-skin-admin-domain.mjs';

export class AdminApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.code = code;
  }
}

function header(request, name) {
  return request.headers?.[name] || request.headers?.get?.(name) || '';
}

export function assertSameOrigin(request) {
  const origin = header(request, 'origin');
  const host = (header(request, 'x-forwarded-host') || header(request, 'host')).split(',')[0].trim();
  if (!origin || !host) throw new AdminApiError(403, 'ORIGIN_REQUIRED', 'A same-origin request is required.');
  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    throw new AdminApiError(403, 'ORIGIN_REQUIRED', 'A same-origin request is required.');
  }
  if (parsedOrigin.host !== host || !isApprovedOrigin(parsedOrigin)) {
    throw new AdminApiError(403, 'ORIGIN_REQUIRED', 'A same-origin request is required.');
  }
}

function isApprovedOrigin(origin) {
  const configured = process.env.BETTER_AUTH_ALLOWED_HOSTS || 'localhost:5173,localhost:3000';
  const hosts = configured.split(',').map((value) => value.trim()).filter(Boolean);
  if (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:') return false;
  return hosts.some((allowed) => {
    const candidate = origin.host.toLowerCase();
    const normalized = allowed.toLowerCase();
    return normalized.startsWith('*.')
      ? candidate.endsWith(normalized.slice(1)) && candidate.length > normalized.length - 1
      : candidate === normalized;
  });
}

export async function authenticatedUser(request, { requireOrigin = true } = {}) {
  if (requireOrigin) assertSameOrigin(request);
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!session?.user?.id) throw new AdminApiError(401, 'UNAUTHORIZED', 'Authentication is required.');
  const [user] = await getDb()
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, session.user.id));
  if (!user) throw new AdminApiError(401, 'UNAUTHORIZED', 'Authentication is required.');
  if (user.status !== 'active') throw new AdminApiError(403, 'ACCOUNT_DISABLED', 'This account is disabled.');
  return { ...user, sessionExpiresAt: session.session?.expiresAt ?? null };
}

export async function requestBody(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  if (typeof request.body === 'string') {
    try {
      return JSON.parse(request.body);
    } catch {
      throw new AdminApiError(400, 'INVALID_JSON', 'The request body is invalid.');
    }
  }
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new AdminApiError(400, 'INVALID_JSON', 'The request body is invalid.');
  }
}

export function requestId(body) {
  return typeof body.requestId === 'string' && body.requestId ? body.requestId : randomUUID();
}

export function sendAdminError(response, error) {
  if (error instanceof AdminApiError) return response.status(error.status).json({ error: { code: error.code } });
  if (error?.name === 'ZodError') return response.status(422).json({ error: { code: 'VALIDATION_ERROR' } });
  if (error instanceof PreviewDomainError || error instanceof ManagedAssetError) {
    const status = error.code === 'FORBIDDEN' ? 403 : error.code === 'NOT_FOUND' ? 404 : error.code === 'VERSION_CONFLICT' ? 409 : 400;
    return response.status(status).json({ error: { code: error.code } });
  }
  if (error instanceof AdminAccountDomainError) {
    return response.status(error.status).json({ error: { code: error.code } });
  }
  if (error instanceof CharacterSkinDomainError) {
    const status = error.status || (error.code === 'NOT_FOUND' ? 404 : error.code === 'VERSION_CONFLICT' ? 409 : error.code === 'FORBIDDEN' ? 403 : 400);
    return response.status(status).json({ error: { code: error.code, ...(error.details ? { details: error.details } : {}) } });
  }
  return response.status(500).json({ error: { code: 'INTERNAL_ERROR' } });
}
