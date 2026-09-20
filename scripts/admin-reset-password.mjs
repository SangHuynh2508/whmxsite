const email = process.env.ADMIN_PASSWORD_RESET_EMAIL?.trim();
const newPassword = process.env.ADMIN_PASSWORD_RESET_NEW_PASSWORD;

try {
  if (!email || !newPassword) throw new Error('INPUT_REQUIRED');
  const { resetAdminPassword } = await import('../server/admin-password-reset-domain.mjs');
  await resetAdminPassword({ email, newPassword });
  // Do not emit identity, password, hash, session, or database details.
  console.log('ADMIN_PASSWORD_RESET_COMPLETED');
} catch (error) {
  console.error(error?.code === 'USER_NOT_FOUND'
    ? 'ADMIN_PASSWORD_RESET_USER_NOT_FOUND'
    : 'ADMIN_PASSWORD_RESET_FAILED');
  process.exitCode = 1;
} finally {
  const { closeDb } = await import('../db/client.mjs');
  await closeDb().catch(() => undefined);
}
