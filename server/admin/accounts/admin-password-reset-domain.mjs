import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { getDb } from '../../../db/client.mjs';
import { accounts, users } from '../../../db/schema/auth.mjs';
import { createPasswordRecoveryAuth, internalAuthHeaders } from '../../auth.mjs';

const resetInput = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  newPassword: z.string().min(12).max(128),
});

export class AdminPasswordResetError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = 'AdminPasswordResetError';
    this.code = code;
    this.status = status;
  }
}

function domainError(code, status) {
  throw new AdminPasswordResetError(code, status);
}

export async function resetAdminPassword(rawInput) {
  const input = resetInput.parse(rawInput);
  const db = getDb();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email));
  if (!user) domainError('USER_NOT_FOUND', 404);

  const [credential] = await db
    .select({ id: accounts.id, password: accounts.password })
    .from(accounts)
    .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, 'credential')));
  if (!credential?.password) domainError('CREDENTIAL_ACCOUNT_NOT_FOUND', 400);

  let resetToken;
  const recoveryAuth = createPasswordRecoveryAuth(async ({ token }) => {
    resetToken = token;
  });

  try {
    await recoveryAuth.api.requestPasswordReset({
      body: { email: input.email },
      headers: internalAuthHeaders(),
    });
    if (!resetToken) domainError('PASSWORD_RESET_FAILED', 400);
    await recoveryAuth.api.resetPassword({
      body: { token: resetToken, newPassword: input.newPassword },
      headers: internalAuthHeaders(),
    });
  } catch (error) {
    if (error instanceof AdminPasswordResetError) throw error;
    domainError('PASSWORD_RESET_FAILED', 400);
  }

  // Better Auth's recovery configuration revokes all existing sessions during
  // reset. This flow never creates a replacement session.
  return { userId: user.id };
}
